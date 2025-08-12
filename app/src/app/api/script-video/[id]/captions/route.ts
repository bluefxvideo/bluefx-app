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
    
    // FIXED: Handle both absolute and relative timing formats
    let segments = [];
    
    if (data.caption_data?.chunks) {
      // New structured caption data (already absolute timing)
      segments = data.caption_data.chunks.segments || [];
    } else if (data.processing_logs?.caption_chunks) {
      // Legacy caption chunks - convert to absolute timing
      const legacySegments = data.processing_logs.caption_chunks.segments || [];
      segments = legacySegments.map((seg: any) => {
        const segmentStartTime = seg.segment_start_time || 0;
        
        return {
          ...seg,
          caption_chunks: (seg.caption_chunks || []).map((chunk: any) => ({
            ...chunk,
            // FIXED: Convert relative to absolute timing
            start_time: segmentStartTime + (chunk.start_time || 0),
            end_time: segmentStartTime + (chunk.end_time || chunk.start_time + 2),
            confidence: chunk.confidence || 0.8
          }))
        };
      });
      
      console.log(`[Captions API] Converted ${segments.length} legacy segments to absolute timing`);
    } else if (data.processing_logs?.segments) {
      // Fallback: create chunks from segment text with absolute timing
      segments = data.processing_logs.segments.map((seg: any) => ({
        segment_id: seg.id,
        caption_chunks: [{
          id: `${seg.id}_full`,
          text: seg.text,
          start_time: seg.start_time, // Already absolute
          end_time: seg.end_time,     // Already absolute
          duration: seg.end_time - seg.start_time,
          lines: [seg.text],
          confidence: 0.5
        }]
      }));
      
      console.log(`[Captions API] Created ${segments.length} fallback chunks from segments`);
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