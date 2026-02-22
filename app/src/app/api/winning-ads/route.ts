import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';

/**
 * GET /api/winning-ads
 *
 * Returns paginated list of winning ads with optional filters.
 *
 * Query parameters:
 * - niche (string) - filter by niche display name
 * - sort (string) - "likes", "ctr", "clone_score", "newest". Default: "clone_score"
 * - country (string) - filter by country code
 * - page (number) - default 1
 * - limit (number) - default 20, max 50
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const niche = searchParams.get('niche');
    const sort = searchParams.get('sort') || 'clone_score';
    const country = searchParams.get('country');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('winning_ads')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    // Apply niche filter
    if (niche) {
      query = query.eq('niche', niche);
    }

    // Apply country filter
    if (country) {
      query = query.contains('country_codes', [country]);
    }

    // Apply sorting
    switch (sort) {
      case 'likes':
        query = query.order('likes', { ascending: false });
        break;
      case 'ctr':
        query = query.order('ctr', { ascending: false });
        break;
      case 'newest':
        query = query.order('date_scraped', { ascending: false });
        break;
      case 'clone_score':
      default:
        query = query.order('clone_score', { ascending: false });
        break;
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: ads, count, error } = await query;

    if (error) {
      console.error('Failed to fetch winning ads:', error);
      return NextResponse.json(
        { error: 'Failed to fetch ads' },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    return NextResponse.json({
      ads: ads ?? [],
      pagination: {
        page,
        limit,
        total,
        has_more: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Winning ads API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
