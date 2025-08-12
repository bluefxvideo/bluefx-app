import { createClient } from '@/app/supabase/client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const supabase = createClient();

    // Get the stored word timings from database
    const { data: video, error } = await supabase
      .from('script_to_video_history')
      .select('word_timings')
      .eq('id', videoId)
      .single();

    if (error) {
      console.error('Error fetching word timings:', error);
      return NextResponse.json({ error: 'Failed to fetch word timings' }, { status: 500 });
    }

    if (!video || !video.word_timings) {
      return NextResponse.json({ words: [] });
    }

    // Flatten all word timings from all segments
    const allWords: any[] = [];
    
    if (Array.isArray(video.word_timings)) {
      video.word_timings.forEach((segment: any) => {
        if (segment.word_timings && Array.isArray(segment.word_timings)) {
          allWords.push(...segment.word_timings);
        }
      });
    }

    // Sort by start time
    allWords.sort((a, b) => a.start - b.start);

    return NextResponse.json({ words: allWords });

  } catch (error) {
    console.error('Word timings API error:', error);
    return NextResponse.json({ error: 'Failed to fetch word timings' }, { status: 500 });
  }
}