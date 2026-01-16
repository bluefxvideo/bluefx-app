/**
 * Client-side Grid Cropper
 *
 * Uses HTML Canvas to crop a 4x4 storyboard grid into 16 individual frames.
 * This is fast, free, and runs entirely in the browser.
 *
 * Usage:
 * const frames = await cropGridToFrames(gridImageUrl);
 * // Then send frames to server for upload/upscaling
 */

interface GridConfig {
  columns: number;
  rows: number;
}

interface CroppedFrame {
  frameNumber: number;
  row: number;
  col: number;
  base64Data: string;
  width: number;
  height: number;
}

// Default config for 4x4 grid
const DEFAULT_CONFIG: GridConfig = {
  columns: 4,
  rows: 4,
};

/**
 * Load an image from URL into an HTMLImageElement
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Required for canvas operations on external images
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Crop a single frame from the grid using canvas
 */
function cropFrame(
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Draw the cropped portion
  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

  // Return as base64 JPEG (high quality) - Crystal Upscaler works better with JPEG
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Crop a grid image into individual frames
 *
 * @param gridImageUrl - URL of the grid image (e.g., 4K 16:9 storyboard)
 * @param config - Grid configuration (columns, rows)
 * @returns Array of cropped frames with base64 data
 */
export async function cropGridToFrames(
  gridImageUrl: string,
  config: GridConfig = DEFAULT_CONFIG
): Promise<CroppedFrame[]> {
  const { columns, rows } = config;

  // Load the image
  const img = await loadImage(gridImageUrl);
  const totalWidth = img.naturalWidth;
  const totalHeight = img.naturalHeight;

  // Calculate frame dimensions
  const frameWidth = Math.floor(totalWidth / columns);
  const frameHeight = Math.floor(totalHeight / rows);

  console.log(`Grid: ${totalWidth}x${totalHeight}, Frame: ${frameWidth}x${frameHeight}`);

  const frames: CroppedFrame[] = [];
  let frameNumber = 1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = col * frameWidth;
      const y = row * frameHeight;

      const base64Data = cropFrame(img, x, y, frameWidth, frameHeight);

      frames.push({
        frameNumber,
        row,
        col,
        base64Data,
        width: frameWidth,
        height: frameHeight,
      });

      frameNumber++;
    }
  }

  return frames;
}

/**
 * Get frame coordinates without cropping (for preview/planning)
 */
export function getFrameLayout(
  imageWidth: number,
  imageHeight: number,
  config: GridConfig = DEFAULT_CONFIG
) {
  const { columns, rows } = config;
  const frameWidth = Math.floor(imageWidth / columns);
  const frameHeight = Math.floor(imageHeight / rows);

  const frames: Array<{
    frameNumber: number;
    row: number;
    col: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];

  let frameNumber = 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      frames.push({
        frameNumber,
        row,
        col,
        x: col * frameWidth,
        y: row * frameHeight,
        width: frameWidth,
        height: frameHeight,
      });
      frameNumber++;
    }
  }

  return { frames, frameWidth, frameHeight, totalFrames: columns * rows };
}

/**
 * Crop a single specific frame from a grid
 */
export async function cropSingleFrame(
  gridImageUrl: string,
  frameNumber: number,
  config: GridConfig = DEFAULT_CONFIG
): Promise<CroppedFrame | null> {
  const { columns, rows } = config;

  if (frameNumber < 1 || frameNumber > columns * rows) {
    console.error(`Invalid frame number: ${frameNumber}`);
    return null;
  }

  const img = await loadImage(gridImageUrl);
  const frameWidth = Math.floor(img.naturalWidth / columns);
  const frameHeight = Math.floor(img.naturalHeight / rows);

  // Convert frameNumber to row/col (1-indexed)
  const index = frameNumber - 1;
  const row = Math.floor(index / columns);
  const col = index % columns;

  const x = col * frameWidth;
  const y = row * frameHeight;

  const base64Data = cropFrame(img, x, y, frameWidth, frameHeight);

  return {
    frameNumber,
    row,
    col,
    base64Data,
    width: frameWidth,
    height: frameHeight,
  };
}
