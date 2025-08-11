import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Simple API to fetch caption chunks for a video
 * GET /api/script-video/[id]/captions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const videoId = params.id;
    
    // Get user from session/auth (simplified)
    // In production, verify user owns this video
    
    // Fetch caption data
    const { data, error } = await supabase
      .from('script_to_video_history')
      .select('caption_data, processing_logs')
      .eq('id', videoId)
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }
    
    // Try new caption_data first, fallback to processing_logs
    let segments = [];
    
    if (data.caption_data?.chunks) {
      // New structured caption data
      segments = data.caption_data.chunks.segments || [];
    } else if (data.processing_logs?.caption_chunks) {
      // Legacy caption chunks
      segments = data.processing_logs.caption_chunks.segments || [];
    } else if (data.processing_logs?.segments) {
      // Fallback: use segment text (old videos without chunks)
      segments = data.processing_logs.segments.map((seg: any) => ({
        segment_id: seg.id,
        caption_chunks: [{
          id: `${seg.id}_full`,
          text: seg.text,
          start_time: seg.start_time,
          end_time: seg.end_time,
          lines: [seg.text], // Show as single chunk (legacy)
          confidence: 0.5
        }]
      }));
    }
    
    return NextResponse.json({
      success: true,
      videoId,
      segments,
      totalChunks: segments.reduce((sum: number, seg: any) => 
        sum + (seg.caption_chunks?.length || 0), 0
      )
    });
    
  } catch (error) {
    console.error('Error fetching captions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch captions' },
      { status: 500 }
    );
  }
}