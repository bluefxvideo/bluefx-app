import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/app/supabase/server';
import { dayStart, daysBetween, localDay, readAll, toolName, viewerOffset } from '@/lib/admin/usage';

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
    // Days are the viewer's calendar days: "Today" starts at their midnight, "Last 7 days" is today and the six days before.
    const offset = viewerOffset(searchParams.get('tz'));
    const today = localDay(Date.now(), offset);
    const days = dateRange === '1d' ? 1 : dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : null;
    const firstDay = days ? localDay(dayStart(today, offset).getTime() - (days - 1) * 24 * 60 * 60 * 1000, offset) : null;
    const startDate = firstDay ? dayStart(firstDay, offset).toISOString() : '2000-01-01T00:00:00.000Z';

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
    // Same table that user-dashboard-enhanced.tsx uses. Read page by page: one request stops at 1,000 rows.
    let usageData: { user_id: string; operation_type: string | null; amount: number | null; created_at: string }[];
    try {
      usageData = await readAll((from, to) =>
        adminClient
          .from('credit_transactions')
          .select('user_id, operation_type, amount, created_at')
          .eq('transaction_type', 'debit')
          .gte('created_at', startDate)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to)
      );
    } catch (usageError) {
      return NextResponse.json({
        error: `Failed to fetch usage data: ${usageError instanceof Error ? usageError.message : 'unknown error'}`,
      }, { status: 500 });
    }

    console.log('📊 Usage query result - count:', usageData.length);

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
        toolName: toolName(toolId),
        totalCredits: data.credits,
        totalUses: data.uses,
        uniqueUsers: data.userIds.length,
      }))
      .sort((a, b) => b.totalCredits - a.totalCredits);

    // Daily trends
    const dailyMap = new Map<string, { credits: number; generations: number; userIds: string[] }>();
    for (const entry of entries) {
      if (!entry.created_at) continue;
      const dateKey = localDay(entry.created_at, offset);
      const existing = dailyMap.get(dateKey) || { credits: 0, generations: 0, userIds: [] };
      existing.credits += Math.abs(entry.amount || 0);
      existing.generations += 1;
      if (entry.user_id && !existing.userIds.includes(entry.user_id)) {
        existing.userIds.push(entry.user_id);
      }
      dailyMap.set(dateKey, existing);
    }

    // One point per calendar day, days without usage included. "All time" starts at the first day with usage.
    const firstUsedDay = [...dailyMap.keys()].sort()[0] || today;
    const dailyTrends = daysBetween(firstDay || firstUsedDay, today).map((dateKey) => {
      const dayData = dailyMap.get(dateKey);
      return {
        date: dateKey,
        creditsUsed: dayData?.credits || 0,
        generations: dayData?.generations || 0,
        activeUsers: dayData?.userIds.length || 0,
      };
    });

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
