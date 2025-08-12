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
        
        // Version tracking for auto-save
        version_number: 1,
        edit_history: [],
        last_modified: new Date().toISOString()
      })
      .select()
      .single();

    if (videoError) throw videoError;

    // Store segments
    if (record.segments.length > 0) {
      const segmentsData = record.segments.map((segment: any, index) => ({
        video_id: videoData.id,
        segment_index: index,
        text_content: segment.text || '',
        start_time: segment.start_time || 0,
        end_time: segment.end_time || 0,
        duration: segment.duration || 0,
        image_url: segment.image_url,
        image_prompt: segment.image_prompt,
        voice_url: segment.voice_url,
        voice_duration: segment.voice_duration,
        segment_status: 'ready'
      }));

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

    // Convert database format back to ScriptToVideoResponse format
    const result = {
      success: true,
      video_url: data.video_url,
      audio_url: data.processing_logs?.audio_url,
      generated_images: data.processing_logs?.generated_images || [],
      segments: data.processing_logs?.segments || [],
      timeline_data: {
        total_duration: data.duration_seconds || 60,
        segment_count: data.processing_logs?.segments?.length || 0,
        frame_count: Math.ceil((data.duration_seconds || 60) * 30)
      },
      production_plan: data.processing_logs?.production_plan,
      prediction_id: data.id,
      batch_id: data.processing_logs?.batch_id || '',
      credits_used: data.processing_logs?.credits_used || 0,
      generation_time_ms: 0,
      word_timings: data.processing_logs?.word_timings || []
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
    const { data, error } = await supabase
      .rpc('get_user_credit_balance', { user_uuid: user_id });

    if (error) throw error;

    return {
      success: true,
      credits: data || 0
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
    // Get current balance first
    const currentBalance = await getUserCredits(user_id);
    
    if (!currentBalance.success || (currentBalance.credits || 0) < amount) {
      return {
        success: false,
        error: 'Insufficient credits',
        remainingCredits: currentBalance.credits || 0
      };
    }

    // Record the debit transaction
    const { data, error } = await supabase
      .from('credit_transactions')
      .insert({
        user_id,
        transaction_type: 'debit',
        amount: -amount, // negative for deduction
        balance_after: (currentBalance.credits || 0) - amount,
        operation_type,
        description: `Credits used for ${operation_type}`,
        metadata,
        status: 'completed'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      remainingCredits: data.balance_after,
      transaction_id: data.id
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