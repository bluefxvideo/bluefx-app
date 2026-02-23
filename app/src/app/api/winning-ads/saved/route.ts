import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import {
  getUserSavedAdIds,
  saveWinningAd,
  unsaveWinningAd,
} from '@/actions/database/saved-ads-database';

/**
 * GET /api/winning-ads/saved
 * Returns the list of winning_ad_ids the current user has saved.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await getUserSavedAdIds(user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ saved_ad_ids: result.data ?? [] });
  } catch (error) {
    console.error('GET /api/winning-ads/saved error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/winning-ads/saved
 * Body: { winning_ad_id: number, tiktok_material_id: string }
 * Saves an ad for the current user.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { winning_ad_id, tiktok_material_id } = body;

    if (!winning_ad_id || !tiktok_material_id) {
      return NextResponse.json(
        { error: 'winning_ad_id and tiktok_material_id are required' },
        { status: 400 }
      );
    }

    const result = await saveWinningAd(user.id, winning_ad_id, tiktok_material_id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/winning-ads/saved error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/winning-ads/saved
 * Body: { winning_ad_id: number }
 * Removes a saved ad for the current user.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { winning_ad_id } = body;

    if (!winning_ad_id) {
      return NextResponse.json({ error: 'winning_ad_id is required' }, { status: 400 });
    }

    const result = await unsaveWinningAd(user.id, winning_ad_id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/winning-ads/saved error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
