'use server';

import { createClient } from '@/app/supabase/server';

// Tool name mapping for human-readable display
export const TOOL_NAMES: Record<string, string> = {
  'voice_over': 'Voice Over',
  'media_generation': 'AI Cinematographer',
  'content_generation': 'Content Multiplier',
  'avatar_video': 'Talking Avatar',
  'ai_prediction': 'Thumbnail Machine',
  'script_to_video': 'Script to Video',
  'music_generation': 'Music Maker',
  'logo_generation': 'Logo Generator',
  'ebook_generation': 'Ebook Writer',
  'video_swap': 'Video Swap',
};

export interface ToolUsageBreakdown {
  tool: string;
  toolName: string;
  credits: number;
  count: number;
}

export interface UserUsageStats {
  totalCreditsUsed: number;
  totalGenerations: number;
  byTool: ToolUsageBreakdown[];
  lastActivity: string | null;
  mostUsedTool: string | null;
}

export interface CreditUsageEntry {
  id: string;
  user_id: string;
  service_type: string;
  credits_used: number;
  operation_type: string;
  reference_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface UserUsageHistoryResponse {
  entries: CreditUsageEntry[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Check if the current user is an admin
 */
async function verifyAdmin(): Promise<{ isAdmin: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { isAdmin: false, error: 'Authentication required' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { isAdmin: false, error: 'Admin access required' };
  }

  return { isAdmin: true };
}

/**
 * Fetch aggregated usage stats for a specific user
 */
export async function fetchUserUsageStats(userId: string): Promise<{
  success: boolean;
  stats?: UserUsageStats;
  error?: string;
}> {
  try {
    const adminCheck = await verifyAdmin();
    if (!adminCheck.isAdmin) {
      return { success: false, error: adminCheck.error };
    }

    const supabase = await createClient();

    // Fetch all credit usage for this user
    const { data: usageData, error: usageError } = await supabase
      .from('credit_usage')
      .select('service_type, credits_used, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (usageError) {
      console.error('Error fetching usage stats:', usageError);
      return { success: false, error: 'Failed to fetch usage stats' };
    }

    // Calculate aggregated stats
    const entries = usageData || [];
    const totalCreditsUsed = entries.reduce((sum, e) => sum + (e.credits_used || 0), 0);
    const totalGenerations = entries.length;
    const lastActivity = entries.length > 0 ? entries[0].created_at : null;

    // Group by tool
    const toolMap = new Map<string, { credits: number; count: number }>();
    for (const entry of entries) {
      const tool = entry.service_type || 'unknown';
      const existing = toolMap.get(tool) || { credits: 0, count: 0 };
      toolMap.set(tool, {
        credits: existing.credits + (entry.credits_used || 0),
        count: existing.count + 1,
      });
    }

    const byTool: ToolUsageBreakdown[] = Array.from(toolMap.entries())
      .map(([tool, data]) => ({
        tool,
        toolName: TOOL_NAMES[tool] || tool,
        credits: data.credits,
        count: data.count,
      }))
      .sort((a, b) => b.credits - a.credits);

    const mostUsedTool = byTool.length > 0 ? byTool[0].toolName : null;

    return {
      success: true,
      stats: {
        totalCreditsUsed,
        totalGenerations,
        byTool,
        lastActivity,
        mostUsedTool,
      },
    };
  } catch (error) {
    console.error('Error in fetchUserUsageStats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch usage stats',
    };
  }
}

/**
 * Fetch paginated usage history for a specific user
 */
export async function fetchUserUsageHistory(
  userId: string,
  options?: {
    page?: number;
    limit?: number;
    toolFilter?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<{
  success: boolean;
  data?: UserUsageHistoryResponse;
  error?: string;
}> {
  try {
    const adminCheck = await verifyAdmin();
    if (!adminCheck.isAdmin) {
      return { success: false, error: adminCheck.error };
    }

    const supabase = await createClient();
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('credit_usage')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (options?.toolFilter && options.toolFilter !== 'all') {
      query = query.eq('service_type', options.toolFilter);
    }

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching usage history:', error);
      return { success: false, error: 'Failed to fetch usage history' };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        entries: data || [],
        total,
        page,
        totalPages,
      },
    };
  } catch (error) {
    console.error('Error in fetchUserUsageHistory:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch usage history',
    };
  }
}

/**
 * Get list of unique tools used by a user (for filter dropdown)
 */
export async function fetchUserToolList(userId: string): Promise<{
  success: boolean;
  tools?: { value: string; label: string }[];
  error?: string;
}> {
  try {
    const adminCheck = await verifyAdmin();
    if (!adminCheck.isAdmin) {
      return { success: false, error: adminCheck.error };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('credit_usage')
      .select('service_type')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching tool list:', error);
      return { success: false, error: 'Failed to fetch tool list' };
    }

    // Get unique tools
    const uniqueTools = [...new Set((data || []).map(d => d.service_type))];
    const tools = uniqueTools.map(tool => ({
      value: tool,
      label: TOOL_NAMES[tool] || tool,
    }));

    return { success: true, tools };
  } catch (error) {
    console.error('Error in fetchUserToolList:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tool list',
    };
  }
}
