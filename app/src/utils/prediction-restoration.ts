import { ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';

/**
 * Create a partial ThumbnailMachineResponse for restoration based on prediction data
 * This is a client-side utility function
 */
export function createPartialResultFromPrediction(prediction: any): ThumbnailMachineResponse {
  return {
    success: false, // Not completed yet
    batch_id: prediction.batchId,
    credits_used: 0,
    generation_time_ms: 0,
    prompt: prediction.prompt || '', // Ensure prompt is available for UI display
    generationType: prediction.type, // Store type for UI logic
    // Empty arrays since generation is ongoing
    thumbnails: [],
    face_swapped_thumbnails: [],
    titles: []
  } as any; // Cast to any since generationType is not in the official interface
}