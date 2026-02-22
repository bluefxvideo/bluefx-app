import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/app/supabase/server';

/**
 * POST /api/winning-ads/refresh
 *
 * Manually triggers a winning ads scrape refresh.
 * Admin-only endpoint.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Trigger the cron endpoint internally
    const cronUrl = new URL('/api/cron/winning-ads-scrape', request.nextUrl.origin);
    const cronToken = process.env.CRON_SECRET_TOKEN;

    const cronResponse = await fetch(cronUrl.toString(), {
      method: 'GET',
      headers: {
        ...(cronToken ? { Authorization: `Bearer ${cronToken}` } : {}),
      },
    });

    const result = await cronResponse.json();

    return NextResponse.json({
      success: true,
      message: 'Refresh triggered',
      result,
    });
  } catch (error) {
    console.error('Winning ads refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
