'use client';

import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence, Audio, Img } from 'remotion';
import { AIComposition, AITrackItem } from '../store/use-ai-video-editor-store';

export interface AIRemotionCompositionProps {
  composition: AIComposition;
  sequences: AITrackItem[];
}

/**
 * Main Remotion Composition
 * Renders all sequences (track items) with proper timing and layering
 */
export function AIRemotionComposition({ 
  composition, 
  sequences 
}: AIRemotionCompositionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Sort sequences by layer (lower layers render first, higher layers on top)
  const sortedSequences = [...sequences].sort((a, b) => a.layer - b.layer);
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {sortedSequences.map((sequence) => (
        <Sequence
          key={sequence.id}
          from={sequence.start}
          durationInFrames={sequence.duration}
        >
          <AISequenceItem 
            sequence={sequence} 
            currentFrame={frame}
            fps={fps}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/**
 * Individual Sequence Item Renderer
 * Handles different types of content (text, image, audio, video)
 */
function AISequenceItem({ 
  sequence, 
  currentFrame, 
  fps 
}: { 
  sequence: AITrackItem;
  currentFrame: number;
  fps: number;
}) {
  const { transform, opacity = 1 } = sequence.details;
  
  // Calculate if this sequence is currently active
  const isActive = currentFrame >= sequence.start && currentFrame < sequence.start + sequence.duration;
  
  if (!isActive) return null;
  
  // Base transform styles
  const baseStyles: React.CSSProperties = {
    opacity,
    transform: transform ? 
      `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)` 
      : undefined,
  };
  
  switch (sequence.type) {
    case 'text':
      return <TextSequence sequence={sequence} style={baseStyles} />;
      
    case 'image':
      return <ImageSequence sequence={sequence} style={baseStyles} />;
      
    case 'audio':
      return <AudioSequence sequence={sequence} />;
      
    case 'video':
      return <VideoSequence sequence={sequence} style={baseStyles} />;
      
    case 'ai-generated':
      return <AIGeneratedSequence sequence={sequence} style={baseStyles} />;
      
    case 'caption':
      return <CaptionSequence sequence={sequence} style={baseStyles} />;
      
    default:
      return null;
  }
}

/**
 * Text Sequence Component
 */
function TextSequence({ 
  sequence, 
  style 
}: { 
  sequence: AITrackItem; 
  style: React.CSSProperties;
}) {
  const { text = 'Sample Text' } = sequence.details;
  
  return (
    <AbsoluteFill style={style}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '48px',
          fontWeight: 'bold',
          color: '#FFFFFF',
          textAlign: 'center',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          padding: '40px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

/**
 * Image Sequence Component
 */
function ImageSequence({ 
  sequence, 
  style 
}: { 
  sequence: AITrackItem; 
  style: React.CSSProperties;
}) {
  const { src } = sequence.details;
  
  if (!src) {
    return (
      <AbsoluteFill style={style}>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            border: '2px dashed #555',
            color: '#888',
            fontSize: '24px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          No Image
        </div>
      </AbsoluteFill>
    );
  }
  
  return (
    <AbsoluteFill style={style}>
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * Audio Sequence Component
 */
function AudioSequence({ 
  sequence 
}: { 
  sequence: AITrackItem;
}) {
  const { src, volume = 1 } = sequence.details;
  
  if (!src) return null;
  
  return (
    <Audio
      src={src}
      volume={volume}
      startFrom={0}
    />
  );
}

/**
 * Video Sequence Component
 */
function VideoSequence({ 
  sequence, 
  style 
}: { 
  sequence: AITrackItem; 
  style: React.CSSProperties;
}) {
  const { src } = sequence.details;
  
  if (!src) {
    return (
      <AbsoluteFill style={style}>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            border: '2px dashed #555',
            color: '#888',
            fontSize: '24px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          No Video
        </div>
      </AbsoluteFill>
    );
  }
  
  // For now, treat video like image until we implement proper video support
  return <ImageSequence sequence={sequence} style={style} />;
}

/**
 * AI Generated Sequence Component
 * Special handling for AI-generated content with metadata
 */
function AIGeneratedSequence({ 
  sequence, 
  style 
}: { 
  sequence: AITrackItem; 
  style: React.CSSProperties;
}) {
  const { ai_metadata } = sequence;
  
  // Render based on the actual content type but with AI indicators
  const baseSequence = { ...sequence, type: sequence.details.text ? 'text' : sequence.details.src ? 'image' : 'text' } as AITrackItem;
  
  return (
    <AbsoluteFill style={style}>
      {/* Render the actual content */}
      <AISequenceItem 
        sequence={baseSequence}
        currentFrame={0} // Not used in this context
        fps={30}
      />
      
      {/* AI indicator overlay (subtle) */}
      {ai_metadata && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(59, 130, 246, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'Inter, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ✨ AI Generated
        </div>
      )}
    </AbsoluteFill>
  );
}

/**
 * Caption Sequence Component
 * Follows React Video Editor pattern - captions are rendered using currentFrame from useCurrentFrame()
 */
function CaptionSequence({ 
  sequence, 
  style 
}: { 
  sequence: AITrackItem; 
  style: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { caption_metadata, details } = sequence;
  
  // Check if we have segments (unified format)
  if (!caption_metadata?.segments) {
    return <AbsoluteFill />;
  }
  
  // Use absolute timeline position for unified track
  const currentTimeMs = (frame * 1000) / fps;
  
  // Find current caption segment based on timeline position  
  const currentSegment = caption_metadata.segments?.find((segment: any) => 
    currentTimeMs >= segment.start && currentTimeMs < segment.end
  );
  
  // If no current segment, don't show anything
  if (!currentSegment) {
    return <AbsoluteFill />;
  }
  
  // Find currently active words in current segment
  const activeWords = currentSegment.words.filter((word: any) => 
    currentTimeMs >= word.start && currentTimeMs < word.end
  );
  
  // Only log occasionally to avoid spam
  if (frame % 30 === 0) {
    console.log('Caption Debug:', {
      frame,
      currentTimeMs,
      activeWords: activeWords.length,
      currentSegment: currentSegment ? {
        text: currentSegment.text,
        start: currentSegment.start,
        end: currentSegment.end,
        wordCount: currentSegment.words.length
      } : null
    });
  }
  
  // Render text with word-level highlighting for current segment
  const renderText = () => {
    return currentSegment.words.map((wordData: any, index: number) => {
      const isActive = currentTimeMs >= wordData.start && currentTimeMs < wordData.end;
      const hasAppeared = currentTimeMs >= wordData.end;
      
      let color = details.color || '#DADADA';
      if (isActive) {
        color = details.activeColor || '#50FF12';
      } else if (hasAppeared) {
        color = details.appearedColor || '#FFFFFF';
      }
      
      const backgroundColor = isActive ? (details.activeFillColor || 'transparent') : 'transparent';
      
      return (
        <span
          key={`${wordData.word}-${index}`}
          style={{
            color,
            backgroundColor,
            padding: isActive ? '4px 6px' : '0',
            borderRadius: isActive ? '6px' : '0',
            marginRight: '8px'
          }}
        >
          {wordData.word}
        </span>
      );
    });
  };
  
  return (
    <AbsoluteFill>
      {/* Debug: Always visible test */}
      <div style={{
        position: 'absolute',
        top: 50,
        left: 50,
        backgroundColor: 'rgba(255, 0, 0, 0.9)',
        color: 'white',
        padding: '20px',
        fontSize: '24px',
        zIndex: 9999
      }}>
        CAPTION TEST - Active: {activeWords.length}
      </div>
      
      {/* Caption text */}
      <div
        style={{
          position: 'absolute',
          top: '80%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          fontSize: '48px',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          border: '2px solid #FFFFFF',
          padding: '20px',
          fontWeight: 'bold',
          lineHeight: 1.2,
          color: '#FFFFFF',
          zIndex: 1000
        }}
      >
        {renderText()}
      </div>
      
    </AbsoluteFill>
  );
}