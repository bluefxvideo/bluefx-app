'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { deductCredits } from '@/actions/database/script-video-database';

/**
 * API endpoint to store the exported video from Remotion
 * Called after video is successfully rendered
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      video_url,        // URL from Remotion server
      video_id,         // script_to_video_history record ID
      batch_id,         // Original generation batch ID
      duration_seconds, // Video duration
      file_size_mb,     // File size
      export_settings   // Export quality, format, etc.
    } = await request.json();

    if (!video_url || !video_id) {
      return NextResponse.json({ 
        error: 'video_url and video_id are required' 
      }, { status: 400 });
    }

    console.log(`📥 Storing exported video for user ${user.id}, video ${video_id}`);

    // Step 1: Download video from Remotion server
    const videoResponse = await fetch(video_url);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video from Remotion: ${videoResponse.status}`);
    }
    
    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
    
    // Step 2: Upload to Supabase storage
    const fileName = `${user.id}/exports/${batch_id || video_id}_${Date.now()}.mp4`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('script-videos')
      .upload(fileName, videoBlob, {
        contentType: 'video/mp4',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload video to storage: ${uploadError.message}`);
    }

    // Step 3: Get public URL
    const { data: urlData } = supabase.storage
      .from('script-videos')
      .getPublicUrl(fileName);

    const storedVideoUrl = urlData.publicUrl;

    // Step 4: Update script_to_video_history record
    const { error: updateError } = await supabase
      .from('script_to_video_history')
      .update({
        video_url: storedVideoUrl,
        status: 'exported',
        export_data: {
          exported_at: new Date().toISOString(),
          duration_seconds,
          file_size_mb,
          export_settings,
          storage_path: fileName
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', video_id)
      .eq('user_id', user.id); // Security: ensure user owns this record

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error(`Failed to update video record: ${updateError.message}`);
    }

    // Step 5: Deduct credits for video export (if not already deducted)
    const EXPORT_CREDITS = 10; // Credits for rendering/exporting
    const creditResult = await deductCredits(
      user.id,
      EXPORT_CREDITS,
      'video-export',
      { video_id, batch_id, duration_seconds }
    );

    if (!creditResult.success) {
      console.warn('Credit deduction failed:', creditResult.error);
      // Don't fail the whole operation if credit deduction fails
    }

    console.log(`✅ Video exported and stored: ${storedVideoUrl}`);

    return NextResponse.json({
      success: true,
      video_url: storedVideoUrl,
      storage_path: fileName,
      credits_deducted: EXPORT_CREDITS,
      remaining_credits: creditResult.remainingCredits
    });

  } catch (error) {
    console.error('Video storage error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to store video'
    }, { status: 500 });
  }
}

/**
 * GET endpoint to check export status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const video_id = searchParams.get('video_id');

    if (!video_id) {
      return NextResponse.json({ error: 'video_id is required' }, { status: 400 });
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch video record
    const { data: video, error: fetchError } = await supabase
      .from('script_to_video_history')
      .select('id, video_url, status, export_data')
      .eq('id', video_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      video_id: video.id,
      video_url: video.video_url,
      status: video.status,
      export_data: video.export_data
    });

  } catch (error) {
    console.error('Video status check error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to check video status'
    }, { status: 500 });
  }
}