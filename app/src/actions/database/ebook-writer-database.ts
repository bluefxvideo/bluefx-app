'use server';

import { createClient } from '@/app/supabase/server';
import { Json } from '@/types/database';

/**
 * Ebook Writer Database Operations
 * Handles all database interactions for ebook generation and management
 * Compatible with existing ebook_history and ebook_writer_history tables
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

export interface EbookMetricsData {
  user_id: string;
  workflow_type: string;
  credits_used: number;
  generation_time_ms: number;
  word_count: number;
  chapters_generated: number;
}

/**
 * Store ebook generation results in the main ebook_history table
 */
export async function storeEbookResults(data: EbookResultsData): Promise<{ success: boolean; ebook_id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Prepare data according to existing schema
    const ebookData = {
      user_id: data.user_id,
      title: data.title,
      description: data.topic || null,
      chapter_count: data.chapter_count || 0,
      total_word_count: data.word_count || 0,
      status: 'completed',
      generation_progress: 100,
      content_structure: data.outline ? JSON.stringify(data.outline) : null,
      generated_content: data.content ? JSON.stringify(data.content) : null,
      cover_image_url: data.cover_url || null,
      metadata: JSON.stringify({
        batch_id: data.batch_id,
        credits_used: data.credits_used,
        generation_date: new Date().toISOString()
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('ebook_history')
      .insert(ebookData)
      .select('id')
      .single();

    if (error) {
      console.error('Error storing ebook results:', error);
      return { success: false, error: error.message };
    }

    return { success: true, ebook_id: result.id };
    
  } catch (error) {
    console.error('Database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to store ebook results' 
    };
  }
}

/**
 * Create initial ebook record
 */
export async function createEbookRecord(
  userId: string, 
  title: string,
  topic?: string
): Promise<{ success: boolean; ebook_id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    
    const ebookData = {
      user_id: userId,
      title: title,
      description: topic || null,
      chapter_count: 0,
      total_word_count: 0,
      status: 'draft',
      generation_progress: 0,
      content_structure: null,
      generated_content: null,
      cover_image_url: null,
      metadata: JSON.stringify({
        created_via: 'ebook_writer_tool',
        topic: topic
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('ebook_history')
      .insert(ebookData)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating ebook record:', error);
      return { success: false, error: error.message };
    }

    return { success: true, ebook_id: result.id };
    
  } catch (error) {
    console.error('Database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create ebook record' 
    };
  }
}

/**
 * Update existing ebook record
 */
export async function updateEbookRecord(
  ebookId: string,
  updates: Partial<{
    title: string;
    description: string;
    chapter_count: number;
    total_word_count: number;
    status: string;
    generation_progress: number;
    content_structure: Json;
    generated_content: Json;
    cover_image_url: string;
    metadata: Json;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    const updateData: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    // Convert objects to JSON strings for JSONB fields
    if (updates.content_structure) {
      updateData.content_structure = JSON.stringify(updates.content_structure);
    }
    if (updates.generated_content) {
      updateData.generated_content = JSON.stringify(updates.generated_content);
    }
    if (updates.metadata) {
      updateData.metadata = JSON.stringify(updates.metadata);
    }
    
    const { error } = await supabase
      .from('ebook_history')
      .update(updateData)
      .eq('id', ebookId);

    if (error) {
      console.error('Error updating ebook record:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
    
  } catch (error) {
    console.error('Database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update ebook record' 
    };
  }
}

/**
 * Get ebook by ID
 */
export async function getEbookById(ebookId: string): Promise<{ success: boolean; ebook?: Record<string, unknown>; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { data: ebook, error } = await supabase
      .from('ebook_history')
      .select('*')
      .eq('id', ebookId)
      .single();

    if (error) {
      console.error('Error fetching ebook:', error);
      return { success: false, error: error.message };
    }

    // Parse JSON fields
    if (ebook.content_structure && typeof ebook.content_structure === 'string') {
      try {
        ebook.content_structure = JSON.parse(ebook.content_structure);
      } catch {
        console.warn('Failed to parse content_structure JSON');
      }
    }
    if (ebook.generated_content && typeof ebook.generated_content === 'string') {
      try {
        ebook.generated_content = JSON.parse(ebook.generated_content);
      } catch {
        console.warn('Failed to parse generated_content JSON');
      }
    }
    if (ebook.metadata && typeof ebook.metadata === 'string') {
      try {
        ebook.metadata = JSON.parse(ebook.metadata);
      } catch {
        console.warn('Failed to parse metadata JSON');
      }
    }

    return { success: true, ebook };
    
  } catch (error) {
    console.error('Database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch ebook' 
    };
  }
}

/**
 * Get user's ebook history
 */
export async function getUserEbookHistory(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ success: boolean; ebooks?: Record<string, unknown>[]; total_count?: number; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Get total count
    const { count, error: countError } = await supabase
      .from('ebook_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('Error counting ebooks:', countError);
      return { success: false, error: countError.message };
    }

    // Get paginated results
    const { data: ebooks, error } = await supabase
      .from('ebook_history')
      .select('id, title, description, chapter_count, total_word_count, status, generation_progress, cover_image_url, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching ebook history:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      ebooks: ebooks || [], 
      total_count: count || 0 
    };
    
  } catch (error) {
    console.error('Database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch ebook history' 
    };
  }
}

/**
 * Delete ebook
 */
export async function deleteEbook(ebookId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('ebook_history')
      .delete()
      .eq('id', ebookId)
      .eq('user_id', userId); // Ensure user can only delete their own ebooks

    if (error) {
      console.error('Error deleting ebook:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
    
  } catch (error) {
    console.error('Database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete ebook' 
    };
  }
}

/**
 * Search ebooks by title or description
 */
export async function searchEbooks(
  userId: string,
  query: string,
  limit: number = 20
): Promise<{ success: boolean; ebooks?: Record<string, unknown>[]; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { data: ebooks, error } = await supabase
      .from('ebook_history')
      .select('id, title, description, chapter_count, total_word_count, status, cover_image_url, created_at, updated_at')
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error searching ebooks:', error);
      return { success: false, error: error.message };
    }

    return { success: true, ebooks: ebooks || [] };
    
  } catch (error) {
    console.error('Database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to search ebooks' 
    };
  }
}

/**
 * Store chapter generation in ebook_writer_history table
 */
export async function storeChapterGeneration(data: {
  user_id: string;
  ebook_id?: string;
  writing_session_id: string;
  chapter_number: number;
  chapter_title: string;
  content_prompt: string;
  generated_content?: string;
  word_count?: number;
  writing_style?: string;
  tone?: string;
}): Promise<{ success: boolean; chapter_id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { data: result, error } = await supabase
      .from('ebook_writer_history')
      .insert({
        user_id: data.user_id,
        ebook_id: data.ebook_id || null,
        writing_session_id: data.writing_session_id,
        chapter_number: data.chapter_number,
        chapter_title: data.chapter_title,
        content_prompt: data.content_prompt,
        generated_content: data.generated_content || null,
        word_count: data.word_count || 0,
        writing_style: data.writing_style || null,
        tone: data.tone || null,
        revision_count: 0,
        feedback_applied: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error storing chapter generation:', error);
      return { success: false, error: error.message };
    }

    return { success: true, chapter_id: result.id };
    
  } catch (error) {
    console.error('Database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to store chapter generation' 
    };
  }
}

/**
 * Record generation metrics
 */
export async function recordEbookMetrics(data: EbookMetricsData): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('generation_metrics')
      .insert({
        user_id: data.user_id,
        tool_name: 'ebook_writer',
        workflow_type: data.workflow_type,
        credits_used: data.credits_used,
        generation_time_ms: data.generation_time_ms,
        metadata: JSON.stringify({
          word_count: data.word_count,
          chapters_generated: data.chapters_generated
        }),
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error recording metrics:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
    
  } catch (error) {
    console.error('Database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to record metrics' 
    };
  }
}

/**
 * Save current ebook session (auto-save)
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
  try {
    const supabase = await createClient();
    
    // If ebookId provided, update existing record
    if (ebookId) {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };
      
      // Map session data to database fields
      if (sessionData.title) updateData.title = sessionData.title;
      if (sessionData.topic) updateData.description = sessionData.topic;
      if (sessionData.outline) updateData.content_structure = JSON.stringify(sessionData.outline);
      if (sessionData.content) updateData.generated_content = JSON.stringify(sessionData.content);
      if (sessionData.cover_url) updateData.cover_image_url = sessionData.cover_url;
      if (sessionData.generation_progress !== undefined) updateData.generation_progress = sessionData.generation_progress;
      
      // Store session-specific data in metadata
      const metadata = {
        current_step: sessionData.current_step,
        title_options: sessionData.title_options,
        uploaded_documents: sessionData.uploaded_documents,
        last_saved: new Date().toISOString()
      };
      updateData.metadata = JSON.stringify(metadata);
      
      const { error } = await supabase
        .from('ebook_history')
        .update(updateData)
        .eq('id', ebookId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating ebook session:', error);
        return { success: false, error: error.message };
      }

      return { success: true, ebook_id: ebookId };
    } 
    
    // Create new session record
    const ebookData = {
      user_id: userId,
      title: sessionData.title || 'Untitled Ebook',
      description: sessionData.topic || null,
      chapter_count: 0,
      total_word_count: 0,
      status: 'in_progress',
      generation_progress: sessionData.generation_progress || 0,
      content_structure: sessionData.outline ? JSON.stringify(sessionData.outline) : null,
      generated_content: sessionData.content ? JSON.stringify(sessionData.content) : null,
      cover_image_url: sessionData.cover_url || null,
      metadata: JSON.stringify({
        current_step: sessionData.current_step || 'topic',
        title_options: sessionData.title_options,
        uploaded_documents: sessionData.uploaded_documents,
        created_via: 'ebook_writer_session',
        last_saved: new Date().toISOString()
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('ebook_history')
      .insert(ebookData)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating ebook session:', error);
      return { success: false, error: error.message };
    }

    return { success: true, ebook_id: result.id };
    
  } catch (error) {
    console.error('Database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save ebook session' 
    };
  }
}

/**
 * Load user's current ebook session (most recent in-progress)
 */
export async function loadEbookSession(userId: string): Promise<{ 
  success: boolean; 
  session?: {
    ebook_id: string;
    topic?: string;
    title?: string;
    title_options?: Json;
    outline?: Json;
    content?: Json;
    cover_url?: string;
    uploaded_documents?: Json;
    current_step?: string;
    generation_progress?: number;
  }; 
  error?: string 
}> {
  try {
    const supabase = await createClient();
    
    const { data: ebook, error } = await supabase
      .from('ebook_history')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error loading ebook session:', error);
      return { success: false, error: error.message };
    }

    if (!ebook) {
      return { success: true, session: undefined };
    }

    // Parse metadata
    let metadata = {};
    if (ebook.metadata && typeof ebook.metadata === 'string') {
      try {
        metadata = JSON.parse(ebook.metadata);
      } catch {
        console.warn('Failed to parse session metadata JSON');
      }
    }

    // Parse content structure
    let outline = null;
    if (ebook.content_structure && typeof ebook.content_structure === 'string') {
      try {
        outline = JSON.parse(ebook.content_structure);
      } catch {
        console.warn('Failed to parse content_structure JSON');
      }
    }

    // Parse generated content
    let content = null;
    if (ebook.generated_content && typeof ebook.generated_content === 'string') {
      try {
        content = JSON.parse(ebook.generated_content);
      } catch {
        console.warn('Failed to parse generated_content JSON');
      }
    }

    const session = {
      ebook_id: ebook.id,
      topic: ebook.description,
      title: ebook.title,
      title_options: (metadata as any).title_options,
      outline,
      content,
      cover_url: ebook.cover_image_url,
      uploaded_documents: (metadata as any).uploaded_documents,
      current_step: (metadata as any).current_step || 'topic',
      generation_progress: ebook.generation_progress || 0
    };

    return { success: true, session };
    
  } catch (error) {
    console.error('Database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to load ebook session' 
    };
  }
}

/**
 * Get user credits
 */
export async function getUserCredits(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    
    const { data: credits, error } = await supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user credits:', error);
      return 0;
    }

    return credits?.available_credits || 0;
    
  } catch (error) {
    console.error('Database error:', error);
    return 0;
  }
}

/**
 * Deduct credits from user account
 */
export async function deductCredits(userId: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    // First, get current credits
    const { data: currentCredits, error: fetchError } = await supabase
      .from('user_credits')
      .select('available_credits, used_credits')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching current credits:', fetchError);
      return { success: false, error: fetchError.message };
    }

    const newAvailableBalance = (currentCredits?.available_credits || 0) - amount;
    const newUsedCredits = (currentCredits?.used_credits || 0) + amount;
    
    if (newAvailableBalance < 0) {
      return { success: false, error: 'Insufficient credits' };
    }

    // Update credits
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ 
        available_credits: newAvailableBalance,
        used_credits: newUsedCredits,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating credits:', updateError);
      return { success: false, error: updateError.message };
    }

    // Log credit usage in credit_usage table
    const { error: logError } = await supabase
      .from('credit_usage')
      .insert({
        user_id: userId,
        service_type: 'ebook_writer',
        credits_used: amount,
        operation_type: 'generation',
        reference_id: null, // Could link to ebook_id if available
        metadata: JSON.stringify({
          remaining_credits: newAvailableBalance,
          timestamp: new Date().toISOString()
        }),
        created_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Error logging credit usage:', logError);
      // Don't fail the whole operation for logging errors
    }

    return { success: true };
    
  } catch (error) {
    console.error('Database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to deduct credits' 
    };
  }
}