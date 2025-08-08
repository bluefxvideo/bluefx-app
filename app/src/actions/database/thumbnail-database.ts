'use server';

import { createClient } from '@/app/supabase/server';
import { Json } from '@/types/database';

/**
 * Database operations for Thumbnail Machine
 * Handles storing results, tracking metrics, and credit management
 */

interface ThumbnailResult {
  id?: string;
  user_id: string;
  prompt: string;
  image_urls: string[];
  dimensions: string;
  height: number;
  width: number;
  model_name: string;
  model_version?: string | null;
  batch_id?: string | null;
  generation_settings?: Json | null;
  metadata?: Json | null;
  created_at?: string | null;
  image_style?: string | null;
  negative_prompt?: string | null;
  download_count?: number | null;
  file_formats?: string[] | null;
  is_favorite?: boolean | null;
  quality_score?: number | null;
  thumbnail_urls?: string[] | null;
  variations_count?: number | null;
}

interface PredictionRecord {
  prediction_id: string;
  user_id: string;
  tool_id: string;
  service_id: string;
  model_version: string;
  input_data?: Json;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  webhook_url?: string;
  output_data?: Json;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  logs?: string;
}

interface GenerationMetrics {
  user_id: string;
  batch_id: string;
  model_version: string;
  style_type: string;
  num_variations: number;
  generation_time_ms: number;
  total_credits_used: number;
  prompt_length: number;
  has_advanced_options: boolean;
  download_count?: number;
}

/**
 * Store generated thumbnail results in database
 */
export async function storeThumbnailResults(
  results: ThumbnailResult[]
): Promise<{ success: boolean; data?: Record<string, unknown>[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('generated_images')
      .insert(results)
      .select();

    if (error) {
      console.error('Database insert error:', error);
      return {
        success: false,
        error: `Failed to store results: ${error.message}`,
      };
    }

    console.log(`Stored ${results.length} thumbnail results in database`);
    
    return {
      success: true,
      data,
    };

  } catch (error) {
    console.error('storeThumbnailResults error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database storage failed',
    };
  }
}

/**
 * Create prediction tracking record
 */
export async function createPredictionRecord(
  record: PredictionRecord
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('ai_predictions')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Prediction record error:', error);
      return {
        success: false,
        error: `Failed to create prediction record: ${error.message}`,
      };
    }

    return {
      success: true,
      data,
    };

  } catch (error) {
    console.error('createPredictionRecord error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Prediction record failed',
    };
  }
}

/**
 * Update prediction status and results
 */
export async function updatePredictionRecord(
  predictionId: string,
  updates: Partial<PredictionRecord>
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('ai_predictions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('prediction_id', predictionId)
      .select()
      .single();

    if (error) {
      console.error('Prediction update error:', error);
      return {
        success: false,
        error: `Failed to update prediction: ${error.message}`,
      };
    }

    return {
      success: true,
      data,
    };

  } catch (error) {
    console.error('updatePredictionRecord error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Prediction update failed',
    };
  }
}

/**
 * Record generation metrics for analytics
 */
export async function recordGenerationMetrics(
  metrics: GenerationMetrics
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('generation_metrics')
      .insert({
        user_id: metrics.user_id,
        tool_name: 'thumbnail_machine',
        workflow_type: metrics.style_type,
        credits_used: metrics.total_credits_used,
        generation_time_ms: metrics.generation_time_ms,
        metadata: {
          batch_id: metrics.batch_id,
          model_version: metrics.model_version,
          num_variations: metrics.num_variations,
          prompt_length: metrics.prompt_length,
          has_advanced_options: metrics.has_advanced_options,
          download_count: metrics.download_count,
        },
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Metrics recording error:', error);
      return {
        success: false,
        error: `Failed to record metrics: ${error.message}`,
      };
    }

    return {
      success: true,
      data,
    };

  } catch (error) {
    console.error('recordGenerationMetrics error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Metrics recording failed',
    };
  }
}

/**
 * Get user's thumbnail generation history
 */
export async function getThumbnailHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: ThumbnailResult[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('generated_images')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'thumbnail')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('History fetch error:', error);
      return {
        success: false,
        error: `Failed to fetch history: ${error.message}`,
      };
    }

    return {
      success: true,
      data,
    };

  } catch (error) {
    console.error('getThumbnailHistory error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'History fetch failed',
    };
  }
}

/**
 * Delete thumbnail result
 */
export async function deleteThumbnailResult(
  imageId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('generated_images')
      .delete()
      .eq('id', imageId)
      .eq('user_id', userId); // Ensure user can only delete their own images

    if (error) {
      console.error('Delete error:', error);
      return {
        success: false,
        error: `Failed to delete thumbnail: ${error.message}`,
      };
    }

    return { success: true };

  } catch (error) {
    console.error('deleteThumbnailResult error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

/**
 * Get user credit balance
 */
export async function getUserCredits(
  userId: string
): Promise<{ success: boolean; credits?: number; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Credits fetch error:', error);
      return {
        success: false,
        error: `Failed to fetch credits: ${error.message}`,
      };
    }

    return {
      success: true,
      credits: data?.available_credits || 0,
    };

  } catch (error) {
    console.error('getUserCredits error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Credits fetch failed',
    };
  }
}

/**
 * Deduct credits for thumbnail generation
 */
export async function deductCredits(
  userId: string,
  amount: number,
  operation: string,
  metadata?: Json
): Promise<{ success: boolean; remainingCredits?: number; error?: string }> {
  try {
    const supabase = await createClient();

    // Start a transaction-like operation
    // First, check current balance
    const { data: currentCredits, error: fetchError } = await supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', userId)
      .single();

    if (fetchError || !currentCredits) {
      return {
        success: false,
        error: 'Unable to fetch current credit balance',
      };
    }

    if ((currentCredits.available_credits ?? 0) < amount) {
      return {
        success: false,
        error: 'Insufficient credits',
      };
    }

    // Deduct credits
    const newBalance = (currentCredits.available_credits ?? 0) - amount;
    
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ available_credits: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      return {
        success: false,
        error: `Failed to deduct credits: ${updateError.message}`,
      };
    }

    // Log credit usage
    const { error: logError } = await supabase
      .from('credit_usage')
      .insert({
        user_id: userId,
        credits_used: amount,
        operation_type: operation,
        service_type: 'thumbnail_machine',
        metadata,
        created_at: new Date().toISOString(),
      });

    if (logError) {
      console.warn('Failed to log credit usage:', logError);
      // Don't fail the operation if logging fails
    }

    return {
      success: true,
      remainingCredits: newBalance,
    };

  } catch (error) {
    console.error('deductCredits error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Credit deduction failed',
    };
  }
}