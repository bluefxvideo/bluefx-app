'use server';

import { createClient, createAdminClient } from '@/app/supabase/server';
import {
  TOOL_NAMES,
  type PlatformSummaryStats,
  type ToolUsageStat,
  type DailyUsageTrend,
  type TopUser,
  type PlatformUsageResponse,
} from '@/types/platform-usage';

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
 * Fetch platform-wide usage statistics
 */
export async function fetchPlatformUsageStats(
  dateRange: '7d' | '30d' | '90d' | 'all' = '30d'
): Promise<PlatformUsageResponse> {
  try {
    console.log('📊 fetchPlatformUsageStats called with dateRange:', dateRange);

    const adminCheck = await verifyAdmin();
    console.log('📊 Admin check result:', adminCheck);

    if (!adminCheck.isAdmin) {
      return { success: false, error: adminCheck.error };
    }

    // Use admin client to bypass RLS for aggregate queries
    const supabase = createAdminClient();
    console.log('📊 Admin client created');

    // Calculate date range
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365 * 10;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    console.log('📊 Fetching data from:', startDate);

    // Fetch credit usage in date range with a reasonable limit
    // Using limit of 10000 to prevent memory issues while still getting comprehensive data
    const { data: usageData, error: usageError } = await supabase
      .from('credit_usage')
      .select('user_id, service_type, credits_used, created_at')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })
      .limit(10000);

    console.log('📊 Credit usage query result - error:', usageError, 'count:', usageData?.length);

    if (usageError) {
      console.error('Error fetching credit usage:', usageError);
      return { success: false, error: `Failed to fetch usage data: ${usageError.message}` };
    }

    // Fetch total user count
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Fetch new users in date range
    const { count: newUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate);

    console.log('📊 Total users:', totalUsers, 'New users:', newUsers);

    // Calculate summary stats
    const entries = usageData || [];
    console.log('📊 Processing', entries.length, 'entries');

    const totalCreditsUsed = entries.reduce((sum, entry) => sum + (entry.credits_used || 0), 0);
    const totalGenerations = entries.length;
    const uniqueActiveUsers = new Set(entries.map(entry => entry.user_id).filter(Boolean));
    const activeUsers = uniqueActiveUsers.size;

    // Calculate tool usage stats
    const toolMap = new Map<string, { credits: number; uses: number; users: Set<string> }>();
    for (const entry of entries) {
      const toolId = entry.service_type || 'unknown';
      const existing = toolMap.get(toolId) || { credits: 0, uses: 0, users: new Set<string>() };
      existing.credits += (entry.credits_used || 0);
      existing.uses += 1;
      existing.users.add(entry.user_id);
      toolMap.set(toolId, existing);
    }

    const toolUsage: ToolUsageStat[] = Array.from(toolMap.entries())
      .map(([toolId, data]) => ({
        toolId,
        toolName: TOOL_NAMES[toolId] || toolId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        totalCredits: data.credits,
        totalUses: data.uses,
        uniqueUsers: data.users.size,
      }))
      .sort((a, b) => b.totalCredits - a.totalCredits);

    // Calculate daily trends
    const dailyMap = new Map<string, { credits: number; generations: number; users: Set<string> }>();
    for (const entry of entries) {
      if (!entry.created_at) continue;
      const dateKey = entry.created_at.split('T')[0];
      const existing = dailyMap.get(dateKey) || { credits: 0, generations: 0, users: new Set<string>() };
      existing.credits += (entry.credits_used || 0);
      existing.generations += 1;
      existing.users.add(entry.user_id);
      dailyMap.set(dateKey, existing);
    }

    // Fill in missing dates with zeros
    const dailyTrends: DailyUsageTrend[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      const dayData = dailyMap.get(dateKey);
      dailyTrends.push({
        date: dateKey,
        creditsUsed: dayData?.credits || 0,
        generations: dayData?.generations || 0,
        activeUsers: dayData?.users.size || 0,
      });
    }

    // Calculate top users
    const userMap = new Map<string, { credits: number; generations: number; lastActive: string }>();
    for (const entry of entries) {
      const existing = userMap.get(entry.user_id) || { credits: 0, generations: 0, lastActive: entry.created_at };
      existing.credits += (entry.credits_used || 0);
      existing.generations += 1;
      if (entry.created_at > existing.lastActive) {
        existing.lastActive = entry.created_at;
      }
      userMap.set(entry.user_id, existing);
    }

    // Get top 10 users by credits
    const topUserIds = Array.from(userMap.entries())
      .sort((a, b) => b[1].credits - a[1].credits)
      .slice(0, 10)
      .map(([userId]) => userId);

    // Fetch user details for top users (only if there are users to fetch)
    let userProfiles: { id: string; email: string | null; username: string | null; full_name: string | null }[] = [];
    if (topUserIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, username, full_name')
        .in('id', topUserIds);
      userProfiles = data || [];
    }

    const profileMap = new Map(userProfiles.map(p => [p.id, p]));

    const topUsers: TopUser[] = topUserIds.map(userId => {
      const userData = userMap.get(userId)!;
      const profile = profileMap.get(userId);
      return {
        userId,
        email: profile?.email || null,
        username: profile?.username || null,
        fullName: profile?.full_name || null,
        creditsUsed: userData.credits,
        generations: userData.generations,
        lastActive: userData.lastActive,
      };
    });

    console.log('📊 Returning success with', toolUsage.length, 'tools,', dailyTrends.length, 'days,', topUsers.length, 'top users');

    return {
      success: true,
      summary: {
        totalCreditsUsed,
        totalGenerations,
        activeUsers,
        newUsers: newUsers || 0,
        totalUsers: totalUsers || 0,
      },
      toolUsage,
      dailyTrends,
      topUsers,
    };
  } catch (error) {
    console.error('Error in fetchPlatformUsageStats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch platform stats',
    };
  }
}
