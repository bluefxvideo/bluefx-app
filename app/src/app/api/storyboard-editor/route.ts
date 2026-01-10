import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * API endpoint to format storyboard extracted frames for the video editor
 *
 * This endpoint creates editor-compatible data from extracted storyboard frames,
 * allowing users to take their AI-generated storyboard frames directly into
 * the multi-track video editor for assembly, animation, and export.
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();

  try {
    const { projectId, userId, frames } = await request.json();

    if (!projectId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Project ID and User ID are required' },
        { status: 400 }
      );
    }

    // If frames are provided directly, use them; otherwise fetch from ad_projects
    let extractedFrames = frames;
    let projectData = null;

    if (!extractedFrames) {
      // Fetch project data from ad_projects table
      const { data: project, error: projectError } = await supabase
        .from('ad_projects')
        .select('id, extracted_frames, prompt, visual_style, status, created_at')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();

      if (projectError || !project) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      if (!project.extracted_frames || project.extracted_frames.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No extracted frames found. Please extract frames first.' },
          { status: 400 }
        );
      }

      extractedFrames = project.extracted_frames;
      projectData = project;
    }

    // Calculate timeline duration based on frames
    // Default: 3 seconds per frame for a comfortable viewing pace
    const SECONDS_PER_FRAME = 3;
    const FPS = 30;
    const totalDuration = extractedFrames.length * SECONDS_PER_FRAME;
    const totalDurationMs = totalDuration * 1000;

    // Convert frames to editor-compatible track items
    const trackItems = extractedFrames.map((frame: any, index: number) => {
      const startTime = index * SECONDS_PER_FRAME;
      const startTimeMs = startTime * 1000;
      const durationMs = SECONDS_PER_FRAME * 1000;
      const startFrame = startTime * FPS;
      const durationFrames = SECONDS_PER_FRAME * FPS;

      // Use upscaled URL if available, otherwise original
      const imageUrl = frame.upscaledUrl || frame.originalUrl;

      return {
        id: `storyboard-frame-${frame.frameNumber}`,
        name: `Frame ${frame.frameNumber}`,
        type: 'image',

        // Timing (in frames for Remotion compatibility)
        from: startFrame,
        duration: durationFrames,

        // Display range (in ms for DesignCombo)
        display: {
          from: startTimeMs,
          to: startTimeMs + durationMs,
        },

        // Track assignment
        trackId: 'storyboard-track',

        // Visual properties
        details: {
          src: imageUrl,
          width: frame.width || 1920,
          height: frame.height || 1080,
          // Center the image
          x: 0,
          y: 0,
          // Fill the canvas
          objectFit: 'cover',
        },

        // Metadata for identification
        metadata: {
          frameNumber: frame.frameNumber,
          row: frame.row,
          col: frame.col,
          originalUrl: frame.originalUrl,
          upscaledUrl: frame.upscaledUrl,
          sourceType: 'storyboard',
          projectId: projectId,
        },
      };
    });

    // Create track structure
    const tracks = [
      {
        id: 'storyboard-track',
        name: 'Storyboard Frames',
        type: 'image',
        items: trackItems.map((item: any) => item.id),
        accepts: ['image', 'video'],
        index: 0,
        static: false,
      },
    ];

    // Build trackItemsMap for fast lookup
    const trackItemsMap: Record<string, any> = {};
    trackItems.forEach((item: any) => {
      trackItemsMap[item.id] = item;
    });

    // Determine canvas size based on first frame (assuming all frames are same size)
    const firstFrame = extractedFrames[0];
    const canvasWidth = firstFrame?.width || 1920;
    const canvasHeight = firstFrame?.height || 1080;

    // Build the complete editor payload (DesignCombo format)
    const editorPayload = {
      // Design properties
      fps: FPS,
      size: {
        width: canvasWidth,
        height: canvasHeight,
      },
      duration: totalDurationMs,

      // Track items
      trackItems: trackItems,
      trackItemsMap: trackItemsMap,
      trackItemIds: trackItems.map((item: any) => item.id),

      // Tracks structure
      tracks: tracks,

      // Selection and transitions (empty initially)
      activeIds: [],
      transitionsMap: {},
      transitionIds: [],

      // Timeline scale (default zoom)
      scale: {
        index: 7,
        unit: 300,
        zoom: 1 / 300,
        segments: 5,
      },

      // Background
      background: {
        type: 'color',
        value: '#000000',
      },

      // Structure for layer ordering
      structure: tracks.map((t: any) => t.id),
    };

    // Store this as a video editor composition for later retrieval
    const compositionId = `storyboard-${projectId}-${Date.now()}`;

    // Optionally save to video_editor_compositions table
    // This allows the editor to reload the project later
    const { error: saveError } = await supabase
      .from('video_editor_compositions')
      .upsert({
        id: compositionId,
        user_id: userId,
        project_id: projectId,
        composition_data: editorPayload,
        source_type: 'storyboard',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (saveError) {
      console.warn('Failed to save composition (non-blocking):', saveError);
    }

    return NextResponse.json({
      success: true,
      data: {
        compositionId,
        projectId,
        frameCount: extractedFrames.length,
        totalDuration: totalDuration,
        editorPayload,
        // URL to open editor with this composition
        editorUrl: `/editor?storyboardId=${projectId}&userId=${userId}`,
      },
    });

  } catch (error) {
    console.error('Error formatting storyboard for editor:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to format storyboard for editor'
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler to retrieve storyboard editor data
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();

  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    const userId = url.searchParams.get('userId');

    if (!projectId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Project ID and User ID are required' },
        { status: 400 }
      );
    }

    // Check for existing composition first
    const { data: composition } = await supabase
      .from('video_editor_compositions')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('source_type', 'storyboard')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (composition?.composition_data) {
      return NextResponse.json({
        success: true,
        data: {
          compositionId: composition.id,
          projectId,
          editorPayload: composition.composition_data,
          savedAt: composition.updated_at,
        },
      });
    }

    // No saved composition, fetch frames and create new one
    const { data: project, error: projectError } = await supabase
      .from('ad_projects')
      .select('id, extracted_frames, prompt, visual_style, status')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    if (!project.extracted_frames || project.extracted_frames.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No extracted frames found' },
        { status: 400 }
      );
    }

    // Generate fresh editor payload (same logic as POST)
    const extractedFrames = project.extracted_frames;
    const SECONDS_PER_FRAME = 3;
    const FPS = 30;

    const trackItems = extractedFrames.map((frame: any, index: number) => {
      const startTime = index * SECONDS_PER_FRAME;
      const startTimeMs = startTime * 1000;
      const durationMs = SECONDS_PER_FRAME * 1000;
      const startFrame = startTime * FPS;
      const durationFrames = SECONDS_PER_FRAME * FPS;
      const imageUrl = frame.upscaledUrl || frame.originalUrl;

      return {
        id: `storyboard-frame-${frame.frameNumber}`,
        name: `Frame ${frame.frameNumber}`,
        type: 'image',
        from: startFrame,
        duration: durationFrames,
        display: { from: startTimeMs, to: startTimeMs + durationMs },
        trackId: 'storyboard-track',
        details: {
          src: imageUrl,
          width: frame.width || 1920,
          height: frame.height || 1080,
          x: 0,
          y: 0,
          objectFit: 'cover',
        },
        metadata: {
          frameNumber: frame.frameNumber,
          row: frame.row,
          col: frame.col,
          originalUrl: frame.originalUrl,
          upscaledUrl: frame.upscaledUrl,
          sourceType: 'storyboard',
          projectId: projectId,
        },
      };
    });

    const firstFrame = extractedFrames[0];
    const editorPayload = {
      fps: FPS,
      size: { width: firstFrame?.width || 1920, height: firstFrame?.height || 1080 },
      duration: extractedFrames.length * SECONDS_PER_FRAME * 1000,
      trackItems,
      trackItemsMap: Object.fromEntries(trackItems.map((item: any) => [item.id, item])),
      trackItemIds: trackItems.map((item: any) => item.id),
      tracks: [{
        id: 'storyboard-track',
        name: 'Storyboard Frames',
        type: 'image',
        items: trackItems.map((item: any) => item.id),
        accepts: ['image', 'video'],
        index: 0,
        static: false,
      }],
      activeIds: [],
      transitionsMap: {},
      transitionIds: [],
      scale: { index: 7, unit: 300, zoom: 1 / 300, segments: 5 },
      background: { type: 'color', value: '#000000' },
      structure: ['storyboard-track'],
    };

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        frameCount: extractedFrames.length,
        editorPayload,
      },
    });

  } catch (error) {
    console.error('Error fetching storyboard editor data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch storyboard data' },
      { status: 500 }
    );
  }
}
