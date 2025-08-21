import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { updatePredictionRecord } from '@/actions/database/thumbnail-database';
import type { Json } from '@/types/database';

/**
 * Voice Over AI Webhook Handler
 * Processes Voice Over completion events for unified system integration
 * 
 * Since OpenAI TTS is synchronous, this handles "fake" webhook completions
 * to maintain consistency with other async AI tools in our system
 */

interface VoiceOverWebhookPayload {
  prediction_id: string;
  user_id: string;
  status: 'succeeded' | 'failed';
  output?: string; // Audio URL
  generated_audio?: {
    id: string;
    audio_url: string;
    voice_id: string;
    voice_name: string;
    script_text: string;
    duration_seconds: number;
    file_size_mb: number;
    export_format: string;
    created_at: string;
  };
  error?: string;
  completed_at: string;
}

interface VoiceOverProcessingResult {
  success: boolean;
  prediction_id: string;
  status: string;
  processing_time_ms?: number;
  error?: string;
}

/**
 * POST handler for Voice Over webhook events
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    console.log('🎙️ Voice Over Webhook: Received completion event');
    
    const payload: VoiceOverWebhookPayload = await request.json();
    console.log(`🤖 Voice Over Decision: Processing ${payload.prediction_id} - Status: ${payload.status}`);

    // Validate required fields
    if (!payload.prediction_id || !payload.user_id) {
      console.warn('🚨 Invalid Voice Over webhook payload');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let result: VoiceOverProcessingResult;

    if (payload.status === 'succeeded') {
      result = await processVoiceOverCompletion(payload);
    } else if (payload.status === 'failed') {
      result = await processVoiceOverFailure(payload);
    } else {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Voice Over Webhook: Completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      message: `Voice Over ${payload.status} processed`,
      result: {
        ...result,
        processing_time_ms: processingTime,
      },
    });

  } catch (error) {
    console.error('🚨 Voice Over Webhook Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Voice Over webhook processing failed',
      processing_time_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}

/**
 * Process successful Voice Over completion
 */
async function processVoiceOverCompletion(payload: VoiceOverWebhookPayload): Promise<VoiceOverProcessingResult> {
  try {
    console.log(`🎙️ Processing Voice Over completion: ${payload.prediction_id}`);
    
    // Update prediction record with final status
    await updatePredictionRecord(payload.prediction_id, {
      status: 'succeeded',
      output_data: {
        audio_url: payload.output,
        generated_audio: payload.generated_audio,
        webhook_processed: true,
        processed_at: new Date().toISOString(),
      } as Json,
      completed_at: payload.completed_at,
    });

    // TODO: Broadcast to user via real-time channel
    console.log(`📡 Broadcasting Voice Over completion to user: ${payload.user_id}`);

    // TODO: Update voice over history/stats if needed
    console.log(`📊 Voice Over stats updated for user: ${payload.user_id}`);

    return {
      success: true,
      prediction_id: payload.prediction_id,
      status: 'complete',
    };

  } catch (error) {
    console.error('Voice Over completion processing failed:', error);
    
    return {
      success: false,
      prediction_id: payload.prediction_id,
      status: 'error',
      error: error instanceof Error ? error.message : 'Processing failed',
    };
  }
}

/**
 * Process failed Voice Over generation
 */
async function processVoiceOverFailure(payload: VoiceOverWebhookPayload): Promise<VoiceOverProcessingResult> {
  try {
    console.log(`❌ Processing Voice Over failure: ${payload.prediction_id}`);
    
    // Update prediction record with error status
    await updatePredictionRecord(payload.prediction_id, {
      status: 'failed',
      output_data: {
        error: payload.error || 'Voice generation failed',
        webhook_processed: true,
        processed_at: new Date().toISOString(),
      } as Json,
      completed_at: payload.completed_at,
    });

    // TODO: Handle credit refunds if needed
    console.log(`💳 Voice Over failure - checking credit refunds for user: ${payload.user_id}`);

    // TODO: Broadcast failure notification to user
    console.log(`📡 Broadcasting Voice Over failure to user: ${payload.user_id}`);

    return {
      success: true, // Webhook processed successfully even though generation failed
      prediction_id: payload.prediction_id,
      status: 'failed',
      error: payload.error,
    };

  } catch (error) {
    console.error('Voice Over failure processing failed:', error);
    
    return {
      success: false,
      prediction_id: payload.prediction_id,
      status: 'error',
      error: error instanceof Error ? error.message : 'Failure processing failed',
    };
  }
}

/**
 * GET handler for Voice Over status checks (for testing)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const predictionId = url.searchParams.get('prediction_id');
  
  if (!predictionId) {
    return NextResponse.json({ error: 'Missing prediction_id' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    
    // Get prediction status
    const { data: prediction, error } = await supabase
      .from('ai_predictions')
      .select('*')
      .eq('prediction_id', predictionId)
      .eq('tool_id', 'voice-over')
      .single();

    if (error || !prediction) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      prediction_id: predictionId,
      status: prediction.status,
      output_data: prediction.output_data,
      created_at: prediction.created_at,
      completed_at: prediction.completed_at,
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed'
    }, { status: 500 });
  }
}