'use client';

import { useVideoEditorStore } from '../store/video-editor-store';
import './caption-animations.css';

/**
 * Caption Overlay Component
 * Displays real-time captions over the video player with lip-sync effect
 * Applies typography and color settings from the editor
 */
export function CaptionOverlay() {
  const {
    segments,
    timeline,
    settings
  } = useVideoEditorStore();

  // Find the current active segment based on timeline position
  const getCurrentSegment = () => {
    return segments.find(segment => 
      timeline.current_time >= segment.start_time && 
      timeline.current_time < segment.end_time
    );
  };

  const currentSegment = getCurrentSegment();

  // Don't show anything if no segment is active
  if (!currentSegment) {
    return null;
  }

  // Apply typography and color settings to caption styling
  const getCaptionStyle = () => {
    const { typography, colors } = settings;
    
    return {
      fontFamily: typography.font_family,
      fontSize: '16px', // Fixed smaller size for video overlay
      fontWeight: typography.font_weight,
      fontStyle: typography.font_style,
      textAlign: 'center' as const, // Always center for video captions
      lineHeight: 1.3,
      letterSpacing: `${typography.letter_spacing}px`,
      textTransform: typography.text_transform as 'none' | 'capitalize' | 'uppercase' | 'lowercase' | 'initial' | 'inherit',
      textDecoration: typography.text_decoration,
      color: colors.text_color,
      backgroundColor: 'rgba(0, 0, 0, 0.75)', // Semi-transparent background for readability
      textShadow: '1px 1px 2px rgba(0, 0, 0, 0.9)', // Strong shadow for video overlay
      border: colors.stroke.enabled ? `${colors.stroke.width}px ${colors.stroke.style} ${colors.stroke.color}` : 'none'
    };
  };

  // Calculate animation timing for lip-sync effect
  const getAnimationStyle = () => {
    const segmentProgress = (timeline.current_time - currentSegment.start_time) / currentSegment.duration;
    const { animation } = settings;
    
    // Apply entrance animation at segment start
    if (segmentProgress < 0.1) {
      const animationClass = getEntranceAnimation(animation.entrance.type);
      return {
        animation: `${animationClass} ${animation.entrance.duration}ms ${animation.entrance.easing}`
      };
    }
    
    // Apply continuous animation if enabled
    if (animation.continuous.type !== 'none') {
      const continuousClass = getContinuousAnimation(animation.continuous.type);
      return {
        animation: `${continuousClass} ${2000 / animation.continuous.speed}ms infinite`
      };
    }
    
    return {};
  };

  const getEntranceAnimation = (type: string) => {
    switch (type) {
      case 'fade': return 'fadeIn';
      case 'slide_up': return 'slideInUp';
      case 'slide_down': return 'slideInDown';
      case 'zoom': return 'zoomIn';
      case 'bounce': return 'bounceIn';
      case 'typewriter': return 'typewriter';
      default: return 'fadeIn';
    }
  };

  const getContinuousAnimation = (type: string) => {
    switch (type) {
      case 'pulse': return 'pulse';
      case 'glow': return 'glow';
      case 'float': return 'float';
      case 'shake': return 'shake';
      default: return 'pulse';
    }
  };

  // Position caption based on layout settings - optimized for video overlay
  const getPositionStyle = () => {
    return {
      position: 'absolute' as const,
      left: '50%',
      bottom: '15%', // Position near bottom with some distance
      width: '85%', // Smaller width so it doesn't cover face
      maxWidth: '280px', // Reasonable max for mobile video
      padding: '8px 12px',
      margin: '0',
      transform: 'translateX(-50%)', // Center horizontally
      borderRadius: '8px',
      zIndex: 10
    };
  };


  return (
    <div
      className="pointer-events-none select-none"
      style={{
        ...getPositionStyle(),
        ...getCaptionStyle(),
        ...getAnimationStyle()
      }}
    >
      {/* Word-by-word highlighting for precise lip-sync */}
      <div className="relative">
        {currentSegment.text.split(' ').map((word, index) => {
          const words = currentSegment.text.split(' ');
          const segmentProgress = (timeline.current_time - currentSegment.start_time) / currentSegment.duration;
          
          // Calculate word timing - each word gets equal time within the segment
          const wordStartTime = index / words.length;
          const wordEndTime = (index + 1) / words.length;
          
          // Check if this specific word is currently being "spoken"
          const isCurrentWord = segmentProgress >= wordStartTime && segmentProgress < wordEndTime;
          
          return (
            <span
              key={index}
              className={`inline-block mr-1 transition-all duration-100 ${
                isCurrentWord ? 'transform scale-110' : 'transform scale-100'
              }`}
              style={{
                color: isCurrentWord 
                  ? settings.colors.highlight_color 
                  : settings.colors.text_color,
                opacity: 1,
                fontWeight: isCurrentWord ? 'bold' : 'normal'
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// CSS Animations (add to global CSS or styled-components)
const captionAnimations = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.3); }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes typewriter {
  from { width: 0; }
  to { width: 100%; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

@keyframes glow {
  0%, 100% { text-shadow: 0 0 5px currentColor; }
  50% { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}
`;

// Export animations for global CSS injection
export { captionAnimations };