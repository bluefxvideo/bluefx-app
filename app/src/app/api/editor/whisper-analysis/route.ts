import { NextRequest, NextResponse } from 'next/server';
import { analyzeAudioWithWhisper } from '@/actions/services/whisper-analysis-service';

/**
 * Editor Whisper Analysis API
 *
 * Proxies Whisper speech analysis through the main app which has the
 * OpenAI API key. The editor (port 3002) calls this endpoint instead
 * of trying to call OpenAI directly.
 *
 * POST: analyze audio with Whisper
 */

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// ─── POST: Analyze audio with Whisper ────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { audio_url, segments, language, frame_rate } = await request.json();

    if (!audio_url) {
      return NextResponse.json(
        { success: false, error: 'audio_url is required' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    console.log('🎤 Editor whisper-analysis request:', { audio_url: audio_url.substring(0, 80) });

    const result = await analyzeAudioWithWhisper(
      {
        audio_url,
        segments: segments || [],
        language,
      },
      frame_rate || 30,
    );

    if (!result.success) {
      console.error('❌ Whisper analysis failed:', result.error);
      return NextResponse.json(
        { success: false, error: result.error || 'Whisper analysis failed' },
        { status: 500, headers: corsHeaders(request) },
      );
    }

    console.log('✅ Whisper analysis completed:', {
      duration: result.total_duration,
      words: result.word_count,
    });

    return NextResponse.json(result, { headers: corsHeaders(request) });
  } catch (err) {
    console.error('❌ Whisper-analysis POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze audio' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

// ─── OPTIONS (CORS preflight) ──────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders(request) });
}
