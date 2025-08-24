import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { createHedraAPI } from '@/actions/models/hedra-api';
import { updatePredictionRecord } from '@/actions/database/thumbnail-database';
import { downloadAndUploadImage } from '@/actions/supabase-storage';
import type { Json } from '@/types/database';

/**
 * Hedra AI Webhook Handler
 * Processes Hedra video generation completions for Talking Avatar
 * 
 * Since Hedra doesn't provide webhooks, this endpoint handles manual status checks
 * and polling-based completion detection
 */

interface HedraWebhookPayload {
  generation_id: string;
  user_id: string;
  avatar_video_id: string;
  action: 'check_status' | 'manual_complete';
  video_url?: string;
  status?: 'processing' | 'complete' | 'error';
  error_message?: string;
}

interface HedraProcessingResult {
  success: boolean;
  generation_id: string;
  status: string;
  video_url?: string;
  error?: string;
  processing_time_ms?: number;
}

/**
 * POST handler for Hedra webhook events
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    console.log('🎬 Hedra Webhook: Received request');
    
    const payload: HedraWebhookPayload = await request.json();
    console.log(`🤖 Hedra Decision: Processing ${payload.generation_id} - Action: ${payload.action}`);

    // Validate required fields
    if (!payload.generation_id || !payload.user_id) {
      console.warn('🚨 Invalid Hedra webhook payload');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let result: HedraProcessingResult;

    if (payload.action === 'check_status') {
      result = await checkHedraGenerationStatus(payload);
    } else if (payload.action === 'manual_complete') {
      result = await processHedraCompletion(payload);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Hedra Webhook: Completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      message: `Hedra ${payload.action} processed`,
      result,
      processing_time_ms: processingTime,
    });

  } catch (error) {
    console.error('🚨 Hedra Webhook Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Hedra webhook processing failed',
      processing_time_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}

/**
 * Check Hedra generation status via API
 */
async function checkHedraGenerationStatus(payload: HedraWebhookPayload): Promise<HedraProcessingResult> {
  try {
    const hedra = createHedraAPI();
    
    // Check generation status
    const statusResult = await hedra.checkGenerationStatus(payload.generation_id);
    
    console.log(`🎬 Hedra Status: ${payload.generation_id} → ${statusResult.status}`);
    
    // Update prediction record
    await updatePredictionRecord(payload.generation_id, {
      status: statusResult.status === 'complete' ? 'succeeded' : 
              statusResult.status === 'error' ? 'failed' : 'processing',
      output_data: statusResult.videoUrl ? { video_url: statusResult.videoUrl } as Json : null,
    });

    // If complete, process the completion
    if (statusResult.status === 'complete' && statusResult.videoUrl) {
      return await processHedraVideoComplete(payload, statusResult.videoUrl);
    }

    return {
      success: true,
      generation_id: payload.generation_id,
      status: statusResult.status || 'processing',
      video_url: statusResult.videoUrl,
      error: statusResult.error,
    };

  } catch (error) {
    console.error('Hedra status check failed:', error);
    return {
      success: false,
      generation_id: payload.generation_id,
      status: 'error',
      error: error instanceof Error ? error.message : 'Status check failed',
    };
  }
}

/**
 * Process manual completion (for testing or external triggers)
 */
async function processHedraCompletion(payload: HedraWebhookPayload): Promise<HedraProcessingResult> {
  try {
    if (!payload.video_url) {
      throw new Error('Video URL required for manual completion');
    }

    return await processHedraVideoComplete(payload, payload.video_url);

  } catch (error) {
    console.error('Hedra manual completion failed:', error);
    return {
      success: false,
      generation_id: payload.generation_id,
      status: 'error',
      error: error instanceof Error ? error.message : 'Manual completion failed',
    };
  }
}

/**
 * Process completed Hedra video generation
 */
async function processHedraVideoComplete(payload: HedraWebhookPayload, videoUrl: string): Promise<HedraProcessingResult> {
  try {
    console.log(`🎬 Processing Hedra completion: ${payload.generation_id}`);
    
    const supabase = await createClient();
    
    // Download and upload video to our storage
    const uploadResult = await downloadAndUploadImage(
      videoUrl,
      'talking-avatar',
      `avatar_${payload.generation_id}`,
      {
        bucket: 'videos', // Use videos bucket instead of images
        contentType: 'video/mp4', // Correct MIME type for MP4 videos
        filename: `avatar_${payload.generation_id}.mp4` // Correct file extension
      }
    );
    
    if (!uploadResult.success || !uploadResult.url) {
      throw new Error(`Video upload failed: ${uploadResult.error}`);
    }

    console.log(`🎬 Video uploaded: ${uploadResult.url}`);

    // Update avatar_videos record
    if (payload.avatar_video_id) {
      const { error: updateError } = await supabase
        .from('avatar_videos')
        .update({
          status: 'completed',
          video_url: uploadResult.url,
          completed_at: new Date().toISOString(),
          metadata: {
            hedra_generation_id: payload.generation_id,
            original_video_url: videoUrl,
            processed_at: new Date().toISOString(),
          } as Json
        })
        .eq('id', payload.avatar_video_id);

      if (updateError) {
        console.error('Failed to update avatar_videos record:', updateError);
      } else {
        console.log(`✅ Updated avatar_videos record: ${payload.avatar_video_id}`);
      }
    }

    // Update prediction record
    await updatePredictionRecord(payload.generation_id, {
      status: 'succeeded',
      output_data: { video_url: uploadResult.url } as Json,
      completed_at: new Date().toISOString(),
    });

    // TODO: Broadcast to user via real-time channel
    console.log(`📡 Broadcasting completion to user: ${payload.user_id}`);

    return {
      success: true,
      generation_id: payload.generation_id,
      status: 'complete',
      video_url: uploadResult.url,
    };

  } catch (error) {
    console.error('Hedra completion processing failed:', error);
    
    // Update prediction with error
    await updatePredictionRecord(payload.generation_id, {
      status: 'failed',
      output_data: { error: error instanceof Error ? error.message : 'Processing failed' } as Json,
    });

    return {
      success: false,
      generation_id: payload.generation_id,
      status: 'error',
      error: error instanceof Error ? error.message : 'Processing failed',
    };
  }
}

/**
 * GET handler for status checks
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const generationId = url.searchParams.get('generation_id');
  const userId = url.searchParams.get('user_id');
  
  if (!generationId || !userId) {
    return NextResponse.json({ error: 'Missing generation_id or user_id' }, { status: 400 });
  }

  try {
    const result = await checkHedraGenerationStatus({
      generation_id: generationId,
      user_id: userId,
      avatar_video_id: '', // Not needed for status check
      action: 'check_status',
    });

    return NextResponse.json(result);
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed'
    }, { status: 500 });
  }
}