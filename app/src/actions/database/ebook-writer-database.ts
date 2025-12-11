'use server';

import { createClient } from '@supabase/supabase-js';
import type { Json } from '@/types/database';

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Ebook Writer Database Operations
 * Following the successful pattern from script-video-database.ts
 */

export interface EbookSessionData {
  user_id: string;
  topic?: string;
  title?: string;
  title_options?: Json;
  outline?: Json;
  content?: Json;
  cover_url?: string;
  uploaded_documents?: Json;
  current_step?: string;
  generation_progress?: number;
}

/**
 * Save ebook session data to database
 * Uses ebook_history table with JSONB metadata field
 */
export async function saveEbookSession(
  userId: string,
  sessionData: {
    topic?: string;
    title?: string;
    title_options?: Json;
    outline?: Json;
    content?: Json;
    cover_url?: string;
    uploaded_documents?: Json;
    current_step?: string;
    generation_progress?: number;
  },
  ebookId?: string
): Promise<{ success: boolean; ebook_id?: string; error?: string }> {
  const supabase = getSupabaseClient();
  try {
    // Prepare the session metadata
    const metadata = {
      session_data: sessionData,
      last_updated: new Date().toISOString(),
      version: 1
    };

    if (ebookId) {
      // Update existing record
      const { data, error } = await supabase
        .from('ebook_history')
        .update({
          title: sessionData.title || 'Untitled Ebook',
          description: sessionData.topic || null,
          status: 'draft',
          generation_progress: sessionData.generation_progress || 0,
          cover_image_url: sessionData.cover_url || null,
          metadata: metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', ebookId)
        .eq('user_id', userId) // Security: ensure user owns this record
        .select()
        .single();

      if (error) throw error;
      return { success: true, ebook_id: data.id };
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('ebook_history')
        .insert({
          user_id: userId,
          title: sessionData.title || 'Untitled Ebook',
          description: sessionData.topic || null,
          chapter_count: 0,
          total_word_count: 0,
          status: 'draft',
          generation_progress: sessionData.generation_progress || 0,
          cover_image_url: sessionData.cover_url || null,
          metadata: metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, ebook_id: data.id };
    }
  } catch (error) {
    console.error('Error saving ebook session:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Load ebook session data from database
 * Gets the most recent session for a user
 */
export async function loadEbookSession(userId: string): Promise<{
  success: boolean;
  session?: any;
  error?: string
}> {
  const supabase = getSupabaseClient();
  try {
    // Get the most recent draft ebook for this user
    const { data, error } = await supabase
      .from('ebook_history')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    
    if (!data) {
      return { success: true, session: null };
    }

    // Extract session data from metadata
    const sessionData = data.metadata?.session_data || {};
    
    // Convert back to expected format
    const session = {
      ebook_id: data.id,
      topic: data.description || sessionData.topic,
      title: data.title || sessionData.title,
      title_options: sessionData.title_options,
      outline: sessionData.outline,
      content: sessionData.content,
      cover_url: data.cover_image_url || sessionData.cover_url,
      uploaded_documents: sessionData.uploaded_documents,
      current_step: sessionData.current_step || 'topic',
      generation_progress: data.generation_progress || sessionData.generation_progress || 0,
      created_at: data.created_at,
      updated_at: data.updated_at
    };

    return { success: true, session };
  } catch (error) {
    console.error('Error loading ebook session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get all ebook history for a user
 */
export async function getUserEbookHistory(userId: string): Promise<{
  success: boolean;
  ebooks?: any[];
  error?: string;
}> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('ebook_history')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return { success: true, ebooks: data || [] };
  } catch (error) {
    console.error('Error getting user ebook history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete current draft session (for Start Over functionality)
 */
export async function clearEbookSession(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = getSupabaseClient();
  try {
    // Delete all draft ebooks for this user (they can have multiple drafts)
    const { error } = await supabase
      .from('ebook_history')
      .delete()
      .eq('user_id', userId)
      .eq('status', 'draft'); // Only delete drafts, not completed ebooks

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error clearing ebook session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete an ebook record
 */
export async function deleteEbook(userId: string, ebookId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('ebook_history')
      .delete()
      .eq('id', ebookId)
      .eq('user_id', userId); // Security: ensure user owns this record

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting ebook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Complete an ebook and mark as finished
 */
export async function completeEbook(
  userId: string,
  ebookId: string,
  finalData: {
    content: Json;
    word_count: number;
    chapter_count: number;
    cover_url?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('ebook_history')
      .update({
        status: 'completed',
        generation_progress: 100,
        total_word_count: finalData.word_count,
        chapter_count: finalData.chapter_count,
        generated_content: finalData.content,
        cover_image_url: finalData.cover_url || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', ebookId)
      .eq('user_id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error completing ebook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Store ebook generation results (for orchestrator compatibility)
 */
export interface EbookResultsData {
  user_id: string;
  title: string;
  topic?: string;
  outline?: Json;
  content?: Json[];
  cover_url?: string;
  batch_id: string;
  credits_used: number;
  word_count?: number;
  chapter_count?: number;
}

export async function storeEbookResults(data: EbookResultsData): Promise<{
  success: boolean;
  ebook_id?: string;
  error?: string
}> {
  const supabase = getSupabaseClient();
  try {
    const { data: result, error } = await supabase
      .from('ebook_history')
      .insert({
        user_id: data.user_id,
        title: data.title,
        description: data.topic || null,
        chapter_count: data.chapter_count || 0,
        total_word_count: data.word_count || 0,
        status: 'completed',
        generation_progress: 100,
        content_structure: data.outline,
        generated_content: data.content,
        cover_image_url: data.cover_url || null,
        metadata: {
          batch_id: data.batch_id,
          credits_used: data.credits_used,
          generation_timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, ebook_id: result.id };
  } catch (error) {
    console.error('Error storing ebook results:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Record ebook generation metrics
 */
export async function recordEbookMetrics(data: {
  user_id: string;
  batch_id?: string;
  workflow_type: string;
  generation_time_ms: number;
  credits_used: number;
  word_count: number;
  chapters_generated: number;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('generation_metrics')
      .insert({
        user_id: data.user_id,
        tool_name: 'ebook-writer',
        workflow_type: data.workflow_type,
        generation_time_ms: data.generation_time_ms,
        credits_used: data.credits_used,
        metadata: {
          batch_id: data.batch_id,
          word_count: data.word_count,
          chapters_generated: data.chapters_generated
        }
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error recording ebook metrics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get user credit balance
 */
export async function getUserCredits(user_id: string): Promise<{
  success: boolean;
  credits: number;
  error?: string;
}> {
  const supabase = getSupabaseClient();
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

/**
 * Deduct credits from user account
 */
export async function deductCredits(
  user_id: string,
  amount: number,
  operation_type: string,
  metadata: Json
): Promise<{
  success: boolean;
  remainingCredits: number;
  transaction_id?: string;
  error?: string;
}> {
  const supabase = getSupabaseClient();
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