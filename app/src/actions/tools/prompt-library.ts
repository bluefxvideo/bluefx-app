'use server';

import { createClient } from '@/app/supabase/server';
import type { Prompt, PromptCategory, CreatePromptInput, UpdatePromptInput } from '@/lib/prompt-library/types';

interface FetchPromptsOptions {
  category?: PromptCategory;
  search?: string;
  featuredOnly?: boolean;
}

interface PromptResponse {
  success: boolean;
  prompt?: Prompt;
  error?: string;
}

interface PromptsResponse {
  success: boolean;
  prompts?: Prompt[];
  error?: string;
}

/**
 * Fetch all prompts with optional filtering
 */
export async function fetchPrompts(options?: FetchPromptsOptions): Promise<PromptsResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    let query = supabase
      .from('prompt_library')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.featuredOnly) {
      query = query.eq('is_featured', true);
    }

    if (options?.search) {
      query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching prompts:', error);
      return { success: false, error: error.message };
    }

    return { success: true, prompts: data as Prompt[] };
  } catch (error) {
    console.error('Error in fetchPrompts:', error);
    return { success: false, error: 'Failed to fetch prompts' };
  }
}

/**
 * Fetch a single prompt by ID
 */
export async function fetchPrompt(id: string): Promise<PromptResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await supabase
      .from('prompt_library')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching prompt:', error);
      return { success: false, error: error.message };
    }

    return { success: true, prompt: data as Prompt };
  } catch (error) {
    console.error('Error in fetchPrompt:', error);
    return { success: false, error: 'Failed to fetch prompt' };
  }
}

/**
 * Create a new prompt (admin only - enforced by RLS)
 */
export async function createPrompt(input: CreatePromptInput): Promise<PromptResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await supabase
      .from('prompt_library')
      .insert([input])
      .select()
      .single();

    if (error) {
      console.error('Error creating prompt:', error);
      return { success: false, error: error.message };
    }

    return { success: true, prompt: data as Prompt };
  } catch (error) {
    console.error('Error in createPrompt:', error);
    return { success: false, error: 'Failed to create prompt' };
  }
}

/**
 * Update an existing prompt (admin only - enforced by RLS)
 */
export async function updatePrompt(id: string, updates: UpdatePromptInput): Promise<PromptResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await supabase
      .from('prompt_library')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating prompt:', error);
      return { success: false, error: error.message };
    }

    return { success: true, prompt: data as Prompt };
  } catch (error) {
    console.error('Error in updatePrompt:', error);
    return { success: false, error: 'Failed to update prompt' };
  }
}

/**
 * Delete a prompt (admin only - enforced by RLS)
 */
export async function deletePrompt(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { error } = await supabase
      .from('prompt_library')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting prompt:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in deletePrompt:', error);
    return { success: false, error: 'Failed to delete prompt' };
  }
}

/**
 * Reorder prompts (admin only - enforced by RLS)
 */
export async function reorderPrompts(orderedIds: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Update display_order for each prompt
    const updates = orderedIds.map((id, index) =>
      supabase
        .from('prompt_library')
        .update({ display_order: index })
        .eq('id', id)
    );

    await Promise.all(updates);

    return { success: true };
  } catch (error) {
    console.error('Error in reorderPrompts:', error);
    return { success: false, error: 'Failed to reorder prompts' };
  }
}

/**
 * Toggle featured status (admin only - enforced by RLS)
 */
export async function togglePromptFeatured(id: string, isFeatured: boolean): Promise<PromptResponse> {
  return updatePrompt(id, { is_featured: isFeatured });
}
