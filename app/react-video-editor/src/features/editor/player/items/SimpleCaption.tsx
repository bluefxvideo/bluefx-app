import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ITrackItem } from "@designcombo/types";

// Simplified caption interface
export interface ICaptionTrackItem extends ITrackItem {
  type: 'caption';
  caption_metadata?: {
    segments?: Array<{
      start: number;
      end: number;
      text: string;
      words: Array<{
        word: string;
        start: number;
        end: number;
        confidence?: number;
      }>;
    }>;
  };
}

interface CaptionProps {
  item: ICaptionTrackItem;
  options: any;
}

/**
 * Simplified Caption Component to avoid hooks issues
 */
export default function SimpleCaption({ item, options }: CaptionProps) {
  // Always call these hooks first, no conditionals
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Simple calculation
  const currentTimeMs = (frame * 1000) / fps;
  
  // Find active segment without complex logic
  const segments = item.caption_metadata?.segments || [];
  let activeText = '';
  
  for (const segment of segments) {
    if (currentTimeMs >= segment.start && currentTimeMs < segment.end) {
      activeText = segment.text;
      break;
    }
  }
  
  return (
    <AbsoluteFill>
      {activeText && (
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: 8,
            fontSize: 32,
            fontFamily: 'Inter',
            textAlign: 'center',
            maxWidth: '80%',
          }}
        >
          {activeText}
        </div>
      )}
      
      {/* Debug info */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        color: 'yellow',
        fontSize: 12,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 4
      }}>
        Frame: {frame}, Time: {currentTimeMs.toFixed(0)}ms, Segments: {segments.length}
      </div>
    </AbsoluteFill>
  );
}

// Export as Caption for compatibility
export { SimpleCaption as Caption };