'use server';

import { createClient } from '@/app/supabase/server';
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
import { createMusicRecord } from '@/actions/database/music-database';
import { createPredictionRecord } from '@/actions/database/thumbnail-database';
import { uploadAudioToStorage } from '@/actions/supabase-storage';

// Enhanced request/response interfaces following AI orchestrator pattern
export interface MusicMachineRequest {
  // Core generation parameters
  prompt: string;
  duration?: number; // 1-300 seconds

  // Tier selection (NEW - 3-tier system)
  tier?: 'unlimited' | 'hd' | 'pro';

  // Model configuration (UPDATED to support both MusicGen and Lyria-2)
  model_provider?: 'musicgen' | 'lyria-2';
  model_version?: 'stereo-melody-large' | 'stereo-large' | 'melody-large' | 'large'; // For MusicGen
  output_format?: 'wav' | 'mp3';
  
  // Audio conditioning (optional)
  input_audio?: string | File; // Reference audio for style conditioning
  continuation?: boolean; // Continue from input audio vs influence style
  
  // Advanced parameters (MusicGen specific)
  temperature?: number; // 0.0-2.0, creativity control
  top_k?: number; // Token sampling limit
  top_p?: number; // Cumulative probability sampling
  classifier_free_guidance?: number; // 1.0-10.0, prompt adherence
  normalization_strategy?: 'loudness' | 'clip' | 'peak' | 'rms';
  
  // Lyria-2 specific parameters
  negative_prompt?: string; // What to exclude from generation
  seed?: number; // Reproducibility control
  
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

    // Step 1: Audio Upload (if input audio provided)
    let inputAudioUrl: string | undefined;
    if (authenticatedRequest.input_audio) {
      console.log('🎵 Uploading input audio for conditioning...');
      
      const uploadResult = await uploadAudioToStorage(authenticatedRequest.input_audio);
      if (uploadResult.success && uploadResult.url) {
        inputAudioUrl = uploadResult.url;
        console.log('🎵 Input audio uploaded:', inputAudioUrl);
      } else {
        warnings.push('Input audio upload failed, proceeding without audio conditioning');
        console.warn('Audio upload failed:', uploadResult.error);
      }
    }

    // Step 2: Determine Tier and Set Credits
    const tier = authenticatedRequest.tier || 'unlimited';
    const TIER_CREDITS: Record<string, number> = { unlimited: 0, hd: 8, pro: 15 };
    const TIER_PROVIDERS: Record<string, string> = { unlimited: 'lyria-2', hd: 'stable-audio', pro: 'elevenlabs' };

    total_credits = TIER_CREDITS[tier] || 0;
    const modelProvider = TIER_PROVIDERS[tier] || 'lyria-2';

    // Optimize prompt
    const optimizedPrompt = optimizePromptForMusic(
      authenticatedRequest.prompt,
      authenticatedRequest.genre,
      authenticatedRequest.mood
    );

    console.log(`🎵 Using tier: ${tier} (${modelProvider}) with optimized prompt:`, optimizedPrompt);

    // Step 3: Credit Validation (skip for unlimited tier)
    const userCredits = await getUserCredits(supabase, user.id);
    if (tier !== 'unlimited' && userCredits < total_credits) {
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
    const duration = authenticatedRequest.duration || 30;

    if (tier === 'pro') {
      // ElevenLabs Music - Pro tier (15 credits)
      prediction = await createElevenLabsMusicPrediction({
        prompt: optimizedPrompt,
        duration: Math.min(duration, 300),
        ...(webhookUrl && { webhook: webhookUrl })
      });
      console.log(`🎵 ElevenLabs Music prediction created:`, prediction.id);
    } else if (tier === 'hd') {
      // Stable Audio 2.5 - HD tier (8 credits)
      prediction = await createStableAudioPrediction({
        prompt: optimizedPrompt,
        seconds: Math.min(duration, 47),
        negative_prompt: authenticatedRequest.negative_prompt || 'vocals, singing, voice, spoken word, lyrics',
        ...(webhookUrl && { webhook: webhookUrl })
      });
      console.log(`🎵 Stable Audio prediction created:`, prediction.id);
    } else {
      // Lyria-2 - Unlimited tier (free)
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
        tier,
        model_provider: modelProvider,
        duration,
        negative_prompt: authenticatedRequest.negative_prompt,
        seed: authenticatedRequest.seed,
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
      tier,
    });

    if (!musicRecord.success) {
      console.error('Failed to create music database record:', musicRecord.error);
      warnings.push('Database record creation failed, but generation is proceeding');
    }

    // Step 6: Credit Deduction (skip for unlimited tier)
    if (tier !== 'unlimited' && total_credits > 0) {
      await deductCredits(supabase, user.id, total_credits, batch_id, 'music_generation');
    }

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
      model_info: tier === 'hd' ? await getStableAudioModelInfo()
        : tier === 'pro' ? await getElevenLabsMusicModelInfo()
        : await getLyria2ModelInfo(),
      prediction_id: prediction.id,
      batch_id,
      credits_used: total_credits,
      remaining_credits: tier === 'unlimited' ? userCredits : userCredits - total_credits,
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