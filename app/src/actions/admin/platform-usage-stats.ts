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
  'starting-shot': 'Starting Shot',
  'video-generation': 'Video Generation',
  'storyboard-generation': 'Storyboard',
  'storyboard-frame-extraction': 'Frame Extraction',
};

export interface PlatformSummaryStats {
  totalCreditsUsed: number;
  totalGenerations: number;
  activeUsers: number;
  newUsers: number;
  totalUsers: number;
}

export interface ToolUsageStat {
  toolId: string;
  toolName: string;
  totalCredits: number;
  totalUses: number;
  uniqueUsers: number;
}

export interface DailyUsageTrend {
  date: string;
  creditsUsed: number;
  generations: number;
  activeUsers: number;
}

export interface TopUser {
  userId: string;
  email: string | null;
  username: string | null;
  fullName: string | null;
  creditsUsed: number;
  generations: number;
  lastActive: string | null;
}

export interface PlatformUsageResponse {
  success: boolean;
  summary?: PlatformSummaryStats;
  toolUsage?: ToolUsageStat[];
  dailyTrends?: DailyUsageTrend[];
  topUsers?: TopUser[];
  error?: string;
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
 * Fetch platform-wide usage statistics
 */
export async function fetchPlatformUsageStats(
  dateRange: '7d' | '30d' | '90d' | 'all' = '30d'
): Promise<PlatformUsageResponse> {
  try {
    const adminCheck = await verifyAdmin();
    if (!adminCheck.isAdmin) {
      return { success: false, error: adminCheck.error };
    }

    const supabase = await createClient();

    // Calculate date range
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365 * 10;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all credit transactions in date range
    const { data: transactions, error: txError } = await supabase
      .from('credit_transactions')
      .select('user_id, amount, operation_type, created_at')
      .eq('transaction_type', 'debit')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return { success: false, error: 'Failed to fetch usage data' };
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

    // Calculate summary stats
    const txList = transactions || [];
    const totalCreditsUsed = txList.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const totalGenerations = txList.length;
    const uniqueActiveUsers = new Set(txList.map(tx => tx.user_id));
    const activeUsers = uniqueActiveUsers.size;

    // Calculate tool usage stats
    const toolMap = new Map<string, { credits: number; uses: number; users: Set<string> }>();
    for (const tx of txList) {
      const toolId = tx.operation_type || 'unknown';
      const existing = toolMap.get(toolId) || { credits: 0, uses: 0, users: new Set<string>() };
      existing.credits += Math.abs(tx.amount);
      existing.uses += 1;
      existing.users.add(tx.user_id);
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
    for (const tx of txList) {
      const dateKey = tx.created_at.split('T')[0];
      const existing = dailyMap.get(dateKey) || { credits: 0, generations: 0, users: new Set<string>() };
      existing.credits += Math.abs(tx.amount);
      existing.generations += 1;
      existing.users.add(tx.user_id);
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
    for (const tx of txList) {
      const existing = userMap.get(tx.user_id) || { credits: 0, generations: 0, lastActive: tx.created_at };
      existing.credits += Math.abs(tx.amount);
      existing.generations += 1;
      if (tx.created_at > existing.lastActive) {
        existing.lastActive = tx.created_at;
      }
      userMap.set(tx.user_id, existing);
    }

    // Get top 10 users by credits
    const topUserIds = Array.from(userMap.entries())
      .sort((a, b) => b[1].credits - a[1].credits)
      .slice(0, 10)
      .map(([userId]) => userId);

    // Fetch user details for top users
    const { data: userProfiles } = await supabase
      .from('profiles')
      .select('id, email, username, full_name')
      .in('id', topUserIds);

    const profileMap = new Map(userProfiles?.map(p => [p.id, p]) || []);

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
