import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  getInputProps,
} from 'remotion';

export const ScriptToVideo = () => {
  const inputProps = getInputProps();
  
  // Destructure props with defaults
  const {
    headline = 'Default Video Title',
    segments = [
      {
        text: 'This is a default segment',
        startTime: 0,
        endTime: 3,
        duration: 3,
        wordTimings: [],
      },
    ],
    imageUrls = { 0: 'https://via.placeholder.com/720x1280/3B82F6/ffffff?text=Default+Image' },
    audioUrl = '',
    totalDuration = 3,
    aspectRatio = '9:16',
    dimensions = { width: 720, height: 1280 },
    captionSettings = {
      enabled: true,
      position: 'bottom',
      highlightColor: '#facc15',
      fontSize: 18,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      fontWeight: 'bold',
    },
    kenBurnsEffect = {
      enabled: true,
      zoomScale: 1.05,
      duration: 'segment',
    },
  } = inputProps;

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Find the current segment based on time
  const currentSegment = segments.find(
    (segment) => currentTime >= segment.startTime && currentTime < segment.endTime
  );

  // Get the current segment index
  const currentSegmentIndex = segments.findIndex(
    (segment) => currentTime >= segment.startTime && currentTime < segment.endTime
  );

  // Calculate Ken Burns effect scale
  const getKenBurnsScale = () => {
    if (!kenBurnsEffect.enabled || !currentSegment) return 1;
    
    const segmentProgress = 
      (currentTime - currentSegment.startTime) / currentSegment.duration;
    
    return interpolate(
      segmentProgress,
      [0, 1],
      [1, kenBurnsEffect.zoomScale],
      {
        easing: Easing.out(Easing.ease),
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }
    );
  };

  // Get caption position styles
  const getCaptionPositionStyles = () => {
    const baseStyles = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      width: '100%',
    };

    switch (captionSettings.position) {
      case 'top':
        return {
          ...baseStyles,
          alignItems: 'flex-start',
          paddingTop: '40px',
        };
      case 'center':
        return {
          ...baseStyles,
          alignItems: 'center',
        };
      case 'bottom':
      default:
        return {
          ...baseStyles,
          alignItems: 'flex-end',
          paddingBottom: '40px',
        };
    }
  };

  // Render word-by-word highlighted text
  const renderHighlightedText = () => {
    if (!currentSegment) return null;

    // If we have word timings, render with highlighting
    if (currentSegment.wordTimings && currentSegment.wordTimings.length > 0) {
      return (
        <span>
          {currentSegment.wordTimings.map((wordTiming, index) => {
            const isHighlighted = 
              currentTime >= wordTiming.startTime && 
              currentTime < wordTiming.endTime;
            
            return (
              <span
                key={index}
                style={{
                  color: isHighlighted ? captionSettings.highlightColor : 'white',
                  transition: 'color 0.1s ease',
                }}
              >
                {wordTiming.word}
                {index < currentSegment.wordTimings.length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </span>
      );
    }

    // Fallback to regular text
    return <span>{currentSegment.text}</span>;
  };

  // Calculate headline animation
  const headlineOpacity = interpolate(
    currentTime,
    [0, 0.5, 1.5, 2],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const headlineScale = spring({
    frame: frame,
    fps,
    config: {
      damping: 200,
    },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Background Image with Ken Burns Effect */}
      {currentSegmentIndex >= 0 && imageUrls[currentSegmentIndex] && (
        <AbsoluteFill>
          <Img
            src={imageUrls[currentSegmentIndex]}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${getKenBurnsScale()})`,
              transformOrigin: 'center center',
            }}
          />
          {/* Dark overlay for better text readability */}
          <AbsoluteFill
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
            }}
          />
        </AbsoluteFill>
      )}

      {/* Audio Track */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* Headline (first 2 seconds) */}
      {headline && currentTime < 2 && (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            opacity: headlineOpacity,
          }}
        >
          <div
            style={{
              color: 'white',
              fontSize: captionSettings.fontSize * 1.5,
              fontWeight: 'bold',
              textAlign: 'center',
              padding: '30px',
              maxWidth: '90%',
              lineHeight: 1.2,
              transform: `scale(${headlineScale})`,
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            }}
          >
            {headline}
          </div>
        </AbsoluteFill>
      )}

      {/* Captions */}
      {captionSettings.enabled && currentSegment && currentTime >= 2 && (
        <AbsoluteFill style={getCaptionPositionStyles()}>
          <div
            style={{
              backgroundColor: captionSettings.backgroundColor,
              color: 'white',
              fontSize: captionSettings.fontSize,
              fontWeight: captionSettings.fontWeight,
              padding: '15px 25px',
              borderRadius: '8px',
              textAlign: 'center',
              maxWidth: '90%',
              lineHeight: 1.4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {renderHighlightedText()}
          </div>
        </AbsoluteFill>
      )}

      {/* Segment transition indicator (optional) */}
      {currentSegmentIndex >= 0 && (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              fontSize: '12px',
              padding: '5px 10px',
              borderRadius: '15px',
              backdropFilter: 'blur(10px)',
            }}
          >
            {currentSegmentIndex + 1} / {segments.length}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}; 