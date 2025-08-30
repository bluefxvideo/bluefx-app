'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateThumbnails, ThumbnailMachineRequest, ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { useCredits } from '@/hooks/useCredits';

/**
 * Custom hook for thumbnail machine functionality
 * Simplified to match AI Cinematographer pattern
 */
export function useThumbnailMachine() {
  const { credits } = useCredits();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ThumbnailMachineResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [user, setUser] = useState<User | null>(null);
  
  // Use ref to track current result without causing subscription re-creation
  const resultRef = useRef<ThumbnailMachineResponse | undefined>(undefined);
  const isGeneratingRef = useRef<boolean>(false);
  const lastProcessedRef = useRef<string | null>(null);
  
  const supabase = createClient();

  // Update refs when state changes
  useEffect(() => {
    resultRef.current = result;
  }, [result]);
  
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription?.unsubscribe();
  }, [supabase.auth]);

  // State restoration - check for ongoing generations when user is authenticated
  useEffect(() => {
    if (!user?.id) return;
    
    console.log('🔍 Checking for ongoing thumbnail generations...');
    
    const checkOngoingGenerations = async () => {
      try {
        // Only check for VERY recent predictions (last 10 minutes) that might need restoration
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        
        const { data: recentPredictions } = await supabase
          .from('ai_predictions')
          .select('*')
          .eq('user_id', user.id)
          .eq('tool_id', 'thumbnail-machine')
          .gte('created_at', tenMinutesAgo)
          .in('status', ['starting', 'processing'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (recentPredictions && recentPredictions.length > 0) {
          const prediction = recentPredictions[0];
          console.log('📺 Found ongoing thumbnail generation, restoring state:', prediction.prediction_id);
          
          // Restore processing state
          setIsGenerating(true);
          
          // Create placeholder result for processing display
          const placeholderResult: ThumbnailMachineResponse = {
            success: true,
            batch_id: prediction.prediction_id,
            credits_used: 0,
            generation_time_ms: 0,
            thumbnails: []
          };
          
          setResult(placeholderResult);
          console.log('✅ Thumbnail processing state restored');
        }
      } catch (error) {
        console.error('State restoration error:', error);
      }
    };

    // Delay to let user auth complete
    const timeoutId = setTimeout(checkOngoingGenerations, 1000);
    return () => clearTimeout(timeoutId);
  }, [user?.id, supabase]);

  // Generate thumbnails - simplified like AI Cinematographer
  const generateThumbnail = async (request: ThumbnailMachineRequest): Promise<ThumbnailMachineResponse> => {
    // Authentication check
    if (!user?.id) {
      const errorResponse: ThumbnailMachineResponse = {
        success: false,
        error: 'User must be authenticated to generate thumbnails',
        batch_id: `error_${Date.now()}`,
        generation_time_ms: 0,
        credits_used: 0,
        thumbnails: []
      };
      setError(errorResponse.error);
      return errorResponse;
    }

    setIsGenerating(true);
    setError(undefined);
    
    // Create immediate placeholder result
    const batch_id = `thumbnail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const placeholderResult: ThumbnailMachineResponse = {
      success: true,
      batch_id,
      generation_time_ms: 0,
      credits_used: 0,
      thumbnails: []
    };
    setResult(placeholderResult);
    
    try {
      const response = await generateThumbnails({
        ...request,
        user_id: user.id,
      });
      
      // Don't overwrite result if it's a face swap that returns empty arrays (webhook will update it)
      // Check if this is a face swap operation that's waiting for webhook
      const isFaceSwapWaitingForWebhook = request.operation_mode === 'face-swap-only' && 
        response.success && 
        response.face_swapped_thumbnails?.length === 0;
      
      if (!isFaceSwapWaitingForWebhook) {
        setResult(response);
      } else {
        console.log('🔄 Face swap initiated - waiting for webhook to update results');
        // Keep the placeholder result with the batch_id but don't overwrite with empty arrays
        setResult(prev => ({
          ...response,
          // Preserve any face swap results that might have already arrived via webhook
          face_swapped_thumbnails: prev?.face_swapped_thumbnails?.length ? prev.face_swapped_thumbnails : []
        }));
      }
      
      if (!response.success) {
        setError(response.error);
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Thumbnail generation failed';
      const errorResponse: ThumbnailMachineResponse = {
        success: false,
        error: errorMessage,
        batch_id: `error_${Date.now()}`,
        generation_time_ms: 0,
        credits_used: 0,
        thumbnails: []
      };
      setError(errorMessage);
      setResult(errorResponse);
      return errorResponse;
    } finally {
      // Don't stop generating for face swap - webhook will handle that
      if (request.operation_mode !== 'face-swap-only') {
        setIsGenerating(false);
      }
    }
  };

  // Clear results
  const clearResults = () => {
    setResult(undefined);
    setError(undefined);
    setIsGenerating(false);
  };

  // Handle webhook broadcast updates (Direct broadcasting like AI Cinematographer)
  const handleWebhookUpdate = useCallback(async (message: any) => {
    const timestamp = new Date().toISOString();
    console.log(`📡 [${timestamp}] Processing webhook broadcast:`, {
      tool_type: message.tool_type,
      prediction_id: message.prediction_id,
      batch_id: message.batch_id,
      status: message.status,
      has_results: !!message.results
    });
    
    if (message.tool_type !== 'face-swap' && message.tool_type !== 'thumbnail' && message.tool_type !== 'ideogram') {
      console.log('⏭️ Skipping - not a thumbnail tool');
      return;
    }
    
    // Simple duplicate prevention - one prediction ID only
    console.log('🔍 Duplicate check:', {
      messagePredictionId: message.prediction_id,
      lastProcessed: lastProcessedRef.current,
      isDuplicate: lastProcessedRef.current === message.prediction_id
    });
    
    if (lastProcessedRef.current === message.prediction_id) {
      console.log('⏭️ DUPLICATE DETECTED - Skipping already processed prediction:', message.prediction_id);
      return;
    }
    lastProcessedRef.current = message.prediction_id;
    
    if (message.status !== 'succeeded' || !message.results?.success) {
      return;
    }
    
    // Get the prediction record to get the actual image data
    if (message.prediction_id) {
      console.log('🔍 Querying prediction with external_id:', message.prediction_id, 'for user:', user?.id);
      try {
        // For face swap, we might need to query by prediction_id OR external_id
        let prediction;
        let error;
        
        // First try by external_id (normal flow)
        ({ data: prediction, error } = await supabase
          .from('ai_predictions')
          .select('prediction_id, output_data, user_id')
          .eq('external_id', message.prediction_id)
          .eq('user_id', user.id)
          .single());
        
        // If not found and it's face swap, try by prediction_id directly using batch_id
        if (!prediction && message.tool_type === 'face-swap' && message.batch_id) {
          console.log('🔍 Face swap: trying direct prediction_id match with batch_id:', message.batch_id);
          ({ data: prediction, error } = await supabase
            .from('ai_predictions')
            .select('prediction_id, output_data, user_id')
            .eq('prediction_id', message.batch_id)
            .eq('user_id', user.id)
            .single());
        }
          
        console.log('🔍 Prediction query result:', { prediction, error });
          
        if (prediction && prediction.output_data) {
          const currentResult = resultRef.current;
          console.log('🔍 Matching check:', { 
            currentBatchId: currentResult?.batch_id, 
            predictionId: prediction.prediction_id,
            messageBatchId: message.batch_id,
            isMatch: currentResult && (currentResult.batch_id === prediction.prediction_id || currentResult.batch_id === message.batch_id)
          });
          // Match by either prediction_id or batch_id (for face swap)
          const isCurrentGeneration = currentResult && (
            currentResult.batch_id === prediction.prediction_id || 
            currentResult.batch_id === message.batch_id
          );
          
          if (isCurrentGeneration) {
            console.log('🎉 [BROADCAST] Webhook broadcast matches - updating UI with results!');
            
            const outputData = prediction.output_data as any;
            console.log('🔍 Output data to process:', outputData);
            
            // Create the final result directly without multiple state updates
            const currentResult = resultRef.current;
            if (currentResult) {
              let finalResult;
              
              // Handle Face Swap results
              if (outputData.face_swapped_thumbnails) {
                console.log('🎯 Processing face swap results:', outputData.face_swapped_thumbnails);
                finalResult = {
                  ...currentResult,
                  face_swapped_thumbnails: outputData.face_swapped_thumbnails.map((item: any) => ({
                    url: item.image_url || item.url,
                    source_thumbnail_id: item.source_thumbnail_id || currentResult.batch_id,
                    replicate_url: item.image_url || item.url,
                  }))
                };
              }
              // Handle Normal Generate results
              else if (outputData.thumbnails) {
                console.log('🎯 Processing thumbnail results:', outputData.thumbnails);
                finalResult = {
                  ...currentResult,
                  thumbnails: outputData.thumbnails.map((item: any, index: number) => ({
                    id: `${currentResult.batch_id}_${index + 1}`,
                    url: item.image_url || item.url,
                    variation_index: index + 1,
                    batch_id: currentResult.batch_id,
                  }))
                };
              }
              
              if (finalResult) {
                console.log('🔍 Setting final result with data:', {
                  has_face_swap: !!finalResult.face_swapped_thumbnails,
                  face_swap_count: finalResult.face_swapped_thumbnails?.length || 0,
                  has_thumbnails: !!finalResult.thumbnails,
                  thumbnail_count: finalResult.thumbnails?.length || 0,
                  batch_id: finalResult.batch_id,
                  success: finalResult.success
                });
                setResult(finalResult);
                console.log('✅ Result state updated via setResult');
              } else {
                console.warn('⚠️ No final result created from output data');
              }
            } else {
              console.warn('⚠️ No current result to update');
            }
            
            // Wait for next tick to ensure setResult completes before stopping loading
            setTimeout(() => {
              setIsGenerating(false);
              console.log('🎉 [BROADCAST] Generation complete via broadcast!');
            }, 0);
          }
        } else if (error) {
          console.error('❌ Prediction query error:', error);
        } else {
          console.log('⚠️ No prediction found or no output_data');
        }
      } catch (error) {
        console.error('❌ Error fetching prediction from broadcast:', error);
      }
    }
  }, [user?.id, supabase]);

  // Subscribe to real-time updates for thumbnail status
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔔 Setting up real-time subscription for user:', user.id);

    const subscription = supabase
      .channel(`user_${user.id}_updates`)
      .on(
        'broadcast',
        {
          event: 'webhook_update',
        },
        (payload) => {
          console.log('🔔 Real-time broadcast received:', payload);
          handleWebhookUpdate(payload.payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_predictions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔔 Real-time thumbnail update received:', {
            event: payload.eventType,
            old: payload.old,
            new: payload.new
          });

          const updatedPrediction = payload.new as any;
          
          // Only process thumbnail-machine predictions that are completed
          // Skip postgres updates for now since broadcast handler works better
          if (updatedPrediction?.tool_id !== 'thumbnail-machine' || 
              updatedPrediction?.status !== 'completed' ||
              !updatedPrediction?.output_data) {
            return;
          }
          
          // TEMPORARY: Skip postgres updates to avoid double-processing with broadcasts
          console.log('⏭️ [POSTGRES] Skipping postgres update - using broadcast instead');
          return;
          
          // Update current result if it matches the current generation
          const currentResult = resultRef.current;
          const isCurrentGeneration = currentResult && currentResult.batch_id && 
            updatedPrediction?.prediction_id === currentResult.batch_id;

          console.log('🔍 Real-time matching check:', {
            hasCurrentResult: !!currentResult,
            currentBatchId: currentResult?.batch_id,
            updatedPredictionId: updatedPrediction?.prediction_id,
            isMatch: isCurrentGeneration,
            isGenerating: isGeneratingRef.current
          });

          if (isCurrentGeneration) {
            console.log('📺 [POSTGRES] Updating current thumbnail result:', {
              batch_id: currentResult.batch_id,
              output_data: updatedPrediction.output_data
            });

            // Parse results from ai_predictions.output_data (AI Cinematographer pattern)
            const outputData = updatedPrediction.output_data;
            
            setResult(prev => {
              if (!prev) return prev;
              
              // Handle Face Swap results
              if (outputData.face_swapped_thumbnails) {
                return {
                  ...prev,
                  face_swapped_thumbnails: outputData.face_swapped_thumbnails.map((item: any) => ({
                    url: item.image_url,
                    source_thumbnail_id: item.source_thumbnail_id || prev.batch_id,
                    replicate_url: item.image_url,
                  }))
                };
              }
              
              // Handle Normal Generate results
              if (outputData.thumbnails) {
                return {
                  ...prev,
                  thumbnails: outputData.thumbnails.map((item: any, index: number) => ({
                    id: `${prev.batch_id}_${index + 1}`,
                    url: item.image_url,
                    variation_index: index + 1,
                    batch_id: prev.batch_id,
                  }))
                };
              }
              
              return prev;
            });

            // Stop generating when prediction is completed (UPDATE event)
            if (updatedPrediction.status === 'completed') {
              setIsGenerating(false);
              console.log('🎉 [POSTGRES] Thumbnail generation complete!');
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up real-time subscription');
      supabase.removeChannel(subscription);
    };
  }, [user?.id, supabase]);


  return {
    // Main function
    generate: generateThumbnail,
    
    // States
    isGenerating,
    result,
    error,
    credits,
    
    // Utilities
    clearResults,
  };
}

/**
 * Calculate estimated credits for a request
 * Matches the logic in the AI orchestrator
 */
function calculateEstimatedCredits(request: ThumbnailMachineRequest): number {
  let credits = 0;
  
  // Core thumbnail generation (2 credits per thumbnail)
  credits += (request.num_outputs || 4) * 2;
  
  // Face swap (3 credits per target)
  if (request.face_swap) {
    const targetsCount = request.face_swap.apply_to_all ? (request.num_outputs || 4) : 1;
    credits += targetsCount * 3;
  }
  
  // Title generation (1 credit)
  if (request.generate_titles) {
    credits += 1;
  }
  
  return credits;
}