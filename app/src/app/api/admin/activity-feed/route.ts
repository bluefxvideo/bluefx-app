import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/app/supabase/server';

// Tool name mapping - matches operation types from deductCredits() calls
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

  // Legacy/alternative names
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
    const dateFilter = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const toolFilter = searchParams.get('tool');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = (page - 1) * limit;

    // Calculate date range
    const startOfDay = `${dateFilter}T00:00:00.000Z`;
    const endOfDay = `${dateFilter}T23:59:59.999Z`;

    // Use admin client
    const adminClient = createAdminClient();

    // Build query for activity entries
    let query = adminClient
      .from('credit_transactions')
      .select('id, user_id, operation_type, amount, created_at', { count: 'exact' })
      .eq('transaction_type', 'debit')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: false });

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
    let userMap: Record<string, { name: string; email?: string }> = {};

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
      tool_display_name: TOOL_NAMES[entry.operation_type] || entry.operation_type.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      credits: Math.abs(entry.amount || 0),
      created_at: entry.created_at,
    }));

    // Get daily summary
    const { data: allDayEntries } = await adminClient
      .from('credit_transactions')
      .select('user_id, operation_type, amount')
      .eq('transaction_type', 'debit')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const dayEntries = allDayEntries || [];
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
        toolName: TOOL_NAMES[tool] || tool.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Get unique tools for filter dropdown
    const { data: allTools } = await adminClient
      .from('credit_transactions')
      .select('operation_type')
      .eq('transaction_type', 'debit');

    const uniqueTools = [...new Set((allTools || []).map(t => t.operation_type).filter(Boolean))];
    const tools = uniqueTools.map(tool => ({
      value: tool,
      label: TOOL_NAMES[tool] || tool.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    }));

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
