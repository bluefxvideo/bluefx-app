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

/**
 * PostgREST returns at most 1,000 rows per request (Supabase max-rows), and
 * supabase-js does not page for you. A single unbounded select therefore
 * counted categories over an arbitrary 1,000-row slice of the 16k+ Facebook
 * ads ("Skincare (5)" while the list held 211). Page through every row in
 * fixed ranges, ordered by id so parallel ranges never overlap or skip.
 */
const PAGE_SIZE = 1000;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function countActiveAdsBy(
  supabase: SupabaseServerClient,
  platform: 'facebook' | 'tiktok',
  column: 'industry_key' | 'niche',
): Promise<Record<string, number>> {
  // The Facebook finder only lists ads that have a cover image; count the same set.
  const coverOnly = platform === 'facebook';

  const countQuery = supabase
    .from('winning_ads')
    .select('id', { count: 'exact', head: true })
    .eq('platform', platform)
    .eq('is_active', true);
  const { count, error: countError } = await (coverOnly
    ? countQuery.not('video_cover_url', 'is', null)
    : countQuery);
  if (countError) throw countError;

  const pageQuery = (i: number) => {
    const q = supabase
      .from('winning_ads')
      .select('industry_key, niche')
      .eq('platform', platform)
      .eq('is_active', true);
    return (coverOnly ? q.not('video_cover_url', 'is', null) : q)
      .order('id', { ascending: true })
      .range(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE - 1);
  };

  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const results = await Promise.all(Array.from({ length: pages }, (_, i) => pageQuery(i)));

  const counts: Record<string, number> = {};
  for (const { data, error } of results) {
    if (error) throw error;
    for (const row of data ?? []) {
      const key = column === 'industry_key' ? row.industry_key : row.niche;
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}

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
      let countMap: Record<string, number>;
      try {
        countMap = await countActiveAdsBy(supabase, 'facebook', 'industry_key');
      } catch (error) {
        console.error('Failed to fetch Facebook categories:', error);
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
      }

      // Search terms are lowercase utility strings; show humans Title Case
      // (slug stays the raw term because filtering matches industry_key).
      const SPECIAL: Record<string, string> = {
        'GLP-1': 'GLP-1 (Weight Loss Rx)',
        'make money online': 'Make Money Online',
        'app download': 'Apps',
      };
      const pretty = (term: string) =>
        SPECIAL[term] ?? term.replace(/\b\w/g, (c) => c.toUpperCase());
      const niches = Object.entries(countMap)
        .map(([name, ad_count]) => ({ name: pretty(name), slug: name, ad_count }))
        .sort((a, b) => b.ad_count - a.ad_count);

      return NextResponse.json({ niches });
    }

    // TikTok: use static niche list from constants
    let countMap: Record<string, number>;
    try {
      countMap = await countActiveAdsBy(supabase, 'tiktok', 'niche');
    } catch (error) {
      console.error('Failed to fetch niche counts:', error);
      return NextResponse.json({ error: 'Failed to fetch niches' }, { status: 500 });
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
