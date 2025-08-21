'use server';

import { createClient } from '@/app/supabase/server';
import { createHedraAPI } from '@/actions/models/hedra-api';

/**
 * Hedra API Polling System
 * Handles periodic checking of Hedra generation status since they don't provide webhooks
 */

interface HedraPollingJob {
  generation_id: string;
  user_id: string;
  avatar_video_id?: string;
  created_at: string;
  last_checked_at?: string;
  status: 'processing' | 'completed' | 'failed' | 'timeout';
  retry_count: number;
  max_retries: number;
  poll_interval_ms: number;
}

interface PollingResult {
  success: boolean;
  jobs_checked: number;
  completions_processed: number;
  errors: string[];
}

/**
 * Check all pending Hedra generations and process completions
 */
export async function pollHedraGenerations(): Promise<PollingResult> {
  const result: PollingResult = {
    success: true,
    jobs_checked: 0,
    completions_processed: 0,
    errors: [],
  };

  try {
    const supabase = await createClient();
    
    // Get all pending Hedra generations from prediction tracking
    const { data: pendingPredictions, error } = await supabase
      .from('ai_predictions')
      .select('*')
      .eq('service_id', 'hedra')
      .eq('tool_id', 'talking-avatar')
      .in('status', ['starting', 'processing'])
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch pending predictions: ${error.message}`);
    }

    if (!pendingPredictions || pendingPredictions.length === 0) {
      console.log('📊 No pending Hedra generations found');
      return result;
    }

    console.log(`🎬 Found ${pendingPredictions.length} pending Hedra generations`);

    const hedra = createHedraAPI();

    // Process each pending generation
    for (const prediction of pendingPredictions) {
      result.jobs_checked++;
      
      try {
        console.log(`🔍 Checking Hedra generation: ${prediction.prediction_id}`);
        
        // Check generation status
        const statusResult = await hedra.checkGenerationStatus(prediction.prediction_id);
        
        if (statusResult.status === 'complete' && statusResult.videoUrl) {
          console.log(`✅ Hedra generation completed: ${prediction.prediction_id}`);
          
          // Process completion via webhook endpoint
          const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/hedra-ai`;
          const completionPayload = {
            generation_id: prediction.prediction_id,
            user_id: prediction.user_id,
            avatar_video_id: findAvatarVideoId(prediction),
            action: 'manual_complete',
            video_url: statusResult.videoUrl,
            status: 'complete',
          };

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(completionPayload),
          });

          if (response.ok) {
            result.completions_processed++;
            console.log(`🎬 Successfully processed completion: ${prediction.prediction_id}`);
          } else {
            const error = `Webhook processing failed: ${response.status}`;
            result.errors.push(error);
            console.error(error);
          }
          
        } else if (statusResult.status === 'error') {
          console.error(`❌ Hedra generation failed: ${prediction.prediction_id} - ${statusResult.error}`);
          
          // Update prediction to failed status
          await supabase
            .from('ai_predictions')
            .update({
              status: 'failed',
              output_data: { error: statusResult.error },
              completed_at: new Date().toISOString(),
            })
            .eq('prediction_id', prediction.prediction_id);

          // Update avatar_videos record if exists
          const avatarVideoId = findAvatarVideoId(prediction);
          if (avatarVideoId) {
            await supabase
              .from('avatar_videos')
              .update({
                status: 'failed',
                error_message: statusResult.error,
                failed_at: new Date().toISOString(),
              })
              .eq('id', avatarVideoId);
          }
          
        } else {
          console.log(`⏳ Hedra generation still processing: ${prediction.prediction_id} - ${statusResult.status}`);
          
          // Update last checked timestamp
          await supabase
            .from('ai_predictions')
            .update({
              updated_at: new Date().toISOString(),
            })
            .eq('prediction_id', prediction.prediction_id);
        }

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (jobError) {
        const error = `Failed to check ${prediction.prediction_id}: ${jobError instanceof Error ? jobError.message : 'Unknown error'}`;
        result.errors.push(error);
        console.error(error);
      }
    }

    console.log(`🎬 Polling complete: ${result.jobs_checked} checked, ${result.completions_processed} completed`);

  } catch (error) {
    result.success = false;
    const errorMsg = error instanceof Error ? error.message : 'Polling failed';
    result.errors.push(errorMsg);
    console.error('🚨 Hedra polling failed:', errorMsg);
  }

  return result;
}

/**
 * Start a background polling job for Hedra generations
 * This should be called periodically via a cron job or similar
 */
export async function startHedraPolling(): Promise<void> {
  console.log('🎬 Starting Hedra polling service...');
  
  // Run polling every 30 seconds
  const pollInterval = 30 * 1000; // 30 seconds
  
  const poll = async () => {
    try {
      const result = await pollHedraGenerations();
      
      if (!result.success && result.errors.length > 0) {
        console.error('🚨 Polling errors:', result.errors);
      }
      
      // Schedule next poll
      setTimeout(poll, pollInterval);
      
    } catch (error) {
      console.error('🚨 Polling cycle failed:', error);
      // Continue polling even if one cycle fails
      setTimeout(poll, pollInterval);
    }
  };

  // Start initial poll
  poll();
}

/**
 * Helper function to find avatar_video_id from prediction metadata
 */
function findAvatarVideoId(prediction: any): string | undefined {
  // Try to extract avatar_video_id from input_data or metadata
  const inputData = prediction.input_data as any;
  
  if (inputData?.avatar_video_id) {
    return inputData.avatar_video_id;
  }
  
  // Return the prediction_id as fallback since we store it as batch_id
  return prediction.prediction_id;
}

/**
 * Check specific Hedra generation status (for manual checking)
 */
export async function checkSpecificGeneration(generationId: string): Promise<{
  success: boolean;
  status?: string;
  videoUrl?: string;
  error?: string;
}> {
  try {
    const hedra = createHedraAPI();
    const result = await hedra.checkGenerationStatus(generationId);
    
    return {
      success: result.success,
      status: result.status,
      videoUrl: result.videoUrl,
      error: result.error,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed',
    };
  }
}

/**
 * Process a specific completion manually (for testing)
 */
export async function processManualCompletion(
  generationId: string,
  userId: string,
  videoUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/hedra-ai`;
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        generation_id: generationId,
        user_id: userId,
        action: 'manual_complete',
        video_url: videoUrl,
        status: 'complete',
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`);
    }

    return { success: true };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Manual processing failed',
    };
  }
}