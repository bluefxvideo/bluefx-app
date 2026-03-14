'use server';

import { createClient } from '@/app/supabase/server';
import type { AgentCloneGenerationRow } from '@/types/reelestate';

// ═══════════════════════════════════════════
// Agent Clone Generations CRUD
// ═══════════════════════════════════════════

export async function storeAgentCloneGeneration(params: {
  user_id: string;
  agent_photo_url: string;
  background_url: string;
  composite_url: string;
  prompt: string;
  aspect_ratio: string;
  credits_used: number;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('agent_clone_generations')
      .insert({
        user_id: params.user_id,
        agent_photo_url: params.agent_photo_url,
        background_url: params.background_url,
        composite_url: params.composite_url,
        prompt: params.prompt,
        aspect_ratio: params.aspect_ratio,
        status: 'composite_ready',
        credits_used: params.credits_used,
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to store agent clone generation:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Agent Clone generation stored:', data.id);
    return { success: true, id: data.id };
  } catch (error) {
    console.error('❌ storeAgentCloneGeneration error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to store generation' };
  }
}

export async function updateAgentCloneGeneration(
  id: string,
  updates: Partial<Pick<AgentCloneGenerationRow,
    'composite_url' | 'video_url' | 'status' | 'prediction_id' |
    'error_message' | 'credits_used' | 'dialogue' | 'action' |
    'camera_motion' | 'duration'
  >>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('agent_clone_generations')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('❌ Failed to update agent clone generation:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update' };
  }
}

export async function getAgentCloneGenerations(
  limit = 50,
): Promise<{ success: boolean; generations?: AgentCloneGenerationRow[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required' };

    const { data, error } = await supabase
      .from('agent_clone_generations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Failed to get agent clone generations:', error);
      return { success: false, error: error.message };
    }

    return { success: true, generations: (data || []) as AgentCloneGenerationRow[] };
  } catch (error) {
    return { success: false, error: 'Failed to get generations' };
  }
}

export async function deleteAgentCloneGeneration(
  id: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('agent_clone_generations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Failed to delete agent clone generation:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Agent Clone generation deleted:', id);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete generation' };
  }
}
