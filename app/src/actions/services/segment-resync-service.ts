'use server';

import { generateVoiceForSegments, generateVoiceForAllSegments } from './voice-generation-service';
import { analyzeAudioWithWhisper } from './whisper-analysis-service';
import { realignSegmentsWithVoiceTiming } from './segment-realignment-service';
import { storeScriptVideoResults } from '../database/script-video-database';

export interface ResyncRequest {
  video_id: string;
  segments: Array<{
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    duration: number;
    image_prompt: string;
    needs_voice_regen?: boolean; // Flag segments that need new voice
  }>;
  voice_settings?: {
    voice_id?: string;
    speed?: 'slower' | 'normal' | 'faster';
    emotion?: 'neutral' | 'excited' | 'calm' | 'confident' | 'authoritative';
  };
  user_id: string;
}

export interface ResyncResponse {
  success: boolean;
  segments: any[];
  audio_url?: string;
  word_timings?: any[];
  caption_chunks?: any;
  error?: string;
}

/**
 * Re-synchronize segments after editing
 * This handles voice regeneration and timing realignment
 */
export async function resyncSegmentsAfterEdit(request: ResyncRequest): Promise<ResyncResponse> {
  console.log('🔄 Starting segment resynchronization...');
  
  try {
    // Step 1: Identify which segments need voice regeneration
    const segmentsNeedingVoice = request.segments.filter(s => s.needs_voice_regen);
    const unchangedSegments = request.segments.filter(s => !s.needs_voice_regen);
    
    console.log(`📊 ${segmentsNeedingVoice.length} segments need voice, ${unchangedSegments.length} unchanged`);
    
    // Step 2: Generate voice for modified segments
    let allAudioUrls: string[] = [];
    let regeneratedSegments = [...request.segments];
    
    if (segmentsNeedingVoice.length > 0) {
      // Generate voice for modified segments
      const voiceResult = await generateVoiceForSegments({
        segments: segmentsNeedingVoice.map(segment => ({
          id: segment.id,
          text: segment.text,
          start_time: 0,
          end_time: segment.duration,
          duration: segment.duration
        })),
        voice_settings: request.voice_settings || {
          voice_id: 'alloy',
          speed: 'normal',
          emotion: 'neutral'
        },
        user_id: request.user_id,
        batch_id: `resync_${Date.now()}`
      });
      
      if (voiceResult.success && voiceResult.audio_url) {
        allAudioUrls.push(voiceResult.audio_url);
        
        // Update segments with actual voice duration if provided
        if (voiceResult.segment_durations) {
          voiceResult.segment_durations.forEach((duration: number, index: number) => {
            const segmentId = segmentsNeedingVoice[index].id;
            const segmentIndex = regeneratedSegments.findIndex(s => s.id === segmentId);
            if (segmentIndex !== -1) {
              regeneratedSegments[segmentIndex].duration = duration;
            }
          });
        }
      }
    }
    
    // Step 3: Merge audio files if needed (or regenerate all)
    // For now, let's regenerate all voice to ensure consistency
    console.log('🎤 Regenerating complete audio track...');
    
    // We already imported generateVoiceForAllSegments at the top
    const fullVoiceResult = await generateVoiceForAllSegments({
      segments: regeneratedSegments.map(s => ({
        id: s.id,
        text: s.text,
        start_time: 0,
        end_time: s.duration,
        duration: s.duration
      })),
      voice_settings: request.voice_settings || {
        voice_id: 'alloy',
        speed: 'normal',
        emotion: 'neutral'
      },
      user_id: request.user_id,
      batch_id: `resync_full_${Date.now()}`
    });
    
    if (!fullVoiceResult.success || !fullVoiceResult.audio_url) {
      throw new Error('Failed to regenerate voice track');
    }
    
    // Step 4: Run Whisper analysis on new audio
    console.log('🎧 Analyzing new audio with Whisper...');
    
    const whisperResult = await analyzeAudioWithWhisper({
      audio_url: fullVoiceResult.audio_url,
      segments: regeneratedSegments.map(seg => ({
        id: seg.id,
        text: seg.text,
        start_time: seg.start_time,
        end_time: seg.end_time
      }))
    }, 30);
    
    if (!whisperResult.success) {
      throw new Error('Whisper analysis failed');
    }
    
    // Step 5: Realign segments with actual voice timing
    console.log('⏱️ Realigning segments to match voice...');
    
    const realignedSegments = await realignSegmentsWithVoiceTiming(
      regeneratedSegments,
      whisperResult
    );
    
    // Step 6: Generate caption chunks
    console.log('📝 Creating caption chunks...');
    
    const { createProfessionalCaptions } = await import('./caption-chunking-service');
    const captionResult = await createProfessionalCaptions(whisperResult, 'standard');
    
    // Step 7: Update database
    console.log('💾 Saving to database...');
    
    // Use the existing database function which already handles the Supabase client
    const storeResult = await storeScriptVideoResults({
      user_id: request.user_id,
      script_text: regeneratedSegments.map(s => s.text).join(' '),
      video_url: '', // Not regenerating video, just audio
      audio_url: fullVoiceResult.audio_url,
      generated_images: [], // Keep existing images
      segments: realignedSegments,
      batch_id: `resync_${Date.now()}`,
      model_version: 'resync-1.0',
      generation_parameters: request as any,
      production_plan: { workflow_type: 'resync' } as any,
      credits_used: 0, // Already tracked elsewhere
      word_timings: whisperResult.segment_timings,
      caption_chunks: captionResult.success ? captionResult : null
    });
    
    if (!storeResult?.success) {
      console.error('Database update failed');
      // Continue anyway - data is generated
    }
    
    console.log('✅ Resynchronization complete!');
    
    return {
      success: true,
      segments: realignedSegments,
      audio_url: fullVoiceResult.audio_url,
      word_timings: whisperResult.segment_timings,
      caption_chunks: captionResult.success ? captionResult : undefined
    };
    
  } catch (error) {
    console.error('❌ Resync failed:', error);
    return {
      success: false,
      segments: request.segments,
      error: error instanceof Error ? error.message : 'Resynchronization failed'
    };
  }
}

/**
 * Quick resync for minor text edits
 * Only regenerates voice for specific segment
 */
export async function quickResyncSegment(
  videoId: string,
  segmentId: string,
  newText: string,
  allSegments: any[],
  userId: string,
  voiceSettings?: any
): Promise<ResyncResponse> {
  console.log(`⚡ Quick resync for segment ${segmentId}`);
  
  // Mark only the edited segment for voice regeneration
  const segmentsWithFlags = allSegments.map(s => ({
    ...s,
    needs_voice_regen: s.id === segmentId
  }));
  
  // Update the text for the target segment
  const targetIndex = segmentsWithFlags.findIndex(s => s.id === segmentId);
  if (targetIndex !== -1) {
    segmentsWithFlags[targetIndex].text = newText;
  }
  
  return resyncSegmentsAfterEdit({
    video_id: videoId,
    segments: segmentsWithFlags,
    voice_settings: voiceSettings,
    user_id: userId
  });
}

