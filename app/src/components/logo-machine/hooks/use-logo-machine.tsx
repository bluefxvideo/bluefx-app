'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateLogo, LogoMachineRequest, LogoMachineResponse } from '@/actions/tools/logo-machine';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { useCredits } from '@/hooks/useCredits';
import { updatePredictionRecord } from '@/actions/database/logo-database';
import { getActivePredictions } from '@/actions/database/restore-active-predictions';

/**
 * Enhanced Logo Machine Hook with Robust Polling & State Restoration
 * Matching the Thumbnail Machine v2 pattern for consistency
 */
export function useLogoMachine() {
  const { credits, isLoading: creditsLoading } = useCredits();
  
  // Core state
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<LogoMachineResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [user, setUser] = useState<User | null>(null);
  
  // Polling state
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const webhookTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentBatchIdRef = useRef<string | null>(null);
  const restorationAttemptedRef = useRef<boolean>(false);
  
  const supabase = createClient();

  // Get current user and restore any active generation state
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        // Try to restore active generation state silently in background (only once)
        if (user && !restorationAttemptedRef.current) {
          restorationAttemptedRef.current = true;
          await restoreActiveGeneration(user.id);
        }
      } catch (error) {
        console.error('❌ Error during user initialization:', error);
      }
    };
    
    initializeUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user || null;
      setUser(newUser);
      
      // If user just logged in, try to restore their active generations silently
      if (newUser && event === 'SIGNED_IN' && !restorationAttemptedRef.current) {
        try {
          restorationAttemptedRef.current = true;
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
   * Also checks for completed predictions that haven't been displayed yet
   */
  const restoreActiveGeneration = async (userId: string) => {
    try {
      // Skip restoration if already generating (prevent race conditions)
      if (isGenerating) {
        console.log('🔄 Skipping restoration - already generating');
        return;
      }

      // First check for active (in-progress) predictions
      const activePredictionsResult = await getActivePredictions(userId, 'logo-machine');
      
      if (activePredictionsResult.success && activePredictionsResult.predictions?.length) {
        const activePrediction = activePredictionsResult.predictions[0];

        console.log('🔄 Found active logo prediction for restoration:', activePrediction.batchId);

        // Verify the prediction actually exists in ai_predictions table before restoring
        const { data: dbPrediction, error } = await supabase
          .from('ai_predictions')
          .select('*')
          .eq('prediction_id', activePrediction.batchId)
          .single();

        if (error || !dbPrediction) {
          console.warn('⚠️ Active prediction not found in database, skipping restoration:', activePrediction.batchId);
          return;
        }

        // Set generating state FIRST
        setIsGenerating(true);
        setError(undefined);
        
        // Create partial result for UI display
        const partialResult: LogoMachineResponse = {
          success: false,
          prediction_id: activePrediction.predictionId,
          batch_id: activePrediction.batchId,
          credits_used: 0,
          generation_time_ms: 0
        };
        
        setResult(partialResult);
        
        // Store current batch ID for polling
        currentBatchIdRef.current = activePrediction.batchId;
        
        // Start polling immediately for the restored prediction
        startPolling(activePrediction.predictionId);
        return;
      }
      
      // If no active predictions, check for recent completed predictions that might need to be displayed
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: completedPredictions } = await supabase
        .from('ai_predictions')
        .select('*')
        .eq('user_id', userId)
        .eq('tool_id', 'logo-machine')
        .eq('status', 'completed')
        .gte('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (completedPredictions && completedPredictions.length > 0) {
        const completedPrediction = completedPredictions[0];
        const outputData = completedPrediction.output_data as any;
        
        if (outputData && outputData.logo) {
          // Restore completed result
          const restoredResult: LogoMachineResponse = {
            success: true,
            batch_id: completedPrediction.prediction_id,
            prediction_id: completedPrediction.prediction_id,
            credits_used: completedPrediction.credits_used || 0,
            generation_time_ms: Date.now() - new Date(completedPrediction.created_at).getTime(),
            logo: outputData.logo
          };
          
          setResult(restoredResult);
          setIsGenerating(false);
          setError(undefined);
        }
      }
      
    } catch (error) {
      console.error('❌ Error restoring generation state:', error);
    }
  };

  /**
   * Start polling for prediction results
   * This is our fallback when webhooks fail
   */
  const startPolling = useCallback(async (batchId: string) => {
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    let pollCount = 0;
    const maxPolls = 90; // 3 minutes with 2 second intervals
    
    const pollForResults = async () => {
      pollCount++;
      
      try {
        // Get prediction metadata from database
        const { data: prediction, error } = await supabase
          .from('ai_predictions')
          .select('*')
          .eq('prediction_id', batchId)
          .single();
        
        if (error || !prediction) {
          console.warn('❌ Prediction not found in database, stopping polling:', batchId);
          // Stop polling for non-existent predictions
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setError('Generation record not found. Please try generating again.');
          setIsGenerating(false);
          return;
        }
        
        // Check if prediction is complete
        if (prediction.status === 'completed' && prediction.output_data) {
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          const outputData = prediction.output_data as any;
          
          // Build the result from output_data
          const polledResult: LogoMachineResponse = {
            success: true,
            batch_id: batchId,
            prediction_id: batchId,
            credits_used: prediction.credits_used || 0,
            generation_time_ms: Date.now() - new Date(prediction.created_at).getTime(),
            logo: outputData.logo
          };
          
          setResult(polledResult);
          setIsGenerating(false);
          setError(undefined);
        } else if (prediction.status === 'failed') {
          // Stop polling on failure
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setError('Generation failed. Please try again.');
          setIsGenerating(false);
        }
        
        // Stop polling after max attempts
        if (pollCount >= maxPolls) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setError('Generation timed out. Please try again.');
          setIsGenerating(false);
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
        
        // Stop polling on critical errors (like 406 - prediction doesn't exist)
        if (error && typeof error === 'object' && 'code' in error) {
          const supabaseError = error as any;
          if (supabaseError.code === 'PGRST116' || supabaseError.details?.includes('406')) {
            console.warn('❌ Stopping polling due to database error (prediction not found)');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setError('Generation record not found. Please try generating again.');
            setIsGenerating(false);
            return;
          }
        }
        
        // Continue polling for temporary errors
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
    // Clear webhook timeout since we received a webhook
    if (webhookTimeoutRef.current) {
      clearTimeout(webhookTimeoutRef.current);
      webhookTimeoutRef.current = null;
    }
    
    // Stop polling since webhook arrived
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Check if this webhook is for our current generation
    if (message.batch_id !== currentBatchIdRef.current) {
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
          
          const webhookResult: LogoMachineResponse = {
            success: true,
            batch_id: message.batch_id,
            prediction_id: message.batch_id,
            credits_used: prediction.credits_used || 0,
            generation_time_ms: Date.now() - new Date(prediction.created_at).getTime(),
            logo: outputData.logo
          };
          
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

    const subscription = supabase
      .channel(`user_${user.id}_updates`)
      .on('broadcast', { event: 'webhook_update' }, (payload) => {
        handleWebhookUpdate(payload.payload);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, handleWebhookUpdate, supabase]);

  /**
   * Main generation function
   */
  const generate = async (request: LogoMachineRequest): Promise<LogoMachineResponse> => {
    // Validation
    if (!user?.id) {
      throw new Error('Please sign in to generate logos');
    }

    // Wait for credits to load
    if (creditsLoading) {
      throw new Error('Loading credits information...');
    }
    
    if (!credits || credits.available_credits < 3) {
      throw new Error('Insufficient credits. Please purchase more credits to continue.');
    }

    // Reset state
    setIsGenerating(true);
    setError(undefined);
    setResult(undefined);
    
    try {
      // Call the server action
      const response = await generateLogo({
        ...request,
        user_id: user.id,
      });
      
      
      // Store the batch_id for webhook/polling matching
      currentBatchIdRef.current = response.batch_id;
      
      // Set initial result (will be updated by webhook or polling)
      setResult(response);
      
      // Logo generation is always async, so set up webhook timeout and polling fallback
      // Start polling after 5 seconds if no webhook arrives
      webhookTimeoutRef.current = setTimeout(() => {
        startPolling(response.batch_id);
      }, 5000);
      
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
    generate,
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