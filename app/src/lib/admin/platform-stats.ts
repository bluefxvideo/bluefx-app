import { createAdminClient } from '@/app/supabase/server';
import { estimatedCost, jobTool, jobUsageCost } from '@/lib/admin/costs';
import { dayStart, daysBetween, localDay, readAll, toolName, viewerOffset } from '@/lib/admin/usage';

/**
 * Usage Overview's numbers: credits, uses, users and our cost in dollars, per tool, per day and per user. The admin
 * route checks the viewer first; the dev preview (app/dev-preview/usage) calls it directly in development.
 */
export async function platformStats(params: { dateRange: string; excludeAdmins: boolean; tz: string | null }) {
    // Get date range from query params
    const { dateRange, excludeAdmins } = params;
    // Days are the viewer's calendar days: "Today" starts at their midnight, "Last 7 days" is today and the six days before.
    const offset = viewerOffset(params.tz);
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
      throw new Error(`Failed to fetch usage data: ${usageError instanceof Error ? usageError.message : 'unknown error'}`);
    }

    console.log('📊 Usage query result - count:', usageData.length);

    // Our cost in dollars (lib/admin/costs.ts): the Phantom jobs record theirs exactly, free video ads included.
    type JobRow = { user_id: string; created_at: string; usage: unknown; listing: unknown; bonus: unknown };
    let jobRows: JobRow[] = [];
    let systemUserId: string | null = null;
    try {
      const { data: settings } = await (adminClient as any).from('free_video_settings').select('system_user_id').limit(1).maybeSingle();
      systemUserId = settings?.system_user_id ?? null;
      jobRows = await readAll((from, to) =>
        (adminClient as any)
          .from('smart_video_jobs')
          .select('user_id, created_at, usage:job->usage, listing:job->listing, bonus:job->bonus')
          .gte('created_at', startDate)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to)
      );
    } catch (jobsError) {
      console.warn('📊 Job costs not read:', jobsError instanceof Error ? jobsError.message : jobsError);
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
    const jobs = (excludeAdmins ? jobRows.filter((job) => !adminIds.has(job.user_id)) : jobRows).map((job) => ({
      ...job,
      costUsd: jobUsageCost(job.usage),
      tool: jobTool({ freeAccount: job.user_id === systemUserId, bonus: Boolean(job.bonus), listing: Boolean(job.listing) }),
    }));
    // The dollars of one ledger charge: an estimate from the credits, 0 for the job-based operations, null without a price.
    const entryCost = (entry: { operation_type: string | null; amount: number | null }) => estimatedCost(entry.operation_type, entry.amount || 0);
    const exactCostUsd = jobs.reduce((sum, job) => sum + job.costUsd, 0);
    const estimatedCostUsd = entries.reduce((sum, entry) => sum + (entryCost(entry) ?? 0), 0);
    const unpricedOperations = [...new Set(entries.filter((entry) => entryCost(entry) === null).map((entry) => entry.operation_type || 'unknown'))];
    const totalGenerations = entries.length;
    const uniqueUserIds = [...new Set(entries.map(e => e.user_id).filter(Boolean))];
    const activeUsers = uniqueUserIds.length;

    // Tool usage breakdown
    const toolMap = new Map<string, { credits: number; uses: number; userIds: string[]; costUsd: number; exact: boolean; unpriced: boolean }>();
    const blankTool = () => ({ credits: 0, uses: 0, userIds: [] as string[], costUsd: 0, exact: false, unpriced: false });
    for (const entry of entries) {
      const toolId = entry.operation_type || 'unknown';
      const existing = toolMap.get(toolId) || blankTool();
      existing.credits += Math.abs(entry.amount || 0);
      existing.uses += 1;
      const cost = entryCost(entry);
      if (cost === null) existing.unpriced = true;
      else existing.costUsd += cost;
      if (entry.user_id && !existing.userIds.includes(entry.user_id)) {
        existing.userIds.push(entry.user_id);
      }
      toolMap.set(toolId, existing);
    }
    // The jobs' exact dollars, on the tool they belong to; the free video ads get rows of their own (no credits).
    for (const job of jobs) {
      const existing = toolMap.get(job.tool) || blankTool();
      existing.costUsd += job.costUsd;
      existing.exact = true;
      if (job.tool.startsWith('free-video')) {
        existing.uses += 1;
        if (!existing.userIds.includes(job.user_id)) existing.userIds.push(job.user_id);
      }
      toolMap.set(job.tool, existing);
    }
    // The presenter and the animated photos are inside their jobs' dollars.
    for (const [from, to] of [['phantom-presenter', 'smart-video'], ['listing-video-clip', 'listing-video']] as const) {
      const part = toolMap.get(from);
      if (part) part.exact = (toolMap.get(to)?.exact ?? false);
    }

    const toolUsage = Array.from(toolMap.entries())
      .map(([toolId, data]) => ({
        toolId,
        toolName: toolName(toolId),
        totalCredits: data.credits,
        totalUses: data.uses,
        uniqueUsers: data.userIds.length,
        costUsd: Math.round(data.costUsd * 100) / 100,
        costKind: data.unpriced ? 'unknown' : data.exact ? 'exact' : 'estimate',
        costIncludedIn: toolId === 'phantom-presenter' ? toolName('smart-video') : toolId === 'listing-video-clip' ? toolName('listing-video') : null,
      }))
      .sort((a, b) => b.costUsd - a.costUsd || b.totalCredits - a.totalCredits);

    // Daily trends
    const dailyMap = new Map<string, { credits: number; generations: number; userIds: string[]; costUsd: number }>();
    for (const entry of entries) {
      if (!entry.created_at) continue;
      const dateKey = localDay(entry.created_at, offset);
      const existing = dailyMap.get(dateKey) || { credits: 0, generations: 0, userIds: [], costUsd: 0 };
      existing.credits += Math.abs(entry.amount || 0);
      existing.generations += 1;
      existing.costUsd += entryCost(entry) ?? 0;
      if (entry.user_id && !existing.userIds.includes(entry.user_id)) {
        existing.userIds.push(entry.user_id);
      }
      dailyMap.set(dateKey, existing);
    }
    for (const job of jobs) {
      if (!job.created_at || !job.costUsd) continue;
      const dateKey = localDay(job.created_at, offset);
      const existing = dailyMap.get(dateKey) || { credits: 0, generations: 0, userIds: [], costUsd: 0 };
      existing.costUsd += job.costUsd;
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
        costUsd: Math.round((dayData?.costUsd || 0) * 100) / 100,
      };
    });

    // Top users
    const userMap = new Map<string, { credits: number; generations: number; lastActive: string; costUsd: number }>();
    for (const entry of entries) {
      if (!entry.user_id) continue;
      const existing = userMap.get(entry.user_id) || { credits: 0, generations: 0, lastActive: entry.created_at, costUsd: 0 };
      existing.credits += Math.abs(entry.amount || 0);
      existing.generations += 1;
      existing.costUsd += entryCost(entry) ?? 0;
      if (entry.created_at > existing.lastActive) {
        existing.lastActive = entry.created_at;
      }
      userMap.set(entry.user_id, existing);
    }

    // A paying user's Phantom jobs add their exact dollars (the free video ads' account has its own tool row).
    for (const job of jobs) {
      if (!job.user_id || job.user_id === systemUserId || !job.costUsd) continue;
      const existing = userMap.get(job.user_id) || { credits: 0, generations: 0, lastActive: job.created_at, costUsd: 0 };
      existing.costUsd += job.costUsd;
      userMap.set(job.user_id, existing);
    }

    // The users who cost us the most, the credits they used beside it.
    const topUserIds = Array.from(userMap.entries())
      .sort((a, b) => b[1].costUsd - a[1].costUsd || b[1].credits - a[1].credits)
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
        costUsd: Math.round(userData.costUsd * 100) / 100,
        lastActive: userData.lastActive,
      };
    });

    return {
      success: true as const,
      summary: {
        totalCreditsUsed,
        totalGenerations,
        activeUsers,
        newUsers: newUsers || 0,
        totalUsers: totalUsers || 0,
        costUsd: Math.round((exactCostUsd + estimatedCostUsd) * 100) / 100,
        exactCostUsd: Math.round(exactCostUsd * 100) / 100,
        estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
        unpricedOperations: unpricedOperations.map((operation) => toolName(operation)),
      },
      toolUsage,
      dailyTrends,
      topUsers,
    };
}
