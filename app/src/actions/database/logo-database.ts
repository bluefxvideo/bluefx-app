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

    // Map user style preferences to valid database values
    const styleMapping: Record<string, string> = {
      'modern': 'realistic',
      'minimalist': 'realistic',
      'professional': 'realistic',
      'vintage': 'artistic',
      'playful': 'cartoon',
      'creative': 'artistic',
    };

    const validImageStyle = styleMapping[result.style] || 'realistic';

    const { error } = await supabase
      .from('generated_images')
      .insert({
        user_id: result.user_id,
        prompt: result.company_name,
        image_urls: [result.logo_url],
        metadata: { 
          company_name: result.company_name, 
          status: result.status,
          original_style: result.style // Store the original style in metadata
        },
        generation_settings: result.settings,
        model_name: 'logo-generator',
        batch_id: result.batch_id,
        image_style: validImageStyle,
        width: 1024,
        height: 1024,
        dimensions: 'square',
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error storing logo result:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Logo result stored for company: ${result.company_name} with style: ${validImageStyle}`);
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
 * Handles case where user doesn't exist in credits table
 */
export async function getUserCredits(user_id: string): Promise<{ success: boolean; credits?: number; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', user_id)
      .single();

    // If user doesn't exist (PGRST116 = no rows found), return 0 credits
    if (error && error.code === 'PGRST116') {
      console.log(`User ${user_id} not found in credits table, will auto-topup on first use`);
      return { success: true, credits: 0 };
    }

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
 * Deduct credits for logo generation
 * Uses Supabase RPC function for atomic credit deduction
 * Automatically tops up user to 600 credits if they have less than the required amount
 */
export async function deductCredits(
  user_id: string, 
  amount: number, 
  operation: string,
  metadata?: Json
): Promise<{ success: boolean; remainingCredits?: number; error?: string }> {
  try {
    const supabase = await createClient();

    // First check if user has enough credits
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('available_credits, period_end')
      .eq('user_id', user_id)
      .single();

    if (creditsError && creditsError.code !== 'PGRST116') {
      console.error('Credits check error:', creditsError);
      return {
        success: false,
        error: `Failed to check credits: ${creditsError.message}`,
      };
    }

    // If no credits record or available credits < required amount or period expired, top up first
    const needsTopup = !credits || 
                      (credits.available_credits < amount) || 
                      (credits.available_credits < 600) ||
                      (new Date(credits.period_end) < new Date());

    if (needsTopup) {
      console.log(`Auto top-up needed for user ${user_id}. Current credits: ${credits?.available_credits || 0}`);
      
      // Top up to 600 credits using RPC function
      const { data: topupData, error: topupError } = await supabase
        .rpc('topup_user_credits', {
          p_user_id: user_id,
          p_target_credits: 600
        });

      if (topupError || !topupData?.success) {
        console.error('Auto top-up failed:', topupError);
        return {
          success: false,
          error: `Auto top-up failed: ${topupError?.message || 'Unknown error'}`,
        };
      }

      console.log(`Auto top-up successful. New available credits: ${topupData.available_credits}`);
    }

    // Now proceed with credit deduction using RPC function
    const { data, error } = await supabase
      .rpc('deduct_user_credits', {
        p_user_id: user_id,
        p_amount: amount,
        p_operation: operation,
        p_metadata: metadata
      });

    if (error) {
      console.error('Credit deduction RPC error:', error);
      return {
        success: false,
        error: `Failed to deduct credits: ${error.message}`,
      };
    }

    // Check the result from the RPC function
    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Credit deduction failed',
      };
    }

    console.log(`💳 Deducted ${amount} credits from user ${user_id}. Remaining: ${data.available_credits}`);
    return { 
      success: true, 
      remainingCredits: data.available_credits 
    };

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