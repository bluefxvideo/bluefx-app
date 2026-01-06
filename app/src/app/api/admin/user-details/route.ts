import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/app/supabase/server';

// Tool name mapping
const TOOL_NAMES: Record<string, string> = {
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

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

    // Use admin client
    const adminClient = createAdminClient();

    // Get user profile
    const { data: userProfile } = await adminClient
      .from('profiles')
      .select('id, username, full_name, email, role, created_at')
      .eq('id', userId)
      .single();

    // Get user credits
    const { data: userCredits } = await adminClient
      .from('user_credits')
      .select('available_credits, total_credits, used_credits')
      .eq('user_id', userId)
      .single();

    // Get user subscription
    const { data: subscription } = await adminClient
      .from('user_subscriptions')
      .select('plan_type, status, current_period_start, current_period_end')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get all transactions for this user (last 100)
    const { data: transactions } = await adminClient
      .from('credit_transactions')
      .select('operation_type, amount, created_at, transaction_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Calculate tool breakdown
    const toolMap = new Map<string, { credits: number; uses: number }>();
    const recentActivity: { date: string; tool: string; credits: number }[] = [];

    for (const tx of transactions || []) {
      if (tx.transaction_type === 'debit') {
        const toolId = tx.operation_type || 'unknown';
        const credits = Math.abs(tx.amount || 0);

        const existing = toolMap.get(toolId) || { credits: 0, uses: 0 };
        toolMap.set(toolId, {
          credits: existing.credits + credits,
          uses: existing.uses + 1,
        });

        // Add to recent activity (first 20 only)
        if (recentActivity.length < 20) {
          recentActivity.push({
            date: tx.created_at,
            tool: TOOL_NAMES[toolId] || toolId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            credits,
          });
        }
      }
    }

    const toolBreakdown = Array.from(toolMap.entries())
      .map(([toolId, data]) => ({
        toolId,
        toolName: TOOL_NAMES[toolId] || toolId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        credits: data.credits,
        uses: data.uses,
      }))
      .sort((a, b) => b.credits - a.credits);

    // Calculate daily usage for the last 30 days
    const dailyUsage: { date: string; credits: number }[] = [];
    const dailyMap = new Map<string, number>();

    for (const tx of transactions || []) {
      if (tx.transaction_type === 'debit' && tx.created_at) {
        const dateKey = tx.created_at.split('T')[0];
        const existing = dailyMap.get(dateKey) || 0;
        dailyMap.set(dateKey, existing + Math.abs(tx.amount || 0));
      }
    }

    // Fill in last 30 days
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      dailyUsage.push({
        date: dateKey,
        credits: dailyMap.get(dateKey) || 0,
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userProfile?.id,
        username: userProfile?.username,
        fullName: userProfile?.full_name,
        email: userProfile?.email,
        role: userProfile?.role,
        createdAt: userProfile?.created_at,
      },
      credits: {
        available: userCredits?.available_credits || 0,
        total: userCredits?.total_credits || 0,
        used: userCredits?.used_credits || 0,
      },
      subscription: subscription ? {
        plan: subscription.plan_type,
        status: subscription.status,
        periodStart: subscription.current_period_start,
        periodEnd: subscription.current_period_end,
      } : null,
      toolBreakdown,
      dailyUsage,
      recentActivity,
    });

  } catch (error) {
    console.error('User details error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
