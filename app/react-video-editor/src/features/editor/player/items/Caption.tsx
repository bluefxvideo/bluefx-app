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
export function Caption({ item, options }: CaptionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Get caption metadata
  const { caption_metadata, details } = item;
  
  // Check if we have segments
  if (!caption_metadata?.segments || caption_metadata.segments.length === 0) {
    return <AbsoluteFill />;
  }
  
  // Calculate current time in milliseconds
  const currentTimeMs = (frame * 1000) / fps;
  
  // Find current caption segment
  const currentSegment = caption_metadata.segments.find(
    segment => currentTimeMs >= segment.start && currentTimeMs < segment.end
  );
  
  if (!currentSegment) {
    return <AbsoluteFill />;
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