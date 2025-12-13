'use server';

import { createClient } from '@/app/supabase/server';

// Tool name mapping for display
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  'voice-over': 'Voice Over',
  'ai-cinematographer': 'AI Cinematographer',
  'content-multiplier': 'Content Multiplier',
  'talking-avatar': 'Talking Avatar',
  'thumbnail-machine': 'Thumbnail Machine',
  'script-to-video': 'Script to Video',
  'music-machine': 'Music Machine',
  'logo-generator': 'Logo Generator',
  'ebook-writer': 'Ebook Writer',
  'video-swap': 'Video Swap',
  'script-generator': 'Script Generator',
  'viral-trends': 'Viral Trends',
  'top-keywords': 'Top Keywords',
  'business-offers': 'Business Offers',
  'my-creations': 'My Creations',
  'script-library': 'Script Library',
  'help-center': 'Help Center',
  'settings': 'Settings',
  'dashboard': 'Dashboard',
};

export interface ActivityLogEntry {
  id: string;
  user_id: string;
  tool_name: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // Joined data
  user_email?: string;
  user_name?: string;
}

export interface DailyActivitySummary {
  date: string;
  total_activities: number;
  unique_users: number;
  by_tool: { tool: string; toolName: string; count: number }[];
}

/**
 * Log user activity when they visit/use a tool
 */
export async function logActivity(
  toolName: string,
  action: string = 'visit',
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('activity_log')
      .insert({
        user_id: user.id,
        tool_name: toolName,
        action,
        metadata: metadata || {},
      });

    if (error) {
      console.error('Error logging activity:', error);
      return { success: false, error: 'Failed to log activity' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in logActivity:', error);
    return { success: false, error: 'Failed to log activity' };
  }
}

/**
 * Fetch activity feed for admin - paginated list of all activity
 */
export async function fetchActivityFeed(options?: {
  page?: number;
  limit?: number;
  toolFilter?: string;
  dateFilter?: string; // YYYY-MM-DD
}): Promise<{
  success: boolean;
  data?: {
    entries: ActivityLogEntry[];
    total: number;
    page: number;
    totalPages: number;
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Verify admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }

    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (options?.toolFilter && options.toolFilter !== 'all') {
      query = query.eq('tool_name', options.toolFilter);
    }

    if (options?.dateFilter) {
      const startOfDay = `${options.dateFilter}T00:00:00.000Z`;
      const endOfDay = `${options.dateFilter}T23:59:59.999Z`;
      query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: activities, error, count } = await query;

    if (error) {
      console.error('Error fetching activity feed:', error);
      return { success: false, error: 'Failed to fetch activity feed' };
    }

    // Get user info for each activity
    const userIds = [...new Set((activities || []).map(a => a.user_id))];

    let userMap: Record<string, { email?: string; name?: string }> = {};

    if (userIds.length > 0) {
      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', userIds);

      // Get emails from auth.users via admin API (if available)
      // For now, we'll use profiles data

      for (const profile of profiles || []) {
        userMap[profile.id] = {
          name: profile.full_name || profile.username || 'Unknown',
        };
      }
    }

    const entries: ActivityLogEntry[] = (activities || []).map(activity => ({
      ...activity,
      user_name: userMap[activity.user_id]?.name,
      user_email: userMap[activity.user_id]?.email,
    }));

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        entries,
        total,
        page,
        totalPages,
      },
    };
  } catch (error) {
    console.error('Error in fetchActivityFeed:', error);
    return { success: false, error: 'Failed to fetch activity feed' };
  }
}

/**
 * Fetch daily activity summary for admin dashboard
 */
export async function fetchDailyActivitySummary(date?: string): Promise<{
  success: boolean;
  data?: DailyActivitySummary;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Verify admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }

    // Default to today
    const targetDate = date || new Date().toISOString().split('T')[0];
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    // Fetch all activity for the day
    const { data: activities, error } = await supabase
      .from('activity_log')
      .select('tool_name, user_id')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    if (error) {
      console.error('Error fetching daily summary:', error);
      return { success: false, error: 'Failed to fetch daily summary' };
    }

    const entries = activities || [];
    const uniqueUsers = new Set(entries.map(e => e.user_id)).size;

    // Group by tool
    const toolMap = new Map<string, number>();
    for (const entry of entries) {
      const count = toolMap.get(entry.tool_name) || 0;
      toolMap.set(entry.tool_name, count + 1);
    }

    const byTool = Array.from(toolMap.entries())
      .map(([tool, count]) => ({
        tool,
        toolName: TOOL_DISPLAY_NAMES[tool] || tool,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      success: true,
      data: {
        date: targetDate,
        total_activities: entries.length,
        unique_users: uniqueUsers,
        by_tool: byTool,
      },
    };
  } catch (error) {
    console.error('Error in fetchDailyActivitySummary:', error);
    return { success: false, error: 'Failed to fetch daily summary' };
  }
}

/**
 * Get list of unique tools for filter dropdown
 */
export async function fetchActivityToolList(): Promise<{
  success: boolean;
  tools?: { value: string; label: string }[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Verify admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }

    const { data, error } = await supabase
      .from('activity_log')
      .select('tool_name');

    if (error) {
      console.error('Error fetching tool list:', error);
      return { success: false, error: 'Failed to fetch tool list' };
    }

    const uniqueTools = [...new Set((data || []).map(d => d.tool_name))];
    const tools = uniqueTools.map(tool => ({
      value: tool,
      label: TOOL_DISPLAY_NAMES[tool] || tool,
    }));

    return { success: true, tools };
  } catch (error) {
    console.error('Error in fetchActivityToolList:', error);
    return { success: false, error: 'Failed to fetch tool list' };
  }
}
