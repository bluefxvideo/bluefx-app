'use server';

import { createClient } from '@/app/supabase/server';
import { ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';

/**
 * Get active (ongoing) predictions for a user that can be restored on page refresh
 */
export async function getActivePredictions(userId: string) {
  const supabase = await createClient();
  
  try {
    console.log('🔍 Querying active predictions for user:', userId);
    
    // Get predictions that are still in progress (not completed/failed)
    // Only get recent ones (within last 5 minutes) to avoid stuck/stale predictions
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: predictions, error } = await supabase
      .from('ai_predictions')
      .select('*')
      .eq('user_id', userId)
      .eq('tool_id', 'thumbnail-machine')
      .in('status', ['starting', 'processing', 'in_queue'])
      .gte('created_at', fiveMinutesAgo) // Only restore predictions created within last 5 minutes
      .order('created_at', { ascending: false });

    console.log('📊 Database query result:', {
      error: error ? error.message : null,
      predictionsFound: predictions?.length || 0,
      predictions: predictions?.map(p => ({
        id: p.prediction_id,
        status: p.status,
        service_id: p.service_id,
        created_at: p.created_at
      }))
    });

    if (error) {
      console.error('❌ Error fetching active predictions:', error);
      return { success: false, error: error.message };
    }

    // Convert predictions to the expected format for restoration
    const activePredictions = predictions?.map(prediction => {
      const inputData = prediction.input_data as any;
      const prompt = inputData?.prompt || '';
      const serviceId = prediction.service_id;
      
      // Determine generation type from service_id
      let type = 'thumbnail';
      if (serviceId === 'face-swap-only' || serviceId?.includes('face')) {
        type = 'face-swap';
      } else if (serviceId === 'recreation-only' || serviceId?.includes('recreate')) {
        type = 'recreate';
      } else if (serviceId === 'titles-only' || serviceId?.includes('title')) {
        type = 'titles';
      } else if (serviceId === 'generate') {
        type = 'thumbnail';
      }
      
      return {
        predictionId: prediction.prediction_id,
        batchId: prediction.prediction_id, // Use prediction ID as batch ID
        prompt,
        type,
        serviceId,
        status: prediction.status,
        createdAt: prediction.created_at,
        inputData
      };
    }) || [];

    // Also check for stuck predictions (older than 5 minutes) and mark them as failed
    await cleanupStuckPredictions(userId);
    
    console.log(`🔄 Found ${activePredictions.length} recent active predictions for user`);
    
    return {
      success: true,
      predictions: activePredictions
    };

  } catch (error) {
    console.error('❌ Error in getActivePredictions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Clean up stuck predictions that have been processing for too long
 */
async function cleanupStuckPredictions(userId: string) {
  try {
    const supabase = await createClient();
    
    // Mark predictions as failed if they've been processing for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: stuckPredictions, error: selectError } = await supabase
      .from('ai_predictions')
      .select('prediction_id, created_at, service_id')
      .eq('user_id', userId)
      .eq('tool_id', 'thumbnail-machine')
      .in('status', ['starting', 'processing', 'in_queue'])
      .lt('created_at', fiveMinutesAgo);

    if (selectError) {
      console.error('❌ Error finding stuck predictions:', selectError);
      return;
    }

    if (stuckPredictions && stuckPredictions.length > 0) {
      console.log(`🧹 Found ${stuckPredictions.length} stuck predictions, marking as failed:`, 
        stuckPredictions.map(p => ({ id: p.prediction_id.slice(-8), service: p.service_id, age: p.created_at }))
      );

      const { error: updateError } = await supabase
        .from('ai_predictions')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString(),
          logs: 'Marked as failed due to timeout (stuck for >5 minutes)'
        })
        .eq('user_id', userId)
        .eq('tool_id', 'thumbnail-machine')
        .in('status', ['starting', 'processing', 'in_queue'])
        .lt('created_at', fiveMinutesAgo);

      if (updateError) {
        console.error('❌ Error updating stuck predictions:', updateError);
      } else {
        console.log('✅ Successfully marked stuck predictions as failed');
      }
    } else {
      console.log('✅ No stuck predictions found');
    }
  } catch (error) {
    console.error('❌ Error in cleanupStuckPredictions:', error);
  }
}

