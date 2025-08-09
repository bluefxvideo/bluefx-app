/**
 * Hedra API Webhook Handler
 * 
 * Handles webhook notifications from Hedra API when video generation is complete.
 * Updates database records and broadcasts real-time updates to users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { uploadImageToStorage } from '@/actions/supabase-storage';

interface HedraWebhookPayload {
  id: string;
  status: 'complete' | 'error' | 'processing';
  generated_video_url?: string;
  error_message?: string;
  metadata?: {
    user_id?: string;
    avatar_video_id?: string;
    text_prompt?: string;
    aspect_ratio?: string;
    resolution?: string;
  };
}

/**
 * Verify webhook signature (if Hedra provides one)
 */
async function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    return true; // Skip verification if no signature/secret
  }

  // Implement signature verification based on Hedra's method
  // This would typically involve HMAC verification
  try {
    const crypto = await import('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return signature === `sha256=${expectedSignature}`;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}

/**
 * Download and store Hedra generated video
 */
async function storeGeneratedVideo(
  videoUrl: string,
  avatarVideoId: string
): Promise<string | null> {
  try {
    console.log('📥 Downloading video from Hedra:', videoUrl);

    // Download video from Hedra
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const videoBlob = await response.blob();
    const videoFile = new File([videoBlob], `avatar_video_${avatarVideoId}.mp4`, {
      type: 'video/mp4',
    });

    // Upload to Supabase Storage
    const uploadResult = await uploadImageToStorage(videoFile, {
      bucket: 'videos',
      folder: 'avatar-videos',
      filename: `avatar_video_${avatarVideoId}.mp4`,
      contentType: 'video/mp4',
    });

    if (!uploadResult.success) {
      throw new Error(`Video upload failed: ${uploadResult.error}`);
    }

    console.log('✅ Video stored successfully:', uploadResult.url);
    return uploadResult.url || null;

  } catch (error) {
    console.error('❌ Failed to store video:', error);
    return null;
  }
}

/**
 * Update avatar video record in database
 */
async function updateAvatarVideoRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  avatarVideoId: string,
  status: string,
  videoUrl?: string,
  errorMessage?: string
) {
  try {
    const updateData: {
      status: string;
      updated_at: string;
      video_url?: string;
      completed_at?: string;
      error_message?: string;
      failed_at?: string;
    } = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed' && videoUrl) {
      updateData.video_url = videoUrl;
      updateData.completed_at = new Date().toISOString();
    } else if (status === 'failed' && errorMessage) {
      updateData.error_message = errorMessage;
      updateData.failed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('avatar_videos')
      .update(updateData)
      .eq('id', avatarVideoId);

    if (error) {
      throw error;
    }

    console.log(`✅ Avatar video ${avatarVideoId} updated to ${status}`);

    // Get user_id for real-time notification
    const { data: avatarVideo } = await supabase
      .from('avatar_videos')
      .select('user_id')
      .eq('id', avatarVideoId)
      .single();

    // Broadcast real-time update
    if (avatarVideo?.user_id) {
      const channel = supabase.channel(`avatar_videos:${avatarVideo.user_id}`);
      
      await channel.send({
        type: 'broadcast',
        event: 'avatar_video_updated',
        payload: {
          id: avatarVideoId,
          status,
          video_url: videoUrl,
          error_message: errorMessage,
        },
      });

      console.log(`📡 Real-time update sent to user ${avatarVideo.user_id}`);
    }

  } catch (error) {
    console.error('❌ Failed to update avatar video record:', error);
    throw error;
  }
}

/**
 * Process webhook payload
 */
async function processWebhook(payload: HedraWebhookPayload) {
  const supabase = await createClient();

  console.log('🎬 Processing Hedra webhook:', {
    id: payload.id,
    status: payload.status,
    hasVideo: !!payload.generated_video_url,
  });

  // Find avatar video record by hedra_generation_id
  const { data: avatarVideo, error: findError } = await supabase
    .from('avatar_videos')
    .select('*')
    .eq('hedra_generation_id', payload.id)
    .single();

  if (findError || !avatarVideo) {
    console.error('❌ Avatar video not found for generation:', payload.id);
    throw new Error(`Avatar video not found for generation ${payload.id}`);
  }

  const avatarVideoId = avatarVideo.id;

  if (payload.status === 'complete' && payload.generated_video_url) {
    // Download and store video
    const storedVideoUrl = await storeGeneratedVideo(
      payload.generated_video_url,
      avatarVideoId
    );

    if (storedVideoUrl) {
      await updateAvatarVideoRecord(
        supabase,
        avatarVideoId,
        'completed',
        storedVideoUrl
      );
    } else {
      await updateAvatarVideoRecord(
        supabase,
        avatarVideoId,
        'failed',
        undefined,
        'Failed to download and store video'
      );
    }

  } else if (payload.status === 'error') {
    await updateAvatarVideoRecord(
      supabase,
      avatarVideoId,
      'failed',
      undefined,
      payload.error_message || 'Video generation failed'
    );

  } else {
    // Update status for processing states
    await updateAvatarVideoRecord(
      supabase,
      avatarVideoId,
      payload.status === 'processing' ? 'processing' : 'processing'
    );
  }
}

/**
 * POST handler for Hedra webhooks
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Hedra webhook received');

    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('x-hedra-signature');
    const webhookSecret = process.env.HEDRA_WEBHOOK_SECRET;

    // Verify webhook signature
    if (webhookSecret && !(await verifyWebhookSignature(body, signature, webhookSecret))) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    let payload: HedraWebhookPayload;
    try {
      payload = JSON.parse(body);
    } catch (_error) {
      console.error('❌ Invalid webhook payload:', body);
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!payload.id || !payload.status) {
      console.error('❌ Missing required webhook fields:', payload);
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Process webhook
    await processWebhook(payload);

    console.log('✅ Hedra webhook processed successfully');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Hedra webhook error:', error);
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler (for webhook verification if needed)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('challenge');

  if (challenge) {
    // Echo back challenge for webhook verification
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({ 
    status: 'Hedra webhook endpoint active',
    timestamp: new Date().toISOString()
  });
}