import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { ALL_NICHES } from '@/lib/winning-ads/constants';

/**
 * GET /api/winning-ads/niches
 *
 * Returns list of available niches/categories with ad counts.
 *
 * Query parameters:
 * - platform (string) - "tiktok" (default) or "facebook"
 *   For TikTok: returns niche names from constants.
 *   For Facebook: returns distinct industry_key (search term) values.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const platform = request.nextUrl.searchParams.get('platform') || 'tiktok';

    if (platform === 'facebook') {
      // For Facebook, use industry_key (search term) as the category
      const { data: rows, error } = await supabase
        .from('winning_ads')
        .select('industry_key')
        .eq('platform', 'facebook')
        .eq('is_active', true)
        .not('video_cover_url', 'is', null);

      if (error) {
        console.error('Failed to fetch Facebook categories:', error);
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
      }

      const countMap: Record<string, number> = {};
      for (const row of rows ?? []) {
        if (row.industry_key) {
          countMap[row.industry_key] = (countMap[row.industry_key] || 0) + 1;
        }
      }

      const niches = Object.entries(countMap)
        .map(([name, ad_count]) => ({ name, slug: name, ad_count }))
        .sort((a, b) => b.ad_count - a.ad_count);

      return NextResponse.json({ niches });
    }

    // TikTok: use static niche list from constants
    const { data: nicheCounts, error } = await supabase
      .from('winning_ads')
      .select('niche')
      .eq('is_active', true)
      .eq('platform', 'tiktok');

    if (error) {
      console.error('Failed to fetch niche counts:', error);
      return NextResponse.json({ error: 'Failed to fetch niches' }, { status: 500 });
    }

    const countMap: Record<string, number> = {};
    for (const row of nicheCounts ?? []) {
      countMap[row.niche] = (countMap[row.niche] || 0) + 1;
    }

    const niches = ALL_NICHES.map((niche) => ({
      name: niche.displayName,
      slug: niche.slug,
      ad_count: countMap[niche.displayName] || 0,
    }));

    return NextResponse.json({ niches });
  } catch (error) {
    console.error('Niches API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
