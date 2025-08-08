// Store for tracking predictions and their callbacks
const predictionCallbacks = new Map<string, {
  callback: (prediction: Record<string, unknown>) => void;
  userId?: string;
  sessionId?: string;
}>();

// Store for real-time updates (you could use Redis, WebSockets, etc.)
const predictionUpdates = new Map<string, Record<string, unknown>>();

// Public API for registering prediction callbacks
export function registerPredictionCallback(
  predictionId: string, 
  callback: (prediction: Record<string, unknown>) => void,
  metadata?: { userId?: string; sessionId?: string }
) {
  predictionCallbacks.set(predictionId, { callback, ...metadata });
}

// Public API for getting prediction updates
export function getPredictionUpdate(predictionId: string) {
  return predictionUpdates.get(predictionId);
}

// Clean up old predictions (call this periodically)
export function cleanupOldPredictions() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  
  for (const [id, prediction] of predictionUpdates.entries()) {
    if (new Date((prediction.created_at as string)).getTime() < oneHourAgo) {
      predictionUpdates.delete(id);
    }
  }
}

// Internal functions for the webhook route
export function setPredictionUpdate(id: string, prediction: Record<string, unknown>) {
  predictionUpdates.set(id, prediction);
}

export function getPredictionCallback(id: string) {
  return predictionCallbacks.get(id);
}

export function removePredictionCallback(id: string) {
  predictionCallbacks.delete(id);
}