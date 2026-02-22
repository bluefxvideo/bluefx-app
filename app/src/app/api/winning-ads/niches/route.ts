import { NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { ALL_NICHES } from '@/lib/winning-ads/constants';

/**
 * GET /api/winning-ads/niches
 *
 * Returns list of available niches with ad counts.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get ad counts per niche
    const { data: nicheCounts, error } = await supabase
      .from('winning_ads')
      .select('niche')
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch niche counts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch niches' },
        { status: 500 }
      );
    }

    // Count ads per niche
    const countMap: Record<string, number> = {};
    for (const row of nicheCounts ?? []) {
      countMap[row.niche] = (countMap[row.niche] || 0) + 1;
    }

    // Build response with all niches (even those with 0 ads)
    const niches = ALL_NICHES.map((niche) => ({
      name: niche.displayName,
      slug: niche.slug,
      ad_count: countMap[niche.displayName] || 0,
    }));

    return NextResponse.json({ niches });
  } catch (error) {
    console.error('Niches API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
