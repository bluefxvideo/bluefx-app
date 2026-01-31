'use server';

import { createClient } from '@/app/supabase/server';
import { uploadImageToStorage } from '@/actions/supabase-storage';
import { generateTalkingAvatarVideo } from '@/actions/models/hedra-api';
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
  custom_avatar_image?: File | null;
  workflow_step: 'avatar_select' | 'voice_generate' | 'video_generate';
  user_id: string;
  voice_audio_url?: string; // For video generation step
  aspect_ratio?: '16:9' | '9:16'; // Video orientation
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
      voiceAudioUrl = await generateVoiceAudio(request.script_text, request.voice_id, request.user_id);
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
 * Step 3: Handle final video generation using Hedra API
 */
async function handleVideoGeneration(
  request: TalkingAvatarRequest,
  batch_id: string,
  startTime: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<TalkingAvatarResponse> {
  let hedraGenerationId: string | null = null;
  
  try {
    // Calculate credit costs
    const creditCosts = calculateTalkingAvatarCreditCost(request);
    
    // Verify user has sufficient credits using proper pattern
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

    // Store initial record using proper pattern
    const storeResult = await storeTalkingAvatarResults({
      user_id: request.user_id,
      script_text: request.script_text,
      avatar_template_id: request.avatar_template_id || null,
      batch_id: batch_id,
      voice_audio_url: request.voice_audio_url,
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

    // Deduct credits using proper RPC pattern
    const deductResult = await deductCredits(
      request.user_id, 
      creditCosts.total, 
      'talking_avatar_generation',
      {
        batch_id,
        script_length: request.script_text.length,
        estimated_duration: creditCosts.estimated_duration
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
    
    // Step 3: Generate video with Hedra API following legacy pattern
    console.log('🎬 Starting Hedra video generation...');
    
    if (!request.voice_audio_url) {
      return {
        success: false,
        error: 'Voice audio URL is required for video generation',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: deductResult.remainingCredits || 0,
      };
    }
    
    try {
      // Calculate estimated duration from script (Hedra requires it)
      const wordCount = request.script_text.trim().split(/\s+/).filter(Boolean).length;
      const estimatedDurationSeconds = Math.max(3, Math.ceil(wordCount / 2.5)); // At least 3 seconds

      const hedraResult = await generateTalkingAvatarVideo(
        request.avatar_image_url || '',
        request.voice_audio_url,
        "A person talking at the camera", // Simplified to match successful curl test
        {
          aspectRatio: request.aspect_ratio || '16:9',
          resolution: '720p',
          duration: estimatedDurationSeconds, // Hedra requires duration despite docs saying optional
          waitForCompletion: false, // Use webhook for async processing
        }
      );

      if (!hedraResult.success) {
        console.error('Hedra generation failed:', hedraResult.error);
        
        // Update record with error using proper pattern
        await storeTalkingAvatarResults({
          user_id: request.user_id,
          script_text: request.script_text,
          avatar_template_id: request.avatar_template_id || null,
          batch_id: batch_id,
          status: 'failed',
          settings: { error_message: hedraResult.error }
        });

        return {
          success: false,
          error: `Video generation failed: ${hedraResult.error}`,
          batch_id,
          generation_time_ms: Date.now() - startTime,
          credits_used: 0,
          remaining_credits: userCredits,
        };
      }

      // Update record with Hedra generation ID following legacy pattern
      if (hedraResult.generationId) {
        hedraGenerationId = hedraResult.generationId;
        await storeTalkingAvatarResults({
          user_id: request.user_id,
          script_text: request.script_text,
          avatar_template_id: request.avatar_template_id || null,
          batch_id: batch_id,
          hedra_generation_id: hedraResult.generationId,
          voice_audio_url: request.voice_audio_url,
          avatar_image_url: request.avatar_image_url,
          status: 'processing',
          settings: {
            aspectRatio: '16:9',
            resolution: '720p',
            model_version: 'hedra-video-1.0'
          }
        });

        // Create prediction tracking record for unified system
        await createPredictionRecord({
          prediction_id: hedraResult.generationId,
          user_id: request.user_id,
          tool_id: 'talking-avatar',
          service_id: 'hedra',
          model_version: 'hedra-video-1.0',
          status: 'processing',
          input_data: {
            avatar_image_url: request.avatar_image_url,
            script_text: request.script_text,
            voice_id: request.voice_id,
            avatar_template_id: request.avatar_template_id,
            avatar_video_id: batch_id, // Reference to avatar_videos record
            estimated_duration: Math.ceil(request.script_text.trim().split(/\s+/).length / 2.5)
          } as any,
        });
      }

      console.log('✅ Hedra generation started:', hedraResult.generationId);

      // Record metrics for analytics
      await recordTalkingAvatarMetrics({
        user_id: request.user_id,
        batch_id: batch_id,
        model_version: 'hedra-video-1.0',
        script_text: request.script_text,
        duration: creditCosts.estimated_duration,
        aspect_ratio: '16:9',
        generation_time_ms: Date.now() - startTime,
        credits_used: creditCosts.total,
        workflow_type: 'generate',
        has_custom_avatar: !!request.custom_avatar_image
      });

    } catch (error) {
      console.error('Hedra API error:', error);
      
      // Update record with error following pattern
      await storeTalkingAvatarResults({
        user_id: request.user_id,
        script_text: request.script_text,
        avatar_template_id: request.avatar_template_id || null,
        batch_id: batch_id,
        status: 'failed',
        settings: { 
          error_message: error instanceof Error ? error.message : 'Hedra API error' 
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
      prediction_id: hedraGenerationId, // Add the Hedra generation ID for polling
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
async function generateVoiceAudio(scriptText: string, voiceId: string, userId: string): Promise<string> {
  try {
    const result = await generateMinimaxVoice({
      text: scriptText,
      voice_settings: {
        voice_id: voiceId,
        speed: 1.0,
        emotion: 'auto'
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
 * Simple proportional scaling: 6 credits per 30 seconds
 */
function calculateTalkingAvatarCreditCost(request: TalkingAvatarRequest) {
  const wordCount = request.script_text.trim().split(/\s+/).length;
  
  // Duration-based cost scaling - simple proportional
  const estimatedDuration = Math.ceil(wordCount / 2.5); // ~2.5 words per second
  
  // Simple calculation: 6 credits per 30 seconds, scaled proportionally
  // 30s = 6 credits, 60s = 12 credits, 90s = 18 credits, etc.
  const creditsPerSecond = 6 / 30; // 0.2 credits per second
  const total = Math.max(6, Math.ceil(estimatedDuration * creditsPerSecond));
  
  return {
    base: 6,
    tier1_cost: 0,
    tier2_cost: 0,
    tier3_cost: 0,
    total,
    word_count: wordCount,
    estimated_duration: estimatedDuration,
    duration_formatted: `${Math.floor(estimatedDuration / 60)}:${(estimatedDuration % 60).toString().padStart(2, '0')}`
  };
}

