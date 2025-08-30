'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateThumbnails, ThumbnailMachineRequest, ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { useCredits } from '@/hooks/useCredits';
import { updatePredictionRecord } from '@/actions/database/thumbnail-database';
import { getIdeogramV2aPrediction } from '@/actions/models/ideogram-v2-turbo';
import { getFaceSwapPrediction } from '@/actions/models/face-swap-cdingram';
import { getActivePredictions } from '@/actions/database/restore-active-predictions';
import { createPartialResultFromPrediction } from '@/utils/prediction-restoration';

/**
 * Simplified Thumbnail Machine Hook with Robust Polling Fallback
 * 
 * Key improvements:
 * 1. Automatic polling when webhooks don't arrive within 5 seconds
 * 2. No complex timeout logic - just reliable polling
 * 3. Clean state management without race conditions
 * 4. Modular for all operations (generate, face-swap, recreate)
 */
export function useThumbnailMachine() {
  const { credits } = useCredits();
  
  // Core state
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ThumbnailMachineResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(false); // Silent restoration by default
  
  // Polling state
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const webhookTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentBatchIdRef = useRef<string | null>(null);
  const predictionIdsRef = useRef<string[]>([]);
  
  const supabase = createClient();

  // Get current user and restore any active generation state
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        // Try to restore active generation state silently in background
        if (user) {
          console.log('🔄 User found, silently checking for active generations...', {
            userId: user.id,
            userEmail: user.email
          });
          await restoreActiveGeneration(user.id);
        } else {
          console.log('ℹ️ No user found, skipping restoration');
        }
      } catch (error) {
        console.error('❌ Error during user initialization:', error);
      }
      console.log('✅ User initialization and restoration complete');
    };
    
    initializeUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user || null;
      setUser(newUser);
      
      // If user just logged in, try to restore their active generations silently
      if (newUser && event === 'SIGNED_IN') {
        try {
          console.log('🔄 User signed in, checking for active generations...');
          await restoreActiveGeneration(newUser.id);
        } catch (error) {
          console.error('❌ Error restoring on sign in:', error);
        }
      }
    });

    return () => subscription?.unsubscribe();
  }, [supabase.auth]);

  /**
   * Restore active generation state from database after page refresh
   */
  const restoreActiveGeneration = async (userId: string) => {
    try {
      console.log('🔄 Attempting to restore active generation state for user:', userId);
      
      const activePredictionsResult = await getActivePredictions(userId);
      
      if (!activePredictionsResult.success) {
        console.log('❌ Failed to fetch active predictions:', activePredictionsResult.error);
        return;
      }
      
      if (!activePredictionsResult.predictions?.length) {
        console.log('ℹ️ No active predictions to restore');
        return;
      }

      // Get the most recent active prediction
      const activePrediction = activePredictionsResult.predictions[0];
      console.log('🔄 Restoring active prediction:', {
        id: activePrediction.predictionId,
        type: activePrediction.type,
        prompt: activePrediction.prompt.substring(0, 50) + '...',
        status: activePrediction.status
      });

      // Set generating state FIRST
      setIsGenerating(true);
      setError(undefined);
      
      // Create partial result for UI display
      const partialResult = createPartialResultFromPrediction(activePrediction);
      console.log('🔄 Setting partial result:', {
        success: partialResult.success,
        batch_id: partialResult.batch_id,
        prompt: partialResult.prompt,
        generationType: (partialResult as any).generationType
      });
      setResult(partialResult);
      
      // Store current batch ID and prediction IDs for polling
      currentBatchIdRef.current = activePrediction.batchId;
      predictionIdsRef.current = [activePrediction.predictionId];
      
      // Start polling immediately for the restored prediction
      console.log('🔄 Starting polling for restored prediction:', activePrediction.predictionId);
      startPolling(activePrediction.predictionId);
      
      console.log('✅ Active generation state restored successfully');
      
    } catch (error) {
      console.error('❌ Error restoring active generation:', error);
      // Don't set error state for restoration failures, just log them
    }
  };

  /**
   * Start polling for prediction results
   * This is our fallback when webhooks fail
   */
  const startPolling = useCallback(async (batchId: string) => {
    console.log('🔄 Starting polling fallback for batch:', batchId);
    
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    let pollCount = 0;
    const maxPolls = 90; // 3 minutes with 2 second intervals
    
    const pollForResults = async () => {
      pollCount++;
      console.log(`📊 Polling attempt ${pollCount}/${maxPolls} for batch:`, batchId);
      
      try {
        // Get prediction metadata from database
        const { data: prediction } = await supabase
          .from('ai_predictions')
          .select('*')
          .eq('prediction_id', batchId)
          .single();
        
        if (!prediction) {
          console.log('⚠️ No prediction record found for polling');
          return;
        }
        
        // Get the Replicate prediction IDs from metadata
        const metadata = prediction.metadata as any;
        const replicatePredictionIds = metadata?.replicate_prediction_ids || [];
        const predictionType = metadata?.prediction_type || 'ideogram';
        
        if (replicatePredictionIds.length === 0 && prediction.external_id) {
          replicatePredictionIds.push(prediction.external_id);
        }
        
        console.log('🔍 Polling Replicate predictions:', replicatePredictionIds);
        
        // Poll each Replicate prediction
        const allCompleted = [];
        let hasFailure = false;
        
        for (const predId of replicatePredictionIds) {
          const replicatePrediction = predictionType === 'face-swap' 
            ? await getFaceSwapPrediction(predId)
            : await getIdeogramV2aPrediction(predId);
          
          if (replicatePrediction.status === 'succeeded' && replicatePrediction.output) {
            allCompleted.push(replicatePrediction);
          } else if (replicatePrediction.status === 'failed' || replicatePrediction.status === 'canceled') {
            hasFailure = true;
            console.error('❌ Prediction failed:', predId, replicatePrediction.error);
          } else if (replicatePrediction.status === 'processing' || replicatePrediction.status === 'starting') {
            // Still processing, continue polling
            return;
          }
        }
        
        // All predictions completed or failed
        if (allCompleted.length > 0 || hasFailure) {
          console.log('✅ Polling complete:', allCompleted.length, 'successful predictions');
          
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          // Update the result based on completed predictions
          if (allCompleted.length > 0) {
            // Get the latest result from database (webhook might have updated it)
            const { data: updatedPrediction } = await supabase
              .from('ai_predictions')
              .select('*')
              .eq('prediction_id', batchId)
              .single();
            
            if (updatedPrediction?.output_data) {
              const outputData = updatedPrediction.output_data as any;
              
              // Build the result from output_data
              const polledResult: ThumbnailMachineResponse = {
                success: true,
                batch_id: batchId,
                credits_used: prediction.credits_used || 0,
                generation_time_ms: Date.now() - new Date(prediction.created_at).getTime(),
                thumbnails: outputData.thumbnails || [],
                face_swapped_thumbnails: outputData.face_swapped_thumbnails || [],
              };
              
              console.log('📦 Setting result from polling:', polledResult);
              setResult(polledResult);
              setIsGenerating(false);
              setError(undefined);
            }
          } else if (hasFailure) {
            setError('Generation failed. Please try again.');
            setIsGenerating(false);
          }
        }
        
        // Stop polling after max attempts
        if (pollCount >= maxPolls) {
          console.log('⏰ Polling timeout reached');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setError('Generation timed out. Please try again.');
          setIsGenerating(false);
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
        // Continue polling on error - might be temporary
      }
    };
    
    // Start polling immediately
    pollForResults();
    
    // Set up interval for subsequent polls
    pollingIntervalRef.current = setInterval(pollForResults, 2000);
  }, [supabase]);

  /**
   * Handle webhook updates from real-time subscription
   */
  const handleWebhookUpdate = useCallback(async (message: any) => {
    console.log('📡 Webhook received:', message);
    
    // Clear webhook timeout since we received a webhook
    if (webhookTimeoutRef.current) {
      clearTimeout(webhookTimeoutRef.current);
      webhookTimeoutRef.current = null;
    }
    
    // Stop polling since webhook arrived
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('🛑 Stopped polling - webhook received');
    }
    
    // Check if this webhook is for our current generation
    if (message.batch_id !== currentBatchIdRef.current) {
      console.log('⏭️ Skipping webhook - different batch_id');
      return;
    }
    
    if (message.status === 'succeeded' && message.results?.success) {
      // Process the webhook result
      try {
        const { data: prediction } = await supabase
          .from('ai_predictions')
          .select('*')
          .eq('prediction_id', message.batch_id)
          .single();
        
        if (prediction?.output_data) {
          const outputData = prediction.output_data as any;
          
          const webhookResult: ThumbnailMachineResponse = {
            success: true,
            batch_id: message.batch_id,
            credits_used: prediction.credits_used || 0,
            generation_time_ms: Date.now() - new Date(prediction.created_at).getTime(),
            thumbnails: outputData.thumbnails || [],
            face_swapped_thumbnails: outputData.face_swapped_thumbnails || [],
          };
          
          console.log('✅ Setting result from webhook:', webhookResult);
          setResult(webhookResult);
          setIsGenerating(false);
          setError(undefined);
        }
      } catch (error) {
        console.error('❌ Error processing webhook:', error);
      }
    }
  }, [supabase]);

  /**
   * Subscribe to real-time webhook updates
   */
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔔 Setting up real-time subscription for user:', user.id);

    const subscription = supabase
      .channel(`user_${user.id}_updates`)
      .on('broadcast', { event: 'webhook_update' }, (payload) => {
        console.log('🔔 Real-time broadcast received:', payload);
        handleWebhookUpdate(payload.payload);
      })
      .subscribe();

    return () => {
      console.log('🔕 Cleaning up real-time subscription');
      subscription.unsubscribe();
    };
  }, [user?.id, handleWebhookUpdate, supabase]);

  /**
   * Main generation function
   */
  const generateThumbnail = async (request: ThumbnailMachineRequest): Promise<ThumbnailMachineResponse> => {
    // Validation
    if (!user?.id) {
      throw new Error('Please sign in to generate thumbnails');
    }

    if (!credits || credits < 2) {
      throw new Error('Insufficient credits. Please purchase more credits to continue.');
    }

    // Reset state
    setIsGenerating(true);
    setError(undefined);
    setResult(undefined);
    
    try {
      // Call the server action
      const response = await generateThumbnails({
        ...request,
        user_id: user.id,
      });
      
      console.log('🎯 Server response:', response);
      
      // Store the batch_id for webhook/polling matching
      currentBatchIdRef.current = response.batch_id;
      
      // Set initial result (will be updated by webhook or polling)
      setResult(response);
      
      // For async operations, set up webhook timeout and polling fallback
      const isAsyncOperation = request.operation_mode === 'face-swap-only' || 
                               (request.face_swap && !response.face_swapped_thumbnails?.length);
      
      if (isAsyncOperation) {
        console.log('⏰ Setting up webhook timeout for async operation');
        
        // Start polling after 5 seconds if no webhook arrives
        webhookTimeoutRef.current = setTimeout(() => {
          console.log('⚠️ No webhook received after 5 seconds, starting polling fallback');
          startPolling(response.batch_id);
        }, 5000);
      } else {
        // Synchronous operation completed
        setIsGenerating(false);
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      setError(errorMessage);
      setIsGenerating(false);
      
      // Clear any timeouts
      if (webhookTimeoutRef.current) {
        clearTimeout(webhookTimeoutRef.current);
        webhookTimeoutRef.current = null;
      }
      
      throw err;
    }
  };

  /**
   * Cancel generation
   */
  const cancelGeneration = useCallback(async () => {
    console.log('🛑 Cancelling generation');
    
    // Clear all timeouts and intervals
    if (webhookTimeoutRef.current) {
      clearTimeout(webhookTimeoutRef.current);
      webhookTimeoutRef.current = null;
    }
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Update database if we have a batch_id
    if (currentBatchIdRef.current && user?.id) {
      try {
        await updatePredictionRecord(currentBatchIdRef.current, {
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to update database on cancellation:', error);
      }
    }
    
    // Reset state
    setIsGenerating(false);
    setResult(undefined);
    setError(undefined);
    currentBatchIdRef.current = null;
  }, [user?.id]);

  return {
    // Actions
    generate: generateThumbnail,
    cancelGeneration,
    
    // States
    isGenerating,
    result,
    error,
    user,
    credits,
    
    // Utilities
    clearResults: () => {
      setResult(undefined);
      setError(undefined);
    },
  };
}