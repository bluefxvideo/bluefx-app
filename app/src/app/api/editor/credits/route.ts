import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/supabase/server';

/**
 * Editor Credits API
 *
 * GET: Returns user's available credit balance.
 * Used by the editor's CreditDisplay component since the editor
 * can't query Supabase directly (no authenticated session).
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId query param is required' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Use admin client to bypass RLS — the editor has no auth cookies
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: true, credits: 0 },
        { headers: corsHeaders(request) },
      );
    }

    return NextResponse.json(
      { success: true, credits: data.available_credits || 0 },
      { headers: corsHeaders(request) },
    );
  } catch (err) {
    console.error('❌ Editor credits GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch credits' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders(request) });
}
