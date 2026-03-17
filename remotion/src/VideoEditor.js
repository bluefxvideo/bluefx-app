import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
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
          <Sequence
            key={audio.id}
            from={audio.startFrame}
            durationInFrames={audio.durationInFrames}
          >
            <Audio
              src={audio.src}
              startFrom={audio.startFrom || 0}
              endAt={audio.endAt}
              volume={audio.volume}
            />
          </Sequence>
        );
      }).filter(Boolean)}

      {/* Image Layers — with crossfade between adjacent images */}
      {(() => {
        const CROSSFADE_FRAMES = 15; // ~0.5s at 30fps
        const sorted = [...imageLayers].sort((a, b) => a.startFrame - b.startFrame);

        return sorted.map((image, index) => {
          const nextImage = sorted[index + 1];
          const prevImage = index > 0 ? sorted[index - 1] : null;

          // Adjacent = this image's end meets the next image's start (±2 frames tolerance)
          const adjacentToNext = nextImage &&
            Math.abs((image.startFrame + image.durationInFrames) - nextImage.startFrame) <= 2;
          const adjacentToPrev = prevImage &&
            Math.abs((prevImage.startFrame + prevImage.durationInFrames) - image.startFrame) <= 2;

          // Extend outgoing image so it stays visible during the crossfade overlap
          const duration = adjacentToNext
            ? image.durationInFrames + CROSSFADE_FRAMES
            : image.durationInFrames;

          return (
            <Sequence
              key={image.id}
              from={image.startFrame}
              durationInFrames={duration}
            >
              <CrossfadeImage
                image={image}
                fadeInFrames={adjacentToPrev ? CROSSFADE_FRAMES : 0}
              />
            </Sequence>
          );
        });
      })()}

      {/* Video Layers — rendered after images so they appear on top */}
      {videoLayers.map((video) => (
        <Sequence
          key={video.id}
          from={video.startFrame}
          durationInFrames={video.durationInFrames}
        >
          <VideoWithKenBurns video={video} />
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
 * Dark background pill, bold text, word-by-word yellow highlight
 */
const WordHighlightText = ({ segment, style, currentTimeMs }) => {
  const fontSize = style.fontSize || 80;

  // Container: positioned at bottom center with dark pill background
  const containerStyle = {
    position: 'absolute',
    bottom: '10%',
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: '90%',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: `${fontSize * 0.2}px ${fontSize * 0.5}px`,
    borderRadius: `${fontSize * 0.2}px`,
    display: 'inline-block',
  };

  // Shared text styles
  const textStyle = {
    fontSize,
    fontFamily: style.fontFamily || 'Inter, sans-serif',
    fontWeight: '800',
    letterSpacing: '0.02em',
    wordSpacing: '0.08em',
    lineHeight: 1.3,
    textShadow: 'none',
    WebkitFontSmoothing: 'antialiased',
  };

  // If no words array, just show the text
  if (!segment.words || segment.words.length === 0) {
    return (
      <div style={{
        ...containerStyle,
        ...textStyle,
        color: style.color || '#FFFFFF',
      }}>
        {segment.text}
      </div>
    );
  }

  // Render with word-level highlighting
  return (
    <div style={containerStyle}>
      {segment.words.map((wordData, index) => {
        let wordColor = style.color || '#FFFFFF';

        if (currentTimeMs >= wordData.end) {
          wordColor = style.appearedColor || '#FFFFFF';
        } else if (currentTimeMs >= wordData.start && currentTimeMs < wordData.end) {
          wordColor = style.activeColor || '#FACC15';
        }

        return (
          <span
            key={`${wordData.word}-${index}`}
            style={{
              ...textStyle,
              color: wordColor,
            }}
          >
            {wordData.word}
            {index < segment.words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );
};

/**
 * Crossfade wrapper — fades an image in over the first N frames
 */
const CrossfadeImage = ({ image, fadeInFrames }) => {
  const frame = useCurrentFrame();

  let opacity = 1;
  if (fadeInFrames > 0 && frame < fadeInFrames) {
    opacity = interpolate(frame, [0, fadeInFrames], [0, 1], {
      extrapolateRight: 'clamp',
      easing: Easing.ease,
    });
  }

  return (
    <AbsoluteFill style={{ opacity }}>
      <ImageWithKenBurns image={image} />
    </AbsoluteFill>
  );
};

/**
 * Image Component with Ken Burns Effect
 */
const ImageWithKenBurns = ({ image }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate Ken Burns transform if effect is enabled
  const hasKenBurns = image.kenBurns && image.kenBurns.preset !== 'none';
  const kenBurnsTransform = hasKenBurns
    ? calculateKenBurnsTransform(frame, image.durationInFrames, image.kenBurns, true)
    : { transform: 'none' };

  // Wrapper clips any overflow from pan/zoom, inner element gets the transform
  const wrapperStyle = {
    ...image.style,
    overflow: 'hidden',
  };

  const imgStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    ...(hasKenBurns && {
      transform: kenBurnsTransform.transform,
      transformOrigin: 'center center',
    }),
  };

  return (
    <div style={wrapperStyle}>
      <Img src={image.src} style={imgStyle} />
    </div>
  );
};

/**
 * Video Component with Ken Burns Effect
 */
const VideoWithKenBurns = ({ video }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate Ken Burns transform if effect is enabled
  const hasKenBurns = video.kenBurns && video.kenBurns.preset !== 'none';
  const kenBurnsTransform = hasKenBurns
    ? calculateKenBurnsTransform(frame, video.durationInFrames, video.kenBurns, true)
    : { transform: 'none' };

  const wrapperStyle = {
    ...video.style,
    overflow: 'hidden',
  };

  const videoStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    ...(hasKenBurns && {
      transform: kenBurnsTransform.transform,
      transformOrigin: 'center center',
    }),
  };

  return (
    <div style={wrapperStyle}>
      <OffthreadVideo
        src={video.src}
        startFrom={video.startFrom || 0}
        endAt={video.endAt}
        volume={video.volume}
        style={videoStyle}
      />
    </div>
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
  
  // Base scale for pan effects — ensures image covers the frame during pan
  const panBaseScale = 1 + intensityFactor + 0.05;

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
      scale = panBaseScale;
      translateX = interpolate(
        progressFrame,
        [0, durationInFrames],
        [0, -intensity * speed],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;

    case 'pan-right':
      scale = panBaseScale;
      translateX = interpolate(
        progressFrame,
        [0, durationInFrames],
        [0, intensity * speed],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;

    case 'pan-up':
      scale = panBaseScale;
      translateY = interpolate(
        progressFrame,
        [0, durationInFrames],
        [0, -intensity * speed],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;

    case 'pan-down':
      scale = panBaseScale;
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