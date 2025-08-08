'use server';

import { createClient } from '@/app/supabase/server';
import { Json } from '@/types/database';

/**
 * Logo Machine Database Operations
 * Based on legacy logo_history table structure
 */

export interface LogoResult {
  user_id: string;
  company_name: string;
  logo_url: string;
  batch_id: string;
  style: string;
  settings: Json;
  status: 'processing' | 'completed' | 'failed';
}

export interface PredictionRecord {
  prediction_id: string;
  user_id: string;
  tool_id: string;
  service_id: string;
  model_version: string;
  status: string;
  input_data: Json;
}

export interface LogoMetrics {
  user_id: string;
  batch_id: string;
  model_version: string;
  company_name: string;
  style_type: string;
  generation_time_ms: number;
  credits_used: number;
  workflow_type: string;
  has_reference_image: boolean;
  industry?: string;
}

/**
 * Store logo generation results in generated_images table
 */
export async function storeLogoResults(result: LogoResult): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('generated_images')
      .insert({
        user_id: result.user_id,
        prompt: result.company_name,
        image_urls: [result.logo_url],
        metadata: { company_name: result.company_name, status: result.status },
        generation_settings: result.settings,
        model_name: 'logo-generator',
        batch_id: result.batch_id,
        image_style: result.style,
        width: 512,
        height: 512,
        dimensions: '512x512',
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error storing logo result:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Logo result stored for company: ${result.company_name}`);
    return { success: true };

  } catch (error) {
    console.error('storeLogoResults error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to store logo result' 
    };
  }
}

/**
 * Create or update prediction record for tracking using generation_metrics
 */
export async function createPredictionRecord(record: PredictionRecord): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('generation_metrics')
      .insert({
        user_id: record.user_id,
        tool_name: record.tool_id,
        workflow_type: record.service_id,
        metadata: {
          prediction_id: record.prediction_id,
          model_version: record.model_version,
          status: record.status,
          input_data: record.input_data
        },
        generation_time_ms: 0,
        credits_used: 0,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error creating prediction record:', error);
      return { success: false, error: error.message };
    }

    return { success: true };

  } catch (error) {
    console.error('createPredictionRecord error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create prediction record' 
    };
  }
}

/**
 * Record logo generation metrics for analytics
 */
export async function recordLogoMetrics(metrics: LogoMetrics): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('generation_metrics')
      .insert({
        user_id: metrics.user_id,
        tool_name: 'logo_machine',
        workflow_type: metrics.workflow_type,
        generation_time_ms: metrics.generation_time_ms,
        credits_used: metrics.credits_used,
        metadata: {
          batch_id: metrics.batch_id,
          model_version: metrics.model_version,
          company_name: metrics.company_name,
          style_type: metrics.style_type,
          has_reference_image: metrics.has_reference_image,
          industry: metrics.industry
        },
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error recording logo metrics:', error);
      return { success: false, error: error.message };
    }

    console.log(`📊 Logo metrics recorded for batch: ${metrics.batch_id}`);
    return { success: true };

  } catch (error) {
    console.error('recordLogoMetrics error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to record logo metrics' 
    };
  }
}

/**
 * Get user credits from user_credits table
 */
export async function getUserCredits(user_id: string): Promise<{ success: boolean; credits?: number; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', user_id)
      .single();

    if (error) {
      console.error('Error getting user credits:', error);
      return { success: false, error: error.message };
    }

    return { success: true, credits: data?.available_credits || 0 };

  } catch (error) {
    console.error('getUserCredits error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get user credits' 
    };
  }
}

/**
 * Deduct credits from user account
 */
export async function deductCredits(
  user_id: string, 
  amount: number, 
  operation: string,
  metadata?: Json
): Promise<{ success: boolean; remainingCredits?: number; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current credits
    const { data: currentData, error: fetchError } = await supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', user_id)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const currentCredits = currentData?.available_credits || 0;
    const newCredits = Math.max(0, currentCredits - amount);

    // Update credits
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ available_credits: newCredits, updated_at: new Date().toISOString() })
      .eq('user_id', user_id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log credit usage
    const { error: logError } = await supabase
      .from('credit_usage')
      .insert({
        user_id,
        credits_used: amount,
        operation_type: operation,
        service_type: 'logo_machine',
        metadata,
        created_at: new Date().toISOString(),
      });

    if (logError) {
      console.warn('Failed to log credit usage:', logError);
      // Don't fail the whole operation for logging issues
    }

    console.log(`💳 Deducted ${amount} credits from user ${user_id}. Remaining: ${newCredits}`);
    return { success: true, remainingCredits: newCredits };

  } catch (error) {
    console.error('deductCredits error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to deduct credits' 
    };
  }
}

/**
 * Get logo history for a user from generated_images
 */
export async function getLogoHistory(
  user_id: string, 
  limit: number = 50
): Promise<{ success: boolean; logos?: Record<string, unknown>[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('generated_images')
      .select('*')
      .eq('user_id', user_id)
      .eq('model_name', 'logo-generator')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting logo history:', error);
      return { success: false, error: error.message };
    }

    return { success: true, logos: data || [] };

  } catch (error) {
    console.error('getLogoHistory error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get logo history' 
    };
  }
}

/**
 * Delete logo from history (with user ownership validation)
 */
export async function deleteLogo(
  logo_id: string, 
  user_id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Delete with RLS enforcing user ownership
    const { error } = await supabase
      .from('generated_images')
      .delete()
      .eq('id', logo_id)
      .eq('user_id', user_id)
      .eq('model_name', 'logo-generator');

    if (error) {
      console.error('Error deleting logo:', error);
      return { success: false, error: error.message };
    }

    console.log(`🗑️ Logo ${logo_id} deleted for user ${user_id}`);
    return { success: true };

  } catch (error) {
    console.error('deleteLogo error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete logo' 
    };
  }
}