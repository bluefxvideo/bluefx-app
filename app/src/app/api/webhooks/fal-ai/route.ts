import { NextRequest, NextResponse } from 'next/server';
import { downloadAndUploadAudio, downloadAndUploadVideo } from '@/actions/supabase-storage';
import { updateMusicRecordAdmin } from '@/actions/database/music-database';
import { updateTalkingAvatarVideoAdmin } from '@/actions/database/talking-avatar-database';
import { createAdminClient } from '@/app/supabase/server';

/**
 * fal.ai Webhook Handler
 * Receives completion callbacks from fal.ai queue API
 * Handles:
 * - MiniMax Music (audio output)
 * - LTX Audio-to-Video (video output)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const payload = await request.json();
    console.log('📬 fal.ai Webhook received:', JSON.stringify(payload, null, 2));

    // fal.ai webhook payload structure
    const { request_id, status, payload: resultPayload, error } = payload;

    if (!request_id) {
      console.error('❌ fal.ai webhook: Missing request_id');
      return NextResponse.json({ error: 'Missing request_id' }, { status: 400 });
    }

    // Determine result type: video or audio
    const hasVideo = resultPayload?.video?.url;
    const hasAudio = resultPayload?.audio?.url;

    // Handle LTX Audio-to-Video completion (video output)
    if (status === 'OK' && hasVideo) {
      return await handleLTXVideoCompletion(request_id, resultPayload, startTime);
    }

    // Handle MiniMax Music completion (audio output)
    if (status === 'OK' && hasAudio) {
      console.log(`🎵 Processing completed music: ${request_id}`);

      // Download and upload audio to our storage
      const uploadResult = await downloadAndUploadAudio(
        resultPayload.audio.url,
        'music-machine',
        `music_${request_id}`
      );

      if (uploadResult.success && uploadResult.url) {
        // Find music record by prediction_id in generation_settings
        const supabase = createAdminClient();
        const { data: musicRecords, error: queryError } = await supabase
          .from('music_history')
          .select('id, user_id')
          .contains('generation_settings', { prediction_id: request_id });

        if (queryError) {
          console.error('❌ fal.ai webhook: Database query error:', queryError);
        }

        console.log(`🔍 fal.ai webhook: Found ${musicRecords?.length || 0} music records for ${request_id}`);

        if (musicRecords && musicRecords.length > 0) {
          const musicId = musicRecords[0].id;
          const userId = musicRecords[0].user_id;

          // Update music record with completed status and audio URL
          await updateMusicRecordAdmin(musicId, {
            status: 'completed',
            audio_url: uploadResult.url,
          });

          // Broadcast completion to user's real-time channel
          await supabase.channel(`user_${userId}_updates`).send({
            type: 'broadcast',
            event: 'webhook_update',
            payload: {
              tool_type: 'music-machine',
              prediction_id: request_id,
              status: 'succeeded',
              results: {
                success: true,
                audio_url: uploadResult.url,
              }
            }
          });

          console.log(`✅ fal.ai webhook: Music complete - ${musicId} (${Date.now() - startTime}ms)`);
        } else {
          console.warn(`⚠️ fal.ai webhook: No music record found for request_id: ${request_id}`);
        }
      } else {
        console.error('❌ fal.ai webhook: Failed to upload audio:', uploadResult.error);
      }
    }
    // Handle failure
    else if (status === 'ERROR' || error) {
      console.error(`❌ fal.ai webhook: Generation failed - ${request_id}:`, error);
      return await handleGenerationFailure(request_id, error, startTime);
    }

    return NextResponse.json({
      success: true,
      message: `Processed webhook for ${request_id}`,
      processing_time_ms: Date.now() - startTime,
    });

  } catch (error) {
    console.error('🚨 fal.ai Webhook Error:', error);

    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
    }, { status: 500 });
  }
}

/**
 * Handle LTX Audio-to-Video completion
 */
async function handleLTXVideoCompletion(
  request_id: string,
  resultPayload: { video: { url: string } },
  startTime: number
): Promise<NextResponse> {
  console.log(`🎬 Processing completed LTX video: ${request_id}`);

  // Download and upload video to our storage
  const uploadResult = await downloadAndUploadVideo(
    resultPayload.video.url,
    'talking-avatar',
    `ltx_${request_id}`
  );

  if (!uploadResult.success || !uploadResult.url) {
    console.error('❌ fal.ai webhook: Failed to upload video:', uploadResult.error);
    return NextResponse.json({
      success: false,
      error: 'Failed to upload video',
      processing_time_ms: Date.now() - startTime,
    });
  }

  // Find avatar video record by fal_request_id
  const supabase = createAdminClient();
  const { data: videoRecords, error: queryError } = await supabase
    .from('avatar_videos')
    .select('id, user_id')
    .eq('fal_request_id', request_id);

  if (queryError) {
    console.error('❌ fal.ai webhook: Database query error:', queryError);
  }

  console.log(`🔍 fal.ai webhook: Found ${videoRecords?.length || 0} avatar video records for ${request_id}`);

  if (videoRecords && videoRecords.length > 0) {
    const videoId = videoRecords[0].id;
    const userId = videoRecords[0].user_id;

    // Update avatar video record with completed status and video URL
    await updateTalkingAvatarVideoAdmin(videoId, {
      status: 'completed',
      video_url: uploadResult.url,
    });

    // Broadcast completion to user's real-time channel
    await supabase.channel(`user_${userId}_updates`).send({
      type: 'broadcast',
      event: 'webhook_update',
      payload: {
        tool_type: 'talking-avatar',
        prediction_id: request_id,
        status: 'succeeded',
        results: {
          success: true,
          video_url: uploadResult.url,
        }
      }
    });

    console.log(`✅ fal.ai webhook: LTX video complete - ${videoId} (${Date.now() - startTime}ms)`);
  } else {
    console.warn(`⚠️ fal.ai webhook: No avatar video record found for fal_request_id: ${request_id}`);
  }

  return NextResponse.json({
    success: true,
    message: `Processed LTX video webhook for ${request_id}`,
    processing_time_ms: Date.now() - startTime,
  });
}

/**
 * Handle generation failure for both music and video
 */
async function handleGenerationFailure(
  request_id: string,
  error: string | undefined,
  startTime: number
): Promise<NextResponse> {
  const supabase = createAdminClient();

  // Try to find music record first
  const { data: musicRecords } = await supabase
    .from('music_history')
    .select('id, user_id')
    .contains('generation_settings', { prediction_id: request_id });

  if (musicRecords && musicRecords.length > 0) {
    const musicId = musicRecords[0].id;
    const userId = musicRecords[0].user_id;

    await updateMusicRecordAdmin(musicId, { status: 'failed' });

    await supabase.channel(`user_${userId}_updates`).send({
      type: 'broadcast',
      event: 'webhook_update',
      payload: {
        tool_type: 'music-machine',
        prediction_id: request_id,
        status: 'failed',
        results: { success: false, error: error || 'Music generation failed' }
      }
    });

    console.log(`❌ fal.ai webhook: Music failed - ${musicId}`);
  }

  // Try to find avatar video record
  const { data: videoRecords } = await supabase
    .from('avatar_videos')
    .select('id, user_id')
    .eq('fal_request_id', request_id);

  if (videoRecords && videoRecords.length > 0) {
    const videoId = videoRecords[0].id;
    const userId = videoRecords[0].user_id;

    await updateTalkingAvatarVideoAdmin(videoId, { status: 'failed' });

    await supabase.channel(`user_${userId}_updates`).send({
      type: 'broadcast',
      event: 'webhook_update',
      payload: {
        tool_type: 'talking-avatar',
        prediction_id: request_id,
        status: 'failed',
        results: { success: false, error: error || 'Video generation failed' }
      }
    });

    console.log(`❌ fal.ai webhook: LTX video failed - ${videoId}`);
  }

  return NextResponse.json({
    success: true,
    message: `Processed failure webhook for ${request_id}`,
    processing_time_ms: Date.now() - startTime,
  });
}
