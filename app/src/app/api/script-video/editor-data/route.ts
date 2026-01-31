import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// CORS helper - allow multiple origins for editor access
const ALLOWED_ORIGINS = [
  'https://editor.bluefx.net',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:3000'
];

function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  // Default to production editor
  return process.env.NEXT_PUBLIC_VIDEO_EDITOR_URL || 'https://editor.bluefx.net';
}

/**
 * API endpoint for external video editor data access
 * 
 * This endpoint provides a bridge between the BlueFX app and the external React video editor.
 * It formats and returns all necessary data for video editing including:
 * - Video metadata and settings
 * - Voice audio URLs and timing data
 * - Image URLs and segment mappings
 * - Caption data with word-level timings
 * - All assets needed for video composition
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    console.log('🔍 Editor API: Starting request');
    console.log('🔍 Editor API: Request origin:', request.headers.get('origin'));

    const { user_id, videoId } = await request.json();
    console.log('🔍 Editor API: user_id =', user_id, 'videoId =', videoId);

    if (!user_id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    console.log('🔍 Editor API: Using initialized Supabase client');
    let videoData;
    
    if (videoId) {
      // Fetch specific video data
      const { data: video } = await supabase
        .from('script_to_video_history')
        .select(`
          id,
          script_content,
          video_url,
          thumbnail_url,
          processing_logs,
          whisper_data,
          caption_data,
          storyboard_data,
          image_data,
          voice_data,
          created_at,
          updated_at
        `)
        .eq('id', videoId)
        .eq('user_id', user_id)
        .single();
      
      if (!video) {
        return NextResponse.json(
          { success: false, error: 'Video not found' },
          { status: 404 }
        );
      }
      
      videoData = video;
    } else {
      // Fetch latest video data
      const { data: video } = await supabase
        .from('script_to_video_history')
        .select(`
          id,
          script_content,
          video_url,
          thumbnail_url,
          processing_logs,
          whisper_data,
          caption_data,
          storyboard_data,
          image_data,
          voice_data,
          created_at,
          updated_at
        `)
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!video) {
        return NextResponse.json(
          { success: false, error: 'No video data found' },
          { status: 404 }
        );
      }
      
      videoData = video;
    }

    // Format data for external editor
    const processingLogs = videoData.processing_logs || {};
    
    // Caption chunks are now generated on-demand in the editor
    const captionChunks: any[] = [];
    
    // Fix segment timing if needed
    const segments = processingLogs.segments || [];
    let cumulativeTime = 0;
    const fixedSegments = segments.map((seg: any, index: number) => {
      let startTime = seg.start_time;
      let endTime = seg.end_time;
      let duration = seg.duration;
      
      // Fix null/invalid timing
      if (startTime === null || startTime === undefined || startTime < 0) {
        startTime = cumulativeTime;
        console.log(`🔧 Fixed null start_time for segment ${index}: ${startTime}`);
      }
      
      // Calculate duration if missing
      if (!duration && endTime && startTime >= 0) {
        duration = endTime - startTime;
      } else if (!duration) {
        // Estimate based on text length
        const wordCount = (seg.text || '').split(/\s+/).length;
        duration = Math.max(3, Math.min(8, wordCount / 3)); // ~180 WPM
      }
      
      // Fix end_time if needed
      if (!endTime || endTime <= startTime) {
        endTime = startTime + duration;
        console.log(`🔧 Fixed invalid end_time for segment ${index}: ${endTime}`);
      }
      
      // Update cumulative time for next segment
      cumulativeTime = endTime;
      
      return {
        ...seg,
        start_time: startTime,
        end_time: endTime,
        duration: endTime - startTime
      };
    });
    
    const editorData = {
      // Video metadata
      videoId: videoData.id,
      userId: user_id,
      script: videoData.script_content,
      createdAt: videoData.created_at,
      updatedAt: videoData.updated_at,
      
      // Include image_data for aspect ratio extraction
      imageData: videoData.image_data,
      image_data: videoData.image_data, // Support both field names
      
      // Audio assets (from processing_logs)
      voice: {
        url: processingLogs.audio_url,
        // Include whisper data for precise timing
        whisperData: videoData.whisper_data,
      },
      
      // Voice data for additional metadata
      voiceData: videoData.voice_data,
      voice_data: videoData.voice_data, // Support both field names
      
      // Image assets (from processing_logs)
      images: {
        urls: processingLogs.generated_images || [],
        segments: fixedSegments, // Use the fixed segments with proper timing
      },
      
      // Caption and timing data
      captions: {
        data: videoData.caption_data,
        chunks: captionChunks, // Use the fetched caption chunks from separate table
        wordTimings: processingLogs.word_timings || [],
      },
      
      // Additional metadata for editor configuration
      metadata: {
        totalDuration: videoData.whisper_data?.full_analysis?.total_duration || 0,
        frameRate: videoData.whisper_data?.full_analysis?.frame_rate || 30,
        wordCount: videoData.whisper_data?.full_analysis?.word_count || 0,
        speakingRate: videoData.whisper_data?.full_analysis?.speaking_rate || 0,
        creditsUsed: processingLogs.credits_used || 0,
        batchId: processingLogs.batch_id,
      },
      
      // Video URLs
      videoUrl: videoData.video_url,
      thumbnailUrl: videoData.thumbnail_url,
      
      // Production plan and storyboard data
      productionPlan: processingLogs.production_plan,
      storyboardData: videoData.storyboard_data,
      
      // API endpoint for future updates (if needed)
      apiEndpoint: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/script-video/editor-data?videoId=${videoData.id}`,
    };

    const response = NextResponse.json({
      success: true,
      data: editorData
    });
    
    // Add CORS headers - use environment variable or fallback to localhost for development
    response.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
    
    return response;

  } catch (error) {
    console.error('Error fetching editor data:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorResponse = NextResponse.json(
      { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
    
    // Add CORS headers to error response too
    const allowedOrigin = getAllowedOrigin(request);
    errorResponse.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
    
    return errorResponse;
  }
}

/**
 * GET handler for external editor to fetch video data using query parameters
 * Usage: /api/script-video/editor-data?videoId=123&userId=456
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    console.log('🔍 Editor API (GET): Starting request');
    const url = new URL(request.url);
    const videoId = url.searchParams.get('videoId');
    const userId = url.searchParams.get('userId');
    
    console.log('🔍 Editor API (GET): videoId =', videoId, 'userId =', userId);
    
    if (!userId) {
      const errorResponse = NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
      errorResponse.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
      return errorResponse;
    }

    // Use the same logic as POST but with query parameters
    let videoData;
    
    if (videoId) {
      // Fetch specific video data
      const { data: video } = await supabase
        .from('script_to_video_history')
        .select(`
          id,
          script_content,
          video_url,
          thumbnail_url,
          processing_logs,
          whisper_data,
          caption_data,
          storyboard_data,
          image_data,
          voice_data,
          created_at,
          updated_at
        `)
        .eq('id', videoId)
        .eq('user_id', userId)
        .single();

      if (!video) {
        const errorResponse = NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
        errorResponse.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
        return errorResponse;
      }
      
      videoData = video;
    } else {
      // Fetch latest video data for user
      const { data: video } = await supabase
        .from('script_to_video_history')
        .select(`
          id,
          script_content,
          video_url,
          thumbnail_url,
          processing_logs,
          whisper_data,
          caption_data,
          storyboard_data,
          image_data,
          voice_data,
          created_at,
          updated_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!video) {
        const errorResponse = NextResponse.json({ success: false, error: 'No video found for user' }, { status: 404 });
        errorResponse.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
        return errorResponse;
      }
      
      videoData = video;
    }

    // Format the response using the same logic as POST
    const response = NextResponse.json({
      success: true,
      data: {
        videoId: videoData.id,
        userId: userId,
        script: videoData.script_content || '',
        createdAt: videoData.created_at || new Date().toISOString(),
        updatedAt: videoData.updated_at || new Date().toISOString(),
        
        voice: {
          url: videoData.processing_logs?.voice_url || '',
          whisperData: videoData.whisper_data || {}
        },
        
        images: {
          urls: videoData.storyboard_data?.image_urls || [],
          segments: videoData.storyboard_data?.segments || []
        },
        
        captions: {
          data: videoData.caption_data || {},
          wordTimings: videoData.whisper_data?.segments || []
        },
        
        metadata: {
          totalDuration: videoData.processing_logs?.total_duration || 0,
          frameRate: 30,
          wordCount: (videoData.script_content || '').split(' ').length,
          speakingRate: 150
        },
        
        apiEndpoint: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      }
    });

    response.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return response;

  } catch (error) {
    console.error('Error fetching editor data (GET):', error);
    
    const errorResponse = NextResponse.json(
      { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
    
    errorResponse.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
    return errorResponse;
  }
}

/**
 * OPTIONS handler for CORS support if external editor needs cross-origin access
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(request),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}