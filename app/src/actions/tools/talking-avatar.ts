'use server';

import { createClient } from '@/app/supabase/server';
import { uploadImageToStorage, uploadAudioToStorage } from '@/actions/supabase-storage';
import { generateTalkingAvatarVideo } from '@/actions/models/hedra-api';
import {
  createFalLTXPrediction,
  LTX_RESOLUTIONS,
  LTX_MAX_DURATION_SECONDS,
  validateAudioDuration,
  type LTXResolution
} from '@/actions/models/fal-ltx-audio-video';
import { createPredictionRecord } from '@/actions/database/thumbnail-database';
import {
  getUserCredits,
  deductCredits,
  storeTalkingAvatarResults,
  recordTalkingAvatarMetrics
} from '@/actions/database/talking-avatar-database';
import { generateMinimaxVoice } from '@/actions/services/minimax-voice-service';
import { MINIMAX_VOICE_OPTIONS } from '@/components/shared/voice-constants';

// Request/Response types for Talking Avatar
export interface TalkingAvatarRequest {
  script_text: string;
  avatar_image_url?: string;
  avatar_template_id?: string;
  voice_id?: string;
  voice_speed?: number; // Voice speed multiplier (0.5 - 2.0)
  voice_pitch?: number; // Voice pitch adjustment (-12 to +12)
  voice_volume?: number; // Voice volume (0-10)
  voice_emotion?: string; // Voice emotion (auto, neutral, happy, sad, etc.)
  custom_avatar_image?: File | null;
  workflow_step: 'avatar_select' | 'voice_generate' | 'audio_upload' | 'video_generate';
  user_id: string;
  voice_audio_url?: string; // For video generation step (from TTS)
  aspect_ratio?: '16:9' | '9:16'; // Video orientation (legacy, maps to resolution)
  // New fields for fal.ai LTX
  audio_input_mode?: 'tts' | 'upload';
  uploaded_audio_url?: string; // For direct audio upload
  audio_duration_seconds?: number; // Duration of uploaded audio
  resolution?: LTXResolution; // 'landscape' | 'portrait'
  action_prompt?: string; // Optional prompt for visual style/movements
}

export interface TalkingAvatarResponse {
  success: boolean;
  step_data?: {
    current_step: number;
    total_steps: number;
    avatar_preview_url?: string;
    voice_audio_url?: string;
    video_url?: string;
    estimated_duration?: number;
  };
  avatar_templates?: AvatarTemplate[];
  voice_options?: VoiceOption[];
  video?: {
    id: string;
    video_url: string;
    thumbnail_url?: string;
    script_text: string;
    avatar_image_url: string;
    created_at: string;
  };
  batch_id: string;
  prediction_id?: string | null; // fal.ai request_id or Hedra generation_id for polling
  generation_time_ms: number;
  credits_used: number;
  remaining_credits: number;
  warnings?: string[];
  error?: string;
}

export interface AvatarTemplate {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  category: string;
  gender?: string;
  age_range?: string;
  ethnicity?: string;
  voice_provider?: string;
  voice_id?: string;
  preview_video_url?: string;
  is_active: boolean;
  usage_count?: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  preview_url?: string;
  description: string;
  category?: 'natural' | 'professional' | 'expressive' | 'character';
}

/**
 * Talking Avatar - Single orchestrator replacing 7 legacy edge functions
 * 
 * Replaces:
 * - avatar-generator
 * - avatar-webhook
 * - upload-avatar-template
 * - upload-user-avatar
 * - save-avatar-video
 * - delete-avatar-video
 * - delete-avatar-template
 * 
 * Features:
 * - Multi-step wizard: Avatar Selection → Voice Generation → Video Creation
 * - Avatar template management with custom uploads
 * - OpenAI voice generation integration
 * - Hedra API video generation
 * - Credit cost calculation (6 credits for avatar video generation)
 * - Real-time status updates via database subscriptions
 */
export async function executeTalkingAvatar(
  request: TalkingAvatarRequest
): Promise<TalkingAvatarResponse> {
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

    // Use server-side authenticated user ID instead of client-provided one
    const authenticatedRequest = {
      ...request,
      user_id: user.id,
    };
    
    // Generate unique batch ID for this operation using proper UUID format
    const batch_id = crypto.randomUUID();
    
    // Handle different workflow steps
    switch (authenticatedRequest.workflow_step) {
      case 'avatar_select':
        return await handleAvatarSelection(authenticatedRequest, batch_id, startTime, supabase);
      case 'voice_generate':
        return await handleVoiceGeneration(authenticatedRequest, batch_id, startTime, supabase);
      case 'audio_upload':
        return await handleAudioUpload(authenticatedRequest, batch_id, startTime);
      case 'video_generate':
        return await handleVideoGeneration(authenticatedRequest, batch_id, startTime, supabase);
      default:
        return {
          success: false,
          error: 'Invalid workflow step',
          batch_id,
          generation_time_ms: Date.now() - startTime,
          credits_used: 0,
          remaining_credits: 0,
        };
    }

  } catch (error) {
    console.error('Talking Avatar execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      batch_id: `error_${Date.now()}`,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

/**
 * Step 1: Handle avatar selection and template loading
 */
async function handleAvatarSelection(
  request: TalkingAvatarRequest,
  batch_id: string,
  startTime: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<TalkingAvatarResponse> {
  try {
    // Load avatar templates from database
    const { data: templates, error: templatesError } = await supabase
      .from('avatar_templates')
      .select('*')
      .order('category', { ascending: true });

    if (templatesError) {
      throw new Error(`Failed to load avatar templates: ${templatesError.message}`);
    }

    // Handle custom avatar upload if provided
    let customAvatarUrl: string | undefined;
    if (request.custom_avatar_image) {
      const uploadResult = await uploadImageToStorage(
        request.custom_avatar_image,
        {
          bucket: 'images',
          folder: 'avatars/custom',
          filename: `${batch_id}_avatar.${request.custom_avatar_image.name.split('.').pop()}`,
          contentType: request.custom_avatar_image.type,
        }
      );
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Avatar upload failed');
      }
      
      customAvatarUrl = uploadResult.url;
    }

    return {
      success: true,
      step_data: {
        current_step: 1,
        total_steps: 3,
        avatar_preview_url: customAvatarUrl || request.avatar_image_url,
      },
      avatar_templates: (templates || []) as any,
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: (await getUserCredits(request.user_id)).credits || 0,
    };

  } catch (error) {
    console.error('Avatar selection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Avatar selection failed',
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

/**
 * Step 2: Handle voice selection and audio generation using OpenAI
 */
async function handleVoiceGeneration(
  request: TalkingAvatarRequest,
  batch_id: string,
  startTime: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<TalkingAvatarResponse> {
  try {
    // Calculate word count for duration estimation
    const wordCount = request.script_text.trim().split(/\s+/).length;
    const estimatedDuration = Math.ceil(wordCount / 2.5); // ~2.5 words per second

    // Use Minimax voice options (56 system voices)
    const voiceOptions = MINIMAX_VOICE_OPTIONS;

    // Generate audio using Minimax TTS if voice_id is provided
    let voiceAudioUrl: string | undefined;
    if (request.voice_id && request.script_text) {
      voiceAudioUrl = await generateVoiceAudio(request.script_text, request.voice_id, request.user_id, {
        speed: request.voice_speed,
        pitch: request.voice_pitch,
        volume: request.voice_volume,
        emotion: request.voice_emotion,
      });
    }

    return {
      success: true,
      step_data: {
        current_step: 2,
        total_steps: 3,
        voice_audio_url: voiceAudioUrl,
        estimated_duration: estimatedDuration,
      },
      voice_options: voiceOptions,
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: (await getUserCredits(request.user_id)).credits || 0,
    };

  } catch (error) {
    console.error('Voice generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Voice generation failed',
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

/**
 * Step 2b: Handle direct audio file upload (alternative to TTS)
 * Validates duration and returns audio URL for video generation
 */
async function handleAudioUpload(
  request: TalkingAvatarRequest,
  batch_id: string,
  startTime: number
): Promise<TalkingAvatarResponse> {
  try {
    // Validate that we have audio info
    if (!request.uploaded_audio_url || !request.audio_duration_seconds) {
      return {
        success: false,
        error: 'Audio URL and duration are required for upload mode',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Validate audio duration (max 60 seconds)
    const durationValidation = validateAudioDuration(request.audio_duration_seconds);
    if (!durationValidation.valid) {
      return {
        success: false,
        error: durationValidation.error || 'Audio duration exceeds 60 second limit',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Calculate estimated credits
    const creditCosts = calculateTalkingAvatarCreditCost(request);

    return {
      success: true,
      step_data: {
        current_step: 2,
        total_steps: 3,
        voice_audio_url: request.uploaded_audio_url,
        estimated_duration: request.audio_duration_seconds,
      },
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: (await getUserCredits(request.user_id)).credits || 0,
    };

  } catch (error) {
    console.error('Audio upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Audio upload failed',
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

/**
 * Step 3: Handle final video generation using fal.ai LTX Audio-to-Video
 * Replaces legacy Hedra API with fal.ai for better quality and pricing
 */
async function handleVideoGeneration(
  request: TalkingAvatarRequest,
  batch_id: string,
  startTime: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _supabase: Awaited<ReturnType<typeof createClient>>
): Promise<TalkingAvatarResponse> {
  let falRequestId: string | null = null;

  try {
    // Determine audio URL - either from TTS generation or direct upload
    const audioUrl = request.voice_audio_url || request.uploaded_audio_url;
    if (!audioUrl) {
      return {
        success: false,
        error: 'Audio URL is required for video generation. Generate voice or upload audio first.',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Determine audio duration
    let audioDurationSeconds: number;
    if (request.audio_duration_seconds) {
      // Direct upload - use provided duration
      audioDurationSeconds = request.audio_duration_seconds;
    } else {
      // TTS - estimate from word count (~1.5 words per second)
      const wordCount = request.script_text.trim().split(/\s+/).filter(Boolean).length;
      audioDurationSeconds = Math.max(3, Math.ceil(wordCount / 1.5));
    }

    // Validate audio duration (max 60 seconds for fal.ai LTX)
    const durationValidation = validateAudioDuration(audioDurationSeconds);
    if (!durationValidation.valid) {
      return {
        success: false,
        error: durationValidation.error || 'Invalid audio duration',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Determine resolution from request (default to landscape)
    const resolution: LTXResolution = request.resolution ||
      (request.aspect_ratio === '9:16' ? 'portrait' : 'landscape');
    const { width, height } = LTX_RESOLUTIONS[resolution];

    // Calculate credit costs (1 credit per second, min 10, max 60)
    const creditCosts = calculateTalkingAvatarCreditCost({
      ...request,
      audio_duration_seconds: audioDurationSeconds
    });

    // Verify user has sufficient credits
    const userCreditsResult = await getUserCredits(request.user_id);
    if (!userCreditsResult.success) {
      return {
        success: false,
        error: userCreditsResult.error || 'Failed to check credits',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    const userCredits = userCreditsResult.credits || 0;
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

    // Store initial record with fal.ai LTX fields
    const storeResult = await storeTalkingAvatarResults({
      user_id: request.user_id,
      script_text: request.script_text,
      avatar_template_id: request.avatar_template_id || null,
      batch_id: batch_id,
      voice_audio_url: audioUrl,
      avatar_image_url: request.avatar_image_url,
      video_source: 'fal-ltx',
      resolution_width: width,
      resolution_height: height,
      audio_duration_seconds: audioDurationSeconds,
      action_prompt: request.action_prompt,
      status: 'processing'
    });

    if (!storeResult.success) {
      console.error('Database insert error:', storeResult.error);
      return {
        success: false,
        error: 'Failed to save video generation record',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: userCredits,
      };
    }

    // Deduct credits
    const deductResult = await deductCredits(
      request.user_id,
      creditCosts.total,
      'talking_avatar_generation',
      {
        batch_id,
        audio_duration: audioDurationSeconds,
        resolution: resolution,
        video_source: 'fal-ltx'
      }
    );

    if (!deductResult.success) {
      console.error('Credit deduction failed:', deductResult.error);
      return {
        success: false,
        error: deductResult.error || 'Failed to deduct credits',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: userCredits,
      };
    }

    // Generate video with fal.ai LTX Audio-to-Video
    console.log(`🎬 Starting fal.ai LTX video generation: ${width}×${height}, ${audioDurationSeconds}s`);

    try {
      const falResult = await createFalLTXPrediction({
        audio_url: audioUrl,
        image_url: request.avatar_image_url,
        prompt: request.action_prompt,
        video_size: LTX_RESOLUTIONS[resolution].falSize,
      });

      if (!falResult.request_id) {
        throw new Error('fal.ai did not return a request_id');
      }

      falRequestId = falResult.request_id;

      // Update record with fal.ai request ID
      await storeTalkingAvatarResults({
        user_id: request.user_id,
        script_text: request.script_text,
        avatar_template_id: request.avatar_template_id || null,
        batch_id: batch_id,
        fal_request_id: falResult.request_id,
        voice_audio_url: audioUrl,
        avatar_image_url: request.avatar_image_url,
        video_source: 'fal-ltx',
        resolution_width: width,
        resolution_height: height,
        audio_duration_seconds: audioDurationSeconds,
        action_prompt: request.action_prompt,
        status: 'processing',
        settings: {
          resolution: resolution,
          match_audio_length: true,
          model_version: 'fal-ai/ltx-2-19b/distilled/audio-to-video'
        }
      });

      // Create prediction tracking record for unified system
      await createPredictionRecord({
        prediction_id: falResult.request_id,
        user_id: request.user_id,
        tool_id: 'talking-avatar',
        service_id: 'fal-ai',
        model_version: 'ltx-2-19b-audio-to-video',
        status: 'processing',
        input_data: {
          avatar_image_url: request.avatar_image_url,
          audio_url: audioUrl,
          script_text: request.script_text,
          avatar_template_id: request.avatar_template_id,
          avatar_video_id: batch_id,
          resolution: resolution,
          audio_duration: audioDurationSeconds,
          action_prompt: request.action_prompt
        } as any,
      });

      console.log('✅ fal.ai LTX generation started:', falResult.request_id);

      // Record metrics for analytics
      await recordTalkingAvatarMetrics({
        user_id: request.user_id,
        batch_id: batch_id,
        model_version: 'fal-ai-ltx-audio-to-video',
        script_text: request.script_text,
        duration: audioDurationSeconds,
        aspect_ratio: resolution === 'portrait' ? '9:16' : '16:9',
        generation_time_ms: Date.now() - startTime,
        credits_used: creditCosts.total,
        workflow_type: 'generate',
        has_custom_avatar: !!request.custom_avatar_image
      });

    } catch (error) {
      console.error('fal.ai LTX API error:', error);

      // Update record with error
      await storeTalkingAvatarResults({
        user_id: request.user_id,
        script_text: request.script_text,
        avatar_template_id: request.avatar_template_id || null,
        batch_id: batch_id,
        video_source: 'fal-ltx',
        status: 'failed',
        settings: {
          error_message: error instanceof Error ? error.message : 'fal.ai LTX API error'
        }
      });

      return {
        success: false,
        error: `Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: userCredits,
      };
    }

    return {
      success: true,
      step_data: {
        current_step: 3,
        total_steps: 3,
      },
      video: {
        id: batch_id,
        video_url: '', // Will be updated via webhook when complete
        script_text: request.script_text,
        avatar_image_url: request.avatar_image_url || '',
        created_at: new Date().toISOString(),
      },
      batch_id,
      prediction_id: falRequestId, // fal.ai request_id for polling
      generation_time_ms: Date.now() - startTime,
      credits_used: creditCosts.total,
      remaining_credits: deductResult.remainingCredits || 0,
    };

  } catch (error) {
    console.error('Video generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Video generation failed',
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

/**
 * Generate voice audio using Minimax Speech 2.6 HD via Replicate
 */
async function generateVoiceAudio(scriptText: string, voiceId: string, userId: string, settings: { speed?: number; pitch?: number; volume?: number; emotion?: string } = {}): Promise<string> {
  try {
    const result = await generateMinimaxVoice({
      text: scriptText,
      voice_settings: {
        voice_id: voiceId,
        speed: settings.speed ?? 1.0,
        pitch: settings.pitch,
        volume: settings.volume,
        emotion: (settings.emotion as 'auto' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'neutral') || 'auto'
      },
      user_id: userId,
      batch_id: crypto.randomUUID()
    });

    if (!result.success || !result.audio_url) {
      throw new Error(result.error || 'Minimax voice generation failed');
    }

    return result.audio_url;

  } catch (error) {
    console.error('Minimax TTS error:', error);
    throw error;
  }
}

/**
 * Calculate credit costs for talking avatar operations
 * Pricing: 1.0 credits per second (min 10, max 60)
 *
 * fal.ai LTX Cost: $0.0008 per megapixel
 * - Landscape (1024×576) at 60s = ~884 MP = ~$0.71
 * - Portrait (576×1024) at 60s = ~884 MP = ~$0.71
 *
 * At 1 credit/sec: 60 credits max per video
 * Monthly (600 credits) = 10 videos of 60s | Trial (100 credits) = 1-2 videos
 */
function calculateTalkingAvatarCreditCost(request: TalkingAvatarRequest) {
  let estimatedDuration: number;

  // Use provided audio duration if available (for uploaded audio)
  if (request.audio_duration_seconds) {
    estimatedDuration = Math.min(request.audio_duration_seconds, LTX_MAX_DURATION_SECONDS);
  } else {
    // Estimate from script word count (~2.5 words per second)
    const wordCount = request.script_text.trim().split(/\s+/).filter(Boolean).length;
    estimatedDuration = Math.min(Math.ceil(wordCount / 2.5), LTX_MAX_DURATION_SECONDS);
  }

  // 1.0 credits per second, minimum 10, maximum 60 (for 60-second limit)
  const creditsPerSecond = 1.0;
  const total = Math.max(10, Math.min(60, Math.ceil(estimatedDuration * creditsPerSecond)));

  const wordCount = request.script_text.trim().split(/\s+/).filter(Boolean).length;

  return {
    base: 10, // Minimum 10 credits
    tier1_cost: 0,
    tier2_cost: 0,
    tier3_cost: 0,
    total,
    word_count: wordCount,
    estimated_duration: estimatedDuration,
    duration_formatted: `${Math.floor(estimatedDuration / 60)}:${(estimatedDuration % 60).toString().padStart(2, '0')}`
  };
}

