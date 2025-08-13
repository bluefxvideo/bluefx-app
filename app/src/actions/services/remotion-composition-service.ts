'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Remotion Composition Service
 * Handles the Generation → Editor → Remotion workflow
 */

export interface RemotionComposition {
  composition: {
    id: string;
    durationInFrames: number;
    fps: number;
    width: number;
    height: number;
  };
  sequences: Array<{
    id: string;
    from: number;
    durationInFrames: number;
    type: 'audio' | 'image' | 'text';
    layer: number;
    props: any;
  }>;
  assets: {
    audioUrl: string;
    imageUrls: string[];
    voiceSegments: string[];
    customAssets: string[];
  };
  rendering: {
    codec: string;
    crf: number;
    pixelFormat: string;
    proRes: boolean;
    concurrency: number;
  };
}

export interface EditorOverlays {
  timing_overrides?: Array<{
    sequence_id: string;
    new_from: number;
    new_duration_frames: number;
    reason: string;
  }>;
  content_overrides?: Array<{
    sequence_id: string;
    override_type: string;
    new_content: any;
  }>;
  additional_sequences?: Array<{
    id: string;
    from: number;
    durationInFrames: number;
    type: string;
    props: any;
    layer: number;
  }>;
  ui_state?: {
    current_frame: number;
    zoom_level: number;
    selected_sequence_id?: string;
  };
}

/**
 * Get Remotion-ready composition (Generation → Remotion direct path)
 */
export async function getRemotionComposition(video_id: string): Promise<{
  success: boolean;
  composition?: RemotionComposition;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('script_to_video_history')
      .select('remotion_composition, editor_overlays')
      .eq('id', video_id)
      .single();

    if (error) throw error;

    if (!data.remotion_composition) {
      return {
        success: false,
        error: 'No Remotion composition found for this video'
      };
    }

    let finalComposition = data.remotion_composition;

    // Apply editor overlays if they exist
    if (data.editor_overlays) {
      finalComposition = mergeEditorOverlays(finalComposition, data.editor_overlays);
    }

    return {
      success: true,
      composition: finalComposition
    };
  } catch (error) {
    console.error('Error getting Remotion composition:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get composition'
    };
  }
}

/**
 * Load project for editor (Generation → Editor path)
 */
export async function loadEditorProject(video_id: string): Promise<{
  success: boolean;
  project?: {
    remotion_composition: RemotionComposition;
    generation_metadata: any;
    editor_overlays: EditorOverlays;
    timeline_seconds: any; // UI convenience (converted from frames)
  };
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('script_to_video_history')
      .select('remotion_composition, generation_metadata, editor_overlays')
      .eq('id', video_id)
      .single();

    if (error) throw error;

    if (!data.remotion_composition) {
      return {
        success: false,
        error: 'No composition data found for this video'
      };
    }

    // Convert frame-based data to seconds for editor UI convenience
    const timelineInSeconds = convertFramesToSeconds(data.remotion_composition);

    return {
      success: true,
      project: {
        remotion_composition: data.remotion_composition, // Original preserved
        generation_metadata: data.generation_metadata || {},
        editor_overlays: data.editor_overlays || {},
        timeline_seconds: timelineInSeconds // UI convenience
      }
    };
  } catch (error) {
    console.error('Error loading editor project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load project'
    };
  }
}

/**
 * Save editor changes (non-destructive overlays)
 */
export async function saveEditorOverlays(
  video_id: string, 
  overlays: EditorOverlays
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('script_to_video_history')
      .update({
        editor_overlays: overlays,
        last_modified: new Date().toISOString()
      })
      .eq('id', video_id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error saving editor overlays:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save editor changes'
    };
  }
}

/**
 * Regenerate assets using preserved generation metadata
 */
export async function regenerateAsset(
  video_id: string,
  asset_type: 'voice' | 'image' | 'script',
  segment_id?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('script_to_video_history')
      .select('generation_metadata, remotion_composition')
      .eq('id', video_id)
      .single();

    if (error) throw error;

    if (!data.generation_metadata) {
      return {
        success: false,
        error: 'No generation metadata found - cannot regenerate assets'
      };
    }

    // Use preserved settings for regeneration
    const metadata = data.generation_metadata;

    switch (asset_type) {
      case 'voice':
        console.log('Regenerating voice with settings:', metadata.voice_synthesis);
        // Call voice service with preserved settings
        break;
      case 'image':
        console.log('Regenerating image with settings:', metadata.image_generation);
        // Call image service with preserved settings
        break;
      case 'script':
        console.log('Regenerating script with settings:', metadata.script);
        // Call script service with preserved settings
        break;
    }

    return { success: true };
  } catch (error) {
    console.error('Error regenerating asset:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to regenerate asset'
    };
  }
}

/**
 * Helper: Merge editor overlays with original composition
 */
function mergeEditorOverlays(
  composition: RemotionComposition, 
  overlays: EditorOverlays
): RemotionComposition {
  let merged = { ...composition };

  // Apply timing overrides
  overlays.timing_overrides?.forEach(override => {
    const sequence = merged.sequences.find(s => s.id === override.sequence_id);
    if (sequence) {
      sequence.from = override.new_from;
      sequence.durationInFrames = override.new_duration_frames;
    }
  });

  // Apply content overrides
  overlays.content_overrides?.forEach(override => {
    const sequence = merged.sequences.find(s => s.id === override.sequence_id);
    if (sequence) {
      sequence.props = { ...sequence.props, ...override.new_content };
    }
  });

  // Add new sequences
  if (overlays.additional_sequences) {
    merged.sequences.push(...overlays.additional_sequences);
  }

  // Update composition duration if needed
  const maxFrame = Math.max(...merged.sequences.map(s => s.from + s.durationInFrames));
  if (maxFrame > merged.composition.durationInFrames) {
    merged.composition.durationInFrames = maxFrame;
  }

  return merged;
}

/**
 * Helper: Convert frame-based timing to seconds for editor UI
 */
function convertFramesToSeconds(composition: RemotionComposition) {
  const fps = composition.composition.fps;
  
  return {
    total_duration: composition.composition.durationInFrames / fps,
    segments: composition.sequences
      .filter(seq => seq.type === 'image' || seq.type === 'text')
      .map(seq => ({
        id: seq.id,
        start_time: seq.from / fps,
        end_time: (seq.from + seq.durationInFrames) / fps,
        duration: seq.durationInFrames / fps,
        type: seq.type,
        content: seq.props
      }))
  };
}

/**
 * Helper: Convert seconds back to frames for Remotion
 */
export function convertSecondsToFrames(seconds: number, fps: number = 30): number {
  return Math.floor(seconds * fps);
}