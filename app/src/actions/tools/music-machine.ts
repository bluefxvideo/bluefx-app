'use server';

import { createClient } from '@/app/supabase/server';
import { 
  createMusicGenPrediction, 
  calculateMusicGenCredits,
  getMusicGenModelInfo,
  type MusicGenInput 
} from '@/actions/models/meta-musicgen';
import {
  createLyria2Prediction,
  calculateLyria2Credits,
  getLyria2ModelInfo,
  optimizeLyria2Prompt,
  type Lyria2Input
} from '@/actions/models/google-lyria-2';
import { createMusicRecord } from '@/actions/database/music-database';
import { createPredictionRecord } from '@/actions/database/thumbnail-database';
import { uploadAudioToStorage } from '@/actions/supabase-storage';

// Enhanced request/response interfaces following AI orchestrator pattern
export interface MusicMachineRequest {
  // Core generation parameters
  prompt: string;
  duration?: number; // 1-300 seconds
  
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
  model_info?: ReturnType<typeof getMusicGenModelInfo>;
  
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

    // Step 2: Determine Model Provider and Optimize Prompt
    const modelProvider = authenticatedRequest.model_provider || 'lyria-2';
    let optimizedPrompt: string;
    let modelInput: MusicGenInput | Lyria2Input;
    
    if (modelProvider === 'lyria-2') {
      optimizedPrompt = await optimizeLyria2Prompt(
        authenticatedRequest.prompt,
        authenticatedRequest.genre,
        authenticatedRequest.mood
      );
      
      modelInput = {
        prompt: optimizedPrompt,
        ...(authenticatedRequest.seed && { seed: authenticatedRequest.seed }),
        ...(authenticatedRequest.negative_prompt && { negative_prompt: authenticatedRequest.negative_prompt }),
      } as Lyria2Input;
    } else {
      optimizedPrompt = optimizePromptForMusic(
        authenticatedRequest.prompt,
        authenticatedRequest.genre,
        authenticatedRequest.mood
      );
      
      modelInput = {
        prompt: optimizedPrompt,
        duration: Math.min(Math.max(authenticatedRequest.duration || 30, 1), 300),
        input_audio: inputAudioUrl,
        model_version: authenticatedRequest.model_version || 'stereo-melody-large',
        continuation: authenticatedRequest.continuation || false,
        output_format: authenticatedRequest.output_format || 'mp3',
        normalization_strategy: authenticatedRequest.normalization_strategy || 'loudness',
        temperature: authenticatedRequest.temperature || 1.0,
        top_k: authenticatedRequest.top_k || 250,
        top_p: authenticatedRequest.top_p || 0.0,
        classifier_free_guidance: authenticatedRequest.classifier_free_guidance || 3.0,
      } as MusicGenInput;
    }

    console.log(`🎵 Using ${modelProvider} with optimized prompt:`, optimizedPrompt);

    // Step 3: Credit Calculation and Validation
    total_credits = modelProvider === 'lyria-2' 
      ? await calculateLyria2Credits(modelInput as Lyria2Input)
      : await calculateMusicGenCredits(modelInput as MusicGenInput);
    
    const userCredits = await getUserCredits(supabase, user.id);
    if (userCredits < total_credits) {
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

    // Step 4: Create Prediction with Webhook
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
    const webhookUrl = baseUrl?.startsWith('https://') 
      ? `${baseUrl}/api/webhooks/replicate-ai`
      : undefined; // Don't use webhook if not HTTPS
    
    if (!webhookUrl) {
      console.log('⚠️ No valid HTTPS webhook URL available, prediction will run without webhook');
    } else {
      console.log('🔗 Using webhook URL:', webhookUrl);
    }
    
    let prediction: any;
    
    if (modelProvider === 'lyria-2') {
      prediction = await createLyria2Prediction({
        ...(modelInput as Lyria2Input),
        user_id: authenticatedRequest.user_id,
        batch_id: batch_id,
        ...(webhookUrl && { webhook: webhookUrl })
      });
    } else {
      const musicGenResult = await createMusicGenPrediction({
        input: modelInput as MusicGenInput,
        ...(webhookUrl && { webhook: webhookUrl })
      });
      
      if (!musicGenResult.success || !musicGenResult.prediction) {
        return {
          success: false,
          error: musicGenResult.error || 'Music generation request failed',
          prediction_id: '',
          batch_id,
          generation_time_ms: Date.now() - startTime,
          credits_used: 0,
          remaining_credits: userCredits,
        };
      }
      
      prediction = musicGenResult.prediction;
    }
    console.log(`🎵 ${modelProvider === 'lyria-2' ? 'Lyria-2' : 'MusicGen'} prediction created:`, prediction.id);

    // Create prediction tracking record
    await createPredictionRecord({
      prediction_id: prediction.id,
      user_id: request.user_id,
      tool_id: 'music-machine',
      service_id: 'replicate',
      model_version: modelProvider === 'lyria-2' ? 'google-lyria-2' : 'meta-musicgen-stereo-melody',
      status: 'starting',
      input_data: {
        prompt: request.prompt,
        model_provider: modelProvider,
        duration: modelProvider === 'musicgen' ? (modelInput as MusicGenInput).duration : undefined,
        model_version: modelProvider === 'musicgen' ? (modelInput as MusicGenInput).model_version : undefined,
        output_format: modelProvider === 'musicgen' ? (modelInput as MusicGenInput).output_format : undefined,
        seed: modelProvider === 'lyria-2' ? (modelInput as Lyria2Input).seed : undefined,
        negative_prompt: modelProvider === 'lyria-2' ? (modelInput as Lyria2Input).negative_prompt : undefined,
        ...modelInput
      } as any,
    });

    // Step 6: Database Record Creation
    const musicRecord = await createMusicRecord(user.id, optimizedPrompt, {
      duration: modelProvider === 'musicgen' ? (modelInput as MusicGenInput).duration : undefined,
      prediction_id: prediction.id,
      batch_id,
      credits_used: total_credits,
      genre: authenticatedRequest.genre,
      mood: authenticatedRequest.mood,
      model_provider: modelProvider,
    });

    if (!musicRecord.success) {
      console.error('Failed to create music database record:', musicRecord.error);
      warnings.push('Database record creation failed, but generation is proceeding');
    }

    // Step 7: Credit Deduction
    await deductCredits(supabase, user.id, total_credits, batch_id, 'music_generation');

    return {
      success: true,
      generated_music: {
        id: musicRecord.data?.id || `temp_${Date.now()}`,
        prediction_id: prediction.id,
        prompt: optimizedPrompt,
        duration: modelProvider === 'musicgen' ? (modelInput as MusicGenInput).duration || 10 : undefined,
        model_version: modelProvider === 'musicgen' 
          ? (modelInput as MusicGenInput).model_version || 'musicgen-medium'
          : 'lyria-2',
        output_format: modelProvider === 'musicgen' ? (modelInput as MusicGenInput).output_format || 'mp3' : 'audio',
        status: prediction.status,
        created_at: prediction.created_at,
      },
      model_info: modelProvider === 'lyria-2' ? await getLyria2ModelInfo() : getMusicGenModelInfo(),
      prediction_id: prediction.id,
      batch_id,
      credits_used: total_credits,
      remaining_credits: userCredits - total_credits,
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