import { dispatch } from "@designcombo/events";
import { ADD_TEXT } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";

/**
 * Caption Track Types
 */
export interface ICaptionTrackItem {
  id?: string;
  type?: 'caption' | 'text';
  name?: string;
  display?: {
    from: number;
    to: number;
  };
  metadata?: {
    resourceId?: string;
    duration?: number;
  };
  cut?: {
    from: number;
    to: number;
  };
  details?: {
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    color?: string;
    textAlign?: string;
    isCaptionTrack?: boolean;
    top?: string;
    left?: string;
    transform?: string;
    width?: string;
    captionSegments?: any[];
  };
  caption_metadata?: {
    segments?: Array<{
      start: number;
      end: number;
      text: string;
    }>;
    sourceUrl?: string;
    parentId?: string;
  };
  // Add audio duration for proper track length calculation
  audioDuration?: number;
}

/**
 * Add Caption Track to Editor Timeline
 * 
 * Properly calculates duration from caption segments and adds the track
 * to the timeline with correct timing information.
 */
export function addCaptionTrackToEditor(captionTrack: ICaptionTrackItem) {
  console.log('📝 Adding caption track to editor:', {
    id: captionTrack.id,
    segments: captionTrack.caption_metadata?.segments?.length,
    providedDuration: captionTrack.metadata?.duration,
    displayTo: captionTrack.display?.to
  });

  // Calculate duration - prefer audio duration for track length
  let duration: number;
  
  if (captionTrack.audioDuration) {
    // Use audio duration for track length (captions should span the entire audio)
    duration = captionTrack.audioDuration * 1000; // Convert seconds to milliseconds
    console.log('📊 Duration from audio duration:', duration, 'ms');
  } else if (captionTrack.display?.to) {
    // Use provided display duration
    duration = captionTrack.display.to;
    console.log('📊 Duration from display.to:', duration, 'ms');
  } else if (captionTrack.metadata?.duration) {
    // Use metadata duration
    duration = captionTrack.metadata.duration;
    console.log('📊 Duration from metadata:', duration, 'ms');
  } else if (captionTrack.caption_metadata?.segments && captionTrack.caption_metadata.segments.length > 0) {
    // Fallback: use the end time of the last caption segment
    const segmentMaxEnd = captionTrack.caption_metadata.segments.reduce((max, seg) => Math.max(max, seg.end), 0);
    duration = segmentMaxEnd;
    console.log('📊 Duration from segments (fallback):', duration, 'ms');
  } else {
    // Final fallback duration (30 seconds)
    duration = 30000;
    console.warn('⚠️ Using final fallback duration:', duration, 'ms');
  }

  const trackId = captionTrack.id || generateId();

  const textPayload = {
    id: trackId,
    targetTrackId: trackId, // Required by ADD_TEXT action
    display: {
      from: 0,
      to: duration, // Use calculated duration from caption segments
    },
    cut: {
      from: 0,
      to: duration,
    },
    type: "text",
    details: {
      text: captionTrack.details?.text || "🎬 AI Generated Captions",
      fontSize: captionTrack.details?.fontSize || 24,
      fontFamily: captionTrack.details?.fontFamily || "Arial, sans-serif",
      fontWeight: captionTrack.details?.fontWeight || "bold",
      color: captionTrack.details?.color || "#00FF88", // Green to distinguish AI captions
      textAlign: captionTrack.details?.textAlign || "center",
      
      // Position captions towards bottom center
      top: captionTrack.details?.top || '75%',
      left: captionTrack.details?.left || '50%', 
      transform: captionTrack.details?.transform || 'translate(-50%, -50%)',
      width: captionTrack.details?.width || '80%',
      
      // Store caption data in details
      captionSegments: captionTrack.details?.captionSegments || captionTrack.caption_metadata?.segments,
      isCaptionTrack: true
    },
    metadata: {
      resourceId: captionTrack.metadata?.resourceId || '',
      duration: duration,
      source: 'ai-generated',
      generator: 'whisper-caption-orchestrator',
      frameAligned: true
    }
  };

  console.log('🚀 Dispatching caption track to timeline:', {
    id: textPayload.id,
    targetTrackId: textPayload.targetTrackId,
    duration: textPayload.display.to,
    segments: textPayload.details.captionSegments?.length
  });

  dispatch(ADD_TEXT, {
    payload: textPayload,
    options: {} // Required by ADD_TEXT action
  });
  
  return textPayload.id;
}