import { NextRequest, NextResponse } from 'next/server';
import {
  createFalLTX23Prediction,
  getFalLTX23Status,
  getFalLTX23Result,
} from '@/actions/models/fal-ltx-image-to-video';
import { createAdminClient } from '@/app/supabase/server';
import { downloadAndUploadVideo } from '@/actions/supabase-storage';
import { normalizeProviderError, refundFailedGeneration, refundSentence } from '@/lib/credits/refund';

/**
 * Editor Animate Image API
 *
 * Turns a still image into a video clip using LTX-2.3-Fast on fal.ai (image-to-video).
 * POST: submit a queue job, then charge for it (the debit carries the job id)
 * GET:  poll job status (persists video to Supabase on completion, refunds a failed job)
 */

// Credit cost: 1 credit per second (matches cinematographer pricing)
const CREDITS_PER_SECOND = 1;

// Clip lengths the engine makes, in seconds
const CLIP_SECONDS = [6, 8, 10, 12, 14, 16, 18, 20];

// Cache persisted video URLs to avoid re-uploading on repeated polls
const videoUrlCache = new Map<string, string>();

// Jobs that failed for good, so a repeated poll gets the same answer
const failedJobs = new Map<string, { reason: string; refunded: number }>();

/**
 * fal reports a job that could not be made as COMPLETED and rejects the result
 * request (4xx). Returns the provider's reason for such a job, null for anything
 * that may still work on the next poll (5xx, rate limit, network).
 */
function permanentFailure(err: unknown): string | null {
  const message = err instanceof Error ? err.message : '';
  const match = message.match(/fal\.ai result error: (4\d\d) - ([\s\S]*)$/);
  if (!match || match[1] === '408' || match[1] === '429') return null;
  try {
    return normalizeProviderError(JSON.parse(match[2])) || match[2];
  } catch {
    return match[2];
  }
}

/** Give the credits of a failed job back and remember the outcome. */
async function failJob(predictionId: string, userId: string | null, detail: string | null) {
  let refunded = 0;
  if (userId) {
    const refund = await refundFailedGeneration({
      userId,
      referenceIds: [predictionId],
      operation: 'photo animation',
    });
    if (refund.refunded) refunded = refund.amount ?? 0;
    else console.warn(`⚠️ No refund for animate-image job ${predictionId}: ${refund.reason}`);
  }
  const reason = detail
    ? `The photo could not be animated: ${detail.slice(0, 200)}`
    : 'The photo could not be animated. Trying again usually works.';
  const outcome = { reason: /[.!?]$/.test(reason) ? reason : `${reason}.`, refunded };
  failedJobs.set(predictionId, outcome);
  return outcome;
}

function failedResponse(request: NextRequest, outcome: { reason: string; refunded: number }) {
  return NextResponse.json(
    {
      success: true,
      status: 'failed',
      video_url: null,
      reason: outcome.reason,
      refunded_credits: outcome.refunded,
      error: outcome.refunded > 0 ? `${outcome.reason} ${refundSentence(outcome.refunded)}` : outcome.reason,
    },
    { headers: corsHeaders(request) },
  );
}

/**
 * Persist a completed clip to the listing's clip_predictions JSONB array.
 * This ensures clips survive server restarts and editor reloads.
 */
async function saveClipToListing(
  listingId: string,
  imageUrl: string,
  predictionId: string,
  videoUrl: string,
) {
  try {
    const supabase = createAdminClient();

    // Fetch current clip_predictions
    const { data: listing } = await supabase
      .from('reelestate_listings')
      .select('clip_predictions, photo_urls')
      .eq('id', listingId)
      .single();

    if (!listing) {
      console.warn(`⚠️ Listing ${listingId} not found, skipping clip persistence`);
      return;
    }

    const clipPredictions: any[] = listing.clip_predictions || [];
    const photoUrls: string[] = listing.photo_urls || [];

    // Find the photo index matching this image URL
    const photoIndex = photoUrls.findIndex((url: string) => url === imageUrl);

    // The same job again, or an earlier clip of the same photo: the newest clip takes its place
    const existingIdx = clipPredictions.findIndex(
      (c: any) => c.prediction_id === predictionId || (photoIndex >= 0 && c.index === photoIndex),
    );

    const clipEntry = {
      index: photoIndex >= 0 ? photoIndex : clipPredictions.length,
      prediction_id: predictionId,
      status: 'succeeded' as const,
      video_url: videoUrl,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      clipPredictions[existingIdx] = clipEntry;
    } else {
      clipPredictions.push(clipEntry);
    }

    const { error } = await supabase
      .from('reelestate_listings')
      .update({ clip_predictions: clipPredictions })
      .eq('id', listingId);

    if (error) {
      console.error(`❌ Failed to save clip to listing ${listingId}:`, error);
    } else {
      console.log(`✅ Clip saved to listing ${listingId} (prediction: ${predictionId})`);
    }
  } catch (err) {
    console.error(`❌ Error saving clip to listing:`, err);
  }
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// ─── POST: Create animation job ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { image_url, prompt, duration, aspect_ratio, user_id, listing_id } =
      await request.json();

    if (!image_url) {
      return NextResponse.json(
        { success: false, error: 'image_url is required' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const videoDuration = Number(duration) || 6;
    if (!CLIP_SECONDS.includes(videoDuration)) {
      return NextResponse.json(
        { success: false, error: `duration must be one of ${CLIP_SECONDS.join(', ')} seconds` },
        { status: 400, headers: corsHeaders(request) },
      );
    }
    const creditCost = videoDuration * CREDITS_PER_SECOND;

    // Check the balance first (use admin client — editor has no auth cookies)
    const supabase = createAdminClient();
    if (user_id) {
      const { data: creditData } = await supabase
        .from('user_credits')
        .select('available_credits')
        .eq('user_id', user_id)
        .single();

      const availableCredits = creditData?.available_credits || 0;
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
    }

    // Build prompt — include camera motion instruction directly in text
    const finalPrompt = prompt || 'Slow smooth dolly in on rails. Stabilized camera, no handheld shake, no jitter. Professional real estate cinematography.';

    const queueResponse = await createFalLTX23Prediction({
      image_url,
      prompt: finalPrompt,
      duration: videoDuration,
      aspect_ratio: aspect_ratio || '16:9',
      resolution: '1080p',
      generate_audio: false,
    });

    console.log('✅ Animate-image FAL job queued:', queueResponse.request_id);

    // Charge once the engine has taken the job. The debit carries the job id, so
    // a job that fails later is refunded against exactly this debit. (Charging
    // before the submit lost the credits whenever the submit itself failed.)
    if (user_id) {
      const { data: deduction, error: deductError } = await supabase
        .rpc('deduct_user_credits', {
          p_user_id: user_id,
          p_amount: creditCost,
          p_operation: 'editor-animate-image',
          p_metadata: {
            duration: videoDuration,
            provider: 'fal',
            prediction_id: queueResponse.request_id,
            ...(listing_id ? { listing_id } : {}),
          },
        });

      if (deductError || !deduction?.success) {
        // No charge, no clip: stop the job
        await fetch(`https://queue.fal.run/fal-ai/ltx-2.3/requests/${queueResponse.request_id}/cancel`, {
          method: 'PUT',
          headers: { Authorization: `Key ${process.env.FAL_KEY}` },
        }).catch(() => undefined);
        return NextResponse.json(
          { success: false, error: deductError?.message || deduction?.error || 'Credit deduction failed' },
          { status: 402, headers: corsHeaders(request) },
        );
      }

      console.log(`💳 Animate-image: deducted ${creditCost} credits for ${videoDuration}s video (remaining: ${deduction.remaining_credits})`);
    }

    return NextResponse.json(
      {
        success: true,
        prediction_id: queueResponse.request_id,
        status: 'starting',
        credits_used: user_id ? creditCost : 0,
      },
      { headers: corsHeaders(request) },
    );
  } catch (err) {
    console.error('❌ Animate-image POST error:', err);
    return NextResponse.json(
      { success: false, error: 'The animation could not be started. Nothing was charged.' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

// ─── GET: Poll job status ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const predictionId = url.searchParams.get('predictionId');
    const listingId = url.searchParams.get('listingId');
    const imageUrl = url.searchParams.get('imageUrl');
    const userId = url.searchParams.get('userId');

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

    const failed = failedJobs.get(predictionId);
    if (failed) return failedResponse(request, failed);

    // Check FAL queue status
    const statusResponse = await getFalLTX23Status(predictionId);

    // Map FAL status to our status format
    const statusMap: Record<string, string> = {
      'IN_QUEUE': 'starting',
      'IN_PROGRESS': 'processing',
      'COMPLETED': 'succeeded',
      'FAILED': 'failed',
    };
    const mappedStatus = statusMap[statusResponse.status] || statusResponse.status;

    // If completed, fetch the result and persist to Supabase
    if (statusResponse.status === 'COMPLETED') {
      try {
        const result = await getFalLTX23Result(predictionId);
        const falVideoUrl = result.video?.url;

        if (falVideoUrl) {
          // Persist to Supabase Storage for a permanent URL
          let finalVideoUrl = falVideoUrl;
          try {
            const uploadResult = await downloadAndUploadVideo(
              falVideoUrl,
              'editor-animate',
              predictionId,
              { bucket: 'videos', folder: 'editor-animate' },
            );

            if (uploadResult.success && uploadResult.url) {
              finalVideoUrl = uploadResult.url;
              videoUrlCache.set(predictionId, finalVideoUrl);
              console.log(`✅ Animate-image video persisted to Supabase: ${finalVideoUrl}`);

              // Save clip to listing database for persistence across reloads
              if (listingId && imageUrl) {
                await saveClipToListing(listingId, imageUrl, predictionId, finalVideoUrl);
              }
            } else {
              console.warn('⚠️ Failed to persist video, using FAL URL as fallback');
            }
          } catch (uploadErr) {
            console.warn('⚠️ Video persistence failed, using FAL URL:', uploadErr);
          }

          return NextResponse.json(
            {
              success: true,
              status: 'succeeded',
              video_url: finalVideoUrl,
              error: null,
            },
            { headers: corsHeaders(request) },
          );
        }
        // Finished without a video: nothing more will come
        return failedResponse(request, await failJob(predictionId, userId, null));
      } catch (resultErr) {
        console.error('❌ Failed to fetch FAL result:', resultErr);
        const detail = permanentFailure(resultErr);
        if (detail !== null) {
          return failedResponse(request, await failJob(predictionId, userId, detail));
        }
      }
    }

    if (statusResponse.status === 'FAILED') {
      return failedResponse(request, await failJob(predictionId, userId, null));
    }

    // Still in progress (a finished job whose result could not be read yet is asked for again)
    return NextResponse.json(
      {
        success: true,
        status: statusResponse.status === 'COMPLETED' ? 'processing' : mappedStatus,
        video_url: null,
        error: null,
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
