import { ITrackItem } from "@designcombo/types";
import { ICaptionTrackItem } from "../player/items/Caption";
import { dispatch } from "@designcombo/events";
import { ADD_TEXT } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";


/**
 * Load mock caption data for testing
 * Based on V2 implementation
 */
export async function loadMockCaptionData(): Promise<ICaptionTrackItem | null> {
  try {
    const response = await fetch('/mocks/caption-data.json');
    const mockData = await response.json();
    const { sampleCaptions } = mockData;
    
    if (!sampleCaptions || sampleCaptions.length === 0) {
      console.warn('No caption data found in mock file');
      return null;
    }
    
    // Create unified caption track with all segments
    const captionSegments = sampleCaptions.map((caption: any) => ({
      start: caption.display.from,
      end: caption.display.to,
      text: caption.details.text,
      words: caption.metadata.words,
      style: {
        fontSize: caption.details.fontSize,
        activeColor: caption.details.activeColor,
        appearedColor: caption.details.appearedColor,
        color: caption.details.color
      }
    }));
    
    // Calculate total duration
    const totalDuration = Math.max(...sampleCaptions.map((c: any) => c.display.to));
    
    // Create unified caption track
    const captionTrack: ICaptionTrackItem = {
      id: `caption-${Date.now()}`,
      type: 'caption' as const,
      name: 'Captions',
      display: {
        from: 0,
        to: totalDuration,
      },
      metadata: {
        resourceId: '',
        duration: totalDuration,
      },
      cut: {
        from: 0,
        to: totalDuration,
      },
      details: {
        text: 'Captions',
        fontSize: 48,
        width: 800,
        fontFamily: 'Inter',
        fontUrl: '',
        textAlign: 'center' as const,
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderColor: '#000000',
        borderWidth: 2,
        height: 100,
        top: 100, // Distance from bottom
        left: 50, // Center horizontally
        opacity: 1,
        skewX: 0,
        skewY: 0,
        lineHeight: 1.4,
        letterSpacing: 0,
        fontWeight: 400,
        fontStyle: 'normal',
        textDecoration: 'none',
        wordSpacing: 0,
        textShadow: 'none',
        textTransform: 'none' as const,
        transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
      },
      caption_metadata: {
        segments: captionSegments,
        sourceUrl: null,
        parentId: null
      }
    };
    
    console.log('Mock caption track created:', captionTrack);
    return captionTrack;
    
  } catch (error) {
    console.error('Failed to load mock caption data:', error);
    return null;
  }
}



/**
 * Add caption track to editor using text items with caption metadata
 */
export function addCaptionTrackToEditor(captionTrack: ICaptionTrackItem) {
  // Use ADD_TEXT with exact same structure as TEXT_ADD_PAYLOAD
  const textPayload = {
    id: generateId(),
    display: {
      from: 0,
      to: captionTrack.caption_metadata?.segments?.reduce((max, seg) => Math.max(max, seg.end), 0) || 30000,
    },
    type: "text",
    details: {
      text: "🎬 CAPTIONS TRACK", // Clear indicator this is captions
      fontSize: 48,
      width: 800,
      fontUrl: "", // Will use default font
      fontFamily: "Inter",
      color: "#00FF88", // Green to distinguish from regular text
      wordWrap: "break-word",
      textAlign: "center",
      borderWidth: 2,
      borderColor: "#4A9EFF",
      boxShadow: {
        color: "#000000",
        x: 2,
        y: 2,
        blur: 4,
      },
      // Store caption data in details to ensure it's preserved
      captionSegments: captionTrack.caption_metadata?.segments,
      isCaptionTrack: true
    },
  };
  
  dispatch(ADD_TEXT, {
    payload: textPayload,
    options: {}
  });
  
  console.log('Caption track added as text item with proper structure', textPayload);
}