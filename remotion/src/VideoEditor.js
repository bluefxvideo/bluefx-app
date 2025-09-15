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
  interpolate,
  Easing
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


  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Audio Layers */}
      {audioLayers.map((audio) => {
        // Skip invalid or test URLs
        if (!audio.src || audio.src.includes('example.com') || audio.src.includes('placeholder')) {
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
          <VideoWithKenBurns video={video} />
        </Sequence>
      ))}

      {/* Image Layers */}
      {imageLayers.map((image) => (
        <Sequence
          key={image.id}
          from={image.startFrame}
          durationInFrames={image.durationInFrames}
        >
          <ImageWithKenBurns image={image} />
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
      <div style={{
        position: 'absolute',
        bottom: '10%', // Position from bottom for better centering
        left: '50%',
        transform: 'translateX(-50%) translateZ(0)', // Center horizontally with GPU acceleration
        width: '80%', // Use percentage of video width
        maxWidth: '1200px',
        textAlign: 'center',
        padding: '16px 24px',
        backgroundColor: 'transparent', // No background like in editor
        borderRadius: '8px',
        fontSize: style.fontSize || 48,
        fontFamily: style.fontFamily || 'Inter',
        fontWeight: '900', // Extra bold like in editor
        color: style.color || '#FFFFFF',
        textTransform: 'uppercase', // All caps like in editor
        letterSpacing: '-0.02em', // Tighter letter spacing
        // Enhanced text shadow with stronger outline like in editor
        textShadow: '0 0 15px rgba(0, 0, 0, 1), 0 0 30px rgba(0, 0, 0, 1), 0 0 45px rgba(0, 0, 0, 0.8), 4px 4px 8px rgba(0, 0, 0, 1)',
        WebkitTextStroke: '4px black', // Black outline like in editor
        paintOrder: 'stroke fill', // Stroke behind fill
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        backfaceVisibility: 'hidden',
        willChange: 'transform'
      }}>
        {segment.text}
      </div>
    );
  }

  // Render each word with appropriate styling
  return (
    <div style={{
      position: 'absolute',
      bottom: '10%', // Position from bottom for better centering
      left: '50%',
      transform: 'translateX(-50%) translateZ(0)', // Center horizontally and enable GPU acceleration
      width: '80%', // Use percentage of video width
      maxWidth: '1200px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.6em', // Increased word spacing from 0.3em to 0.6em
      alignItems: 'center',
      justifyContent: 'center', // Always center captions
      textAlign: 'center',
      padding: '0', // No padding like in editor
      backgroundColor: 'transparent', // No background like in editor
      borderRadius: '0', // No border radius
      willChange: 'transform',
      backfaceVisibility: 'hidden'
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
              display: 'inline-block', // Important for proper spacing
              color: wordColor,
              fontSize: style.fontSize || 80, // Larger size like in editor
              fontFamily: style.fontFamily || 'Inter',
              fontWeight: '900', // Extra bold like in editor
              textTransform: 'uppercase', // All caps like in editor
              letterSpacing: '-0.02em', // Tighter letter spacing
              transition: 'color 0.1s ease-in-out',
              // Enhanced text shadow with stronger outline like in editor
              textShadow: '0 0 15px rgba(0, 0, 0, 1), 0 0 30px rgba(0, 0, 0, 1), 0 0 45px rgba(0, 0, 0, 0.8), 4px 4px 8px rgba(0, 0, 0, 1)',
              WebkitTextStroke: '4px black', // Black outline like in editor
              paintOrder: 'stroke fill', // Stroke behind fill
              lineHeight: 1.1,
              transform: 'translateZ(0)', // GPU acceleration for text shadow
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              backfaceVisibility: 'hidden',
              willChange: 'transform'
            }}
          >
            {wordData.word}
          </span>
        );
      })}
    </div>
  );
};

/**
 * Image Component with Ken Burns Effect
 */
const ImageWithKenBurns = ({ image }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Calculate Ken Burns transform if effect is enabled
  // Use the local frame within the sequence for smooth continuous animation
  const kenBurnsTransform = image.kenBurns && image.kenBurns.preset !== 'none' 
    ? calculateKenBurnsTransform(frame, image.durationInFrames, image.kenBurns, true)
    : { transform: 'none' };
  
  // Combine Ken Burns transform with existing style transform
  const finalStyle = {
    ...image.style,
    transform: kenBurnsTransform.transform !== 'none' 
      ? kenBurnsTransform.transform 
      : image.style.transform || 'none'
  };
  
  return <Img src={image.src} style={finalStyle} />;
};

/**
 * Video Component with Ken Burns Effect
 */
const VideoWithKenBurns = ({ video }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Calculate Ken Burns transform if effect is enabled
  // Use the local frame within the sequence for smooth continuous animation
  const kenBurnsTransform = video.kenBurns && video.kenBurns.preset !== 'none'
    ? calculateKenBurnsTransform(frame, video.durationInFrames, video.kenBurns, true)
    : { transform: 'none' };
  
  // Combine Ken Burns transform with existing style transform
  const finalStyle = {
    ...video.style,
    transform: kenBurnsTransform.transform !== 'none'
      ? kenBurnsTransform.transform
      : video.style.transform || 'none'
  };
  
  return (
    <Video
      src={video.src}
      startFrom={video.startFrom || 0}
      endAt={video.endAt}
      volume={video.volume}
      style={finalStyle}
    />
  );
};

/**
 * Calculate Ken Burns transform based on preset and frame
 */
function calculateKenBurnsTransform(frame, durationInFrames, config, continuous = false) {
  const { preset, intensity = 20, smoothness = 'ease-in-out', speed = 1.0 } = config;
  
  // No effect
  if (preset === 'none') {
    return { transform: 'none' };
  }
  
  // Calculate intensity factor (0-100 maps to 0-0.5 for reasonable zoom)
  // Apply speed multiplier to intensity to increase the total zoom/pan amount
  const intensityFactor = (intensity / 200) * speed;
  
  // Use the frame directly for interpolation to ensure full duration animation
  // The speed is now applied to the intensity rather than the frame progression
  let progressFrame = frame;
  
  // Select easing function
  const easingFn = getEasingFunction(smoothness);
  
  // Initialize transform values
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  
  // Apply preset transformations
  switch (preset) {
    case 'zoom-in':
      scale = interpolate(
        progressFrame,
        [0, durationInFrames],
        [1, 1 + intensityFactor],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'zoom-out':
      scale = interpolate(
        progressFrame,
        [0, durationInFrames],
        [1 + intensityFactor, 1],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'pan-left':
      translateX = interpolate(
        progressFrame,
        [0, durationInFrames],
        [0, -intensity * speed],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'pan-right':
      translateX = interpolate(
        progressFrame,
        [0, durationInFrames],
        [0, intensity * speed],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'pan-up':
      translateY = interpolate(
        progressFrame,
        [0, durationInFrames],
        [0, -intensity * speed],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'pan-down':
      translateY = interpolate(
        progressFrame,
        [0, durationInFrames],
        [0, intensity * speed],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'zoom-in-left':
      scale = interpolate(
        progressFrame,
        [0, durationInFrames],
        [1, 1 + intensityFactor],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      translateX = interpolate(
        progressFrame,
        [0, durationInFrames],
        [0, -intensity * speed / 2],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'zoom-in-right':
      scale = interpolate(
        progressFrame,
        [0, durationInFrames],
        [1, 1 + intensityFactor],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      translateX = interpolate(
        progressFrame,
        [0, durationInFrames],
        [0, intensity * speed / 2],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'zoom-out-left':
      scale = interpolate(
        progressFrame,
        [0, durationInFrames],
        [1 + intensityFactor, 1],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      translateX = interpolate(
        progressFrame,
        [0, durationInFrames],
        [intensity * speed / 2, 0],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'zoom-out-right':
      scale = interpolate(
        progressFrame,
        [0, durationInFrames],
        [1 + intensityFactor, 1],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      translateX = interpolate(
        progressFrame,
        [0, durationInFrames],
        [-intensity * speed / 2, 0],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
  }
  
  // Combine into transform string
  const transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
  
  return { transform };
}

/**
 * Get Remotion easing function based on smoothness setting
 */
function getEasingFunction(smoothness) {
  switch (smoothness) {
    case 'linear':
      return Easing.linear;
    case 'ease-in':
      return Easing.in(Easing.cubic);
    case 'ease-out':
      return Easing.out(Easing.cubic);
    case 'ease-in-out':
    default:
      return Easing.inOut(Easing.cubic);
  }
}

// Default export for registration
export default VideoEditor;