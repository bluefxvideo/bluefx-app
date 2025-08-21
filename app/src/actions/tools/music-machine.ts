'use server';

import { createClient } from '@/app/supabase/server';
import { 
  createMusicGenPrediction, 
  calculateMusicGenCredits,
  getMusicGenModelInfo,
  type MusicGenInput 
} from '@/actions/models/meta-musicgen';
import { createMusicRecord } from '@/actions/database/music-database';
import { createPredictionRecord } from '@/actions/database/thumbnail-database';
import { uploadAudioToStorage } from '@/actions/supabase-storage';

// Enhanced request/response interfaces following AI orchestrator pattern
export interface MusicMachineRequest {
  // Core generation parameters
  prompt: string;
  duration?: number; // 1-300 seconds
  
  // Model configuration
  model_version?: 'stereo-melody-large' | 'stereo-large' | 'melody-large' | 'large';
  output_format?: 'wav' | 'mp3';
  
  // Audio conditioning (optional)
  input_audio?: string | File; // Reference audio for style conditioning
  continuation?: boolean; // Continue from input audio vs influence style
  
  // Advanced parameters
  temperature?: number; // 0.0-2.0, creativity control
  top_k?: number; // Token sampling limit
  top_p?: number; // Cumulative probability sampling
  classifier_free_guidance?: number; // 1.0-10.0, prompt adherence
  normalization_strategy?: 'loudness' | 'clip' | 'peak' | 'rms';
  
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
  const batch_id = `music_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

    // Step 2: Prompt Optimization with AI Intelligence
    const optimizedPrompt = optimizePromptForMusic(
      authenticatedRequest.prompt,
      authenticatedRequest.genre,
      authenticatedRequest.mood
    );

    console.log('🎵 Optimized prompt:', optimizedPrompt);

    // Step 3: Prepare MusicGen Input Parameters
    const musicGenInput: MusicGenInput = {
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
    };

    // Step 4: Credit Calculation and Validation
    total_credits = await calculateMusicGenCredits(musicGenInput);
    
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

    // Step 5: Create Prediction with Webhook
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/replicate-ai`;
    
    const predictionResult = await createMusicGenPrediction({
      input: musicGenInput,
      webhook: webhookUrl
    });

    if (!predictionResult.success || !predictionResult.prediction) {
      return {
        success: false,
        error: predictionResult.error || 'Music generation request failed',
        prediction_id: '',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: userCredits,
      };
    }

    const prediction = predictionResult.prediction;
    console.log('🎵 MusicGen prediction created:', prediction.id);

    // Create prediction tracking record
    await createPredictionRecord({
      prediction_id: prediction.id,
      user_id: request.user_id,
      tool_id: 'music-machine',
      service_id: 'replicate',
      model_version: 'meta-musicgen-stereo-melody',
      status: 'starting',
      input_data: {
        prompt: request.prompt,
        duration: musicGenInput.duration,
        model_version: musicGenInput.model_version,
        output_format: musicGenInput.output_format,
        ...musicGenInput
      } as any,
    });

    // Step 6: Database Record Creation
    const musicRecord = await createMusicRecord(user.id, optimizedPrompt, {
      duration: musicGenInput.duration,
      prediction_id: prediction.id,
      batch_id,
      credits_used: total_credits,
      genre: authenticatedRequest.genre,
      mood: authenticatedRequest.mood,
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
        duration: musicGenInput.duration || 10,
        model_version: musicGenInput.model_version || 'musicgen-medium',
        output_format: musicGenInput.output_format || 'mp3',
        status: prediction.status,
        created_at: prediction.created_at,
      },
      model_info: getMusicGenModelInfo(),
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