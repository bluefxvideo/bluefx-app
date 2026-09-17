'use server';

import { after } from 'next/server';
import { createClient, createAdminClient } from '@/app/supabase/server';
import { uploadImageToStorage, uploadAudioToStorage, downloadAndUploadVideo } from '@/actions/supabase-storage';
import { createFalLTX23Prediction } from '@/actions/models/fal-ltx-image-to-video';
import { submitKlingO3ProImageToVideo } from '@/actions/models/fal-kling-video';
import { ensureFalCompatibleImage } from '@/lib/fal-image-guard';
import { refundFailedGeneration, refundSentence } from '@/lib/credits/refund';
import { probeMediaSeconds } from '@/lib/media/probe-seconds';
import { convertVoiceInMedia } from '@/lib/voice-changer/convert';
import type { Json } from '@/types/database';
import {
  AVATAR_TIER_CONFIG,
  scriptFit,
  buildAvatarSpeechPrompt,
  isScriptTier,
  readAvatarTier,
  type AvatarQualityTier,
  AVATAR_VOICE_SWITCH_CREDITS,
} from '@/types/talking-avatar-tiers';
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
  deductCreditsAdmin,
  storeTalkingAvatarResults,
  recordTalkingAvatarMetrics,
  getTalkingAvatarVideo,
  updateTalkingAvatarVideoAdmin
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
  /**
   * Quality tier. 'standard' (default) is the audio-driven LTX-2 19B path.
   * 'fast' | 'ultra' render the typed script with a Video Maker engine that
   * speaks the line itself; no audio fields are needed or read.
   */
  quality_tier?: AvatarQualityTier;
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
        if (isScriptTier(authenticatedRequest.quality_tier)) {
          return await handleScriptTierGeneration(authenticatedRequest, authenticatedRequest.quality_tier, batch_id, startTime);
        }
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

    // The video is priced by the real length of this file, so the page gets the
    // measured figure the moment step 3 opens; the word count is only the fallback.
    const measuredVoiceSeconds = voiceAudioUrl ? await probeMediaSeconds(voiceAudioUrl) : null;

    return {
      success: true,
      step_data: {
        current_step: 2,
        total_steps: 3,
        voice_audio_url: voiceAudioUrl,
        estimated_duration: measuredVoiceSeconds ? Math.ceil(measuredVoiceSeconds) : estimatedDuration,
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
 * Fast / Ultra: the avatar speaks the typed script.
 *
 * Reuses the Video Maker engines (LTX-2.3 fast, Kling O3 Pro) with the avatar
 * photo as first frame and the script as a quoted line in the prompt. Order:
 * validate the script against the tier cap (no DB, no charge when too long),
 * price it from the snapped clip length, check the balance, write the row,
 * submit to fal with the shared webhook, charge only once fal accepted.
 * Completion arrives through /api/webhooks/fal-ai, which already resolves
 * avatar_videos by fal_request_id, or through pollAvatarTierGeneration.
 */
async function handleScriptTierGeneration(
  request: TalkingAvatarRequest,
  tier: Exclude<AvatarQualityTier, 'standard'>,
  batch_id: string,
  startTime: number
): Promise<TalkingAvatarResponse> {
  const fail = (error: string, remaining = 0): TalkingAvatarResponse => ({
    success: false,
    error,
    batch_id,
    generation_time_ms: Date.now() - startTime,
    credits_used: 0,
    remaining_credits: remaining,
  });

  const config = AVATAR_TIER_CONFIG[tier];
  const script = (request.script_text || '').trim();
  if (!script) return fail('Type the script the avatar should speak.');
  if (!request.avatar_image_url) return fail('Pick an avatar first.');

  // 1. Script length against the tier cap, before anything is written or charged
  const fit = scriptFit(tier, script);
  if (!fit.fits || !fit.clipSeconds) {
    return fail(
      `Your script is ${fit.words} words. ${config.label} carries up to ${fit.maxWords} words (${config.maxSeconds} s). Cut ${fit.overBy} word${fit.overBy === 1 ? '' : 's'}, or switch to Basic for scripts up to 60 seconds.`
    );
  }
  const clipSeconds = fit.clipSeconds;
  const credits = fit.credits;

  // 2. Balance
  const userCreditsResult = await getUserCredits(request.user_id);
  if (!userCreditsResult.success) return fail(userCreditsResult.error || 'Failed to check credits');
  const userCredits = userCreditsResult.credits || 0;
  if (userCredits < credits) {
    return fail(`Not enough credits. You need ${credits} credit${credits === 1 ? '' : 's'} but have ${userCredits}.`, userCredits);
  }

  // 3. Inputs for the engine
  const resolution: LTXResolution = request.resolution || (request.aspect_ratio === '9:16' ? 'portrait' : 'landscape');
  const aspect = resolution === 'portrait' ? '9:16' : '16:9';
  const prompt = buildAvatarSpeechPrompt(script, request.action_prompt);
  const imageUrl = (await ensureFalCompatibleImage(request.avatar_image_url, batch_id, 'avatar')) || request.avatar_image_url;
  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.bluefx.net'}/api/webhooks/fal-ai`;
  const settings = {
    tier,
    model_version: config.modelVersion,
    engine: config.videoSource,
    clip_seconds: clipSeconds,
    words: fit.words,
    aspect_ratio: config.aspectFromResolution ? aspect : 'follows-image',
    prompt,
  };
  // Fast renders 1080p at the chosen aspect; Ultra follows the photo, so no size is stored.
  const size = config.aspectFromResolution
    ? (resolution === 'portrait' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 })
    : { width: undefined, height: undefined };

  // 4. Row first, so every later step has something to mark
  const stored = await storeTalkingAvatarResults({
    user_id: request.user_id,
    script_text: script,
    avatar_template_id: request.avatar_template_id || null,
    batch_id,
    avatar_image_url: request.avatar_image_url,
    video_source: config.videoSource,
    resolution_width: size.width,
    resolution_height: size.height,
    duration: clipSeconds,
    audio_duration_seconds: clipSeconds,
    action_prompt: request.action_prompt,
    settings,
    status: 'processing',
  });
  if (!stored.success) {
    console.error('Database insert error:', stored.error);
    return fail('The video could not be started. No credits were taken. Please try again.', userCredits);
  }

  // 5. Charge before submitting (the Video Swap / Clone Studio order): a debit
  // then exists for any webhook, and a submit failure refunds against it.
  const deductResult = await deductCredits(request.user_id, credits, 'talking_avatar_generation', {
    batch_id,
    tier,
    model: config.modelVersion,
    duration_seconds: clipSeconds,
    video_source: config.videoSource,
  });
  if (!deductResult.success) {
    console.error('Avatar credit deduction failed:', deductResult.error);
    const notCharged = 'The credits could not be taken, so the video was not started. Please try again.';
    try {
      await updateTalkingAvatarVideoAdmin(batch_id, { status: 'failed', error_message: notCharged });
    } catch (updateError) {
      console.error('Could not mark the avatar row failed:', updateError);
    }
    return fail(notCharged, userCredits);
  }
  const refundAndFail = async (message: string) => {
    const refund = await refundFailedGeneration({ userId: request.user_id, referenceIds: [batch_id], operation: 'talking avatar generation' });
    if (!refund.refunded) console.error(`Avatar job ${batch_id} failed at submit and was not refunded:`, refund.reason);
    const text = withRefund(message, refund.refunded ? refund.amount : 0);
    try {
      await updateTalkingAvatarVideoAdmin(batch_id, { status: 'failed', error_message: text });
    } catch (updateError) {
      console.error('Could not mark the avatar row failed:', updateError);
    }
    return fail(text, (deductResult.remainingCredits ?? userCredits - credits) + (refund.refunded ? refund.amount || 0 : 0));
  };

  // 6. Submit
  let requestId: string | undefined;
  try {
    if (tier === 'fast') {
      const res = await createFalLTX23Prediction({
        prompt,
        image_url: imageUrl,
        duration: clipSeconds,
        resolution: '1080p',
        aspect_ratio: aspect,
        fps: 25,
        generate_audio: true,
        webhook_url: webhookUrl,
      });
      requestId = res.request_id;
    } else {
      const res = await submitKlingO3ProImageToVideo({
        prompt,
        image_url: imageUrl,
        duration: clipSeconds,
        generate_audio: true,
        shot_type: 'customize',
        webhook_url: webhookUrl,
      });
      if (!res.success) throw new Error(res.error || 'Video submit failed');
      requestId = res.request_id;
    }
    if (!requestId) throw new Error('fal.ai did not return a request_id');
  } catch (error) {
    // The engine's own text (status codes, JSON, request ids) stays in the log
    const raw = error instanceof Error ? error.message : 'Video submit failed';
    console.error(`Avatar ${tier} submit error:`, raw);
    return await refundAndFail(describeSubmitFailure(raw));
  }

  // 7. Request id on the row: the webhook and the poller look the job up by it,
  // so the charge is only kept once the key is durably stored.
  let keyed = false;
  try {
    await updateTalkingAvatarVideoAdmin(batch_id, { fal_request_id: requestId, status: 'processing' });
    keyed = true;
  } catch (error) {
    console.error('Could not store fal_request_id, retrying once:', error);
    try {
      await updateTalkingAvatarVideoAdmin(batch_id, { fal_request_id: requestId, status: 'processing' });
      keyed = true;
    } catch (retryError) {
      console.error('fal_request_id still not stored:', retryError);
    }
  }
  if (!keyed) {
    console.error(`Avatar ${tier} job ${requestId} was submitted but its id could not be stored`);
    return await refundAndFail('The video was started but could not be saved on our side');
  }

  await createPredictionRecord({
    prediction_id: requestId,
    user_id: request.user_id,
    tool_id: 'talking-avatar',
    service_id: 'fal-ai',
    model_version: config.modelVersion,
    status: 'processing',
    input_data: {
      avatar_image_url: request.avatar_image_url,
      script_text: script,
      avatar_template_id: request.avatar_template_id,
      avatar_video_id: batch_id,
      tier,
      clip_seconds: clipSeconds,
      resolution,
      action_prompt: request.action_prompt,
    } as any,
  });

  await recordTalkingAvatarMetrics({
    user_id: request.user_id,
    batch_id,
    model_version: config.modelVersion,
    script_text: script,
    duration: clipSeconds,
    aspect_ratio: aspect,
    generation_time_ms: Date.now() - startTime,
    credits_used: credits,
    workflow_type: 'generate',
    has_custom_avatar: !!request.custom_avatar_image,
  });

  console.log(`✅ Avatar ${tier} generation started: ${requestId} (${clipSeconds}s, ${credits} credits)`);
  return {
    success: true,
    step_data: { current_step: 3, total_steps: 3 },
    video: {
      id: batch_id,
      video_url: '',
      script_text: script,
      avatar_image_url: request.avatar_image_url,
      created_at: new Date().toISOString(),
    },
    batch_id,
    prediction_id: requestId,
    generation_time_ms: Date.now() - startTime,
    credits_used: credits,
    remaining_credits: deductResult.remainingCredits ?? userCredits - credits,
  };
}

/**
 * Poll fallback for every avatar job on fal (Basic, Fast, Ultra). The webhook
 * is the primary path; the page calls this every 10 s so a missed webhook or a
 * missed Realtime event (sleeping laptop, dropped wifi) still finishes the job. fal's queue status never says FAILED: a failed job reports
 * COMPLETED and the result endpoint answers 4xx with the reason, while 5xx,
 * 429 and network errors are transient. Terminal writes claim the row with
 * a status guard so the webhook and this poller cannot both refund or both
 * complete the same job.
 */
export async function pollAvatarTierGeneration(
  videoId: string,
  /**
   * false: only report. When fal says the job is done, the answer is
   * 'processing' with engineDone, and the webhook gets to finish it.
   * true: this call downloads, stores and closes the job itself. The page sends
   * true once engineDone has been seen for about 30 s, so the webhook and the
   * poller do not both store the same video on every job.
   */
  takeOver = true
): Promise<{
  status: 'processing' | 'completed' | 'failed';
  video_url?: string | null;
  error?: string;
  engineDone?: boolean;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'processing', error: 'Not signed in' };

  let video: Awaited<ReturnType<typeof getTalkingAvatarVideo>>;
  try {
    video = await getTalkingAvatarVideo(videoId, user.id);
  } catch (error) {
    console.error('pollAvatarTierGeneration could not read the row:', error);
    return { status: 'processing' };
  }
  if (!video) return { status: 'failed', error: 'This video no longer exists.' };
  if (video.status === 'completed') return { status: 'completed', video_url: video.video_url };
  if (video.status === 'failed') return { status: 'failed', error: video.error_message || 'The video could not be made' };

  const tier = readAvatarTier(video);
  const requestId = video.fal_request_id;
  // Age guard: a job that cannot be finished any more (lost webhook, the engine
  // never answers, the request id never reached the row) is closed and refunded
  // instead of spinning until the user gives up. Every "cannot finish" exit below
  // checks it, so a History card older than 45 minutes always gets an answer.
  const ageMs = Date.now() - new Date(video.created_at || Date.now()).getTime();
  const tooOld = ageMs > 45 * 60 * 1000;
  const closeAsTimedOut = () => failAvatarTierJob(videoId, user.id, 'The video engine did not finish in time');
  // Only these answers mean "the engine no longer knows this job". Auth errors,
  // rate limits and 5xx are passing trouble: one of them must never cost the
  // user a finished video, so they always leave the job open for the next check.
  const jobIsGone = (status: number) => [400, 404, 410, 422].includes(status);

  // No fal request id: a legacy Hedra row (that engine is retired, its few 2025
  // rows can only be closed) or a row whose id never got stored
  if (!requestId) return tooOld ? await closeAsTimedOut() : { status: 'processing' };
  if (tier === 'standard' && video.video_source !== 'fal-ltx') {
    return tooOld ? await closeAsTimedOut() : { status: 'processing' };
  }

  // Status and result live under the base app id, not the full endpoint
  const base = tier === 'fast' ? 'fal-ai/ltx-2.3' : tier === 'ultra' ? 'fal-ai/kling-video' : 'fal-ai/ltx-2-19b';
  const falKey = process.env.FAL_KEY;
  if (!falKey) return { status: 'processing' };

  try {
    const statusRes = await fetch(`https://queue.fal.run/${base}/requests/${requestId}/status`, { headers: { Authorization: `Key ${falKey}` } });
    if (!statusRes.ok) return tooOld && jobIsGone(statusRes.status) ? await closeAsTimedOut() : { status: 'processing' };
    const queue = (await statusRes.json()) as { status?: string };
    if (queue.status === 'FAILED') {
      return await failAvatarTierJob(videoId, user.id, 'The video engine reported a failure');
    }
    if (queue.status !== 'COMPLETED') {
      return tooOld ? await closeAsTimedOut() : { status: 'processing' };
    }

    if (!takeOver) return { status: 'processing', engineDone: true };

    const resultRes = await fetch(`https://queue.fal.run/${base}/requests/${requestId}`, { headers: { Authorization: `Key ${falKey}` } });
    if (!resultRes.ok) {
      // 400/422 from the result endpoint is fal's way of reporting a failed job.
      if (resultRes.status === 400 || resultRes.status === 422) {
        const detail = (await resultRes.text()).slice(0, 300);
        return await failAvatarTierJob(videoId, user.id, describeProviderFailure(detail));
      }
      // 404/410 on an old job: the engine keeps a finished video only for a while.
      // Everything else (auth, 405, 429, 5xx, network) is transient: the webhook or
      // the next check decides, never a refund.
      return tooOld && (resultRes.status === 404 || resultRes.status === 410)
        ? await failAvatarTierJob(videoId, user.id, 'The video engine no longer has this video')
        : { status: 'processing' };
    }
    const result = (await resultRes.json()) as { video?: { url?: string } };
    const providerUrl = result?.video?.url;
    if (!providerUrl) {
      return await failAvatarTierJob(videoId, user.id, 'The video engine finished without a video');
    }

    const uploaded = await downloadAndUploadVideo(providerUrl, 'talking-avatar', `${tier}_${requestId}`);
    if (!(uploaded.success && uploaded.url) && tooOld) {
      // An old job must not be marked ready with a dead link. But the copy can also
      // fail on our side (storage hiccup): only give up when the engine's file itself is gone.
      let fileIsGone = false;
      try {
        const head = await fetch(providerUrl, { method: 'HEAD' });
        fileIsGone = [403, 404, 410].includes(head.status);
      } catch {
        // Network trouble: keep the fallback below
      }
      if (fileIsGone) {
        return await failAvatarTierJob(videoId, user.id, 'The video engine no longer has this video');
      }
    }
    const finalUrl = uploaded.success && uploaded.url ? uploaded.url : providerUrl;

    // Claim the completion: only a row still in 'processing' is ours to finish
    const admin = createAdminClient();
    const { data: claimed } = await admin
      .from('avatar_videos')
      .update({ status: 'completed', video_url: finalUrl, updated_at: new Date().toISOString() })
      .eq('id', videoId)
      .eq('status', 'processing')
      .select('id');
    if (!claimed || claimed.length === 0) {
      const fresh = await getTalkingAvatarVideo(videoId, user.id);
      if (fresh?.status === 'failed') return { status: 'failed', error: fresh.error_message || 'Video generation failed' };
      return { status: 'completed', video_url: fresh?.video_url || finalUrl };
    }
    return { status: 'completed', video_url: finalUrl };
  } catch (error) {
    console.error('pollAvatarTierGeneration error:', error);
    return { status: 'processing' };
  }
}

// ─── Switch voice on a finished avatar video (ChatterboxHD speech-to-speech) ───

/** No switch may be saved or charged after this long; the status call reports it as failed. */
const VOICE_SWITCH_MAX_MS = 10 * 60 * 1000;
/** A running job refreshes `heartbeat_at` this often... */
const VOICE_SWITCH_HEARTBEAT_MS = 15 * 1000;
/** ...and counts as lost (an app update or restart ended it) once the last one is older than this. */
const VOICE_SWITCH_LOST_MS = 60 * 1000;

type VoiceSwapState = {
  status?: 'running' | 'done' | 'failed';
  started_at?: string;
  heartbeat_at?: string;
  finished_at?: string;
  batch_id?: string;
  /** Made by the page for each click, so its poll never mistakes an earlier result for this one. */
  request_id?: string;
  target_voice_url?: string;
  error?: string;
  credits?: number;
  high_quality?: boolean;
  converted_at?: string;
};

function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function swapOf(settings: Record<string, unknown>): VoiceSwapState {
  return settingsObject(settings.voice_swap) as VoiceSwapState;
}

function validRequestId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(value) ? value : undefined;
}

/** The one sentence a failed switch shows. Only a refusal of the sample blames the recording. */
function describeVoiceSwitchFailure(raw: string | undefined): string {
  if (raw && /ChatterboxHD API error \(4\d\d\)/.test(raw)) {
    return 'The voice sample could not be used. Try a clean recording of 10 to 30 seconds with no music. No credits were taken.';
  }
  return 'The voice could not be switched. Try again in a minute. No credits were taken.';
}

/** Why a running switch can no longer finish, or null while it still can. */
function voiceSwitchLostReason(swap: VoiceSwapState, now = Date.now()): string | null {
  if (swap.status !== 'running') return null;
  const startedAt = swap.started_at ? Date.parse(swap.started_at) : NaN;
  if (!Number.isFinite(startedAt) || now - startedAt > VOICE_SWITCH_MAX_MS) {
    return 'The voice switch took too long and was stopped. Try again. No credits were taken.';
  }
  const lastSign = swap.heartbeat_at ? Date.parse(swap.heartbeat_at) : startedAt;
  if (!Number.isFinite(lastSign) || now - lastSign > VOICE_SWITCH_LOST_MS) {
    return 'The voice switch was cut off, most likely by an app update. Try again. No credits were taken.';
  }
  return null;
}

/**
 * Write `settings` only while the switch `batchId` still runs on this row. Every write
 * of a job goes through here: a job that was declared lost, or replaced by a newer
 * switch, can no longer save anything (and so is never charged).
 */
async function writeWhileSwitchRuns(
  videoId: string,
  userId: string,
  batchId: string,
  settings: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from('avatar_videos')
    .update({ video_settings: settings as Json, updated_at: new Date().toISOString() })
    .eq('id', videoId)
    .eq('user_id', userId)
    .eq('video_settings->voice_swap->>batch_id', batchId)
    .eq('video_settings->voice_swap->>status', 'running')
    .select('id');
  if (error) throw new Error(`voice switch state write failed: ${error.message}`);
  return !!data && data.length > 0;
}

/**
 * Put the user's own voice on a finished avatar video. Same pipeline as Video
 * Maker and Agent Clone: the picture is untouched, only the audio track is
 * replaced (Chatterbox keeps the original timing, so the lips stay in sync).
 * This matters most on Fast and Ultra, where the engine picks the voice and it
 * changes from one video to the next.
 *
 * The conversion runs after this action has answered: a 60 second video takes
 * longer than the live proxy lets a request live (about 55 s), and a cut request
 * would still convert and charge while the page reported a failure. The page
 * follows the job with getAvatarVoiceSwitchStatus. The state lives in
 * `video_settings.voice_swap`, the result in `video_settings.voice_video_url`
 * next to the original. 4 credits are taken only after the new video is saved.
 */
export async function switchAvatarVoice(
  videoId: string,
  targetVoiceUrl: string,
  requestId?: string,
): Promise<{ success: boolean; started?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'You are signed out. Sign in again and retry.' };

    // The sample must be a file in our own storage (the page uploads it there first)
    const storageRoot = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
    if (!targetVoiceUrl?.startsWith(storageRoot)) {
      return { success: false, error: 'The voice sample is missing. Upload it again.' };
    }

    const video = await getTalkingAvatarVideo(videoId, user.id);
    if (!video) return { success: false, error: 'This video no longer exists.' };
    if (video.status !== 'completed' || !video.video_url) {
      return { success: false, error: 'Wait for the video to finish, then switch the voice.' };
    }

    const settings = settingsObject(video.video_settings);
    const swap = swapOf(settings);
    // A running switch blocks a new one, unless it was lost (an app update ends it)
    if (swap.status === 'running' && !voiceSwitchLostReason(swap)) {
      return { success: false, error: 'A voice switch is already running for this video. The new version shows up here when it is ready.' };
    }

    const creditCheck = await getUserCredits(user.id);
    if (!creditCheck.success || (creditCheck.credits || 0) < AVATAR_VOICE_SWITCH_CREDITS) {
      return { success: false, error: `Not enough credits. Switching the voice costs ${AVATAR_VOICE_SWITCH_CREDITS} credits.` };
    }

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const batchId = `avatar_voice_${videoId.slice(0, 8)}_${startedAtMs}`;
    // A fresh state: nothing from an earlier switch (its credits, its error) carries over
    await updateTalkingAvatarVideoAdmin(videoId, {
      video_settings: {
        ...settings,
        voice_swap: {
          status: 'running',
          started_at: startedAt,
          heartbeat_at: startedAt,
          batch_id: batchId,
          request_id: validRequestId(requestId),
          target_voice_url: targetVoiceUrl,
        } satisfies VoiceSwapState,
      } as Json,
    });

    const userId = user.id;
    const sourceUrl = video.video_url;
    console.log(`🎙️ AI Avatar: voice switch started (${batchId})`);
    after(() => runAvatarVoiceSwitch({ userId, videoId, sourceUrl, targetVoiceUrl, batchId, startedAtMs }));

    return { success: true, started: true };
  } catch (error) {
    console.error('❌ AI Avatar voice switch start error:', error);
    return { success: false, error: 'The voice switch could not be started. Try again in a minute.' };
  }
}

/**
 * The background half of switchAvatarVoice. Admin client only, so nothing depends on
 * the request's cookies. Every state write is conditional (writeWhileSwitchRuns).
 */
async function runAvatarVoiceSwitch(job: {
  userId: string;
  videoId: string;
  sourceUrl: string;
  targetVoiceUrl: string;
  batchId: string;
  startedAtMs: number;
}): Promise<void> {
  const admin = createAdminClient();

  /** The row's settings while this job still owns it; null once it does not. Throws on a failed read. */
  const readOwnSettings = async (): Promise<Record<string, unknown> | null> => {
    const { data, error } = await admin
      .from('avatar_videos')
      .select('video_settings')
      .eq('id', job.videoId)
      .eq('user_id', job.userId)
      .single();
    if (error) throw new Error(`voice switch state read failed: ${error.message}`);
    const settings = settingsObject(data?.video_settings);
    const swap = swapOf(settings);
    return swap.batch_id === job.batchId && swap.status === 'running' ? settings : null;
  };

  const markFailed = async (reason: string) => {
    try {
      const settings = await readOwnSettings();
      if (!settings) return;
      await writeWhileSwitchRuns(job.videoId, job.userId, job.batchId, {
        ...settings,
        voice_swap: { ...swapOf(settings), status: 'failed', error: reason, finished_at: new Date().toISOString() },
      });
    } catch (error) {
      console.error(`AI Avatar voice switch: could not store the failure (${job.batchId}):`, error);
    }
  };

  // Proof of life for the status call: without it a job ended by an app update
  // would block the video until the 10 minute limit
  let beating = false;
  const heartbeat = setInterval(async () => {
    if (beating) return;
    beating = true;
    try {
      const settings = await readOwnSettings();
      if (settings) {
        await writeWhileSwitchRuns(job.videoId, job.userId, job.batchId, {
          ...settings,
          voice_swap: { ...swapOf(settings), heartbeat_at: new Date().toISOString() },
        });
      }
    } catch (error) {
      console.warn(`AI Avatar voice switch heartbeat failed (${job.batchId}):`, error);
    } finally {
      beating = false;
    }
  }, VOICE_SWITCH_HEARTBEAT_MS);

  try {
    const result = await convertVoiceInMedia({
      batchId: job.batchId,
      // Always the original: switching twice must not re-voice an already re-voiced track
      sourceUrl: job.sourceUrl,
      sourceIsVideo: true,
      sourceExt: 'mp4',
      target: { mode: 'custom', sampleUrl: job.targetVoiceUrl },
      highQuality: true,
      output: { bucket: 'videos', folder: 'talking-avatar' },
      // `videos` only accepts video/*; the extracted WAV needs an audio-friendly bucket
      scratch: { bucket: 'script-videos', folder: `${job.userId}/talking-avatar` },
    });
    if (!result.success || result.resultType !== 'video') {
      const raw = result.success ? 'Voice switch did not return a video' : result.error;
      console.error(`AI Avatar voice switch failed (${job.batchId}):`, raw);
      await markFailed(describeVoiceSwitchFailure(raw));
      return;
    }

    // Past the limit the page has already been told this switch failed
    if (Date.now() - job.startedAtMs > VOICE_SWITCH_MAX_MS) {
      console.warn(`AI Avatar voice switch (${job.batchId}) finished after the time limit; result not used`);
      await markFailed('The voice switch took too long and was stopped. Try again. No credits were taken.');
      return;
    }

    // Save first, charge second: a video the user cannot reach must not cost credits.
    // The settings are read fresh so the tier fields (tier, prompt, clip_seconds) stay.
    const settings = await readOwnSettings();
    const finishedAt = new Date().toISOString();
    const saved = settings
      ? await writeWhileSwitchRuns(job.videoId, job.userId, job.batchId, {
          ...settings,
          voice_video_url: result.videoUrl,
          voice_swap: {
            ...swapOf(settings),
            status: 'done',
            error: undefined,
            high_quality: true,
            converted_at: finishedAt,
            finished_at: finishedAt,
            credits: AVATAR_VOICE_SWITCH_CREDITS,
          },
        })
      : false;
    if (!saved) {
      console.warn(`AI Avatar voice switch (${job.batchId}) no longer owns the row (declared lost or replaced); result not used, not charged`);
      return;
    }

    const deduction = await deductCreditsAdmin(job.userId, AVATAR_VOICE_SWITCH_CREDITS, 'avatar-voice-switch', {
      video_id: job.videoId,
      batch_id: job.batchId,
    } as Json);
    if (!deduction.success) {
      // The user keeps the video; the missed charge is noted on this switch's own state
      console.error(`AI Avatar voice switch: credit deduction failed (${job.batchId}):`, deduction.error);
      try {
        const { data, error } = await admin
          .from('avatar_videos')
          .select('video_settings')
          .eq('id', job.videoId)
          .eq('user_id', job.userId)
          .single();
        if (error) throw error;
        const latest = settingsObject(data?.video_settings);
        if (swapOf(latest).batch_id === job.batchId) {
          await admin
            .from('avatar_videos')
            .update({ video_settings: { ...latest, voice_swap: { ...swapOf(latest), credits: 0 } } as Json })
            .eq('id', job.videoId)
            .eq('video_settings->voice_swap->>batch_id', job.batchId);
        }
      } catch (error) {
        console.error(`AI Avatar voice switch: could not note the missed charge (${job.batchId}):`, error);
      }
    }
    console.log(`✅ AI Avatar: voice switched (${job.batchId})`);
  } catch (error) {
    console.error(`❌ AI Avatar voice switch error (${job.batchId}):`, error);
    await markFailed(describeVoiceSwitchFailure(undefined));
  } finally {
    clearInterval(heartbeat);
  }
}

/**
 * Where the voice switch `requestId` stands; the page asks every few seconds while one
 * runs. 'unknown' means the question could not be answered right now (sign-in or
 * database hiccup): the page asks again instead of drawing a conclusion.
 */
export async function getAvatarVoiceSwitchStatus(videoId: string, requestId?: string): Promise<{
  status: 'none' | 'running' | 'done' | 'failed' | 'unknown';
  voiceVideoUrl?: string | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: 'unknown' };
    const video = await getTalkingAvatarVideo(videoId, user.id);
    if (!video) return { status: 'failed', error: 'This video no longer exists.' };
    const settings = settingsObject(video.video_settings);
    const swap = swapOf(settings);
    const voiceVideoUrl = typeof settings.voice_video_url === 'string' ? settings.voice_video_url : null;

    // Only the switch this page started counts: an earlier result is not this one
    const wanted = validRequestId(requestId);
    if (wanted && swap.request_id !== wanted) return { status: 'none' };

    if (swap.status === 'running') {
      const lost = voiceSwitchLostReason(swap);
      if (!lost) return { status: 'running' };
      // Record the verdict, so a job that is somehow still alive can no longer save or charge
      if (!swap.batch_id) return { status: 'failed', error: lost };
      const recorded = await writeWhileSwitchRuns(videoId, user.id, swap.batch_id, {
        ...settings,
        voice_swap: { ...swap, status: 'failed', error: lost, finished_at: new Date().toISOString() },
      });
      // Not recorded: the job finished a moment ago. The next question gets its result.
      return recorded ? { status: 'failed', error: lost } : { status: 'unknown' };
    }
    if (swap.status === 'failed') return { status: 'failed', error: swap.error || describeVoiceSwitchFailure(undefined) };
    if (swap.status === 'done' && voiceVideoUrl) return { status: 'done', voiceVideoUrl };
    // Rows switched before the state had a status only carry the file
    if (!wanted && voiceVideoUrl) return { status: 'done', voiceVideoUrl };
    return { status: 'none' };
  } catch (error) {
    console.error('getAvatarVoiceSwitchStatus error:', error);
    return { status: 'unknown' };
  }
}

/** One sentence, one period, then the shared refund sentence when credits came back. */
function withRefund(reason: string, refundedCredits?: number): string {
  const sentence = `${reason.trim().replace(/[.!?]+$/, '')}.`;
  return refundedCredits && refundedCredits > 0 ? `${sentence} ${refundSentence(refundedCredits)}` : sentence;
}

/** A job the engine refused to accept, in words a client can act on. */
function describeSubmitFailure(raw: string): string {
  // Narrow on purpose: bare "content" or "policy" also match "Invalid content type"
  // and Content-Security-Policy in an HTML error page
  if (/content[_ -]?(policy|filter|moderation|violation)|safety|flagged|moderat|nsfw/i.test(raw)) {
    return 'The video engine declined this script or photo on safety grounds.';
  }
  return 'The video engine did not accept the job. Try again in a minute.';
}

/** fal's 4xx result payload → one plain sentence for the user. */
function describeProviderFailure(detail: string): string {
  try {
    const parsed = JSON.parse(detail) as { detail?: Array<{ msg?: string }> | string };
    const msg = Array.isArray(parsed.detail) ? parsed.detail.map((d) => d.msg || '').filter(Boolean).join(' ') : String(parsed.detail || '');
    if (/content|safety|flagged|policy/i.test(msg)) return 'The video engine declined this script or photo on safety grounds';
    if (msg) return `The video engine reported: ${msg.slice(0, 160)}`;
  } catch {
    // not JSON
  }
  return 'The video engine reported a failure';
}

/**
 * Claim the row as failed (status guard), then refund. If the webhook already
 * closed the row, nothing is refunded here and its state is returned instead.
 */
async function failAvatarTierJob(videoId: string, userId: string, reason: string) {
  const admin = createAdminClient();
  // The claim already carries a complete sentence: Realtime shows this write on the page
  const { data: claimed, error: claimError } = await admin
    .from('avatar_videos')
    .update({ status: 'failed', error_message: withRefund(reason), updated_at: new Date().toISOString() })
    .eq('id', videoId)
    .in('status', ['processing', 'pending'])
    .select('id');
  if (claimError) console.error('Avatar failure claim failed:', claimError);
  if (!claimed || claimed.length === 0) {
    const fresh = await getTalkingAvatarVideo(videoId, userId);
    if (fresh?.status === 'completed') return { status: 'completed' as const, video_url: fresh.video_url };
    if (fresh?.status === 'failed') return { status: 'failed' as const, error: fresh.error_message || withRefund(reason) };
    // Nothing changed (the claim itself failed): say so instead of reporting a failure that is not on the row
    return { status: 'processing' as const };
  }
  const refund = await refundFailedGeneration({
    userId,
    referenceIds: [videoId],
    operation: 'talking avatar generation',
  });
  if (!refund.refunded) console.error(`Avatar job ${videoId} closed without a refund:`, refund.reason);
  const message = withRefund(reason, refund.refunded ? refund.amount : 0);
  await admin.from('avatar_videos').update({ error_message: message }).eq('id', videoId);
  return { status: 'failed' as const, error: message };
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

    // An uploaded recording must be a file in our own storage. The page once sent
    // the browser's blob: link here, which the video engine can never open, so
    // every uploaded recording was charged, failed and refunded.
    const isUploadedAudio = !request.voice_audio_url && !!request.uploaded_audio_url;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isHostedUpload = supabaseUrl
      ? audioUrl.startsWith(`${supabaseUrl}/storage/v1/object/public/`)
      : /^https:\/\//i.test(audioUrl);
    if (isUploadedAudio && !isHostedUpload) {
      return {
        success: false,
        error: 'The audio file did not upload. Pick the file again and retry. Nothing was charged.',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Determine audio duration
    let audioDurationSeconds: number;
    // The price is 1 credit per second, so the length is measured here for any
    // audio that sits in our own storage (generated voice or uploaded recording).
    // The browser's figure is the fallback when the file cannot be measured.
    const inOwnStorage = !!supabaseUrl && audioUrl.startsWith(`${supabaseUrl}/storage/v1/object/public/`);
    const measuredSeconds = inOwnStorage ? await probeMediaSeconds(audioUrl) : null;
    const browserSeconds = request.audio_duration_seconds;
    if (measuredSeconds) {
      // Decoders differ by a few hundredths of a second on MP3 (frame padding).
      // Within half a second the page's figure stands, so the price on the button
      // is the price charged and a 1:00 file is not turned away after upload.
      audioDurationSeconds = browserSeconds && Math.abs(measuredSeconds - browserSeconds) < 0.5
        ? browserSeconds
        : measuredSeconds;
    } else if (request.audio_duration_seconds) {
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
        error: `Not enough credits. You need ${creditCosts.total} credit${creditCosts.total === 1 ? '' : 's'} but have ${userCredits}.`,
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
        error: 'The video could not be started. No credits were taken. Please try again.',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: userCredits,
      };
    }

    // Generate video with fal.ai LTX Audio-to-Video
    // Credits are deducted AFTER the request is accepted to avoid charging on API errors
    console.log(`🎬 Starting fal.ai LTX video generation: ${width}×${height}, ${audioDurationSeconds}s`);

    let deductResult: { success: boolean; remainingCredits?: number; error?: string } = { success: false };
    // The failure text may only say "No credits were taken" when the charge was never reached
    let chargeAttempted = false;

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

      // Deduct credits AFTER fal.ai request is accepted
      chargeAttempted = true;
      deductResult = await deductCredits(
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
        console.error('Credit deduction failed (video already submitted):', deductResult.error);
      } else {
        // The engine can fail a job within the few writes between "accepted" and this
        // charge (bad input fails in under a second). Its failure webhook then closed
        // the row and found no debit to refund, so the charge is settled here.
        const afterCharge = await getTalkingAvatarVideo(batch_id, request.user_id).catch(() => null);
        if (afterCharge?.status === 'failed') {
          const lateRefund = await refundFailedGeneration({
            userId: request.user_id,
            referenceIds: [batch_id, falRequestId],
            operation: 'talking avatar generation',
          });
          if (!lateRefund.refunded) console.error(`Avatar job ${batch_id} failed before the charge and was not refunded:`, lateRefund.reason);
          const text = withRefund(afterCharge.error_message || 'The video could not be made', lateRefund.refunded ? lateRefund.amount : 0);
          try {
            await updateTalkingAvatarVideoAdmin(batch_id, { error_message: text });
          } catch (updateError) {
            console.error('Could not store the refund on the avatar row:', updateError);
          }
          return {
            success: false,
            error: text,
            batch_id,
            generation_time_ms: Date.now() - startTime,
            credits_used: 0,
            remaining_credits: (deductResult.remainingCredits ?? userCredits - creditCosts.total) + (lateRefund.refunded ? lateRefund.amount || 0 : 0),
          };
        }
      }

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

      // Credits are taken only after the engine accepts the job, so nothing was charged
      const basicFailure = `${describeSubmitFailure(error instanceof Error ? error.message : '')}${chargeAttempted ? '' : ' No credits were taken.'}`;
      try {
        await updateTalkingAvatarVideoAdmin(batch_id, { status: 'failed', error_message: basicFailure });
      } catch (updateError) {
        console.error('Could not store the failure reason on the avatar row:', updateError);
      }

      return {
        success: false,
        error: basicFailure,
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

  // 1.0 credits per second, maximum 60 (for 60-second limit)
  const creditsPerSecond = 1.0;
  const total = Math.min(60, Math.ceil(estimatedDuration * creditsPerSecond));

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

