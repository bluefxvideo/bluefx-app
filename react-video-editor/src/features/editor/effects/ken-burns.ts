import { interpolate, Easing } from 'remotion';

/**
 * Ken Burns Effect Presets
 * Simple, reusable effect configurations
 */

export type KenBurnsPreset = 
  | 'none'
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-down'
  | 'pan-up'
  | 'zoom-in-left'
  | 'zoom-in-right'
  | 'zoom-out-left'
  | 'zoom-out-right';

export interface KenBurnsConfig {
  preset: KenBurnsPreset;
  intensity: number; // 0-100 (default 20)
  smoothness: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'; // Easing type
  speed: number; // 0.1-3.0 (default 1.0) - speed multiplier for animation duration
}

/**
 * Calculate Ken Burns transform values based on current frame
 */
export function calculateKenBurnsTransform(
  frame: number,
  durationInFrames: number,
  config: KenBurnsConfig
): {
  scale: number;
  translateX: number;
  translateY: number;
  transform: string;
} {
  const { preset, intensity = 20, smoothness = 'ease-in-out', speed = 1.0 } = config;
  
  // No effect
  if (preset === 'none') {
    return {
      scale: 1,
      translateX: 0,
      translateY: 0,
      transform: 'none'
    };
  }
  
  // Calculate intensity factor with speed boost
  // Speed affects the total amount of zoom/pan to maintain motion throughout
  const intensityFactor = (intensity / 200) * speed;
  
  // Use normal progress for full duration
  const progress = frame / durationInFrames;
  
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
        progress,
        [0, 1],
        [1, 1 + intensityFactor],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'zoom-out':
      scale = interpolate(
        progress,
        [0, 1],
        [1 + intensityFactor, 1],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'pan-left':
      translateX = interpolate(
        progress,
        [0, 1],
        [0, -intensity * speed],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'pan-right':
      translateX = interpolate(
        progress,
        [0, 1],
        [0, intensity * speed],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'pan-up':
      translateY = interpolate(
        progress,
        [0, 1],
        [0, -intensity * speed],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'pan-down':
      translateY = interpolate(
        progress,
        [0, 1],
        [0, intensity * speed],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'zoom-in-left':
      scale = interpolate(
        progress,
        [0, 1],
        [1, 1 + intensityFactor],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      translateX = interpolate(
        progress,
        [0, 1],
        [0, -intensity * speed / 2],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'zoom-in-right':
      scale = interpolate(
        progress,
        [0, 1],
        [1, 1 + intensityFactor],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      translateX = interpolate(
        progress,
        [0, 1],
        [0, intensity * speed / 2],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'zoom-out-left':
      scale = interpolate(
        progress,
        [0, 1],
        [1 + intensityFactor, 1],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      translateX = interpolate(
        progress,
        [0, 1],
        [intensity * speed / 2, 0],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
      
    case 'zoom-out-right':
      scale = interpolate(
        progress,
        [0, 1],
        [1 + intensityFactor, 1],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      translateX = interpolate(
        progress,
        [0, 1],
        [-intensity * speed / 2, 0],
        { easing: easingFn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      break;
  }
  
  // Combine into transform string
  const transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
  
  return {
    scale,
    translateX,
    translateY,
    transform
  };
}

/**
 * Get Remotion easing function based on smoothness setting
 */
function getEasingFunction(smoothness: KenBurnsConfig['smoothness']) {
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

/**
 * Default Ken Burns configuration
 */
export const DEFAULT_KEN_BURNS_CONFIG: KenBurnsConfig = {
  preset: 'zoom-in',
  intensity: 40,
  smoothness: 'linear',
  speed: 1.8
};

/**
 * Preset descriptions for UI
 */
export const KEN_BURNS_PRESET_LABELS: Record<KenBurnsPreset, string> = {
  'none': 'No Effect',
  'zoom-in': 'Zoom In',
  'zoom-out': 'Zoom Out',
  'pan-left': 'Pan Left',
  'pan-right': 'Pan Right',
  'pan-up': 'Pan Up',
  'pan-down': 'Pan Down',
  'zoom-in-left': 'Zoom In + Left',
  'zoom-in-right': 'Zoom In + Right',
  'zoom-out-left': 'Zoom Out + Left',
  'zoom-out-right': 'Zoom Out + Right'
};