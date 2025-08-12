import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * API to fetch word-level timing data for lip sync
 * GET /api/script-video/[id]/word-timings
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const videoId = params.id;
    
    // Fetch Whisper word timing data
    const { data, error } = await supabase
      .from('script_to_video_history')
      .select('processing_logs')
      .eq('id', videoId)
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }
    
    // Extract word-level timings from Whisper results
    let wordTimings = [];
    
    if (data.processing_logs?.whisper_result?.segments) {
      // Modern Whisper format with word-level timing
      const segments = data.processing_logs.whisper_result.segments;
      
      segments.forEach((segment: any) => {
        if (segment.words) {
          segment.words.forEach((word: any) => {
            wordTimings.push({
              text: word.word?.trim() || word.text?.trim(),
              start_time: word.start,
              end_time: word.end,
              confidence: word.confidence || 0.8
            });
          });
        }
      });
    } else if (data.processing_logs?.whisper_result?.word_segments) {
      // Legacy format - direct word array
      wordTimings = data.processing_logs.whisper_result.word_segments.map((word: any) => ({
        text: word.word || word.text,
        start_time: word.start,
        end_time: word.end,
        confidence: word.confidence || 0.8
      }));
    } else {
      // Fallback: create approximate word timings from segments
      console.log('No word-level timing found, creating approximation');
      
      if (data.processing_logs?.segments) {
        data.processing_logs.segments.forEach((segment: any) => {
          const words = segment.text.split(' ');
          const segmentDuration = segment.end_time - segment.start_time;
          const timePerWord = segmentDuration / words.length;
          
          words.forEach((word: string, index: number) => {
            const wordStart = segment.start_time + (index * timePerWord);
            const wordEnd = wordStart + timePerWord;
            
            wordTimings.push({
              text: word.trim(),
              start_time: wordStart,
              end_time: wordEnd,
              confidence: 0.6 // Lower confidence for approximated timing
            });
          });
        });
      }
    }
    
    // Filter out empty words and sort by timing
    wordTimings = wordTimings
      .filter((word: any) => word.text && word.text.length > 0)
      .sort((a: any, b: any) => a.start_time - b.start_time);
    
    return NextResponse.json({
      success: true,
      videoId,
      wordCount: wordTimings.length,
      words: wordTimings,
      hasAccurateTimings: !!data.processing_logs?.whisper_result?.segments?.[0]?.words
    });
    
  } catch (error) {
    console.error('Error fetching word timings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch word timings' },
      { status: 500 }
    );
  }
}