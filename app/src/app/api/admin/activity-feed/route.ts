import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/app/supabase/server';
import { dayStart, localDay, readAll, toolName, viewerOffset } from '@/lib/admin/usage';

export async function GET(request: NextRequest) {
  try {
    // Check auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
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
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    // The day is the viewer's calendar day, not a UTC day: late-evening usage belongs to the day it was made on.
    const tz = viewerOffset(searchParams.get('tz'));
    const requestedDate = searchParams.get('date');
    const dateFilter = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : localDay(Date.now(), tz);
    const toolFilter = searchParams.get('tool');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = (page - 1) * limit;

    // Calculate date range
    const startOfDay = dayStart(dateFilter, tz).toISOString();
    const endOfDay = new Date(dayStart(dateFilter, tz).getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Use admin client
    const adminClient = createAdminClient();

    // Build query for activity entries
    let query = adminClient
      .from('credit_transactions')
      .select('id, user_id, operation_type, amount, created_at', { count: 'exact' })
      .eq('transaction_type', 'debit')
      .gte('created_at', startOfDay)
      .lt('created_at', endOfDay)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (toolFilter && toolFilter !== 'all') {
      query = query.eq('operation_type', toolFilter);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: entries, error: entriesError, count } = await query;

    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 });
    }

    // Get user profiles for entries
    const userIds = [...new Set((entries || []).map(e => e.user_id).filter(Boolean))];
    const userMap: Record<string, { name: string; email?: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('id, username, full_name, email')
        .in('id', userIds);

      for (const profile of profiles || []) {
        userMap[profile.id] = {
          name: profile.full_name || profile.username || profile.email || 'Unknown',
          email: profile.email || undefined,
        };
      }
    }

    // Format entries
    const activities = (entries || []).map(entry => ({
      id: entry.id,
      user_id: entry.user_id,
      user_name: userMap[entry.user_id]?.name || 'Unknown User',
      user_email: userMap[entry.user_id]?.email,
      tool_name: entry.operation_type,
      tool_display_name: toolName(entry.operation_type),
      credits: Math.abs(entry.amount || 0),
      created_at: entry.created_at,
    }));

    // Get daily summary (every row of the day: one request stops at 1,000)
    const dayEntries = await readAll<{ user_id: string; operation_type: string | null; amount: number | null }>((from, to) =>
      adminClient
        .from('credit_transactions')
        .select('user_id, operation_type, amount')
        .eq('transaction_type', 'debit')
        .gte('created_at', startOfDay)
        .lt('created_at', endOfDay)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
    );
    const uniqueUsers = new Set(dayEntries.map(e => e.user_id)).size;
    const totalCredits = dayEntries.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);

    // Tool breakdown
    const toolBreakdown = new Map<string, number>();
    for (const entry of dayEntries) {
      const tool = entry.operation_type || 'unknown';
      toolBreakdown.set(tool, (toolBreakdown.get(tool) || 0) + 1);
    }

    const byTool = Array.from(toolBreakdown.entries())
      .map(([tool, count]) => ({
        tool,
        toolName: toolName(tool),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // The tool filter lists what was used on this day (plus the tool it is set to). It used to be built from
    // the 1,000 oldest charges ever, so no tool added since 2025 could be picked.
    const usedTools = [...new Set(dayEntries.map(e => e.operation_type).filter((t): t is string => Boolean(t)))];
    if (toolFilter && toolFilter !== 'all' && !usedTools.includes(toolFilter)) usedTools.push(toolFilter);
    const tools = usedTools
      .map(tool => ({ value: tool, label: toolName(tool) }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      summary: {
        date: dateFilter,
        total_activities: dayEntries.length,
        total_credits: totalCredits,
        unique_users: uniqueUsers,
        by_tool: byTool,
      },
      activities,
      tools,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });

  } catch (error) {
    console.error('Activity feed error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
