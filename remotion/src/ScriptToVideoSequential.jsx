import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  getInputProps,
} from "remotion";

/**
 * Frame-Based ScriptToVideo Composition - Professional Implementation
 * Architecture: Audio-first, frame-based, single source of truth
 * Matches our studio implementation exactly
 */
export const ScriptToVideoSequential = () => {
  const inputProps = getInputProps();
  const {
    headline,
    segments,
    audioUrl,
    backgroundMusic,
    captionSettings = {},
    kenBurnsEffect = {},
    metadata = {},
  } = inputProps;

  const { fps, durationInFrames } = useVideoConfig();
  const globalFrame = useCurrentFrame();

  // Professional caption settings matching studio exactly
  const defaultCaptionSettings = {
    enabled: true,
    position: "bottom",
    highlightColor: "#facc15",
    fontSize: 24,
    fontFamily: "Inter, system-ui, sans-serif",
    fontWeight: "bold",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    ...captionSettings,
  };

  // Ken Burns effect settings
  const defaultKenBurnsEffect = {
    enabled: true,
    zoomScale: 1.1,
    duration: "segment",
    ...kenBurnsEffect,
  };

  console.log("[Remotion] Professional frame-based render:", {
    segments: segments?.length || 0,
    totalFrames: durationInFrames,
    fps,
    timingSource: metadata?.timingSource || "unknown",
    architecture: metadata?.architecture || "legacy",
    hasAudio: !!audioUrl,
    hasBackgroundMusic: !!backgroundMusic,
    backgroundMusicVolume: backgroundMusic?.volume,
    hasWordTimings: segments?.some((s) => s.wordFrameTimings?.length > 0),
    captionSettings: defaultCaptionSettings,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Voice Audio - plays throughout entire composition (audio-first architecture) */}
      {audioUrl && <Audio src={audioUrl} volume={1} startFrom={0} />}

      {/* Background Music - adaptive volume and looping */}
      {backgroundMusic?.url && (
        <Audio
          src={backgroundMusic.url}
          volume={backgroundMusic.volume || 0.15}
          startFrom={0}
          loop={backgroundMusic.adaptationType === "loop"}
          endAt={
            backgroundMusic.adaptationType === "trim"
              ? durationInFrames
              : undefined
          }
        />
      )}

      {/* Frame-based sequences using composition props timing */}
      {segments?.map((segment, index) => (
        <Sequence
          key={index}
          from={segment.startFrame || 0}
          durationInFrames={segment.durationInFrames || Math.ceil(3 * fps)}
        >
          <FrameBasedSegment
            segment={segment}
            imageUrl={segment.imageUrl}
            captionSettings={defaultCaptionSettings}
            kenBurnsEffect={defaultKenBurnsEffect}
            segmentIndex={index}
            totalSegments={segments.length}
            globalFrame={globalFrame}
            fps={fps}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/**
 * Frame-Based Segment Component - Professional Implementation
 * Uses frame timing for perfect synchronization
 */
const FrameBasedSegment = ({
  segment,
  imageUrl,
  captionSettings,
  kenBurnsEffect,
  segmentIndex,
  totalSegments,
  globalFrame,
  fps,
}) => {
  const localFrame = useCurrentFrame();
  const { height } = useVideoConfig(); // Get video height for responsive sizing
  const segmentDuration = segment.durationInFrames || Math.ceil(3 * fps);

  // Responsive font size based on video height (LARGER for 50+ audience)
  const getResponsiveFontSize = () => {
    const baseFontSize = captionSettings.fontSize || 56; // Increased from 24 to 56 for 50+ audience
    // Scale font size based on video height (base: 1080p)
    const scale = height / 1080;
    const responsiveFontSize = Math.max(baseFontSize * scale, 32); // Increased minimum from 18 to 32px

    // Debug logging (only log once per segment)
    if (localFrame === 0) {
      console.log(
        `[Remotion] Caption sizing (50+ audience) - Segment ${segmentIndex}:`,
        {
          baseFontSize,
          videoHeight: height,
          scale: scale.toFixed(2),
          responsiveFontSize: responsiveFontSize.toFixed(1),
          position: captionSettings.position,
          fontFamily: captionSettings.fontFamily,
          fontWeight: captionSettings.fontWeight,
        }
      );
    }

    return responsiveFontSize;
  };

  // Ken Burns effect with smooth interpolation
  const kenBurnsScale = kenBurnsEffect.enabled
    ? interpolate(
        localFrame,
        [0, segmentDuration],
        [1, kenBurnsEffect.zoomScale],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.quad),
        }
      )
    : 1;

  // Frame-based word highlighting (FIXED: use absolute frame timing)
  const getCurrentWordHighlighting = () => {
    if (!segment.wordFrameTimings || segment.wordFrameTimings.length === 0) {
      return segment.text ? [{ word: segment.text, isHighlighted: false, hasAppeared: false }] : [];
    }

    // CRITICAL FIX: Use absolute frame position (startFrame + localFrame)
    const absoluteFrame = segment.startFrame + localFrame;

    return segment.wordFrameTimings.map((wordTiming) => {
      const isCurrentlyHighlighted = 
        absoluteFrame >= wordTiming.startFrame &&
        absoluteFrame < wordTiming.endFrame;
      const hasAlreadyAppeared = absoluteFrame >= wordTiming.endFrame;
      
      return {
        word: wordTiming.word,
        isHighlighted: isCurrentlyHighlighted,
        hasAppeared: hasAlreadyAppeared
      };
    });
  };

  const wordHighlighting = getCurrentWordHighlighting();

  // Caption position matching studio exactly (FIXED: TikTok-style positioning with margin)
  const getCaptionFlexPosition = () => {
    const position = captionSettings.position;

    switch (position) {
      case "top":
        return { justifyContent: "flex-start" };
      case "center":
        return { justifyContent: "center" };
      case "bottom":
      default:
        return { justifyContent: "flex-end" };
    }
  };

  // Get margin for caption content (separate from flex positioning)
  const getCaptionMargin = () => {
    const position = captionSettings.position;

    // Calculate responsive spacing (TikTok-style: ~15-20% from bottom)
    const getSpacing = () => {
      const videoHeight = height;
      // Use 18% of video height for spacing (TikTok-style)
      const responsiveSpacing = Math.round(videoHeight * 0.18);
      // Ensure minimum spacing for very small videos
      return Math.max(responsiveSpacing, 100);
    };

    // Debug logging (only log once per segment)
    if (localFrame === 0) {
      console.log(`[Remotion] Caption margin - Segment ${segmentIndex}:`, {
        position: position,
        videoHeight: height,
        spacing: getSpacing(),
      });
    }

    switch (position) {
      case "top":
        return { marginTop: Math.round(height * 0.08) }; // 8% from top
      case "center":
        return { marginTop: 0, marginBottom: 0 };
      case "bottom":
      default:
        return { marginBottom: getSpacing() }; // TikTok-style: 18% from bottom
    }
  };

  return (
    <AbsoluteFill>
      {/* Background Image with Ken Burns Effect */}
      {imageUrl && (
        <AbsoluteFill>
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${kenBurnsScale})`,
              transformOrigin: "center center",
            }}
          />
          {/* Dark overlay matching studio */}
          <AbsoluteFill style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }} />
        </AbsoluteFill>
      )}

      {/* Frame-Based Captions with Word Highlighting */}
      {captionSettings.enabled && wordHighlighting.length > 0 && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            ...getCaptionFlexPosition(),
            paddingLeft: 16, // Horizontal padding set individually
            paddingRight: 16, // Horizontal padding set individually
            zIndex: 20,
          }}
        >
          <div
            style={{
              backgroundColor: captionSettings.backgroundColor,
              borderRadius: 8,
              padding: "12px 20px", // Increased from 8px 16px for better readability
              maxWidth: "90%",
              backdropFilter: "blur(10px)",
              alignSelf: "center", // Center horizontally within the flex container
              ...getCaptionMargin(),
            }}
          >
            <div
              style={{
                display: "block", // Changed from flex to block for proper text flow
                textAlign: "center",
                fontFamily: captionSettings.fontFamily,
                fontSize: getResponsiveFontSize(),
                fontWeight: captionSettings.fontWeight,
                lineHeight: 1.4, // Increased from 1.3 for better readability with larger fonts
                whiteSpace: "pre", // Use 'pre' not 'pre-wrap' for proper space preservation
                wordSpacing: "0.6em", // Word spacing for additional space between words
                // Add transform for better rendering stability
                transform: "translateZ(0)",
                backfaceVisibility: "hidden",
                // Force font smoothing
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale",
              }}
            >
              {wordHighlighting.map((wordState, index) => {
                // Three-state coloring like the editor
                let wordColor;
                if (wordState.hasAppeared) {
                  // Word has been spoken - white
                  wordColor = "white";
                } else if (wordState.isHighlighted) {
                  // Word is currently being spoken - highlight color (yellow)
                  wordColor = captionSettings.highlightColor;
                } else {
                  // Word hasn't been spoken yet - light gray
                  wordColor = "#E0E0E0";
                }
                
                // For the last word, don't add a space after
                const isLastWord = index === wordHighlighting.length - 1;
                
                return (
                  <span
                    key={index}
                    style={{
                      display: "inline-block", // Required for proper whitespace measurement
                      color: wordColor,
                      // More explicit text shadow with fallback
                      textShadow: "0 0 8px rgba(0,0,0,1), 2px 2px 4px rgba(0,0,0,0.9), 1px 1px 2px rgba(0,0,0,0.8)",
                      fontWeight: wordState.isHighlighted
                        ? "bold"
                        : captionSettings.fontWeight,
                      // Remove transition for rendering stability
                      // transition: "color 0.15s ease", 
                      WebkitFontSmoothing: "antialiased", // Better text rendering
                      MozOsxFontSmoothing: "grayscale",
                      // Add transform for better rendering
                      transform: "perspective(100px) translateZ(0)",
                      willChange: "transform",
                      // Explicit margin for word spacing
                      marginRight: !isLastWord ? "0.5em" : "0",
                      // Ensure text is rendered properly
                      backfaceVisibility: "hidden",
                    }}
                  >
                    {wordState.word}
                  </span>
                );
              })}
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export default ScriptToVideoSequential;
