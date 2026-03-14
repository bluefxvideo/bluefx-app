import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeAudioWithWhisper } from '@/actions/services/whisper-analysis-service';

/**
 * ReelEstate Editor Data API
 *
 * Formats ReelEstate listing data for the external React Video Editor.
 * Returns the same shape that `/api/script-video/editor-data` returns so
 * the editor can consume it via the existing BlueFX loader pipeline.
 *
 * URL format: POST { user_id, listingId }
 * or GET ?listingId=X&userId=Y
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// ─── Shared formatting logic ───────────────────────────────────────────

async function formatListingForEditor(listing: any, userId: string) {
  const segments = listing.script_segments || [];
  const analyses = listing.image_analysis || [];
  const photos = listing.photo_urls || [];
  const selectedIndices: number[] = listing.selected_indices || [];
  const voiceoverUrl = listing.voiceover_url;
  const voiceoverDuration = listing.voiceover_duration_seconds || 0;
  const aspectRatio = listing.aspect_ratio || '16:9';
  const listingData = listing.listing_data;

  // Build selected segments in order
  const selectedSegments = segments.filter(
    (s: any) => selectedIndices.includes(s.image_index),
  );

  // ─── Whisper-based timing (precise) ──────────────────────────────────
  // Use Whisper raw word timings + word-count splitting for reliable segment boundaries.
  // This avoids the fragile text-matching approach: we simply count how many words
  // each segment has and assign Whisper words sequentially.
  let whisperWordTimings: any[] = [];
  let editorSegments: any[];
  let usedWhisper = false;

  if (voiceoverUrl && selectedSegments.length > 0) {
    try {
      console.log('🎤 Running Whisper analysis on voiceover for segment timing...');
      const whisperSegments = selectedSegments.map((seg: any, i: number) => ({
        id: `segment-${i}`,
        text: seg.voiceover || '',
      }));

      const whisperResult = await analyzeAudioWithWhisper({
        audio_url: voiceoverUrl,
        segments: whisperSegments,
      });

      // Use raw_word_timings for reliable word-count-based splitting
      const rawWords = whisperResult.raw_word_timings || [];

      if (whisperResult.success && rawWords.length > 0) {
        console.log(`✅ Whisper returned ${rawWords.length} raw word timings`);

        // Count words per segment
        const segmentWordCounts = selectedSegments.map(
          (seg: any) => (seg.voiceover || '').split(/\s+/).filter(Boolean).length,
        );
        const totalExpectedWords = segmentWordCounts.reduce((a: number, b: number) => a + b, 0);
        console.log(`📊 Expected words: ${totalExpectedWords}, Whisper words: ${rawWords.length}`);

        // Assign Whisper words to segments by word count
        let wordIdx = 0;
        editorSegments = selectedSegments.map((seg: any, i: number) => {
          const analysis = analyses.find((a: any) => a.index === seg.image_index);
          const expectedWords = segmentWordCounts[i];

          // How many Whisper words to assign to this segment
          // Scale proportionally if counts don't match exactly
          const ratio = rawWords.length / Math.max(totalExpectedWords, 1);
          const assignCount = Math.max(1, Math.round(expectedWords * ratio));

          const segStart = wordIdx;
          const segEnd = Math.min(wordIdx + assignCount, rawWords.length);
          const assignedWords = rawWords.slice(segStart, segEnd);
          wordIdx = segEnd;

          // For the last segment, grab any remaining words
          if (i === selectedSegments.length - 1 && wordIdx < rawWords.length) {
            assignedWords.push(...rawWords.slice(wordIdx));
            wordIdx = rawWords.length;
          }

          const startTime = assignedWords.length > 0 ? assignedWords[0].start : 0;
          const endTime = assignedWords.length > 0
            ? assignedWords[assignedWords.length - 1].end
            : startTime + 3;

          return {
            id: `segment-${i}`,
            text: seg.voiceover || `Segment ${i + 1}`,
            start_time: startTime,
            end_time: endTime,
            duration: endTime - startTime,
            image_prompt: analysis?.description || `Photo ${seg.image_index + 1}`,
            camera_motion: analysis?.camera_motion || 'none',
          };
        });

        // Collect all raw word timings for captions
        whisperWordTimings = rawWords;
        usedWhisper = true;

        console.log('🎯 Using Whisper word-count-based segment timings:');
        editorSegments.forEach((seg, i) => {
          console.log(`  Segment ${i}: ${seg.start_time.toFixed(2)}s → ${seg.end_time.toFixed(2)}s (${seg.duration.toFixed(2)}s) — "${seg.text.substring(0, 40)}..."`);
        });
      } else {
        console.warn('⚠️ Whisper analysis returned no word timings, falling back to proportional');
      }
    } catch (err) {
      console.warn('⚠️ Whisper analysis failed, falling back to proportional:', err);
    }
  }

  // ─── Fallback: proportional scaling ────────────────────────────────
  if (!usedWhisper) {
    const rawDurations = selectedSegments.map((seg: any) => seg.duration_seconds || 3);
    const rawTotal = rawDurations.reduce((sum: number, d: number) => sum + d, 0);
    const totalDur = voiceoverDuration || rawTotal || 30;
    const scale = rawTotal > 0 ? totalDur / rawTotal : 1;

    let currentTime = 0;
    editorSegments = selectedSegments.map((seg: any, i: number) => {
      const analysis = analyses.find((a: any) => a.index === seg.image_index);
      const duration = rawDurations[i] * scale;
      const startTime = currentTime;
      currentTime += duration;
      return {
        id: `segment-${i}`,
        text: seg.voiceover || `Segment ${i + 1}`,
        start_time: startTime,
        end_time: currentTime,
        duration,
        image_prompt: analysis?.description || `Photo ${seg.image_index + 1}`,
        camera_motion: analysis?.camera_motion || 'none',
      };
    });
    console.log('📐 Using proportional segment timings (Whisper unavailable)');
  }

  // Build image URLs list matching segment order
  const imageUrls = selectedSegments.map((seg: any) => photos[seg.image_index]);

  return {
    videoId: listing.id,
    userId,
    script: selectedSegments.map((s: any) => s.voiceover).join(' '),
    createdAt: listing.created_at,
    updatedAt: listing.updated_at,

    // Aspect ratio for canvas sizing
    imageData: {
      generation_params: { aspect_ratio: aspectRatio },
    },
    image_data: {
      generation_params: { aspect_ratio: aspectRatio },
    },

    // Audio — include Whisper word timings so editor can auto-generate captions
    voice: {
      url: voiceoverUrl || '',
      whisperData: whisperWordTimings.length > 0
        ? {
            success: true,
            total_duration: editorSegments.length > 0
              ? editorSegments[editorSegments.length - 1].end_time
              : (voiceoverDuration || 0),
            segment_timings: [],
            raw_word_timings: whisperWordTimings,
            word_count: whisperWordTimings.length,
            speaking_rate: 150,
            confidence_score: 0.9,
            alignment_quality: 'high' as const,
            frame_rate: 30,
            timing_precision: 'frame' as const,
          }
        : null,
    },

    // Images + segments
    images: {
      urls: imageUrls,
      segments: editorSegments,
    },

    // Listing metadata overlay
    listing: listingData
      ? {
          address: listingData.address,
          price: listingData.price_formatted || `$${listingData.price?.toLocaleString() || ''}`,
          beds: listingData.beds,
          baths: listingData.baths,
          sqft: listingData.sqft,
        }
      : null,

    // Metadata
    metadata: {
      totalDuration: editorSegments.length > 0
        ? editorSegments[editorSegments.length - 1].end_time
        : (voiceoverDuration || 30),
      frameRate: 30,
      wordCount: selectedSegments.reduce(
        (acc: number, s: any) => acc + (s.voiceover || '').split(/\s+/).length,
        0,
      ),
      speakingRate: 150,
      creditsUsed: listing.total_credits_used || 0,
    },

    // Captions & word timings from Whisper (if available)
    captions: {
      data: null,
      chunks: [],
      wordTimings: whisperWordTimings,
    },

    apiEndpoint: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/reelestate/editor-data?listingId=${listing.id}`,
  };
}

// ─── POST handler ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();

  try {
    const { user_id, listingId } = await request.json();

    if (!user_id || !listingId) {
      return NextResponse.json(
        { success: false, error: 'user_id and listingId are required' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const { data: listing, error } = await supabase
      .from('reelestate_listings')
      .select('*')
      .eq('id', listingId)
      .eq('user_id', user_id)
      .single();

    if (error || !listing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    const editorData = await formatListingForEditor(listing, user_id);

    return NextResponse.json(
      { success: true, data: editorData },
      { headers: corsHeaders(request) },
    );
  } catch (err) {
    console.error('❌ ReelEstate editor-data POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

// ─── GET handler ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();

  try {
    const url = new URL(request.url);
    const listingId = url.searchParams.get('listingId');
    const userId = url.searchParams.get('userId');

    if (!userId || !listingId) {
      return NextResponse.json(
        { success: false, error: 'userId and listingId query params are required' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const { data: listing, error } = await supabase
      .from('reelestate_listings')
      .select('*')
      .eq('id', listingId)
      .eq('user_id', userId)
      .single();

    if (error || !listing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    const editorData = await formatListingForEditor(listing, userId);

    return NextResponse.json(
      { success: true, data: editorData },
      { headers: corsHeaders(request) },
    );
  } catch (err) {
    console.error('❌ ReelEstate editor-data GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

// ─── OPTIONS (CORS preflight) ──────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders(request) });
}
