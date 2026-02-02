'use server';

import { createClient } from '@/app/supabase/server';
import { MUSIC_CREDITS, MusicMode, INSTRUMENTAL_SUFFIX } from '@/types/music-machine';
import {
  createFalMiniMaxPrediction,
  getFalMiniMaxModelInfo,
} from '@/actions/models/fal-minimax-music';
import { createMusicRecord } from '@/actions/database/music-database';
import { createPredictionRecord } from '@/actions/database/thumbnail-database';

// Request interface for Music Machine
export interface MusicMachineRequest {
  prompt: string;           // Style description (10-300 chars)
  lyrics?: string;          // Optional lyrics with tags (10-3000 chars)
  mode: MusicMode;          // 'instrumental' or 'vocals'
  user_id: string;
}

// Response interface for Music Machine
export interface MusicMachineResponse {
  success: boolean;

  generated_music?: {
    id: string;
    request_id: string;
    prompt: string;
    has_lyrics: boolean;
    model_version: string;
    output_format: string;
    status: string;
    created_at: string;
  };

  model_info?: Awaited<ReturnType<typeof getFalMiniMaxModelInfo>>;

  request_id: string;
  batch_id: string;
  credits_used: number;
  remaining_credits: number;
  generation_time_ms: number;

  error?: string;
  warnings?: string[];
}

/**
 * Music Machine - MiniMax v2 via fal.ai
 *
 * Features:
 * - High-quality music generation with vocals or instrumental
 * - Simple prompt + optional lyrics interface
 * - Fixed 6 credits per generation
 * - fal.ai queue-based processing
 */
export async function executeMusicMachine(
  request: MusicMachineRequest
): Promise<MusicMachineResponse> {
  const startTime = Date.now();
  const batch_id = crypto.randomUUID();
  const warnings: string[] = [];

  try {
    const supabase = await createClient();

    // Authentication validation
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: 'Authentication required',
        request_id: '',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Validate prompt length
    const basePrompt = request.prompt.trim();
    if (basePrompt.length < 10 || basePrompt.length > 300) {
      return {
        success: false,
        error: 'Prompt must be between 10 and 300 characters',
        request_id: '',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Apply instrumental suffix to prompt if in instrumental mode
    const prompt = request.mode === 'instrumental'
      ? `${basePrompt}. ${INSTRUMENTAL_SUFFIX}`
      : basePrompt;

    // Prepare lyrics - use "[Instrumental]" if no lyrics provided or in instrumental mode with empty lyrics
    const lyrics = request.lyrics?.trim();
    const lyricsPrompt = lyrics && lyrics.length >= 10
      ? lyrics
      : '[Instrumental]';
    const hasLyrics = lyrics && lyrics.length >= 10 && request.mode === 'vocals';

    console.log(`🎵 Music Machine: "${prompt.substring(0, 50)}..." | Mode: ${request.mode} | Lyrics: ${hasLyrics ? 'Yes' : 'Instrumental'}`);

    // Credit validation
    const userCredits = await getUserCredits(supabase, user.id);
    if (userCredits < MUSIC_CREDITS) {
      return {
        success: false,
        error: `Insufficient credits. Required: ${MUSIC_CREDITS}, Available: ${userCredits}`,
        request_id: '',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: userCredits,
      };
    }

    // Create fal.ai prediction
    const prediction = await createFalMiniMaxPrediction({
      prompt: prompt,
      lyrics_prompt: lyricsPrompt,
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format: 'mp3'
      }
    });

    console.log(`✅ fal.ai MiniMax request queued: ${prediction.request_id}`);

    // Create prediction tracking record
    await createPredictionRecord({
      prediction_id: prediction.request_id,
      user_id: user.id,
      tool_id: 'music-machine',
      service_id: 'fal-ai',
      model_version: 'minimax-music-v2',
      status: 'starting',
      input_data: {
        prompt: prompt,
        lyrics: hasLyrics ? lyrics : null,
        has_lyrics: hasLyrics,
      } as any,
    });

    // Database record creation
    const musicRecord = await createMusicRecord(user.id, prompt, {
      prediction_id: prediction.request_id,
      batch_id,
      credits_used: MUSIC_CREDITS,
      model_provider: 'fal-ai-minimax-v2',
      tier: 'standard',
    });

    if (!musicRecord.success) {
      console.error('Failed to create music database record:', musicRecord.error);
      warnings.push('Database record creation failed, but generation is proceeding');
    }

    // Deduct credits
    await deductCredits(supabase, user.id, MUSIC_CREDITS, batch_id, 'music_generation');

    return {
      success: true,
      generated_music: {
        id: musicRecord.data?.id || `temp_${Date.now()}`,
        request_id: prediction.request_id,
        prompt: prompt,
        has_lyrics: !!hasLyrics,
        model_version: 'minimax-music-v2',
        output_format: 'mp3',
        status: prediction.status,
        created_at: new Date().toISOString(),
      },
      model_info: await getFalMiniMaxModelInfo(),
      request_id: prediction.request_id,
      batch_id,
      credits_used: MUSIC_CREDITS,
      remaining_credits: userCredits - MUSIC_CREDITS,
      generation_time_ms: Date.now() - startTime,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

  } catch (error) {
    console.error('Music Machine execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Music generation failed',
      request_id: '',
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

/**
 * Get user's available credits from database
 */
async function getUserCredits(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<number> {
  const { data: userCredits } = await supabase
    .from('user_credits')
    .select('available_credits')
    .eq('user_id', userId)
    .single();

  return userCredits?.available_credits || 0;
}

/**
 * Deduct credits from user account with transaction logging
 */
async function deductCredits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  amount: number,
  batchId: string,
  operation: string
) {
  // Get current credits
  const { data: currentCredits } = await supabase
    .from('user_credits')
    .select('available_credits')
    .eq('user_id', userId)
    .single();

  const newCredits = Math.max(0, (currentCredits?.available_credits || 0) - amount);

  // Update credits
  await supabase
    .from('user_credits')
    .update({
      available_credits: newCredits,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  // Log credit usage for audit trail
  await supabase
    .from('credit_usage')
    .insert({
      user_id: userId,
      credits_used: amount,
      operation_type: operation,
      reference_id: batchId,
      service_type: 'music_generation',
      created_at: new Date().toISOString()
    } as any);
}
