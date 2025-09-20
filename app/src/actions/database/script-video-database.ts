'use server';

import { createClient } from '@supabase/supabase-js';
import { Json } from '@/types/database';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Script-to-Video Database Operations
 * Real Supabase implementations
 */

export interface ScriptVideoRecord {
  user_id: string;
  script_text: string;
  video_url?: string;
  audio_url?: string;
  generated_images?: any[];
  segments: Json[];
  batch_id: string;
  model_version: string;
  generation_parameters: Json;
  production_plan?: Json;
  credits_used: number;
  word_timings?: any[]; // Whisper word-level timing data
  caption_chunks?: any; // Professional caption chunks following broadcast standards
  caption_settings?: any; // Caption generation settings and metadata
  
  // New comprehensive metadata for consistency
  storyboard_data?: {
    narrative_analysis: any;
    characters: any[];
    scene_orchestration: any[];
    original_context: any;
  };
  whisper_data?: {
    full_analysis: any;
    quality_metrics: any;
    frame_alignment: any;
  };
  voice_data?: {
    synthesis_params: any;
    emotion_mapping: any;
    timing_adjustments: any;
  };
  image_data?: {
    generation_params: any;
    consistency_settings: any;
    seed_values: any[];
  };
  caption_settings?: {
    content_type: string;
    quality_score: number;
    avg_words_per_chunk: number;
  };
  
  // Phase-specific data (NEW ARCHITECTURE)
  remotion_composition?: any;  // PRIMARY: Remotion-native composition
  generation_metadata?: any;   // SECONDARY: Generation settings for regeneration
  editor_overlays?: any;       // TERTIARY: Non-destructive editor changes
  
  // Legacy unified editor data (for backward compatibility)
  editor_data?: any;
}

export async function storeScriptVideoResults(record: ScriptVideoRecord) {
  try {
    // Store main video record with comprehensive metadata
    const { data: videoData, error: videoError } = await supabase
      .from('script_to_video_history')
      .insert({
        user_id: record.user_id,
        script_title: `Script ${new Date().toLocaleDateString()}`,
        script_content: record.script_text,
        video_style: 'slideshow', // Default video style that matches constraint
        resolution: '1080p',
        status: 'completed',
        video_url: record.video_url,
        rendering_settings: record.generation_parameters,
        
        // Legacy processing logs for backward compatibility
        processing_logs: { 
          credits_used: record.credits_used,
          batch_id: record.batch_id,
          audio_url: record.audio_url,
          generated_images: record.generated_images || [],
          segments: record.segments,
          production_plan: record.production_plan,
          word_timings: record.word_timings || [],
          caption_chunks: record.caption_chunks || null
        },
        
        // New structured metadata columns for consistency
        storyboard_data: record.storyboard_data || null,
        whisper_data: record.whisper_data || null,
        voice_data: record.voice_data || null,
        image_data: record.image_data || null,
        caption_data: record.caption_settings ? {
          chunks: record.caption_chunks,
          settings: record.caption_settings
        } : null,
        
        // Phase-specific data (NEW ARCHITECTURE)
        remotion_composition: record.remotion_composition || null,
        generation_metadata: record.generation_metadata || null,
        editor_overlays: record.editor_overlays || null,
        
        // Legacy unified editor data (backward compatibility)
        editor_data: record.editor_data || null,
        
        // Version tracking for auto-save
        version_number: 1,
        edit_history: [],
        last_modified: new Date().toISOString()
      })
      .select()
      .single();

    if (videoError) throw videoError;

    // Store segments with guaranteed valid timing
    if (record.segments.length > 0) {
      let cumulativeTime = 0;
      const segmentsData = record.segments.map((segment: any, index) => {
        // Ensure we always have valid timing
        let startTime = segment.start_time;
        let endTime = segment.end_time;
        let duration = segment.duration;
        
        // Fix any null/undefined timing
        if (startTime === null || startTime === undefined) {
          startTime = cumulativeTime;
          console.warn(`🔧 Fixed null start_time for segment ${index}: using ${startTime}`);
        }
        
        if (duration === null || duration === undefined) {
          // Estimate based on text length (~180 words per minute)
          const wordCount = (segment.text || '').split(/\s+/).length;
          duration = Math.max(3, Math.min(8, wordCount / 3));
          console.warn(`🔧 Fixed null duration for segment ${index}: estimated ${duration}s`);
        }
        
        if (endTime === null || endTime === undefined) {
          endTime = startTime + duration;
          console.warn(`🔧 Fixed null end_time for segment ${index}: calculated ${endTime}`);
        }
        
        // Update cumulative time for next segment
        cumulativeTime = endTime;
        
        return {
          video_id: videoData.id,
          segment_index: index,
          text_content: segment.text || '',
          start_time: startTime,
          end_time: endTime,
          duration: duration,
          image_url: segment.image_url,
          image_prompt: segment.image_prompt,
          voice_url: segment.voice_url,
          voice_duration: segment.voice_duration,
          segment_status: 'ready'
        };
      });

      const { error: segmentsError } = await supabase
        .from('video_segments')
        .insert(segmentsData);

      if (segmentsError) throw segmentsError;
    }

    // Store production plan if provided
    if (record.production_plan) {
      const { error: planError } = await supabase
        .from('production_plans')
        .insert({
          video_id: videoData.id,
          batch_id: record.batch_id,
          workflow_type: (record.production_plan as any).workflow_type || 'sequential',
          complexity_score: (record.production_plan as any).complexity_score || 5,
          segment_strategy: record.production_plan,
          voice_optimization: (record.production_plan as any).voice_optimization || {},
          visual_optimization: (record.production_plan as any).visual_optimization || {},
          credits_used: record.credits_used
        });

      if (planError) throw planError;
    }

    return { success: true, video_id: videoData.id };
  } catch (error) {
    console.error('Error storing script video results:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function createPredictionRecord(data: {
  prediction_id: string;
  user_id: string;
  tool_id: string;
  service_id: string;
  model_version: string;
  status: string;
  input_data: Json;
}) {
  try {
    const { error } = await supabase
      .from('video_operations')
      .insert({
        operation_id: data.prediction_id,
        video_id: null, // will be updated later when video is created
        user_id: data.user_id,
        operation_type: 'full_generation',
        operation_status: data.status as any,
        input_data: data.input_data,
        started_at: new Date().toISOString()
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating prediction record:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function recordGenerationMetrics(data: {
  user_id: string;
  batch_id: string;
  model_version: string;
  workflow_type: string;
  segment_count: number;
  generation_time_ms: number;
  total_credits_used: number;
  complexity_score: number;
  ai_optimizations_applied: number;
}) {
  try {
    const { error } = await supabase
      .from('generation_metrics')
      .insert({
        user_id: data.user_id,
        tool_name: 'script-to-video',
        workflow_type: data.workflow_type,
        generation_time_ms: data.generation_time_ms,
        credits_used: data.total_credits_used,
        metadata: {
          batch_id: data.batch_id,
          model_version: data.model_version,
          segment_count: data.segment_count,
          complexity_score: data.complexity_score,
          ai_optimizations_applied: data.ai_optimizations_applied
        }
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error recording generation metrics:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getLatestScriptVideoResults(user_id: string) {
  try {
    const { data, error } = await supabase
      .from('script_to_video_history')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    
    if (!data) {
      return { success: true, result: null };
    }

    // Calculate actual duration from Whisper frame alignment data
    let actualDuration = 60; // Only as last resort fallback
    
    if (data.whisper_data?.frame_alignment && data.whisper_data.frame_alignment.length > 0) {
      // Sum up all segment durations from Whisper analysis for true continuous duration
      actualDuration = data.whisper_data.frame_alignment.reduce((total: number, frame: any) => {
        return total + (frame.duration || 0);
      }, 0);
    } else if (data.processing_logs?.segments && data.processing_logs.segments.length > 0) {
      // Fallback to segment end times if available
      const maxEndTime = Math.max(...data.processing_logs.segments.map((s: any) => s.end_time || 0));
      if (maxEndTime > 0) actualDuration = maxEndTime;
    }

    // Fetch caption chunks from the separate table
    const captionResult = await getCaptionChunks(data.id);
    const captionChunks = captionResult.success ? captionResult.captions : [];
    
    // Convert database format back to ScriptToVideoResponse format
    const result = {
      success: true,
      video_url: data.video_url,
      audio_url: data.processing_logs?.audio_url,
      generated_images: data.processing_logs?.generated_images || [],
      segments: data.processing_logs?.segments || [],
      timeline_data: {
        total_duration: actualDuration,
        segment_count: data.processing_logs?.segments?.length || 0,
        frame_count: Math.ceil(actualDuration * 30)
      },
      production_plan: data.processing_logs?.production_plan,
      prediction_id: data.id,
      batch_id: data.processing_logs?.batch_id || '',
      credits_used: data.processing_logs?.credits_used || 0,
      generation_time_ms: 0,
      word_timings: data.processing_logs?.word_timings || [],
      // CRITICAL: Include Whisper frame alignment data for correct timing
      whisper_frame_alignment: data.whisper_data?.frame_alignment || [],
      // NEW: Include separate caption chunks with improved structure
      caption_chunks: {
        total_chunks: captionChunks.length,
        chunks: captionChunks,
        quality_score: captionChunks.length > 0 ? 
          captionChunks.reduce((avg, chunk) => avg + (chunk.quality_score || 100), 0) / captionChunks.length : 100,
        avg_words_per_chunk: captionChunks.length > 0 ?
          captionChunks.reduce((avg, chunk) => avg + (chunk.word_count || 0), 0) / captionChunks.length : 0
      },
      video_id: data.id // Include database ID for caption fetching
    };

    return { success: true, result };
  } catch (error) {
    console.error('Error getting latest script video results:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      result: null
    };
  }
}

export async function getUserCredits(user_id: string) {
  try {
    // Query the user_credits table directly like other tools do
    const { data, error } = await supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', user_id)
      .single();

    if (error) {
      console.error('Credits fetch error:', error);
      // If no credits record exists, return 0 credits
      if (error.code === 'PGRST116') {
        return {
          success: true,
          credits: 0
        };
      }
      throw error;
    }

    return {
      success: true,
      credits: data?.available_credits || 0
    };
  } catch (error) {
    console.error('Error getting user credits:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      credits: 0
    };
  }
}

export async function deductCredits(
  user_id: string,
  amount: number,
  operation_type: string,
  metadata: Json
) {
  try {
    // Use the same RPC function as thumbnail-machine
    const { data, error } = await supabase
      .rpc('deduct_user_credits', {
        p_user_id: user_id,
        p_amount: amount,
        p_operation: operation_type,
        p_metadata: metadata
      });

    if (error) {
      console.error('Credit deduction RPC error:', error);
      return {
        success: false,
        error: `Failed to deduct credits: ${error.message}`,
        remainingCredits: 0
      };
    }

    // Check the result from the RPC function
    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Credit deduction failed',
        remainingCredits: data?.remaining_credits || 0
      };
    }

    return {
      success: true,
      remainingCredits: data.remaining_credits,
      transaction_id: data.transaction_id
    };
  } catch (error) {
    console.error('Error deducting credits:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      remainingCredits: 0
    };
  }
}

// Helper functions for managing segments and operations
export async function getVideoSegments(video_id: string) {
  try {
    const { data, error } = await supabase
      .from('video_segments')
      .select('*')
      .eq('video_id', video_id)
      .order('segment_index');

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error getting video segments:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateSegmentAsset(
  segment_id: string,
  asset_type: 'image' | 'voice' | 'caption',
  asset_data: { url?: string; status?: string; [key: string]: any }
) {
  try {
    const updates: any = {};
    
    if (asset_type === 'image') {
      if (asset_data.url) updates.image_url = asset_data.url;
      if (asset_data.status) updates.image_status = asset_data.status;
      if (asset_data.prompt) updates.image_prompt = asset_data.prompt;
    } else if (asset_type === 'voice') {
      if (asset_data.url) updates.voice_url = asset_data.url;
      if (asset_data.status) updates.voice_status = asset_data.status;
      if (asset_data.duration) updates.voice_duration = asset_data.duration;
    } else if (asset_type === 'caption') {
      if (asset_data.status) updates.caption_status = asset_data.status;
      if (asset_data.data) updates.caption_data = asset_data.data;
    }

    const { error } = await supabase
      .from('video_segments')
      .update(updates)
      .eq('id', segment_id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating segment asset:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateOperationProgress(
  operation_id: string,
  updates: {
    status?: string;
    progress_percentage?: number;
    current_stage?: string;
    result_data?: Json;
    error_details?: Json;
  }
) {
  try {
    const { error } = await supabase
      .from('video_operations')
      .update({
        ...updates,
        completed_at: updates.status === 'completed' ? new Date().toISOString() : undefined
      })
      .eq('operation_id', operation_id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating operation progress:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

