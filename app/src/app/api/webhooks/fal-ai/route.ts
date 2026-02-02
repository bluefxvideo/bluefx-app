import { NextRequest, NextResponse } from 'next/server';
import { downloadAndUploadAudio } from '@/actions/supabase-storage';
import { updateMusicRecordAdmin } from '@/actions/database/music-database';
import { createAdminClient } from '@/app/supabase/server';

/**
 * fal.ai Webhook Handler
 * Receives completion callbacks from fal.ai queue API
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const payload = await request.json();
    console.log('🎵 fal.ai Webhook received:', JSON.stringify(payload, null, 2));

    // fal.ai webhook payload structure
    const { request_id, status, payload: resultPayload, error } = payload;

    if (!request_id) {
      console.error('❌ fal.ai webhook: Missing request_id');
      return NextResponse.json({ error: 'Missing request_id' }, { status: 400 });
    }

    // Handle successful completion
    if (status === 'OK' && resultPayload?.audio?.url) {
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

      // Find and update music record with failed status
      const supabase = createAdminClient();
      const { data: musicRecords } = await supabase
        .from('music_history')
        .select('id, user_id')
        .contains('generation_settings', { prediction_id: request_id });

      if (musicRecords && musicRecords.length > 0) {
        const musicId = musicRecords[0].id;
        const userId = musicRecords[0].user_id;

        await updateMusicRecordAdmin(musicId, {
          status: 'failed',
        });

        // Broadcast failure to user
        await supabase.channel(`user_${userId}_updates`).send({
          type: 'broadcast',
          event: 'webhook_update',
          payload: {
            tool_type: 'music-machine',
            prediction_id: request_id,
            status: 'failed',
            results: {
              success: false,
              error: error || 'Music generation failed',
            }
          }
        });
      }
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
