import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Video,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  getInputProps,
  interpolate
} from 'remotion';

/**
 * VideoEditor Composition
 * Renders React Video Editor compositions with all layer types
 */
export const VideoEditor = () => {
  const inputProps = getInputProps();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Destructure props with defaults
  const {
    audioLayers = [],
    imageLayers = [],
    videoLayers = [],
    textLayers = [],
    captionLayers = [],
    composition = {
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 900
    }
  } = inputProps;

  console.log('🎬 VideoEditor render at frame:', frame, {
    audioLayers: audioLayers.length,
    imageLayers: imageLayers.length,
    videoLayers: videoLayers.length,
    textLayers: textLayers.length,
    captionLayers: captionLayers.length
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Audio Layers */}
      {audioLayers.map((audio) => {
        // Skip invalid or test URLs
        if (!audio.src || audio.src.includes('example.com') || audio.src.includes('placeholder')) {
          console.log('⚠️ Skipping invalid audio URL:', audio.src);
          return null;
        }
        
        return (
          <Audio
            key={audio.id}
            src={audio.src}
            startFrom={audio.startFrom || 0}
            endAt={audio.endAt}
            volume={audio.volume}
          />
        );
      }).filter(Boolean)}

      {/* Video Layers */}
      {videoLayers.map((video) => (
        <Sequence
          key={video.id}
          from={video.startFrame}
          durationInFrames={video.durationInFrames}
        >
          <Video
            src={video.src}
            startFrom={video.startFrom || 0}
            endAt={video.endAt}
            volume={video.volume}
            style={video.style}
          />
        </Sequence>
      ))}

      {/* Image Layers */}
      {imageLayers.map((image) => (
        <Sequence
          key={image.id}
          from={image.startFrame}
          durationInFrames={image.durationInFrames}
        >
          <Img
            src={image.src}
            style={image.style}
          />
        </Sequence>
      ))}

      {/* Text Layers */}
      {textLayers.map((text) => (
        <Sequence
          key={text.id}
          from={text.startFrame}
          durationInFrames={text.durationInFrames}
        >
          <div style={{
            ...text.style,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            display: 'flex',
            alignItems: text.style.textAlign === 'center' ? 'center' : 'flex-start',
            justifyContent: text.style.textAlign === 'center' ? 'center' : 
                           text.style.textAlign === 'right' ? 'flex-end' : 'flex-start'
          }}>
            {text.text}
          </div>
        </Sequence>
      ))}

      {/* Caption Layers with Word Highlighting */}
      {captionLayers.map((caption) => (
        <CaptionRenderer
          key={caption.id}
          caption={caption}
          frame={frame}
          fps={fps}
        />
      ))}

      {/* Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          color: 'white',
          fontSize: 14,
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: '4px 8px',
          borderRadius: 4,
          fontFamily: 'monospace'
        }}>
          Frame: {frame} | Layers: A{audioLayers.length} I{imageLayers.length} V{videoLayers.length} T{textLayers.length} C{captionLayers.length}
        </div>
      )}
    </AbsoluteFill>
  );
};

/**
 * Caption Renderer with Word-Level Highlighting
 * Handles timed captions with word-by-word highlighting
 */
const CaptionRenderer = ({ caption, frame, fps }) => {
  // Calculate current time in milliseconds
  const currentTimeMs = (frame * 1000) / fps;
  
  // Find the active segment based on current time
  const activeSegment = caption.segments.find(segment => 
    currentTimeMs >= segment.start && currentTimeMs < segment.end
  );

  // If no active segment, don't render anything
  if (!activeSegment) {
    return null;
  }

  // Render the segment within the caption timeframe
  const segmentStartFrame = Math.round((activeSegment.start / 1000) * fps);
  const segmentEndFrame = Math.round((activeSegment.end / 1000) * fps);
  
  return (
    <Sequence
      from={segmentStartFrame}
      durationInFrames={segmentEndFrame - segmentStartFrame}
    >
      <WordHighlightText
        segment={activeSegment}
        style={caption.style}
        currentTimeMs={currentTimeMs}
      />
    </Sequence>
  );
};

/**
 * Word Highlight Text Component
 * Renders text with word-by-word highlighting based on timing
 */
const WordHighlightText = ({ segment, style, currentTimeMs }) => {
  // If no words array, just show the text
  if (!segment.words || segment.words.length === 0) {
    return (
      <div style={style}>
        {segment.text}
      </div>
    );
  }

  // Render each word with appropriate styling
  return (
    <div style={{
      ...style,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.2em',
      alignItems: 'center',
      justifyContent: style.textAlign === 'center' ? 'center' : 
                     style.textAlign === 'right' ? 'flex-end' : 'flex-start'
    }}>
      {segment.words.map((wordData, index) => {
        // Determine word state based on current time
        let wordColor = style.color || '#E0E0E0'; // Default color
        
        if (currentTimeMs >= wordData.end) {
          // Word has been spoken (appeared)
          wordColor = style.appearedColor || '#FFFFFF';
        } else if (currentTimeMs >= wordData.start && currentTimeMs < wordData.end) {
          // Word is currently being spoken (active)
          wordColor = style.activeColor || '#00FF88';
        }

        return (
          <span
            key={`${wordData.word}-${index}`}
            style={{
              color: wordColor,
              fontSize: style.fontSize,
              fontFamily: style.fontFamily,
              fontWeight: style.fontWeight || 'normal',
              transition: 'color 0.1s ease-in-out',
              textShadow: style.textShadow || '2px 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            {wordData.word}
          </span>
        );
      })}
    </div>
  );
};

// Default export for registration
export default VideoEditor;