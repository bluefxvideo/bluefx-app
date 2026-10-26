import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { platformStats } from '@/lib/admin/platform-stats';

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

    const searchParams = request.nextUrl.searchParams;
    const stats = await platformStats({
      dateRange: searchParams.get('range') || '30d',
      excludeAdmins: searchParams.get('excludeAdmins') === 'true',
      tz: searchParams.get('tz'),
    });
    console.log('📊 Returning success with', stats.toolUsage.length, 'tools,', stats.dailyTrends.length, 'days,', stats.topUsers.length, 'top users');
    return NextResponse.json(stats);

  } catch (error) {
    console.error('📊 Platform stats error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
