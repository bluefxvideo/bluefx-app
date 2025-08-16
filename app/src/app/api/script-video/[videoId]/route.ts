import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * API endpoint for React Video Editor to fetch Script-to-Video assets
 * GET /api/script-video/[videoId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;
    
    if (!videoId) {
      return NextResponse.json(
        { success: false, error: 'Video ID is required' },
        { status: 400 }
      );
    }

    console.log(`🎬 Fetching script-video assets for: ${videoId}`);

    // Fetch the script-video record from database
    const { data: videoRecord, error: fetchError } = await supabase
      .from('script_to_video_history')
      .select(`
        id,
        user_id,
        script_content,
        video_url,
        audio_url,
        generated_images,
        segments,
        remotion_composition,
        generation_metadata,
        whisper_data,
        created_at
      `)
      .eq('id', videoId)
      .single();

    if (fetchError) {
      console.error('❌ Database fetch error:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    if (!videoRecord) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    console.log('✅ Found script-video record:', {
      id: videoRecord.id,
      hasAudio: !!videoRecord.audio_url,
      segmentCount: videoRecord.segments?.length || 0,
      imageCount: videoRecord.generated_images?.length || 0,
      hasRemotionComposition: !!videoRecord.remotion_composition
    });

    // Transform database record to format expected by React Video Editor
    const editorAssets = {
      success: true,
      video_id: videoRecord.id,
      
      // Core assets for editor
      audio_url: videoRecord.audio_url,
      generated_images: videoRecord.generated_images || [],
      segments: videoRecord.segments || [],
      
      // Script content
      script_text: videoRecord.script_content,
      
      // Remotion composition (primary data)
      remotion_composition: videoRecord.remotion_composition,
      
      // Timeline data for editor
      timeline_data: videoRecord.remotion_composition ? {
        total_duration: videoRecord.remotion_composition.composition?.durationInFrames / 30 || 30,
        frame_count: videoRecord.remotion_composition.composition?.durationInFrames || 900,
        fps: videoRecord.remotion_composition.composition?.fps || 30,
        width: videoRecord.remotion_composition.composition?.width || 1920,
        height: videoRecord.remotion_composition.composition?.height || 1080
      } : null,
      
      // Word-level timing for captions (from Whisper)
      word_timings: videoRecord.whisper_data?.frame_alignment || [],
      
      // Generation metadata for context
      generation_info: {
        created_at: videoRecord.created_at,
        model_versions: videoRecord.generation_metadata?.orchestration?.model_versions,
        credits_used: videoRecord.generation_metadata?.credits_breakdown?.total,
        user_id: videoRecord.user_id
      },
      
      // Assets bundle for editor
      assets: videoRecord.remotion_composition?.assets || {
        audioUrl: videoRecord.audio_url || '',
        imageUrls: (videoRecord.generated_images || []).map((img: any) => img.url),
        voiceSegments: [],
        customAssets: []
      }
    };

    console.log('🎉 Transformed assets for editor:', {
      video_id: editorAssets.video_id,
      segmentCount: editorAssets.segments.length,
      imageCount: editorAssets.generated_images.length,
      hasAudio: !!editorAssets.audio_url,
      timelineData: !!editorAssets.timeline_data
    });

    return NextResponse.json(editorAssets);

  } catch (error) {
    console.error('🚨 API error fetching script-video assets:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}