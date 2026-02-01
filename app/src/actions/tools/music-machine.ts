'use server';

import { createClient } from '@/app/supabase/server';
import { MUSIC_MODEL_CONFIG, calculateMusicCredits, type MusicModel } from '@/types/music-machine';
import {
  createLyria2Prediction,
  getLyria2ModelInfo,
} from '@/actions/models/google-lyria-2';
import {
  createStableAudioPrediction,
  getStableAudioModelInfo,
} from '@/actions/models/stable-audio';
import {
  createElevenLabsMusicPrediction,
  getElevenLabsMusicModelInfo,
} from '@/actions/models/elevenlabs-music';
import {
  createMiniMaxMusicPrediction,
  getMiniMaxMusicModelInfo,
} from '@/actions/models/minimax-music';
import { createMusicRecord } from '@/actions/database/music-database';
import { createPredictionRecord } from '@/actions/database/thumbnail-database';

// Enhanced request/response interfaces following AI orchestrator pattern
export interface MusicMachineRequest {
  // Core generation parameters
  prompt: string;
  duration?: number; // 1-300 seconds

  // Model selection (config-driven)
  model?: MusicModel; // 'unlimited' | 'hd' | 'vocals' | 'pro'

  // Shared advanced parameters
  negative_prompt?: string; // What to exclude (Unlimited, HD)
  seed?: number; // Reproducibility control (Unlimited only)

  // Vocals model specific (MiniMax)
  lyrics?: string; // Song lyrics for vocals model (10-600 chars)
  reference_audio?: string; // URL for style reference
  style_strength?: number; // 0.0-1.0, how much to use reference

  // Legacy compatibility fields
  genre?: string; // Integrated into prompt optimization
  mood?: string; // Integrated into prompt optimization

  // System fields
  user_id: string;
}

export interface MusicMachineResponse {
  success: boolean;
  
  // Generated content
  generated_music?: {
    id: string;
    prediction_id: string;
    prompt: string;
    duration: number;
    model_version: string;
    output_format: string;
    status: string;
    audio_url?: string;
    created_at: string;
  };
  
  // Model information
  model_info?: {
    name: string;
    version: string;
    description: string;
    provider: string;
    tier?: string;
    capabilities: string[];
    limitations: string[];
    pricing: { credits?: number; replicate_cost?: string; estimate?: string };
    output_format: string;
    hardware?: string;
  };
  
  // Metadata
  prediction_id: string;
  batch_id: string;
  credits_used: number;
  remaining_credits: number;
  generation_time_ms: number;
  
  // Error handling
  error?: string;
  warnings?: string[];
}

/**
 * Music Machine - AI Orchestrator for Professional Music Generation
 * 
 * Features:
 * - Schema-driven MusicGen integration via Replicate API
 * - Advanced prompt optimization with genre/mood intelligence
 * - Audio conditioning and continuation support
 * - Real-time generation tracking with webhooks
 * - Intelligent credit calculation based on complexity
 * - Audio file upload and storage integration
 * - Professional model parameter tuning
 */
export async function executeMusicMachine(
  request: MusicMachineRequest
): Promise<MusicMachineResponse> {
  const startTime = Date.now();
  const batch_id = crypto.randomUUID(); // ✅ Follow perfect pattern
  let total_credits = 0;
  const warnings: string[] = [];

  try {
    const supabase = await createClient();
    
    // Authentication validation
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        success: false,
        error: 'Authentication required',
        prediction_id: '',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Use server-authenticated user ID
    const authenticatedRequest = {
      ...request,
      user_id: user.id,
    };

    // Step 1: Get model config
    const selectedModel = authenticatedRequest.model || 'unlimited';
    const config = MUSIC_MODEL_CONFIG[selectedModel];
    const modelProvider = config.provider;
    const duration = authenticatedRequest.duration || config.durations[0];

    // Calculate credits (Pro model uses dynamic pricing based on duration)
    total_credits = calculateMusicCredits(selectedModel, duration);

    // Optimize prompt
    const optimizedPrompt = optimizePromptForMusic(
      authenticatedRequest.prompt,
      authenticatedRequest.genre,
      authenticatedRequest.mood
    );

    console.log(`🎵 Using model: ${selectedModel} (${modelProvider}), duration: ${duration}s, credits: ${total_credits}`);

    // Step 3: Credit Validation (skip for unlimited model)
    const userCredits = await getUserCredits(supabase, user.id);
    if (selectedModel !== 'unlimited' && userCredits < total_credits) {
      return {
        success: false,
        error: `Insufficient credits. Required: ${total_credits}, Available: ${userCredits}`,
        prediction_id: '',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: userCredits,
      };
    }

    // Step 4: Create Prediction with Webhook based on Tier
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
    const webhookUrl = baseUrl?.startsWith('https://')
      ? `${baseUrl}/api/webhooks/replicate-ai`
      : undefined;

    if (!webhookUrl) {
      console.log('⚠️ No valid HTTPS webhook URL available, prediction will run without webhook');
    } else {
      console.log('🔗 Using webhook URL:', webhookUrl);
    }

    let prediction: any;

    // Route to appropriate model based on selection
    switch (selectedModel) {
      case 'pro':
        // ElevenLabs Music - Pro model (15 credits)
        prediction = await createElevenLabsMusicPrediction({
          prompt: optimizedPrompt,
          duration: Math.min(duration, config.maxDuration),
          ...(webhookUrl && { webhook: webhookUrl })
        });
        console.log(`🎵 ElevenLabs Music prediction created:`, prediction.id);
        break;

      case 'vocals':
        // MiniMax Music 1.5 - Vocals model (10 credits)
        prediction = await createMiniMaxMusicPrediction({
          prompt: optimizedPrompt,
          ...(authenticatedRequest.lyrics && { lyrics: authenticatedRequest.lyrics }),
          ...(authenticatedRequest.reference_audio && {
            reference_audio: authenticatedRequest.reference_audio,
            style_strength: authenticatedRequest.style_strength ?? 0.5
          }),
          ...(webhookUrl && { webhook: webhookUrl })
        });
        console.log(`🎤 MiniMax Music prediction created:`, prediction.id);
        break;

      case 'hd':
        // Stable Audio 2.5 - HD model (8 credits)
        prediction = await createStableAudioPrediction({
          prompt: optimizedPrompt,
          seconds: Math.min(duration, config.maxDuration),
          negative_prompt: authenticatedRequest.negative_prompt || 'vocals, singing, voice, spoken word, lyrics',
          ...(webhookUrl && { webhook: webhookUrl })
        });
        console.log(`🎵 Stable Audio prediction created:`, prediction.id);
        break;

      default:
        // Lyria-2 - Unlimited model (free)
        prediction = await createLyria2Prediction({
          prompt: optimizedPrompt,
          ...(authenticatedRequest.seed && { seed: authenticatedRequest.seed }),
          ...(authenticatedRequest.negative_prompt && { negative_prompt: authenticatedRequest.negative_prompt }),
          user_id: authenticatedRequest.user_id,
          batch_id: batch_id,
          ...(webhookUrl && { webhook: webhookUrl })
        });
        console.log(`🎵 Lyria-2 prediction created:`, prediction.id);
    }

    // Create prediction tracking record
    await createPredictionRecord({
      prediction_id: prediction.id,
      user_id: request.user_id,
      tool_id: 'music-machine',
      service_id: 'replicate',
      model_version: modelProvider,
      status: 'starting',
      input_data: {
        prompt: request.prompt,
        model: selectedModel,
        model_provider: modelProvider,
        duration,
        negative_prompt: authenticatedRequest.negative_prompt,
        seed: authenticatedRequest.seed,
        lyrics: authenticatedRequest.lyrics,
      } as any,
    });

    // Step 5: Database Record Creation
    const musicRecord = await createMusicRecord(user.id, optimizedPrompt, {
      duration,
      prediction_id: prediction.id,
      batch_id,
      credits_used: total_credits,
      genre: authenticatedRequest.genre,
      mood: authenticatedRequest.mood,
      model_provider: modelProvider,
      tier: selectedModel, // Use model as tier for backwards compatibility
    });

    if (!musicRecord.success) {
      console.error('Failed to create music database record:', musicRecord.error);
      warnings.push('Database record creation failed, but generation is proceeding');
    }

    // Step 6: Credit Deduction (skip for unlimited model)
    if (selectedModel !== 'unlimited' && total_credits > 0) {
      await deductCredits(supabase, user.id, total_credits, batch_id, 'music_generation');
    }

    // Get model info based on selection
    const getModelInfo = async () => {
      switch (selectedModel) {
        case 'hd': return await getStableAudioModelInfo();
        case 'vocals': return await getMiniMaxMusicModelInfo();
        case 'pro': return await getElevenLabsMusicModelInfo();
        default: return await getLyria2ModelInfo();
      }
    };

    return {
      success: true,
      generated_music: {
        id: musicRecord.data?.id || `temp_${Date.now()}`,
        prediction_id: prediction.id,
        prompt: optimizedPrompt,
        duration: duration,
        model_version: modelProvider,
        output_format: 'audio',
        status: prediction.status,
        created_at: prediction.created_at,
      },
      model_info: await getModelInfo(),
      prediction_id: prediction.id,
      batch_id,
      credits_used: total_credits,
      remaining_credits: selectedModel === 'unlimited' ? userCredits : userCredits - total_credits,
      generation_time_ms: Date.now() - startTime,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

  } catch (error) {
    console.error('Music Machine execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Music generation failed',
      prediction_id: '',
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: total_credits,
      remaining_credits: 0,
    };
  }
}

/**
 * Intelligent Prompt Optimization for Music Generation
 * Enhances user prompts with genre/mood context and music-specific descriptors
 */
function optimizePromptForMusic(
  prompt: string, 
  genre?: string, 
  mood?: string
): string {
  let optimized = prompt.trim();
  
  // Add genre and mood context intelligently
  const contexts = [];
  if (genre && !optimized.toLowerCase().includes(genre.toLowerCase())) {
    contexts.push(genre);
  }
  if (mood && !optimized.toLowerCase().includes(mood.toLowerCase())) {
    contexts.push(mood);
  }
  
  if (contexts.length > 0) {
    optimized = `${contexts.join(' ')} music: ${optimized}`;
  }
  
  // Enhance with music production descriptors if not present
  const musicDescriptors = [
    'instrument', 'vocal', 'melody', 'rhythm', 'beat', 
    'harmony', 'chord', 'bass', 'drum', 'guitar', 'piano'
  ];
  
  const hasMusicalContext = musicDescriptors.some(desc => 
    optimized.toLowerCase().includes(desc)
  );
  
  if (!hasMusicalContext) {
    // Add appropriate musical context based on genre
    if (genre) {
      const genreInstruments = {
        'rock': 'electric guitar and drums',
        'jazz': 'piano and saxophone',
        'classical': 'orchestral instruments',
        'electronic': 'synthesizers and electronic beats',
        'folk': 'acoustic guitar',
        'hip-hop': 'beats and bass',
        'country': 'acoustic guitar and vocals',
        'pop': 'catchy melody and vocals'
      };
      
      const instruments = genreInstruments[genre.toLowerCase() as keyof typeof genreInstruments];
      if (instruments) {
        optimized += `, featuring ${instruments}`;
      } else {
        optimized += ', instrumental';
      }
    } else {
      optimized += ', instrumental';
    }
  }
  
  return optimized;
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
  // Deduct from available credits
  await supabase
    .from('user_credits')
    .update({
      available_credits: amount, // Note: This should be handled via RPC or proper SQL for atomic decrement
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