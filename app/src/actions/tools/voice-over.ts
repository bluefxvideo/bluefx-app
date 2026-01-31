'use server';

import { createClient } from '@/app/supabase/server';
import { createPredictionRecord, updatePredictionRecord } from '@/actions/database/thumbnail-database';
import { generateMinimaxVoice } from '@/actions/services/minimax-voice-service';
import { MINIMAX_VOICE_OPTIONS, type MinimaxEmotion } from '@/components/shared/voice-constants';

// Request/Response types for Voice Over
export interface VoiceOverRequest {
  script_text: string;
  voice_id: string;
  voice_settings?: {
    speed?: number; // 0.5 to 2.0
    pitch?: number; // -12 to 12 semitones
    volume?: number; // 0 to 10
    emotion?: MinimaxEmotion;
  };
  export_format?: 'mp3' | 'wav' | 'flac';
  quality?: 'standard' | 'hd';
  use_ssml?: boolean;
  user_id: string;
}

export interface VoiceOverResponse {
  success: boolean;
  generated_audio?: {
    id: string;
    audio_url: string;
    voice_id: string;
    voice_name: string;
    script_text: string;
    duration_seconds: number;
    file_size_mb: number;
    export_format: string;
    created_at: string;
  };
  voice_options?: VoiceOption[];
  batch_id: string;
  generation_time_ms: number;
  credits_used: number;
  remaining_credits: number;
  warnings?: string[];
  error?: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  accent: string;
  preview_url?: string;
  description: string;
  category: 'natural' | 'professional' | 'expressive' | 'character';
  supports_ssml: boolean;
}

export interface GeneratedVoice {
  id: string;
  user_id: string;
  script_text: string;
  voice_id: string;
  voice_name: string;
  audio_url: string;
  duration_seconds: number;
  file_size_mb: number;
  export_format: string;
  voice_settings?: {
    speed?: number;
    pitch?: number;
    volume?: number;
    emotion?: MinimaxEmotion;
  };
  batch_id: string;
  credits_used: number;
  created_at: string;
}

/**
 * Voice Over - AI orchestrator for professional voice generation
 *
 * Features:
 * - Minimax Speech 2.6 HD with 17 system voices
 * - Voice cloning support
 * - Multiple export formats (MP3, WAV, FLAC)
 * - Emotion, speed, pitch, and volume controls
 * - Credit cost calculation (2 credits per voice generation)
 * - Voice history and management
 */
export async function executeVoiceOver(
  request: VoiceOverRequest
): Promise<VoiceOverResponse> {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    // Get authenticated user from server session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        success: false,
        error: 'Authentication required',
        batch_id: '',
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Use server-side authenticated user ID
    const authenticatedRequest = {
      ...request,
      user_id: user.id,
    };
    
    // Generate unique batch ID and prediction ID
    const batch_id = `voice_over_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const prediction_id = `vo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create prediction tracking record
    await createPredictionRecord({
      prediction_id,
      user_id: user.id,
      tool_id: 'voice-over',
      service_id: 'minimax-tts',
      model_version: 'speech-2.6-hd',
      status: 'starting',
      input_data: {
        script_text: authenticatedRequest.script_text,
        voice_id: authenticatedRequest.voice_id,
        voice_settings: authenticatedRequest.voice_settings,
        export_format: authenticatedRequest.export_format || 'mp3',
        quality: authenticatedRequest.quality || 'standard',
        use_ssml: authenticatedRequest.use_ssml || false,
        batch_id
      } as any,
    });
    
    // Calculate credit costs
    const creditCosts = calculateVoiceOverCreditCost(authenticatedRequest);
    
    // Verify user has sufficient credits
    const userCredits = await getUserCredits(supabase, user.id);
    if (userCredits < creditCosts.total) {
      return {
        success: false,
        error: `Insufficient credits. Required: ${creditCosts.total}, Available: ${userCredits}`,
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: userCredits,
      };
    }

    // Generate single voice
    const voiceId = authenticatedRequest.voice_id;
    let generatedAudio: {
      id: string;
      audio_url: string;
      voice_id: string;
      voice_name: string;
      script_text: string;
      duration_seconds: number;
      file_size_mb: number;
      export_format: string;
      created_at: string;
    } | null = null;
    let totalCreditsUsed = 0;

    try {
      console.log(`🎙️ Generating voice with Minimax: ${voiceId}`);

      // Update prediction to processing status
      await updatePredictionRecord(prediction_id, {
        status: 'processing',
      });

      // Generate audio using Minimax Speech 2.6 HD
      const minimaxResult = await generateMinimaxVoice({
        text: authenticatedRequest.script_text,
        voice_settings: {
          voice_id: voiceId,
          speed: authenticatedRequest.voice_settings?.speed ?? 1.0,
          pitch: authenticatedRequest.voice_settings?.pitch ?? 0,
          volume: authenticatedRequest.voice_settings?.volume ?? 1,
          emotion: authenticatedRequest.voice_settings?.emotion ?? 'auto'
        },
        user_id: user.id,
        batch_id
      });

      if (!minimaxResult.success || !minimaxResult.audio_url) {
        throw new Error(minimaxResult.error || 'Voice generation failed');
      }

      const audioUrl = minimaxResult.audio_url;

      // Get voice details
      const voiceDetails = getVoiceDetails(voiceId);

      // Use duration from Minimax metadata or estimate
      const wordCount = authenticatedRequest.script_text.trim().split(/\s+/).length;
      const estimatedDuration = minimaxResult.metadata?.duration_estimate || Math.ceil(wordCount / 2.5);
      const estimatedFileSize = estimatedDuration * 0.125; // ~125KB per second for MP3

      // Create database record
      const { data: voiceRecord, error: dbError } = await supabase
        .from('generated_voices')
        .insert({
          id: `${batch_id}_${voiceId}`,
          user_id: user.id,
          text_content: authenticatedRequest.script_text,
          voice_id: voiceId,
          voice_name: voiceDetails.name,
          voice_provider: 'minimax',
          audio_format: authenticatedRequest.export_format || 'mp3',
          audio_url: audioUrl,
          duration_seconds: Math.round(estimatedDuration),
          file_size_bytes: Math.round(estimatedFileSize * 1024 * 1024),
          voice_settings: authenticatedRequest.voice_settings,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database insert error:', dbError);
        throw new Error('Failed to save voice generation record');
      }

      generatedAudio = {
        id: voiceRecord.id,
        audio_url: audioUrl,
        voice_id: voiceId,
        voice_name: voiceDetails.name,
        script_text: authenticatedRequest.script_text,
        duration_seconds: estimatedDuration,
        file_size_mb: estimatedFileSize,
        export_format: authenticatedRequest.export_format || 'mp3',
        created_at: voiceRecord?.created_at || new Date().toISOString(),
      };

      totalCreditsUsed = creditCosts.per_voice;
      
      // Update prediction to completed status with output data
      await updatePredictionRecord(prediction_id, {
        status: 'succeeded',
        output_data: {
          audio_url: audioUrl,
          voice_id: voiceId,
          voice_name: voiceDetails.name,
          duration_seconds: estimatedDuration,
          file_size_mb: estimatedFileSize,
          export_format: authenticatedRequest.export_format || 'mp3',
        } as any,
        completed_at: new Date().toISOString(),
      });
      
      // Trigger webhook completion for consistency with other tools
      setTimeout(async () => {
        try {
          await triggerVoiceOverWebhookCompletion(prediction_id, user.id, audioUrl, generatedAudio);
        } catch (webhookError) {
          console.warn('Voice Over webhook trigger failed:', webhookError);
        }
      }, 100); // Small delay to ensure response is sent first
      
    } catch (error) {
      console.error(`Voice generation failed for ${voiceId}:`, error);
      
      // Update prediction to failed status
      await updatePredictionRecord(prediction_id, {
        status: 'failed',
        output_data: {
          error: error instanceof Error ? error.message : 'Voice generation failed'
        } as any,
        completed_at: new Date().toISOString(),
      });
      
      throw error;
    }

    // Deduct credits only for successful generations
    if (totalCreditsUsed > 0) {
      await deductCredits(supabase, user.id, totalCreditsUsed, batch_id, 'voice_over_generation');
    }

    return {
      success: generatedAudio !== null,
      generated_audio: generatedAudio as any,
      voice_options: getVoiceOptions(),
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: totalCreditsUsed,
      remaining_credits: userCredits - totalCreditsUsed,
    };

  } catch (error) {
    console.error('Voice Over execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Voice generation failed',
      batch_id: `error_${Date.now()}`,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

/**
 * Get available voice options - Minimax Speech 2.6 HD voices
 */
function getVoiceOptions(): VoiceOption[] {
  return MINIMAX_VOICE_OPTIONS.map(voice => ({
    id: voice.id,
    name: voice.name,
    gender: voice.gender,
    accent: 'neutral',
    description: voice.description,
    category: voice.category || 'natural',
    supports_ssml: false,
    preview_url: voice.preview_url
  }));
}

/**
 * Get voice details by ID
 */
function getVoiceDetails(voiceId: string): VoiceOption {
  const voices = getVoiceOptions();
  return voices.find(v => v.id === voiceId) || voices[0];
}

/**
 * Calculate credit costs for voice over operations
 */
function calculateVoiceOverCreditCost(request: VoiceOverRequest) {
  const wordCount = request.script_text.trim().split(/\s+/).length;
  const baseCost = 2; // Base cost per voice generation
  
  // Quality multiplier
  let qualityMultiplier = 1;
  if (request.quality === 'hd') {
    qualityMultiplier = 1.5;
  }
  
  // Format multiplier
  let formatMultiplier = 1;
  if (request.export_format === 'wav') {
    formatMultiplier = 1.2; // WAV files are larger
  }
  
  // Length multiplier (for very long content)
  let lengthMultiplier = 1;
  if (wordCount > 500) {
    lengthMultiplier = 1 + ((wordCount - 500) * 0.001); // Small increase for long content
  }
  
  const perVoiceCost = Math.ceil(baseCost * qualityMultiplier * formatMultiplier * lengthMultiplier);
  const voiceCount = 1;
  const total = perVoiceCost * voiceCount;
  
  return {
    base: baseCost,
    per_voice: perVoiceCost,
    quality_multiplier: qualityMultiplier,
    format_multiplier: formatMultiplier,
    length_multiplier: lengthMultiplier,
    voice_count: voiceCount,
    total,
    word_count: wordCount
  };
}

/**
 * Get user's available credits
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
 * Deduct credits from user account
 */
async function deductCredits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  amount: number,
  batchId: string,
  operation: string
) {
  // Deduct from available credits (atomic decrement)
  await supabase.rpc('deduct_user_credits', {
    user_id: userId,
    credits_to_deduct: amount
  });

  // Log credit usage
  await supabase
    .from('credit_usage')
    .insert({
      user_id: userId,
      credits_used: amount,
      operation_type: operation,
      reference_id: batchId,
      service_type: 'voice_over',
      created_at: new Date().toISOString()
    } as any);
}

/**
 * Trigger webhook completion for Voice Over (for consistency with async tools)
 */
async function triggerVoiceOverWebhookCompletion(
  predictionId: string,
  userId: string,
  audioUrl: string,
  generatedAudio: any
): Promise<void> {
  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/voice-over-ai`;
    
    const payload = {
      prediction_id: predictionId,
      user_id: userId,
      status: 'succeeded',
      output: audioUrl,
      generated_audio: generatedAudio,
      completed_at: new Date().toISOString(),
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`);
    }

    console.log(`🎙️ Voice Over webhook completion triggered: ${predictionId}`);
    
  } catch (error) {
    console.error('Voice Over webhook trigger failed:', error);
    // Don't throw - this is non-critical
  }
}