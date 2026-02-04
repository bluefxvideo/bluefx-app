import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/app/supabase/server';

// Tool name mapping for human-readable display
// These match the operation types passed to deductCredits() across the codebase
const TOOL_NAMES: Record<string, string> = {
  // AI Cinematographer operations
  'video-generation': 'Cinematographer Video',
  'starting-shot': 'Starting Shot',
  'storyboard-generation': 'Storyboard Generation',
  'storyboard-frame-extraction': 'Frame Extraction',

  // Script to Video
  'script-to-video-generation': 'Script to Video',
  'video-export': 'Video Export',

  // Voice & Audio
  'voice_over_generation': 'Voice Over',
  'music_generation': 'Music Generation',

  // Avatar
  'talking_avatar_generation': 'Talking Avatar',

  // Thumbnail Machine
  'thumbnail-generation': 'Thumbnail Generation',
  'face-swap-only': 'Face Swap Only',
  'recreation': 'Thumbnail Recreation',
  'title-generation': 'Title Generation',

  // Ebook
  'ebook_generation': 'Ebook Writer',
  'ebook_cover_generation': 'Ebook Cover',

  // Logo
  'logo-generation': 'Logo Generation',

  // Video Swap
  'video-swap': 'Video Swap',

  // Legacy/alternative names (for backwards compatibility)
  'voice_over': 'Voice Over',
  'media_generation': 'AI Cinematographer',
  'content_generation': 'Content Multiplier',
  'avatar_video': 'Talking Avatar',
  'ai_prediction': 'Thumbnail Machine',
  'script_to_video': 'Script to Video',
  'logo_generation': 'Logo Generator',
  'video_swap': 'Video Swap',
};

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Platform stats API called');

    // Check auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('📊 Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin' || user.email === 'contact@bluefx.net';
    if (!isAdmin) {
      console.log('📊 Not admin:', profile?.role);
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('📊 Admin verified, fetching data...');

    // Get date range from query params
    const searchParams = request.nextUrl.searchParams;
    const dateRange = searchParams.get('range') || '30d';
    const excludeAdmins = searchParams.get('excludeAdmins') === 'true';
    const days = dateRange === '1d' ? 1 : dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365 * 10;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    console.log('📊 Date range:', dateRange, 'Exclude admins:', excludeAdmins, 'Start date:', startDate);

    // Use admin client
    const adminClient = createAdminClient();

    // Fetch admin user IDs if excluding
    let adminIds = new Set<string>();
    if (excludeAdmins) {
      const { data: adminProfiles } = await adminClient
        .from('profiles')
        .select('id')
        .eq('role', 'admin');
      adminIds = new Set(adminProfiles?.map(p => p.id) || []);
      console.log('📊 Excluding admin IDs:', [...adminIds]);
    }

    // Fetch credit transactions data (this is where user usage is stored)
    // Same table that user-dashboard-enhanced.tsx uses
    const { data: usageData, error: usageError } = await adminClient
      .from('credit_transactions')
      .select('user_id, operation_type, amount, created_at')
      .eq('transaction_type', 'debit')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })
      .limit(10000);

    console.log('📊 Usage query result - error:', usageError?.message, 'count:', usageData?.length);

    if (usageError) {
      return NextResponse.json({
        error: `Failed to fetch usage data: ${usageError.message}`,
        details: usageError
      }, { status: 500 });
    }

    // Fetch user counts
    let totalUsersQuery = adminClient.from('profiles').select('*', { count: 'exact', head: true });
    let newUsersQuery = adminClient.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startDate);

    if (excludeAdmins) {
      totalUsersQuery = totalUsersQuery.neq('role', 'admin');
      newUsersQuery = newUsersQuery.neq('role', 'admin');
    }

    const { count: totalUsers, error: totalUsersError } = await totalUsersQuery;
    console.log('📊 Total users:', totalUsers, 'error:', totalUsersError?.message);

    const { count: newUsers, error: newUsersError } = await newUsersQuery;
    console.log('📊 New users:', newUsers, 'error:', newUsersError?.message);

    // Process data - using operation_type and amount from credit_transactions
    // Filter out admin usage if requested
    const entries = excludeAdmins
      ? (usageData || []).filter(tx => !adminIds.has(tx.user_id))
      : (usageData || []);
    const totalCreditsUsed = entries.reduce((sum, entry) => sum + Math.abs(entry.amount || 0), 0);
    const totalGenerations = entries.length;
    const uniqueUserIds = [...new Set(entries.map(e => e.user_id).filter(Boolean))];
    const activeUsers = uniqueUserIds.length;

    // Tool usage breakdown
    const toolMap = new Map<string, { credits: number; uses: number; userIds: string[] }>();
    for (const entry of entries) {
      const toolId = entry.operation_type || 'unknown';
      const existing = toolMap.get(toolId) || { credits: 0, uses: 0, userIds: [] };
      existing.credits += Math.abs(entry.amount || 0);
      existing.uses += 1;
      if (entry.user_id && !existing.userIds.includes(entry.user_id)) {
        existing.userIds.push(entry.user_id);
      }
      toolMap.set(toolId, existing);
    }

    const toolUsage = Array.from(toolMap.entries())
      .map(([toolId, data]) => ({
        toolId,
        toolName: TOOL_NAMES[toolId] || toolId.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        totalCredits: data.credits,
        totalUses: data.uses,
        uniqueUsers: data.userIds.length,
      }))
      .sort((a, b) => b.totalCredits - a.totalCredits);

    // Daily trends
    const dailyMap = new Map<string, { credits: number; generations: number; userIds: string[] }>();
    for (const entry of entries) {
      if (!entry.created_at) continue;
      const dateKey = entry.created_at.split('T')[0];
      const existing = dailyMap.get(dateKey) || { credits: 0, generations: 0, userIds: [] };
      existing.credits += Math.abs(entry.amount || 0);
      existing.generations += 1;
      if (entry.user_id && !existing.userIds.includes(entry.user_id)) {
        existing.userIds.push(entry.user_id);
      }
      dailyMap.set(dateKey, existing);
    }

    const dailyTrends: { date: string; creditsUsed: number; generations: number; activeUsers: number }[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      const dayData = dailyMap.get(dateKey);
      dailyTrends.push({
        date: dateKey,
        creditsUsed: dayData?.credits || 0,
        generations: dayData?.generations || 0,
        activeUsers: dayData?.userIds.length || 0,
      });
    }

    // Top users
    const userMap = new Map<string, { credits: number; generations: number; lastActive: string }>();
    for (const entry of entries) {
      if (!entry.user_id) continue;
      const existing = userMap.get(entry.user_id) || { credits: 0, generations: 0, lastActive: entry.created_at };
      existing.credits += Math.abs(entry.amount || 0);
      existing.generations += 1;
      if (entry.created_at > existing.lastActive) {
        existing.lastActive = entry.created_at;
      }
      userMap.set(entry.user_id, existing);
    }

    const topUserIds = Array.from(userMap.entries())
      .sort((a, b) => b[1].credits - a[1].credits)
      .slice(0, 10)
      .map(([userId]) => userId);

    // Fetch user profiles
    let userProfiles: { id: string; email: string | null; username: string | null; full_name: string | null }[] = [];
    if (topUserIds.length > 0) {
      const { data } = await adminClient
        .from('profiles')
        .select('id, email, username, full_name')
        .in('id', topUserIds);
      userProfiles = data || [];
    }

    const profileMap = new Map(userProfiles.map(p => [p.id, p]));

    const topUsers = topUserIds.map(userId => {
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

    return NextResponse.json({
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
    });

  } catch (error) {
    console.error('📊 Platform stats error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
