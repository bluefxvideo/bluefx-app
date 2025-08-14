import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ITrackItem } from "@designcombo/types";

// Extend ITrackItem for captions
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
      style?: {
        fontSize?: number;
        activeColor?: string;
        appearedColor?: string;
        color?: string;
      };
    }>;
    sourceUrl?: string;
    parentId?: string;
  };
}

interface CaptionProps {
  item: ICaptionTrackItem;
  options: any;
}

/**
 * Caption Component - Renders captions with word-level timing
 * Based on V2 implementation but adapted for React Video Editor
 */
function CaptionComponent({ item, options }: CaptionProps) {
  // Always call hooks in the same order regardless of conditions
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Get caption metadata
  const { caption_metadata, details } = item;
  
  // Calculate current time in milliseconds
  const currentTimeMs = (frame * 1000) / fps;
  
  // Always calculate these to maintain hook order
  const hasSegments = caption_metadata?.segments && caption_metadata.segments.length > 0;
  const currentSegment = hasSegments 
    ? caption_metadata.segments.find(segment => currentTimeMs >= segment.start && currentTimeMs < segment.end)
    : null;
  
  // Debug logging (removed to prevent re-render issues)
  // console.log('Caption render:', { frame, currentTimeMs, hasSegments });
  
  // Early return after all hooks are called - but show debug info
  if (!hasSegments) {
    return (
      <AbsoluteFill>
        <div style={{ 
          position: 'absolute', 
          top: 20, 
          left: 20, 
          color: 'red', 
          fontSize: 16,
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 8
        }}>
          NO CAPTION SEGMENTS
        </div>
      </AbsoluteFill>
    );
  }
  
  if (!currentSegment) {
    return (
      <AbsoluteFill>
        <div style={{ 
          position: 'absolute', 
          top: 20, 
          left: 20, 
          color: 'yellow', 
          fontSize: 16,
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 8
        }}>
          NO ACTIVE SEGMENT (t={currentTimeMs.toFixed(0)}ms)
        </div>
      </AbsoluteFill>
    );
  }
  
  // Find active words based on current time
  const activeWords = currentSegment.words.filter(
    word => currentTimeMs >= word.start && currentTimeMs < word.end
  );
  
  const appearedWords = currentSegment.words.filter(
    word => currentTimeMs >= word.end
  );
  
  // Default styles (can be overridden by segment.style or details)
  const defaultStyle = {
    fontSize: details?.fontSize || 48,
    activeColor: currentSegment.style?.activeColor || '#00FF88',
    appearedColor: currentSegment.style?.appearedColor || '#FFFFFF',
    color: currentSegment.style?.color || '#808080',
    fontFamily: details?.fontFamily || 'Inter',
    textAlign: (details?.textAlign as any) || 'center',
    backgroundColor: details?.backgroundColor || 'rgba(0, 0, 0, 0.7)',
    borderColor: details?.borderColor || '#000000',
    borderWidth: details?.borderWidth || 2,
  };
  
  // Render caption with word-level highlighting
  return (
    <AbsoluteFill>
      {/* Debug indicator */}
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        left: 10, 
        color: 'green', 
        fontSize: 12,
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 4
      }}>
        CAPTION ACTIVE: {currentSegment.text.substring(0, 20)}...
      </div>
      
      <div
        style={{
          position: 'absolute',
          bottom: details?.top || 100,
          left: details?.left || '50%',
          transform: 'translateX(-50%)',
          width: details?.width || '80%',
          maxWidth: 800,
          padding: '16px 24px',
          backgroundColor: defaultStyle.backgroundColor,
          borderRadius: 8,
          border: `${defaultStyle.borderWidth}px solid ${defaultStyle.borderColor}`,
          ...options?.style,
        }}
      >
        <div
          style={{
            fontSize: defaultStyle.fontSize,
            fontFamily: defaultStyle.fontFamily,
            textAlign: defaultStyle.textAlign,
            lineHeight: 1.4,
          }}
        >
          {currentSegment.words.map((word, index) => {
            const isActive = activeWords.some(w => w.word === word.word && w.start === word.start);
            const hasAppeared = appearedWords.some(w => w.word === word.word && w.start === word.start);
            
            let color = defaultStyle.color;
            if (isActive) {
              color = defaultStyle.activeColor;
            } else if (hasAppeared) {
              color = defaultStyle.appearedColor;
            }
            
            return (
              <span
                key={`${word.word}-${word.start}-${index}`}
                style={{
                  color,
                  transition: 'color 0.2s ease',
                  marginRight: '0.25em',
                  fontWeight: isActive ? 700 : 400,
                  textShadow: isActive ? '0 0 20px currentColor' : 'none',
                }}
              >
                {word.word}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// Export memoized version to prevent unnecessary re-renders
export const Caption = React.memo(CaptionComponent);