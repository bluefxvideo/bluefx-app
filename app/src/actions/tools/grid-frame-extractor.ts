'use server';

import Replicate from 'replicate';
import { createClient } from '@/lib/supabase/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

/**
 * Grid Frame Extractor
 *
 * Takes a 4x4 storyboard grid image (3840x2160 at 16:9) and:
 * 1. Receives pre-cropped frames from client-side canvas
 * 2. Uploads them to Supabase storage
 * 3. Upscales each frame 2x to 1920x1080 using Real-ESRGAN
 *
 * The actual cropping happens client-side using canvas for speed.
 * This server action handles storage and upscaling.
 */

interface GridConfig {
  columns: number;
  rows: number;
  width: number;  // Total grid width (e.g., 3840)
  height: number; // Total grid height (e.g., 2160)
}

interface ExtractedFrame {
  frameNumber: number;
  row: number;
  col: number;
  originalUrl: string;
  upscaledUrl?: string;
  width: number;
  height: number;
}

interface ExtractionResult {
  success: boolean;
  frames?: ExtractedFrame[];
  error?: string;
}

// Default config for 4x4 grid at 4K 16:9
export const DEFAULT_GRID_CONFIG: GridConfig = {
  columns: 4,
  rows: 4,
  width: 3840,
  height: 2160,
};

/**
 * Calculate crop coordinates for each frame in the grid
 * Used by client-side canvas to know where to crop
 */
export function getFrameCoordinates(config: GridConfig = DEFAULT_GRID_CONFIG) {
  const { columns, rows, width, height } = config;
  const frameWidth = Math.floor(width / columns);
  const frameHeight = Math.floor(height / rows);

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

  return { frames, frameWidth, frameHeight };
}

/**
 * Upload a cropped frame (base64) to Supabase storage
 */
async function uploadFrameToStorage(
  base64Data: string,
  projectId: string,
  frameNumber: number
): Promise<string> {
  const supabase = await createClient();

  // Remove data URL prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');

  const fileName = `projects/${projectId}/frames/frame_${frameNumber.toString().padStart(2, '0')}.png`;

  const { data, error } = await supabase.storage
    .from('ad-projects')
    .upload(fileName, buffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload frame ${frameNumber}: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('ad-projects')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Upscale a single frame using Real-ESRGAN on Replicate
 * 960x540 → 1920x1080 (2x scale)
 */
async function upscaleFrame(imageUrl: string, scale: number = 2): Promise<string> {
  try {
    const output = await replicate.run(
      'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
      {
        input: {
          image: imageUrl,
          scale: scale,
          face_enhance: true, // Enable face enhancement for character consistency
        },
      }
    );

    if (typeof output === 'string') {
      return output;
    }

    // Handle array output
    if (Array.isArray(output) && output.length > 0) {
      return output[0] as string;
    }

    throw new Error('Unexpected output format from upscaler');
  } catch (error) {
    console.error('Upscale error:', error);
    throw error;
  }
}

/**
 * Upload upscaled frame to permanent storage (from Replicate temp URL)
 */
async function saveUpscaledFrame(
  replicateUrl: string,
  projectId: string,
  frameNumber: number
): Promise<string> {
  const supabase = await createClient();

  // Download from Replicate
  const response = await fetch(replicateUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  const fileName = `projects/${projectId}/frames/frame_${frameNumber.toString().padStart(2, '0')}_upscaled.png`;

  const { data, error } = await supabase.storage
    .from('ad-projects')
    .upload(fileName, buffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to save upscaled frame ${frameNumber}: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('ad-projects')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Process frames that were cropped client-side
 * Receives base64 data for each frame, uploads, and optionally upscales
 */
export async function processExtractedFrames(
  projectId: string,
  frames: Array<{
    frameNumber: number;
    row: number;
    col: number;
    base64Data: string;
    width: number;
    height: number;
  }>,
  shouldUpscale: boolean = true
): Promise<ExtractionResult> {
  try {
    const extractedFrames: ExtractedFrame[] = [];

    console.log(`Processing ${frames.length} frames for project ${projectId}`);

    for (const frame of frames) {
      console.log(`Processing frame ${frame.frameNumber}/${frames.length}`);

      // Step 1: Upload cropped frame to storage
      const originalUrl = await uploadFrameToStorage(
        frame.base64Data,
        projectId,
        frame.frameNumber
      );

      const extractedFrame: ExtractedFrame = {
        frameNumber: frame.frameNumber,
        row: frame.row,
        col: frame.col,
        originalUrl,
        width: frame.width,
        height: frame.height,
      };

      // Step 2: Upscale if requested
      if (shouldUpscale) {
        console.log(`Upscaling frame ${frame.frameNumber} (2x scale)`);
        const upscaledTempUrl = await upscaleFrame(originalUrl, 2);

        // Save upscaled to permanent storage
        extractedFrame.upscaledUrl = await saveUpscaledFrame(
          upscaledTempUrl,
          projectId,
          frame.frameNumber
        );
        extractedFrame.width = frame.width * 2;
        extractedFrame.height = frame.height * 2;
      }

      extractedFrames.push(extractedFrame);
    }

    // Update project in database with extracted frames
    const supabase = await createClient();
    await supabase
      .from('ad_projects')
      .update({
        extracted_frames: extractedFrames,
        status: 'frames',
      })
      .eq('id', projectId);

    return {
      success: true,
      frames: extractedFrames,
    };
  } catch (error) {
    console.error('Frame processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during frame processing',
    };
  }
}

/**
 * Upscale a single image (standalone utility)
 */
export async function upscaleImage(
  imageUrl: string,
  scale: number = 2,
  enhanceFaces: boolean = true
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const output = await replicate.run(
      'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
      {
        input: {
          image: imageUrl,
          scale: scale,
          face_enhance: enhanceFaces,
        },
      }
    );

    if (typeof output === 'string') {
      return { success: true, url: output };
    }

    if (Array.isArray(output) && output.length > 0) {
      return { success: true, url: output[0] as string };
    }

    return { success: false, error: 'Unexpected output format' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upscale failed',
    };
  }
}
