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
  const { preset, intensity = 20, smoothness = 'ease-in-out' } = config;
  
  // No effect
  if (preset === 'none') {
    return {
      scale: 1,
      translateX: 0,
      translateY: 0,
      transform: 'none'
    };
  }
  
  // Calculate intensity factor (0-100 maps to 0-0.5 for reasonable zoom)
  const intensityFactor = intensity / 200;
  
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
        frame,
        [0, durationInFrames],
        [1, 1 + intensityFactor],
        { easing: easingFn }
      );
      break;
      
    case 'zoom-out':
      scale = interpolate(
        frame,
        [0, durationInFrames],
        [1 + intensityFactor, 1],
        { easing: easingFn }
      );
      break;
      
    case 'pan-left':
      translateX = interpolate(
        frame,
        [0, durationInFrames],
        [0, -intensity],
        { easing: easingFn }
      );
      break;
      
    case 'pan-right':
      translateX = interpolate(
        frame,
        [0, durationInFrames],
        [0, intensity],
        { easing: easingFn }
      );
      break;
      
    case 'pan-up':
      translateY = interpolate(
        frame,
        [0, durationInFrames],
        [0, -intensity],
        { easing: easingFn }
      );
      break;
      
    case 'pan-down':
      translateY = interpolate(
        frame,
        [0, durationInFrames],
        [0, intensity],
        { easing: easingFn }
      );
      break;
      
    case 'zoom-in-left':
      scale = interpolate(
        frame,
        [0, durationInFrames],
        [1, 1 + intensityFactor],
        { easing: easingFn }
      );
      translateX = interpolate(
        frame,
        [0, durationInFrames],
        [0, -intensity / 2],
        { easing: easingFn }
      );
      break;
      
    case 'zoom-in-right':
      scale = interpolate(
        frame,
        [0, durationInFrames],
        [1, 1 + intensityFactor],
        { easing: easingFn }
      );
      translateX = interpolate(
        frame,
        [0, durationInFrames],
        [0, intensity / 2],
        { easing: easingFn }
      );
      break;
      
    case 'zoom-out-left':
      scale = interpolate(
        frame,
        [0, durationInFrames],
        [1 + intensityFactor, 1],
        { easing: easingFn }
      );
      translateX = interpolate(
        frame,
        [0, durationInFrames],
        [intensity / 2, 0],
        { easing: easingFn }
      );
      break;
      
    case 'zoom-out-right':
      scale = interpolate(
        frame,
        [0, durationInFrames],
        [1 + intensityFactor, 1],
        { easing: easingFn }
      );
      translateX = interpolate(
        frame,
        [0, durationInFrames],
        [-intensity / 2, 0],
        { easing: easingFn }
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
  preset: 'none',
  intensity: 20,
  smoothness: 'ease-in-out'
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