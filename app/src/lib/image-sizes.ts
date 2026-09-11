/**
 * Pixel sizes behind the app's aspect-ratio + 1K/2K/4K choices, shared by the
 * GPT Image 2.5 model file (request sizing) and the tools that record what
 * they generated (history rows need width, height and an orientation label).
 */
import type { NanoBananaAspectRatio } from '@/actions/models/fal-nano-banana-2';

export type ImageResolution = '1K' | '2K' | '4K';
export type PixelSize = { width: number; height: number };

const SIZES: Record<ImageResolution, Partial<Record<NanoBananaAspectRatio, PixelSize>>> = {
  '1K': {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1024, height: 1024 },
    '4:3': { width: 1024, height: 768 },
    '3:4': { width: 768, height: 1024 },
    '3:2': { width: 1536, height: 1024 },
    '2:3': { width: 1024, height: 1536 },
    '21:9': { width: 1920, height: 816 },
  },
  '2K': {
    '16:9': { width: 2560, height: 1440 },
    '9:16': { width: 1440, height: 2560 },
    '1:1': { width: 2048, height: 2048 },
    '4:3': { width: 2048, height: 1536 },
    '3:4': { width: 1536, height: 2048 },
    '3:2': { width: 2160, height: 1440 },
    '2:3': { width: 1440, height: 2160 },
    '21:9': { width: 2560, height: 1088 },
  },
  '4K': {
    '16:9': { width: 3840, height: 2160 },
    '9:16': { width: 2160, height: 3840 },
    '1:1': { width: 3072, height: 3072 },
    '4:3': { width: 3072, height: 2304 },
    '3:4': { width: 2304, height: 3072 },
    '3:2': { width: 3240, height: 2160 },
    '2:3': { width: 2160, height: 3240 },
    '21:9': { width: 3840, height: 1632 },
  },
};

/** Pixel size for an aspect ratio at a resolution tier; undefined for 'auto'. */
export function pixelSizeFor(aspect: NanoBananaAspectRatio, resolution: ImageResolution): PixelSize | undefined {
  return SIZES[resolution][aspect];
}

/** The orientation label the generated_images.dimensions column has always held. */
export function orientationOf(aspect: NanoBananaAspectRatio): 'landscape' | 'portrait' | 'square' {
  if (aspect === '1:1' || aspect === 'auto') return 'square';
  const [w, h] = aspect.split(':').map(Number);
  return w >= h ? 'landscape' : 'portrait';
}
