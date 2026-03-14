import { NextRequest, NextResponse } from 'next/server';
import {
  createVideoGenerationPrediction,
  getVideoGenerationPrediction,
} from '@/actions/models/video-generation-v1';

/**
 * Editor Animate Image API
 *
 * Turns a still image into a video clip using LTX-2.3-Fast (image-to-video).
 * POST: create a prediction (async)
 * GET:  poll prediction status
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// ─── POST: Create animation prediction ──────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { image_url, prompt, camera_motion, duration, aspect_ratio } =
      await request.json();

    if (!image_url) {
      return NextResponse.json(
        { success: false, error: 'image_url is required' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const prediction = await createVideoGenerationPrediction({
      prompt: prompt || 'Smooth cinematic camera movement',
      image: image_url,
      camera_motion: camera_motion || 'none',
      duration: duration || 6,
      aspect_ratio: aspect_ratio || '16:9',
      generate_audio: false,
      resolution: '1080p',
    });

    console.log('✅ Animate-image prediction created:', prediction.id);

    return NextResponse.json(
      {
        success: true,
        prediction_id: prediction.id,
        status: prediction.status,
      },
      { headers: corsHeaders(request) },
    );
  } catch (err) {
    console.error('❌ Animate-image POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create animation' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

// ─── GET: Poll prediction status ────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const predictionId = url.searchParams.get('predictionId');

    if (!predictionId) {
      return NextResponse.json(
        { success: false, error: 'predictionId query param is required' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const prediction = await getVideoGenerationPrediction(predictionId);

    const videoUrl =
      typeof prediction.output === 'string'
        ? prediction.output
        : Array.isArray(prediction.output)
          ? prediction.output[0]
          : null;

    return NextResponse.json(
      {
        success: true,
        status: prediction.status,
        video_url: videoUrl || null,
        error: prediction.error || null,
      },
      { headers: corsHeaders(request) },
    );
  } catch (err) {
    console.error('❌ Animate-image GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to check animation status' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

// ─── OPTIONS (CORS preflight) ──────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders(request) });
}
