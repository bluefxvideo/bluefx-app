import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  getInputProps,
} from 'remotion';

/**
 * Ken Burns direction presets mapped from Gemini camera_motion analysis.
 * Each returns a CSS transform string based on segment progress (0 → 1).
 */
function getKenBurnsTransform(direction, progress, scale = 1.08) {
  // Eased progress for smooth motion
  const t = Easing.out(Easing.ease)(progress);

  switch (direction) {
    case 'zoom_in':
      return `scale(${1 + (scale - 1) * t})`;
    case 'zoom_out':
      return `scale(${scale - (scale - 1) * t})`;
    case 'pan_left': {
      const x = interpolate(t, [0, 1], [3, -3]);
      return `scale(${scale}) translateX(${x}%)`;
    }
    case 'pan_right': {
      const x = interpolate(t, [0, 1], [-3, 3]);
      return `scale(${scale}) translateX(${x}%)`;
    }
    case 'pan_up': {
      const y = interpolate(t, [0, 1], [3, -3]);
      return `scale(${scale}) translateY(${y}%)`;
    }
    case 'pan_down': {
      const y = interpolate(t, [0, 1], [-3, 3]);
      return `scale(${scale}) translateY(${y}%)`;
    }
    case 'orbit_left': {
      const x = interpolate(t, [0, 1], [2, -2]);
      const s = interpolate(t, [0, 1], [1, scale * 0.98]);
      return `scale(${s}) translateX(${x}%)`;
    }
    case 'orbit_right': {
      const x = interpolate(t, [0, 1], [-2, 2]);
      const s = interpolate(t, [0, 1], [1, scale * 0.98]);
      return `scale(${s}) translateX(${x}%)`;
    }
    default:
      // Subtle zoom in as fallback
      return `scale(${1 + (scale - 1) * 0.5 * t})`;
  }
}

export const ReelEstateVideo = () => {
  const inputProps = getInputProps();

  const {
    photos = {},
    segments = [],
    audioUrl = '',
    backgroundMusic = null,
    introText = null,
    listing = null,
    totalDuration = 10,
    aspectRatio = '16:9',
  } = inputProps;

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentTime = frame / fps;

  // Find the current segment based on time
  const currentSegmentIndex = segments.findIndex(
    (segment) => currentTime >= segment.startTime && currentTime < segment.endTime
  );
  const currentSegment = currentSegmentIndex >= 0 ? segments[currentSegmentIndex] : null;

  // Also find next segment for crossfade (optional future use)
  const nextSegmentIndex = currentSegmentIndex + 1 < segments.length ? currentSegmentIndex + 1 : -1;

  // Calculate segment progress (0 → 1)
  const segmentProgress = currentSegment
    ? Math.min(1, Math.max(0, (currentTime - currentSegment.startTime) / currentSegment.duration))
    : 0;

  // Ken Burns transform for current segment
  const kenBurnsTransform = currentSegment
    ? getKenBurnsTransform(currentSegment.kenBurns || 'zoom_in', segmentProgress)
    : 'scale(1)';

  // Listing info overlay — visible during first segment, fades out
  const firstSegmentEnd = segments.length > 0 ? segments[0].endTime : 3;
  // Ensure overlay timing values are strictly monotonically increasing
  const fadeIn = Math.min(0.5, firstSegmentEnd * 0.3);
  const fadeOutStart = Math.max(fadeIn + 0.01, firstSegmentEnd - 0.8);
  const fadeOutEnd = Math.max(fadeOutStart + 0.01, firstSegmentEnd);
  const listingOverlayOpacity = (listing || introText)
    ? interpolate(
        currentTime,
        [0, fadeIn, fadeOutStart, fadeOutEnd],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0;

  // Listing info scale spring
  const listingScale = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 100 },
    durationInFrames: 20,
  });

  // Segment counter pill
  const counterOpacity = interpolate(
    currentTime,
    [0.3, 0.8],
    [0, 0.6],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Determine font sizes based on aspect ratio
  const isPortrait = aspectRatio === '9:16';
  const addressFontSize = isPortrait ? 28 : 36;
  const priceFontSize = isPortrait ? 42 : 52;
  const detailsFontSize = isPortrait ? 18 : 22;
  const counterFontSize = isPortrait ? 12 : 14;

  // Photo for current segment
  const currentPhotoUrl = currentSegment ? photos[currentSegmentIndex] : null;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Background Media: video clip (animated) or photo (Ken Burns) */}
      {currentPhotoUrl && (
        <AbsoluteFill key={`media-${currentSegmentIndex}`}>
          {currentPhotoUrl.includes('.mp4') || currentPhotoUrl.includes('.webm') ? (
            <OffthreadVideo
              src={currentPhotoUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <Img
              src={currentPhotoUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: kenBurnsTransform,
                transformOrigin: 'center center',
              }}
            />
          )}
        </AbsoluteFill>
      )}

      {/* Voiceover Audio */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* Background Music */}
      {backgroundMusic?.url && (
        <Audio
          src={backgroundMusic.url}
          volume={backgroundMusic.volume || 0.3}
          startFrom={0}
          loop
        />
      )}

      {/* Listing Info Overlay — first segment (uses introText if provided, falls back to listing data) */}
      {(listing || introText) && listingOverlayOpacity > 0.01 && (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: isPortrait ? 'flex-end' : 'flex-end',
            justifyContent: 'center',
            paddingBottom: isPortrait ? '20%' : '10%',
            opacity: listingOverlayOpacity,
          }}
        >
          <div
            style={{
              transform: `scale(${listingScale})`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '24px 40px',
              borderRadius: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              maxWidth: '85%',
            }}
          >
            {/* Price */}
            {listing.price && (
              <div
                style={{
                  color: '#4ade80',
                  fontSize: priceFontSize,
                  fontWeight: 'bold',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  letterSpacing: '-0.02em',
                }}
              >
                {listing.price}
              </div>
            )}

            {/* Address or custom intro text */}
            {(introText || listing?.address) && (
              <div
                style={{
                  color: 'white',
                  fontSize: addressFontSize,
                  fontWeight: '600',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {introText || listing.address}
              </div>
            )}

            {/* Details: beds / baths / sqft */}
            {(listing.beds || listing.baths || listing.sqft) && (
              <div
                style={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: detailsFontSize,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  display: 'flex',
                  gap: '16px',
                  marginTop: '4px',
                }}
              >
                {listing.beds && <span>{listing.beds} bed</span>}
                {listing.baths && <span>{listing.baths} bath</span>}
                {listing.sqft && <span>{listing.sqft.toLocaleString()} sqft</span>}
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* Segment counter pill (top-right) */}
      {currentSegmentIndex >= 0 && (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            padding: '20px',
            opacity: counterOpacity,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              color: 'white',
              fontSize: counterFontSize,
              padding: '5px 12px',
              borderRadius: '20px',
              fontFamily: 'Inter, system-ui, sans-serif',
              backdropFilter: 'blur(8px)',
            }}
          >
            {currentSegmentIndex + 1} / {segments.length}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
