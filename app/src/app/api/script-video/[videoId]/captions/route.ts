import { createAdminClient } from '@/app/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    console.log('🔍 Captions API: Starting request');
    const { videoId } = await params;
    console.log('🔍 Captions API: videoId =', videoId);
    
    const supabase = createAdminClient();
    console.log('🔍 Captions API: Created admin client');

    // Get the stored caption data from database
    const { data: video, error } = await supabase
      .from('script_to_video_history')
      .select('caption_data, whisper_data')
      .eq('id', videoId)
      .single();

    console.log('🔍 Captions API: DB query result - error:', error, 'data:', !!video);

    if (error) {
      console.error('Error fetching caption data:', error);
      return NextResponse.json({ error: 'Failed to fetch captions', details: error.message }, { status: 500 });
    }

    if (!video) {
      return NextResponse.json({ caption_chunks: [], word_timings: [] });
    }

    console.log('🔍 Captions API: Raw caption_data:', video.caption_data);
    console.log('🔍 Captions API: Raw whisper_data:', video.whisper_data);

    // Extract caption chunks properly - they should be organized by segment
    const captionData = video.caption_data?.chunks;
    const whisperData = video.whisper_data?.full_analysis;
    
    console.log('🔍 Captions API: Extracted captionData:', captionData);
    console.log('🔍 Captions API: Extracted whisperData:', whisperData);

    // Convert to the format expected by SimpleCaptionOverlay
    let captionSegments = [];
    let wordTimings = [];

    if (captionData && Array.isArray(captionData.segments)) {
      // Convert caption segments to expected format
      captionSegments = captionData.segments.map((segment: any) => ({
        segment_id: segment.segment_id || `seg_${Math.random()}`,
        caption_chunks: segment.caption_chunks || []
      }));
    }

    if (whisperData && Array.isArray(whisperData.segment_timings)) {
      // Convert whisper data to expected format
      wordTimings = whisperData.segment_timings.map((timing: any) => ({
        segment_id: timing.segment_id || `seg_${Math.random()}`,
        word_timings: timing.word_timings || []
      }));
    }

    console.log('🔍 Captions API: Converted captionSegments:', captionSegments.length, 'segments');
    console.log('🔍 Captions API: Converted wordTimings:', wordTimings.length, 'segments');
    
    // Return professional caption chunks with word-level timings
    return NextResponse.json({
      caption_chunks: captionSegments,
      word_timings: wordTimings,
      success: true
    });

  } catch (error) {
    console.error('🔍 Captions API error:', error);
    return NextResponse.json({ error: 'Failed to fetch captions', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}