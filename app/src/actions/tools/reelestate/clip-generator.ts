'use server';

import {
  createVideoGenerationPrediction,
  getVideoGenerationPrediction,
} from '@/actions/models/video-generation-v1';
import type { ClipGenerationRequest, ClipStatus } from '@/types/reelestate';

/**
 * Generate a single video clip from a listing photo using LTX-2.3-Fast.
 * Returns the prediction ID for polling.
 */
export async function generateListingClip(
  request: ClipGenerationRequest
): Promise<ClipStatus> {
  try {
    console.log(`🎬 Generating clip ${request.index}: ${request.camera_motion} motion`);

    const prediction = await createVideoGenerationPrediction({
      prompt: request.prompt,
      image: request.photo_url,
      camera_motion: request.camera_motion,
      duration: 6,
      resolution: '1080p',
      aspect_ratio: request.aspect_ratio,
      generate_audio: false,
    });

    return {
      index: request.index,
      prediction_id: prediction.id,
      status: prediction.status === 'starting' ? 'starting' : 'processing',
    };
  } catch (error) {
    console.error(`❌ Clip ${request.index} generation error:`, error);
    return {
      index: request.index,
      prediction_id: '',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Failed to start clip generation',
    };
  }
}

/**
 * Generate all listing clips in parallel.
 * Returns array of ClipStatus with prediction IDs for polling.
 */
export async function generateAllListingClips(
  requests: ClipGenerationRequest[]
): Promise<{ success: boolean; clips: ClipStatus[]; error?: string }> {
  try {
    console.log(`🎬 Starting parallel generation of ${requests.length} clips...`);

    const results = await Promise.allSettled(
      requests.map(req => generateListingClip(req))
    );

    const clips: ClipStatus[] = results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        index: requests[i].index,
        prediction_id: '',
        status: 'failed' as const,
        error: 'Failed to start generation',
      };
    });

    const succeeded = clips.filter(c => c.status !== 'failed').length;
    console.log(`✅ ${succeeded}/${requests.length} clips started successfully`);

    return { success: succeeded > 0, clips };
  } catch (error) {
    console.error('❌ Batch clip generation error:', error);
    return {
      success: false,
      clips: [],
      error: error instanceof Error ? error.message : 'Failed to generate clips',
    };
  }
}

/**
 * Poll a single clip's generation status.
 */
export async function pollClipStatus(predictionId: string, index: number): Promise<ClipStatus> {
  try {
    const prediction = await getVideoGenerationPrediction(predictionId);

    let videoUrl: string | undefined;
    if (prediction.status === 'succeeded' && prediction.output) {
      videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    }

    return {
      index,
      prediction_id: predictionId,
      status: prediction.status as ClipStatus['status'],
      video_url: videoUrl,
      error: prediction.error || undefined,
    };
  } catch (error) {
    return {
      index,
      prediction_id: predictionId,
      status: 'failed',
      error: 'Failed to poll status',
    };
  }
}
