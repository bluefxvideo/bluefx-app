import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ALLOWED_ORIGINS = [
  'https://editor.bluefx.net',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3002',
];

function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return process.env.NEXT_PUBLIC_VIDEO_EDITOR_URL || 'https://editor.bluefx.net';
}

function corsHeaders(request: NextRequest) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
  };
}

/**
 * POST — Two modes:
 * 1. "save" (from main app): stores editor payload in video_editor_compositions
 *    body: { action: "save", videoId, userId, payload }
 * 2. "load" (from editor): fetches and returns payload
 *    body: { user_id, videoId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = getSupabase();

    // Mode 1: Save
    if (body.action === 'save') {
      const { videoId, userId, payload } = body;
      if (!videoId || !payload) {
        return NextResponse.json({ success: false, error: 'Missing videoId or payload' }, {
          status: 400, headers: corsHeaders(request),
        });
      }

      // Upsert into video_editor_compositions
      const { error } = await supabase
        .from('video_editor_compositions')
        .upsert({
          video_id: videoId,
          user_id: userId,
          composition_data: payload,
          metadata: { source: 'ad-creator', saved_at: new Date().toISOString() },
          version: 1,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'video_id,user_id' });

      if (error) {
        // If upsert fails (no unique constraint), try insert
        const { error: insertError } = await supabase
          .from('video_editor_compositions')
          .insert({
            video_id: videoId,
            user_id: userId,
            composition_data: payload,
            metadata: { source: 'ad-creator', saved_at: new Date().toISOString() },
            version: 1,
          });

        if (insertError) {
          console.error('Failed to save ad-creator editor data:', insertError);
          return NextResponse.json({ success: false, error: insertError.message }, {
            status: 500, headers: corsHeaders(request),
          });
        }
      }

      console.log(`💾 Ad Creator editor data saved to DB: ${videoId}`);
      return NextResponse.json({ success: true }, { headers: corsHeaders(request) });
    }

    // Mode 2: Load
    const userId = body.user_id;
    const videoId = body.videoId;

    if (!userId || !videoId) {
      return NextResponse.json({ success: false, error: 'Missing user_id or videoId' }, {
        status: 400, headers: corsHeaders(request),
      });
    }

    const { data: row, error } = await supabase
      .from('video_editor_compositions')
      .select('composition_data')
      .eq('video_id', videoId)
      .eq('user_id', userId)
      .single();

    if (error || !row) {
      console.error('Ad Creator editor data not found:', videoId, error);
      return NextResponse.json({ success: false, error: 'No ad creator session found.' }, {
        status: 404, headers: corsHeaders(request),
      });
    }

    const payload = row.composition_data;
    console.log(`📦 Ad Creator editor data served: ${videoId}, clips: ${payload?.video_clips?.length || 0}, images: ${payload?.images?.urls?.length || 0}`);

    return NextResponse.json({ success: true, data: payload }, {
      headers: corsHeaders(request),
    });
  } catch (error) {
    console.error('Ad Creator editor-data error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}
