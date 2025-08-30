'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateThumbnails, ThumbnailMachineRequest, ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { useCredits } from '@/hooks/useCredits';
import { updatePredictionRecord } from '@/actions/database/thumbnail-database';
import { usePredictionPolling } from '@/hooks/use-prediction-polling';
import { getIdeogramV2aPrediction } from '@/actions/models/ideogram-v2-turbo';
import { getFaceSwapPrediction } from '@/actions/models/face-swap-cdingram';

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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [activePredictionId, setActivePredictionId] = useState<string | null>(null);
  const [activePredictionType, setActivePredictionType] = useState<'ideogram' | 'face-swap' | null>(null);
  const pollingEnabledRef = useRef<boolean>(false);
  
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
    
    
    const checkOngoingGenerations = async () => {
      try {
        // Only restore VERY recent operations (last 3 minutes max)
        // Most operations complete within 30-60 seconds
        const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        
        const { data: recentPredictions } = await supabase
          .from('ai_predictions')
          .select('*')
          .eq('user_id', user.id)
          .eq('tool_id', 'thumbnail-machine')
          .gte('created_at', threeMinutesAgo)
          .in('status', ['starting', 'processing']) // Excludes 'cancelled', 'completed', 'failed'
          .order('created_at', { ascending: false })
          .limit(1);

        if (recentPredictions && recentPredictions.length > 0) {
          const prediction = recentPredictions[0];
          const createdAt = new Date(prediction.created_at);
          const ageInSeconds = (Date.now() - createdAt.getTime()) / 1000;
          
            id: prediction.prediction_id,
            age: `${Math.round(ageInSeconds)} seconds`,
            status: prediction.status
          });
          
          // Only restore if prediction is less than 3 minutes old
          // This prevents restoring stuck/orphaned records
          if (ageInSeconds < 180) { // 3 minutes
            
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
            
            // Auto-cleanup if this restoration gets stuck
            // Set a timeout to stop after reasonable time
            const maxWaitTime = Math.max(180000 - (ageInSeconds * 1000), 30000); // Remaining time up to 3 min, min 30 sec
            
            // Set timeout directly here since startGenerationTimeout isn't available yet
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
              setIsGenerating(false);
              setError('Generation timed out. Please try again.');
            }, maxWaitTime);
          } else {
            // Mark old stuck predictions as failed
            try {
              await updatePredictionRecord(prediction.prediction_id, {
                status: 'failed',
                completed_at: new Date().toISOString()
              });
            } catch (err) {
            }
          }
        }
      } catch (error) {
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
    
    // Don't create placeholder - just set loading state
    // The server will return the real batch_id and we'll use that everywhere
    
    let hadError = false;
    
    try {
      const response = await generateThumbnails({
        ...request,
        user_id: user.id,
      });
      
      
      // Start timeout now that we have the real batch_id
      const timeoutMs = request.operation_mode === 'face-swap-only' ? 180000 
                      : request.operation_mode === 'recreation-only' ? 150000 
                      : 120000;
      startGenerationTimeout(timeoutMs);
      
      // Always set the result with the server's batch_id
      setResult(response);
      
      
      if (!response.success) {
        setError(response.error);
        hadError = true;
      }
      
      return response;
    } catch (err) {
      hadError = true;
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
      // For face swap: only skip cleanup if the operation was successful
      // If there's an error, we need to clean up even for face swap
      const shouldCleanup = request.operation_mode !== 'face-swap-only' || hadError;
      
      if (shouldCleanup) {
        // Clear timeout since operation completed (successfully or with error)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
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

  // Cancel ongoing generation
  const cancelGeneration = useCallback(async () => {
    
    // Clear timeout if exists
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Update database to prevent state restoration from re-enabling generation
    const currentResult = resultRef.current;
    if (currentResult?.batch_id && user?.id) {
      try {
        await updatePredictionRecord(currentResult.batch_id, {
          status: 'cancelled',
          completed_at: new Date().toISOString()
        });
      } catch (error) {
      }
    }
    
    // Reset to clean initial state - no error message for user cancellation
    setIsGenerating(false);
    setResult(undefined);
    setError(undefined);
  }, [user?.id]);

  // Auto-timeout functionality
  const startGenerationTimeout = useCallback((timeoutMs: number = 180000) => { // 3 minutes default
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(async () => {
      
      // Update database to mark as failed to prevent restoration
      const currentResult = resultRef.current;
      if (currentResult?.batch_id && user?.id) {
        try {
          await updatePredictionRecord(currentResult.batch_id, {
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: 'Generation timed out'
          });
        } catch (error) {
        }
      }
      
      setIsGenerating(false);
      setError('Generation timed out. Please try again.');
    }, timeoutMs);
  }, [user?.id]);

  // Handle webhook broadcast updates (Direct broadcasting like AI Cinematographer)
  const handleWebhookUpdate = useCallback(async (message: any) => {
    const timestamp = new Date().toISOString();
      tool_type: message.tool_type,
      prediction_id: message.prediction_id,
      batch_id: message.batch_id,
      status: message.status,
      has_results: !!message.results,
      currentBatchId: resultRef.current?.batch_id,
      isGenerating: isGeneratingRef.current
    });
    
    if (message.tool_type !== 'face-swap' && message.tool_type !== 'thumbnail' && message.tool_type !== 'ideogram' && message.tool_type !== 'thumbnail-machine') {
      return;
    }
    
    // Simple duplicate prevention - one prediction ID only
      messagePredictionId: message.prediction_id,
      lastProcessed: lastProcessedRef.current,
      isDuplicate: lastProcessedRef.current === message.prediction_id
    });
    
    if (lastProcessedRef.current === message.prediction_id) {
      return;
    }
    lastProcessedRef.current = message.prediction_id;
    
    if (message.status !== 'succeeded' || !message.results?.success) {
      return;
    }
    
    // Get the prediction record to get the actual image data
    if (message.prediction_id) {
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
          .maybeSingle()); // Use maybeSingle to avoid error when no rows found
        
        // If not found and it's face swap, try by prediction_id directly using batch_id
        if (!prediction && message.tool_type === 'face-swap' && message.batch_id) {
          ({ data: prediction, error } = await supabase
            .from('ai_predictions')
            .select('prediction_id, output_data, user_id')
            .eq('prediction_id', message.batch_id)
            .eq('user_id', user.id)
            .maybeSingle()); // Use maybeSingle to avoid error when no rows found
        }
          
          
        if (prediction && prediction.output_data) {
          const currentResult = resultRef.current;
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
            
            const outputData = prediction.output_data as any;
            
            // Create the final result directly without multiple state updates
            const currentResult = resultRef.current;
            if (currentResult) {
              let finalResult;
              
              // Handle Face Swap results
              if (outputData.face_swapped_thumbnails) {
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
                  has_face_swap: !!finalResult.face_swapped_thumbnails,
                  face_swap_count: finalResult.face_swapped_thumbnails?.length || 0,
                  has_thumbnails: !!finalResult.thumbnails,
                  thumbnail_count: finalResult.thumbnails?.length || 0,
                  batch_id: finalResult.batch_id,
                  success: finalResult.success
                });
                setResult(finalResult);
              } else {
              }
            } else {
            }
            
            // Wait for next tick to ensure setResult completes before stopping loading
            setTimeout(() => {
              
              // Clear timeout since generation completed successfully
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
              
              setIsGenerating(false);
            }, 100); // Small delay to ensure state updates propagate
          }
        } else if (error) {
        } else {
        }
      } catch (error) {
      }
    }
  }, [user?.id, supabase]);

  // Subscribe to real-time updates for thumbnail status
  useEffect(() => {
    if (!user?.id) return;


    const subscription = supabase
      .channel(`user_${user.id}_updates`)
      .on(
        'broadcast',
        {
          event: 'webhook_update',
        },
        (payload) => {
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
          return;
          
          // Update current result if it matches the current generation
          const currentResult = resultRef.current;
          const isCurrentGeneration = currentResult && currentResult.batch_id && 
            updatedPrediction?.prediction_id === currentResult.batch_id;

            hasCurrentResult: !!currentResult,
            currentBatchId: currentResult?.batch_id,
            updatedPredictionId: updatedPrediction?.prediction_id,
            isMatch: isCurrentGeneration,
            isGenerating: isGeneratingRef.current
          });

          if (isCurrentGeneration) {
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
            }
          }
        }
      )
      .subscribe((status) => {
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user?.id, supabase]);


  // Debug what we're returning
  useEffect(() => {
      isGenerating,
      hasResult: !!result,
      resultSuccess: result?.success,
      faceSwapCount: result?.face_swapped_thumbnails?.length || 0,
      thumbnailCount: result?.thumbnails?.length || 0
    });
  }, [isGenerating, result]);
  
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
    cancelGeneration,
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