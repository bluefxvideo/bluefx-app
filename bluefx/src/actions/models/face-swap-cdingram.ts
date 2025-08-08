'use server';

/**
 * Generated from: Replicate face-swap Model
 * Base URL: https://api.replicate.com/v1
 * Model: cdingram/face-swap
 * Version: d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111
 */

interface FaceSwapInput {
  input_image: string; // Target image where face will be swapped (URL or base64 data URI)
  swap_image: string;  // Image containing the face to be swapped in (URL or base64 data URI)
}

interface FaceSwapPrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version: string;
  input: FaceSwapInput;
  output?: string; // Generated face-swapped image URL
  error?: string;
  logs?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  metrics?: {
    predict_time?: number;
  };
  urls: {
    get: string;
    cancel: string;
  };
}

interface CreatePredictionInput {
  version?: string;
  input: FaceSwapInput;
  webhook?: string;
}

/**
 * Create a new face swap prediction
 */
export async function createFaceSwapPrediction(params: FaceSwapInput, webhook?: string): Promise<FaceSwapPrediction> {
  try {
    const requestBody: CreatePredictionInput = {
      version: 'd1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111',
      input: params,
    };

    if (webhook) {
      requestBody.webhook = webhook;
    }

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('createFaceSwapPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of a face swap prediction
 */
export async function getFaceSwapPrediction(predictionId: string): Promise<FaceSwapPrediction> {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('getFaceSwapPrediction error:', error);
    throw error;
  }
}

/**
 * Cancel a running face swap prediction
 */
export async function cancelFaceSwapPrediction(predictionId: string): Promise<FaceSwapPrediction> {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('cancelFaceSwapPrediction error:', error);
    throw error;
  }
}

/**
 * Helper function to wait for a face swap prediction to complete
 * Polls the prediction status until it's finished
 */
export async function waitForFaceSwapCompletion(
  predictionId: string, 
  maxWaitTime: number = 300000, // 5 minutes default
  pollInterval: number = 2000   // 2 seconds default
): Promise<FaceSwapPrediction> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const prediction = await getFaceSwapPrediction(predictionId);
    
    if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
      return prediction;
    }
    
    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error(`Face swap prediction ${predictionId} timed out after ${maxWaitTime}ms`);
}

/**
 * Complete face swap workflow: create prediction and wait for results
 */
export async function performFaceSwap(
  inputImage: string,
  swapImage: string,
  webhook?: string
): Promise<string> {
  try {
    // Create the prediction
    const prediction = await createFaceSwapPrediction({
      input_image: inputImage,
      swap_image: swapImage
    }, webhook);

    console.log(`Face swap prediction created: ${prediction.id}`);

    // If webhook is provided, return prediction ID for async handling
    if (webhook) {
      return prediction.id;
    }

    // Otherwise, wait for completion
    const completedPrediction = await waitForFaceSwapCompletion(prediction.id);

    if (completedPrediction.status === 'failed') {
      throw new Error(`Face swap failed: ${completedPrediction.error}`);
    }

    if (!completedPrediction.output) {
      throw new Error('Face swap completed but no output URL was returned');
    }

    return completedPrediction.output;
  } catch (error) {
    console.error('performFaceSwap error:', error);
    throw error;
  }
}