import { NextRequest, NextResponse } from 'next/server';
import {
  createVideoGenerationPrediction,
  getVideoGenerationPrediction,
} from '@/actions/models/video-generation-v1';
import { getUserCredits } from '@/actions/credit-management';
import { deductCredits } from '@/actions/database/cinematographer-database';
import { downloadAndUploadVideo } from '@/actions/supabase-storage';

/**
 * Editor Animate Image API
 *
 * Turns a still image into a video clip using LTX-2.3-Fast (image-to-video).
 * POST: create a prediction (deducts credits first)
 * GET:  poll prediction status (persists video to Supabase on completion)
 */

// Credit cost: 1 credit per second (matches cinematographer Fast/LTX pricing)
const CREDITS_PER_SECOND = 1;

// Cache persisted video URLs to avoid re-uploading on repeated polls
const videoUrlCache = new Map<string, string>();

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
    const { image_url, prompt, camera_motion, duration, aspect_ratio, user_id } =
      await request.json();

    if (!image_url) {
      return NextResponse.json(
        { success: false, error: 'image_url is required' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const videoDuration = duration || 6;
    const creditCost = videoDuration * CREDITS_PER_SECOND;

    // Deduct credits if user_id is provided
    if (user_id) {
      const creditCheck = await getUserCredits(user_id);
      if (!creditCheck.success) {
        return NextResponse.json(
          { success: false, error: 'Unable to verify credit balance' },
          { status: 500, headers: corsHeaders(request) },
        );
      }

      const availableCredits = creditCheck.credits || 0;
      if (availableCredits < creditCost) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient credits. Need ${creditCost}, have ${availableCredits}`,
            remaining_credits: availableCredits,
            required_credits: creditCost,
          },
          { status: 402, headers: corsHeaders(request) },
        );
      }

      const deduction = await deductCredits(
        user_id,
        creditCost,
        'editor-animate-image',
        { camera_motion, duration: videoDuration } as Record<string, unknown>,
      );

      if (!deduction.success) {
        return NextResponse.json(
          { success: false, error: deduction.error || 'Credit deduction failed' },
          { status: 402, headers: corsHeaders(request) },
        );
      }

      console.log(`💳 Animate-image: deducted ${creditCost} credits for ${videoDuration}s video (remaining: ${deduction.remainingCredits})`);
    }

    const prediction = await createVideoGenerationPrediction({
      prompt: prompt || 'Smooth cinematic camera movement',
      image: image_url,
      camera_motion: camera_motion || 'none',
      duration: videoDuration,
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
        credits_used: user_id ? creditCost : 0,
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

    // Check cache first — return persisted URL if already uploaded
    const cachedUrl = videoUrlCache.get(predictionId);
    if (cachedUrl) {
      return NextResponse.json(
        {
          success: true,
          status: 'succeeded',
          video_url: cachedUrl,
          error: null,
        },
        { headers: corsHeaders(request) },
      );
    }

    const prediction = await getVideoGenerationPrediction(predictionId);

    const replicateVideoUrl =
      typeof prediction.output === 'string'
        ? prediction.output
        : Array.isArray(prediction.output)
          ? prediction.output[0]
          : null;

    // If video is ready, persist to Supabase Storage for permanent URL
    let finalVideoUrl = replicateVideoUrl;
    if (prediction.status === 'succeeded' && replicateVideoUrl) {
      try {
        const uploadResult = await downloadAndUploadVideo(
          replicateVideoUrl,
          'editor-animate',
          predictionId,
          { bucket: 'videos', folder: 'editor-animate' },
        );

        if (uploadResult.success && uploadResult.url) {
          finalVideoUrl = uploadResult.url;
          videoUrlCache.set(predictionId, finalVideoUrl);
          console.log(`✅ Animate-image video persisted to Supabase: ${finalVideoUrl}`);
        } else {
          console.warn('⚠️ Failed to persist video, using Replicate URL as fallback');
        }
      } catch (uploadErr) {
        console.warn('⚠️ Video persistence failed, using Replicate URL:', uploadErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        status: prediction.status,
        video_url: finalVideoUrl || null,
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
