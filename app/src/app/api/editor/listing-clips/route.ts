import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Listing Clips API
 *
 * Returns all completed animated video clips for a given listing
 * from the clip_predictions JSONB column in reelestate_listings.
 *
 * GET ?listingId=X&userId=Y
 */

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const ALLOWED_ORIGINS = [
  'https://editor.bluefx.net',
  'http://localhost:3002',
  'http://localhost:3001',
  'http://localhost:3000',
];

function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return process.env.NEXT_PUBLIC_VIDEO_EDITOR_URL || 'https://editor.bluefx.net';
}

function corsHeaders(request: NextRequest) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const listingId = url.searchParams.get('listingId');
    const userId = url.searchParams.get('userId');

    if (!listingId || !userId) {
      return NextResponse.json(
        { success: false, error: 'listingId and userId are required' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const supabase = getSupabaseClient();

    const { data: listing, error } = await supabase
      .from('reelestate_listings')
      .select('clip_predictions, photo_urls')
      .eq('id', listingId)
      .eq('user_id', userId)
      .single();

    if (error || !listing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    const clipPredictions: any[] = listing.clip_predictions || [];
    const completedClips = clipPredictions
      .filter((c: any) => c.status === 'succeeded' && c.video_url)
      .map((clip: any, i: number) => {
        // Extract a readable name from the video URL filename
        let filename = '';
        try {
          const urlPath = new URL(clip.video_url).pathname;
          filename = urlPath.split('/').pop() || '';
        } catch {
          filename = clip.prediction_id || '';
        }

        return {
          prediction_id: clip.prediction_id,
          video_url: clip.video_url,
          image_url: clip.image_url || null,
          index: clip.index ?? i,
          filename,
          created_at: clip.created_at || null,
        };
      });

    return NextResponse.json(
      {
        success: true,
        clips: completedClips,
        total: completedClips.length,
      },
      { headers: corsHeaders(request) },
    );
  } catch (err) {
    console.error('❌ Listing clips GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch listing clips' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders(request) });
}
