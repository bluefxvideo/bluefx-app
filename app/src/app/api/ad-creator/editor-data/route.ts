import { NextRequest, NextResponse } from 'next/server';

/**
 * Ad Creator → Video Editor data bridge
 *
 * Accepts a JSON payload with all the ad creator's assets (images, voice,
 * scene timings) and returns them in the same shape the editor expects from
 * /api/script-video/editor-data.
 *
 * The assets are stored in localStorage on the main app and passed via POST
 * body when the editor requests them.  A simple in-memory cache keyed by
 * `videoId` keeps the data available for the editor's lifecycle.
 */

// CORS helper
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

// In-memory store for ad-creator editor sessions (survives across editor fetches)
const sessionStore = new Map<string, { data: EditorPayload; createdAt: number }>();

// Clean stale sessions older than 2 hours
function cleanStaleSessions() {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [key, val] of sessionStore) {
    if (val.createdAt < twoHoursAgo) sessionStore.delete(key);
  }
}

interface EditorPayload {
  videoId: string;
  userId: string;
  script?: string;
  voice: { url?: string };
  images: {
    urls: string[];
    segments: Array<{
      id: string;
      text: string;
      start_time: number;
      end_time: number;
      duration: number;
      image_prompt: string;
      camera_motion?: string;
    }>;
  };
  metadata: {
    totalDuration: number;
    frameRate: number;
    wordCount: number;
    speakingRate: number;
  };
}

/**
 * POST — Two modes:
 * 1. "save" mode (from main app): stores editor payload in memory
 *    body: { action: "save", videoId, userId, payload: EditorPayload }
 * 2. "load" mode (from editor): returns stored payload
 *    body: { user_id, videoId }
 */
export async function POST(request: NextRequest) {
  try {
    cleanStaleSessions();
    const body = await request.json();

    // Mode 1: Main app saving data for the editor to pick up
    if (body.action === 'save') {
      const { videoId, payload } = body as { videoId: string; payload: EditorPayload };
      if (!videoId || !payload) {
        return NextResponse.json({ success: false, error: 'Missing videoId or payload' }, {
          status: 400,
          headers: corsHeaders(request),
        });
      }
      sessionStore.set(videoId, { data: payload, createdAt: Date.now() });
      console.log(`💾 Ad Creator editor data saved for session: ${videoId}`);
      return NextResponse.json({ success: true }, { headers: corsHeaders(request) });
    }

    // Mode 2: Editor fetching data
    const userId = body.user_id;
    const videoId = body.videoId;

    if (!userId || !videoId) {
      return NextResponse.json({ success: false, error: 'Missing user_id or videoId' }, {
        status: 400,
        headers: corsHeaders(request),
      });
    }

    const session = sessionStore.get(videoId);
    if (!session) {
      return NextResponse.json({ success: false, error: 'No ad creator session found. Please re-open from the Ad Creator.' }, {
        status: 404,
        headers: corsHeaders(request),
      });
    }

    console.log(`📦 Ad Creator editor data served for session: ${videoId}`);
    return NextResponse.json({ success: true, data: session.data }, {
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

/** CORS preflight */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}
