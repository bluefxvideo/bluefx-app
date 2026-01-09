'use server';

import { createClient } from '@/app/supabase/server';

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

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
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

  const { error } = await supabase.storage
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
 * Create upscale prediction using Crystal Upscaler on Replicate
 * Optimized for portraits, faces, and products
 * Model: philz1337x/crystal-upscaler
 */
async function createUpscalePrediction(imageUrl: string, scale: number = 2): Promise<ReplicatePrediction> {
  // Use the official model endpoint (doesn't require version hash)
  const response = await fetch('https://api.replicate.com/v1/models/philz1337x/crystal-upscaler/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
    },
    body: JSON.stringify({
      input: {
        image: imageUrl,
        scale_factor: scale,
        creativity: 0, // 0 = most faithful to original
        output_format: 'png',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Replicate API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Poll for prediction completion
 */
async function waitForPrediction(predictionId: string, maxWaitMs: number = 120000): Promise<ReplicatePrediction> {
  const startTime = Date.now();
  const pollInterval = 2000;

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get prediction status: ${response.status}`);
    }

    const prediction: ReplicatePrediction = await response.json();

    if (prediction.status === 'succeeded') {
      return prediction;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Prediction ${prediction.status}: ${prediction.error || 'Unknown error'}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Prediction timed out');
}

/**
 * Upscale a single frame using Real-ESRGAN on Replicate
 * 960x540 → 1920x1080 (2x scale)
 */
async function upscaleFrame(imageUrl: string, scale: number = 2): Promise<string> {
  try {
    const prediction = await createUpscalePrediction(imageUrl, scale);
    const completedPrediction = await waitForPrediction(prediction.id);

    if (typeof completedPrediction.output === 'string') {
      return completedPrediction.output;
    }

    if (Array.isArray(completedPrediction.output) && completedPrediction.output.length > 0) {
      return completedPrediction.output[0];
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

  const { error } = await supabase.storage
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
    const prediction = await createUpscalePrediction(imageUrl, scale);
    const completedPrediction = await waitForPrediction(prediction.id);

    if (typeof completedPrediction.output === 'string') {
      return { success: true, url: completedPrediction.output };
    }

    if (Array.isArray(completedPrediction.output) && completedPrediction.output.length > 0) {
      return { success: true, url: completedPrediction.output[0] };
    }

    return { success: false, error: 'Unexpected output format' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upscale failed',
    };
  }
}
