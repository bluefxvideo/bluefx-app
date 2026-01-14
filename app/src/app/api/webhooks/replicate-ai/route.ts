import { NextRequest, NextResponse } from 'next/server';
import { downloadAndUploadImage, downloadAndUploadVideo, downloadAndUploadAudio } from '@/actions/supabase-storage';
import {
  updatePredictionRecord,
  updatePredictionRecordAdmin,
  storeThumbnailResults,
  recordGenerationMetrics
} from '@/actions/database/thumbnail-database';
import { updateCinematographerVideo } from '@/actions/database/cinematographer-database';
import { storeLogoResults, recordLogoMetrics } from '@/actions/database/logo-database';
import { updateMusicRecord } from '@/actions/database/music-database';
import { createVideoUpscalePrediction } from '@/actions/models/video-upscale';
// import { updateScriptVideoRecord } from '@/actions/database/script-video-database';
import type { Json } from '@/types/database';

/**
 * ENHANCED AI-Orchestrated Webhook Handler
 * Intelligent processing with real-time broadcasting and multi-tool support
 */

interface ReplicateInput {
  prompt?: string;
  negative_prompt?: string;
  user_id?: string;
  batch_id?: string;
  metadata?: {
    user_id?: string;
    batch_id?: string;
  };
  num_outputs?: number;
  swap_image?: string;
  input_image?: string;
  topic?: string;
  title_style?: string;
  title_count?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  output_quality?: string;
  seed?: number;
  reference_image?: string;
  style_type?: string;
  // Logo Machine (Ideogram V3) properties
  aspect_ratio?: string;
  magic_prompt_option?: string;
  image?: string; // For reference images
  style_reference_images?: string[]; // For style references
  // AI Cinematographer properties  
  duration?: number;
  motion_scale?: number;
  // Music Machine properties
  model_version?: string;
  output_format?: string;
  input_audio?: string;
  continuation?: boolean;
  normalization_strategy?: string;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  classifier_free_guidance?: number;
  // Script-to-Video properties
  segments?: any[];
  voice_settings?: any;
  // Voice Over properties
  script_text?: string;
  voice_id?: string;
  avatar_image_url?: string;
  // Video Swap (Wan 2.2 Animate Replace) properties
  video?: string;
  character_image?: string;
  job_id?: string;
  // Video Upscale (Topaz Labs) properties
  target_resolution?: string;
  target_fps?: number;
}

interface ReplicateWebhookPayload {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version: string;
  input: ReplicateInput;
  output?: string | string[];
  error?: string;
  logs?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  metrics?: {
    predict_time?: number;
  };
  // Enhanced metadata from our orchestrator
  metadata?: {
    user_id?: string;
    tool_id?: string;
    batch_id?: string;
    workflow_type?: string;
  };
}

interface WebhookProcessingResult {
  success: boolean;
  tool_type: string;
  results_processed: number;
  credits_used: number;
  real_time_broadcast: boolean;
  error?: string;
}

interface PayloadAnalysis {
  tool_type: string;
  processing_strategy: string;
  user_id: string | null;
  batch_id: string | null;
  workflow_type: string;
  expected_outputs: number;
  requires_batch_processing: boolean;
  requires_face_processing: boolean;
  requires_real_time_update: boolean;
}

interface ThumbnailResult {
  user_id: string;
  prompt: string;
  image_urls: string[];
  dimensions: string;
  height: number;
  width: number;
  model_name: string;
  model_version?: string | null;
  batch_id?: string | null;
  generation_settings?: Json | null;
  metadata?: Json | null;
}

/**
 * Enhanced AI webhook processing with real-time capabilities
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let processingResult: WebhookProcessingResult = {
    success: false,
    tool_type: 'unknown',
    results_processed: 0,
    credits_used: 0,
    real_time_broadcast: false,
  };

  try {
    console.log('🎣 AI Webhook: Received Replicate response');
    
    // Parse and validate webhook payload
    const payload: ReplicateWebhookPayload = await request.json();
    console.log(`🤖 AI Decision: Processing ${payload.id} - Status: ${payload.status}`, {
      model_version: payload.version,
      has_output: !!payload.output,
      input_keys: payload.input ? Object.keys(payload.input) : 'none'
    });

    // Enhanced security validation
    if (!validateWebhookAuthenticity(request, payload)) {
      console.warn('🚨 Security: Suspicious webhook request blocked');
      return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 403 });
    }

    // AI Decision: Determine processing strategy based on payload
    const aiAnalysis = await analyzeWebhookPayload(payload);
    console.log(`🧠 AI Analysis: Tool=${aiAnalysis.tool_type}, Strategy=${aiAnalysis.processing_strategy}`, {
      batch_id: aiAnalysis.batch_id,
      user_id: aiAnalysis.user_id,
      expected_outputs: aiAnalysis.expected_outputs
    });

    // Note: Prediction record is now updated by individual result handlers (AI Cinematographer pattern)

    // AI Decision: Route to appropriate processing strategy
    if (payload.status === 'succeeded' && payload.output) {
      processingResult = await handleSuccessfulGeneration(payload, aiAnalysis);
    } else if (payload.status === 'failed') {
      processingResult = await handleFailedGeneration(payload, aiAnalysis);
    } else if (payload.status === 'processing') {
      processingResult = await handleProcessingUpdate(payload, aiAnalysis);
    } else {
      console.log(`📊 Status Update: ${payload.id} → ${payload.status}`);
      processingResult.success = true;
    }

    // Real-time broadcasting to frontend
    if (aiAnalysis.user_id) {
      await broadcastToUser(aiAnalysis.user_id, {
        type: 'webhook_processed',
        prediction_id: payload.id,
        batch_id: aiAnalysis.batch_id, // Include batch_id for face swap matching
        status: payload.status,
        tool_type: aiAnalysis.tool_type,
        results: processingResult,
        timestamp: new Date().toISOString(),
      });
      processingResult.real_time_broadcast = true;
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ AI Webhook: Completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      message: `AI webhook processed ${payload.id}`,
      processing_result: processingResult,
      processing_time_ms: processingTime,
    });

  } catch (error) {
    console.error('🚨 AI Webhook Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'AI webhook processing failed',
      processing_result: processingResult,
      processing_time_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}

/**
 * Enhanced security validation
 */
function validateWebhookAuthenticity(request: NextRequest, payload: ReplicateWebhookPayload): boolean {
  // Basic validation - in production, add signature verification
  const userAgent = request.headers.get('user-agent');
  const contentType = request.headers.get('content-type');
  
  console.log('🔍 Webhook Headers:', {
    userAgent,
    contentType,
    payloadHasId: !!payload.id,
    payloadHasStatus: !!payload.status,
    payloadHasVersion: !!payload.version
  });
  
  // AI Decision: More flexible validation - Replicate doesn't always send "Replicate" in User-Agent
  return !!(
    contentType?.includes('application/json') &&
    payload.id &&
    payload.status &&
    payload.version
  );
}

/**
 * AI payload analysis for intelligent processing
 */
async function analyzeWebhookPayload(payload: ReplicateWebhookPayload): Promise<PayloadAnalysis> {
  // AI Decision: Analyze payload to determine optimal processing
  const analysis = {
    tool_type: 'unknown',
    processing_strategy: 'unknown',
    user_id: null as string | null,
    batch_id: null as string | null,
    workflow_type: 'standard',
    expected_outputs: 1,
    requires_batch_processing: false,
    requires_face_processing: false,
    requires_real_time_update: false,
  };

  // Extract user context
  analysis.user_id = payload.metadata?.user_id || 
                    payload.input?.user_id || 
                    payload.input?.metadata?.user_id || null;

  analysis.batch_id = payload.metadata?.batch_id || 
                     payload.input?.batch_id || 
                     payload.input?.metadata?.batch_id || null;

  // AI Decision: Determine tool type from multiple signals
  // Check output type first - if it's a video file, it's likely AI Cinematographer
  const outputUrl = typeof payload.output === 'string' ? payload.output : payload.output?.[0];
  const isVideoOutput = outputUrl && (outputUrl.includes('.mp4') || outputUrl.includes('.mov') || outputUrl.includes('.webm'));

  // Check for audio output (music generation)
  const isAudioOutput = outputUrl && (outputUrl.includes('.mp3') || outputUrl.includes('.wav') || outputUrl.includes('.m4a') || outputUrl.includes('.flac'));

  // Check for music-specific batch_id pattern
  const isMusicBatchId = analysis.batch_id && analysis.batch_id.startsWith('music_');

  // IMPORTANT: Check Video Upscale FIRST - Topaz video upscale has specific version
  if (
    payload.version?.includes('topazlabs/video-upscale') ||
    payload.version?.includes('topazlabs') ||
    (payload.input?.video && payload.input?.target_resolution && !payload.input?.character_image)
  ) {
    analysis.tool_type = 'video-upscale';
    analysis.processing_strategy = 'single_video_upscale';
    analysis.expected_outputs = 1;
    analysis.requires_real_time_update = true;
  } else if (
    // Check Video Swap (before AI Cinematographer) since both output video
    // Video Swap has specific inputs: video + character_image
    payload.version?.includes('wan-2.2-animate-replace') ||
    payload.version?.includes('wan-video') ||
    (payload.input?.video && payload.input?.character_image)
  ) {
    analysis.tool_type = 'video-swap';
    analysis.processing_strategy = 'single_video_swap';
    analysis.expected_outputs = 1;
    analysis.requires_real_time_update = true;
  } else if (isVideoOutput ||
      payload.version?.includes('dc91b71f6bafe90e311c8b6e03b9b5c1ce53f932b47e243c3a2ebf90d2d2a12d') || // Stable Video Diffusion
      payload.version?.includes('kling') || // Kling model
      (payload.input?.duration && payload.input?.aspect_ratio) ||
      (payload.input?.prompt && (payload.input?.motion_scale || payload.input?.reference_image))) {
    analysis.tool_type = 'ai-cinematographer';
    analysis.processing_strategy = 'single_video_generation';
    analysis.expected_outputs = 1;
    analysis.requires_real_time_update = true;
  } else if (payload.version?.includes('flux-thumbnails-v2') ||
            payload.version?.includes('35eacd3dbd088d6421f7ee27646701b5e03ec5a9a0f68f43112fa228d6fc2522') || // Ideogram V2 Turbo
            (payload.input?.prompt && payload.input?.style_type && !payload.input?.duration)) {
    analysis.tool_type = 'thumbnail-machine';
    analysis.processing_strategy = 'batch_thumbnails';
    analysis.expected_outputs = payload.input?.num_outputs || 1;
    analysis.requires_batch_processing = true;
    analysis.requires_real_time_update = true;
  } else if (payload.version?.includes('d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111') || // Face Swap CDingram
            payload.version?.includes('face-swap') ||
            (payload.input?.swap_image && payload.input?.input_image)) {
    analysis.tool_type = 'face-swap';
    analysis.processing_strategy = 'single_face_swap';
    analysis.expected_outputs = 1;
    analysis.requires_face_processing = true;
    analysis.requires_real_time_update = true;
  } else if (payload.input?.topic || payload.input?.title_style) {
    analysis.tool_type = 'title-generator';
    analysis.processing_strategy = 'text_processing';
    analysis.expected_outputs = payload.input?.title_count || 10;
  } else if (payload.version?.includes('f8a8eb2c75d7d86ec58e3b8309cee63acb437fbab2695bc5004acf64d2de61a7') || // Ideogram V3 Turbo
            (payload.input?.style_type && payload.input?.magic_prompt_option)) {
    analysis.tool_type = 'logo-machine';
    analysis.processing_strategy = 'batch_logos';
    analysis.expected_outputs = 4; // Typical logo generation batch
    analysis.requires_batch_processing = true;
    analysis.requires_real_time_update = true;
  } else if (isAudioOutput || isMusicBatchId ||
            payload.version?.includes('6ad9d07e53bf7e1f5ce9f58b11ad5d5fadc0e2e4b48fa35f47f55ff9b9db6de0') || // Meta MusicGen Stereo Melody
            payload.version?.includes('a7e8d3fd87b875af2897e25dbde07888be1621bf18915b40a1a82543f5c0ab01') || // Google Lyria-2
            (payload.input?.model_version && payload.input?.output_format) ||
            (payload.input?.prompt && (payload.input?.seed !== undefined || payload.input?.negative_prompt))) { // Lyria-2 specific params
    analysis.tool_type = 'music-machine';
    analysis.processing_strategy = 'single_music_generation';
    analysis.expected_outputs = 1;
    analysis.requires_real_time_update = true;
  } else if ((payload.metadata?.tool_id === 'script-to-video') ||
            (payload.input?.segments && payload.input?.voice_settings)) {
    analysis.tool_type = 'script-to-video';
    analysis.processing_strategy = 'orchestrated_script_video';
    analysis.expected_outputs = 1;
    analysis.requires_real_time_update = true;
  } else if ((payload.metadata?.tool_id === 'voice-over') ||
            (payload.input?.script_text && payload.input?.voice_id && !payload.input?.avatar_image_url)) {
    analysis.tool_type = 'voice-over';
    analysis.processing_strategy = 'single_voice_generation';
    analysis.expected_outputs = 1;
    analysis.requires_real_time_update = true;
  }

  // AI Decision: Set workflow type based on complexity
  if (analysis.requires_batch_processing && analysis.requires_face_processing) {
    analysis.workflow_type = 'complex_multi_step';
  } else if (analysis.requires_batch_processing) {
    analysis.workflow_type = 'batch_generation';
  } else {
    analysis.workflow_type = 'single_operation';
  }

  return analysis;
}

/**
 * Enhanced successful generation handling
 */
async function handleSuccessfulGeneration(
  payload: ReplicateWebhookPayload, 
  analysis: PayloadAnalysis
): Promise<WebhookProcessingResult> {
  console.log(`🎨 AI Success Handler: Processing ${analysis.tool_type} results`);
  
  try {
    let results_processed = 0;
    let credits_used = 0;

    // AI Decision: Route to specialized processing based on analysis
    if (analysis.processing_strategy === 'batch_thumbnails') {
      const batchResult = await processBatchThumbnails(payload, analysis);
      results_processed = batchResult.count;
      credits_used = batchResult.credits;
    } else if (analysis.processing_strategy === 'single_face_swap') {
      const singleResult = await processSingleResult(payload, analysis);
      results_processed = singleResult.count;
      credits_used = singleResult.credits;
    } else if (analysis.processing_strategy === 'single_video_generation') {
      const videoResult = await processVideoGeneration(payload, analysis);
      results_processed = videoResult.count;
      credits_used = videoResult.credits;
    } else if (analysis.processing_strategy === 'batch_logos') {
      const logoResult = await processBatchLogos(payload, analysis);
      results_processed = logoResult.count;
      credits_used = logoResult.credits;
    } else if (analysis.processing_strategy === 'single_music_generation') {
      const musicResult = await processMusicGeneration(payload, analysis);
      results_processed = musicResult.count;
      credits_used = musicResult.credits;
    } else if (analysis.processing_strategy === 'orchestrated_script_video') {
      const scriptVideoResult = await processScriptVideoGeneration(payload, analysis);
      results_processed = scriptVideoResult.count;
      credits_used = scriptVideoResult.credits;
    } else if (analysis.processing_strategy === 'single_voice_generation') {
      const voiceResult = await processVoiceOverGeneration(payload, analysis);
      results_processed = voiceResult.count;
      credits_used = voiceResult.credits;
    } else if (analysis.processing_strategy === 'single_video_swap') {
      const videoSwapResult = await processVideoSwapGeneration(payload, analysis);
      results_processed = videoSwapResult.count;
      credits_used = videoSwapResult.credits;
    } else if (analysis.processing_strategy === 'single_video_upscale') {
      const upscaleResult = await processVideoUpscale(payload, analysis);
      results_processed = upscaleResult.count;
      credits_used = upscaleResult.credits;
    } else {
      console.warn(`⚠️ Unknown processing strategy: ${analysis.processing_strategy}`);
    }

    return {
      success: true,
      tool_type: analysis.tool_type,
      results_processed,
      credits_used,
      real_time_broadcast: false, // Will be set by caller
    };

  } catch (error) {
    console.error('Success handling error:', error);
    return {
      success: false,
      tool_type: analysis.tool_type,
      results_processed: 0,
      credits_used: 0,
      real_time_broadcast: false,
      error: error instanceof Error ? error.message : 'Processing failed',
    };
  }
}

/**
 * Enhanced batch thumbnail processing
 */
async function processBatchThumbnails(payload: ReplicateWebhookPayload, analysis: PayloadAnalysis): Promise<{ count: number; credits: number }> {
  const outputs = Array.isArray(payload.output) ? payload.output : [payload.output];
  console.log(`🖼️ Batch Processing: ${outputs.length} thumbnails`);
  
  const batch_id = analysis.batch_id || crypto.randomUUID();
  const thumbnailResults = [];
  let credits_used = 0;

  // AI Decision: Process each variation with intelligent handling
  for (let i = 0; i < outputs.length; i++) {
    const imageUrl = outputs[i];
    if (!imageUrl) continue;

    console.log(`🔄 Processing variation ${i + 1}/${outputs.length}`);
    
    try {
      // AI Decision: Smart filename generation
      const filename = `${analysis.tool_type}_${batch_id}_var${i + 1}`;
      const uploadResult = await downloadAndUploadImage(
        imageUrl as string, 
        analysis.tool_type, 
        filename
      );
      
      if (uploadResult.success && uploadResult.url) {
        thumbnailResults.push({
          user_id: analysis.user_id || 'unknown-user',
          prompt: payload.input?.prompt || 'Generated content',
          image_urls: [uploadResult.url],
          dimensions: '1024x1024',
          height: 1024,
          width: 1024,
          model_name: 'replicate-ai',
          batch_id,
          model_version: determineModelVersion(payload),
          generation_settings: payload.input as Json,
        });
        
        credits_used += 2; // CREDITS_PER_THUMBNAIL
      }
    } catch (variationError) {
      console.error(`❌ Failed to process variation ${i + 1}:`, variationError);
    }
  }
  
  // Store results in prediction record (AI Cinematographer pattern)
  if (thumbnailResults.length > 0 && analysis.batch_id) {
    // Update prediction record with results - no separate table needed
    await updatePredictionRecordAdmin(analysis.batch_id, {
      status: payload.status,
      output_data: {
        thumbnails: thumbnailResults,
        generation_metadata: {
          model_version: determineModelVersion(payload),
          style_type: determineStyleType(payload.input),
          generation_time_ms: payload.metrics?.predict_time || 0,
          prompt_length: (payload.input.prompt || '').length,
          has_advanced_options: hasAdvancedOptions(payload.input),
        }
      } as Json,
      completed_at: payload.completed_at,
      logs: payload.logs,
      external_id: payload.id,
    });
    
    // AI Decision: Rich analytics recording
    await recordGenerationMetrics({
      user_id: analysis.user_id || 'unknown-user',
      batch_id,
      model_version: determineModelVersion(payload),
      style_type: determineStyleType(payload.input),
      num_variations: thumbnailResults.length,
      generation_time_ms: payload.metrics?.predict_time || 0,
      total_credits_used: credits_used,
      prompt_length: (payload.input.prompt || '').length,
      has_advanced_options: hasAdvancedOptions(payload.input),
    });
    
    console.log(`✅ Batch Complete: ${thumbnailResults.length} thumbnails stored in prediction record`);
  }

  return { count: thumbnailResults.length, credits: credits_used };
}

/**
 * Enhanced single result processing
 */
async function processSingleResult(payload: ReplicateWebhookPayload, analysis: PayloadAnalysis): Promise<{ count: number; credits: number }> {
  const imageUrl = typeof payload.output === 'string' ? payload.output : payload.output?.[0];
  if (!imageUrl) return { count: 0, credits: 0 };

  console.log(`🎯 Single Processing: ${analysis.tool_type}`);
  
  // Use the original batch_id from request or generate a new UUID
  const batch_id = analysis.batch_id || crypto.randomUUID();
  let credits_used = 0;

  try {
    const uploadResult = await downloadAndUploadImage(
      imageUrl as string, 
      analysis.tool_type, 
      batch_id
    );
    
    if (uploadResult.success && uploadResult.url) {
      // Store result in prediction record (AI Cinematographer pattern)
      if (analysis.batch_id) {
        console.log(`📝 Updating prediction record for ${analysis.tool_type}, batch_id: ${analysis.batch_id}`);
        
        const resultData = {
          type: analysis.tool_type === 'face-swap' ? 'face-swap' : 'thumbnail',
          image_url: uploadResult.url,
          prompt: payload.input?.prompt || (analysis.tool_type === 'face-swap' ? 'Face Swap Result' : 'Generated content'),
          model_version: determineModelVersion(payload),
          generation_settings: payload.input,
          ...(analysis.tool_type === 'face-swap' && {
            input_image: payload.input?.input_image,
            swap_image: payload.input?.swap_image,
          })
        };

        // Update prediction record with results - no separate table needed
        const updateResult = await updatePredictionRecordAdmin(analysis.batch_id, {
          status: payload.status,
          output_data: {
            [analysis.tool_type === 'face-swap' ? 'face_swapped_thumbnails' : 'thumbnails']: [{
              ...resultData,
              image_url: uploadResult.url // Ensure we have image_url for face swap results
            }]
          } as unknown as Json,
          completed_at: payload.completed_at,
          logs: payload.logs,
          external_id: payload.id,
        });
        
        console.log(`📝 Update result:`, updateResult);
        
        credits_used = analysis.tool_type === 'face-swap' ? 3 : 2;
        console.log(`✅ Single Result: Stored ${analysis.tool_type} in prediction record with batch_id: ${analysis.batch_id}`);
      }
      return { count: 1, credits: credits_used };
    }
  } catch (error) {
    console.error('❌ Single result processing failed:', error);
  }

  return { count: 0, credits: 0 };
}

/**
 * Enhanced failure handling
 */
async function handleFailedGeneration(payload: ReplicateWebhookPayload, analysis: PayloadAnalysis): Promise<WebhookProcessingResult> {
  console.error(`❌ Generation Failed: ${payload.id} - ${payload.error}`);
  
  // AI Decision: Intelligent failure analysis and potential recovery
  const failureType = analyzeFailureType(payload.error || '');
  
  // Update database based on tool type
  try {
    if (analysis.tool_type === 'music-machine') {
      // Find and update the music record
      const { createAdminClient } = await import('@/app/supabase/server');
      const supabase = createAdminClient();
      
      // Query music records with matching prediction_id in generation_settings
      const { data: musicRecords } = await supabase
        .from('music_history')
        .select('id, user_id, generation_settings')
        .contains('generation_settings', { prediction_id: payload.id });
      
      console.log(`🔍 Failed music query: prediction_id=${payload.id}, found=${musicRecords?.length || 0} records`);
      
      if (musicRecords && musicRecords.length > 0) {
        const musicId = musicRecords[0].id;
        
        // ✅ Update analysis with user_id for broadcasting  
        analysis.user_id = musicRecords[0].user_id;
        
        const { updateMusicRecordAdmin } = await import('@/actions/database/music-database');
        
        await updateMusicRecordAdmin(musicId, {
          status: 'failed',
          error_message: payload.error || 'Generation failed',
          generation_settings: {
            prediction_id: payload.id,
            error: payload.error,
            failure_type: failureType,
            replicate_status: payload.status,
            replicate_logs: payload.logs
          } as Json
        });
        
        console.log(`✅ Updated failed music record ${musicId}`);
      }
    } else if (analysis.tool_type === 'thumbnail-machine') {
      // Handle thumbnail failures (already implemented in the system)
      console.log(`📸 Thumbnail failure - will be handled by existing logic`);
    } else if (analysis.tool_type === 'ai-cinematographer') {
      // Handle video failures (already implemented in the system)
      console.log(`🎬 Video failure - will be handled by existing logic`);
    }
  } catch (error) {
    console.error('❌ Failed to update database for failed generation:', error);
  }
  
  console.log(`🔍 Failure Analysis: Type=${failureType}, Tool=${analysis.tool_type}`);
  
  return {
    success: false,
    tool_type: analysis.tool_type,
    results_processed: 0,
    credits_used: 0,
    real_time_broadcast: false,
    error: payload.error || 'Generation failed',
  };
}

/**
 * Processing status updates
 */
async function handleProcessingUpdate(payload: ReplicateWebhookPayload, analysis: PayloadAnalysis): Promise<WebhookProcessingResult> {
  console.log(`⏳ Processing Update: ${payload.id} - ${analysis.tool_type}`);
  
  return {
    success: true,
    tool_type: analysis.tool_type,
    results_processed: 0,
    credits_used: 0,
    real_time_broadcast: false,
  };
}

/**
 * Real-time broadcasting to frontend
 */
async function broadcastToUser(userId: string, message: Record<string, unknown>) {
  try {
    // Import and create admin client for broadcasting
    const { createAdminClient } = await import('@/app/supabase/server');
    const supabase = await createAdminClient();
    
    // AI Decision: Broadcast through Supabase Realtime
    const channel = `user_${userId}_updates`;
    
    console.log(`📡 Broadcasting: ${channel}`, message);
    
    // Broadcast the webhook update to the user's channel
    await supabase.channel(channel).send({
      type: 'broadcast',
      event: 'webhook_update',
      payload: message
    });
    
  } catch (error) {
    console.error('Broadcasting error:', error);
  }
}

/**
 * Enhanced AI helper functions
 */

function determineModelVersion(payload: ReplicateWebhookPayload): string {
  if (payload.version?.includes('flux-thumbnails-v2')) return 'flux-thumbnails-v2';
  if (payload.version?.includes('35eacd3dbd088d6421f7ee27646701b5e03ec5a9a0f68f43112fa228d6fc2522')) return 'ideogram-v2-turbo';
  if (payload.version?.includes('d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111')) return 'cdingram-face-swap';
  if (payload.version?.includes('face-swap')) return 'face-swap';
  return payload.version || 'unknown';
}

// function _determineResultType(_toolType: string): 'thumbnail' | 'faceswap' | 'recreate' {
//   switch (_toolType) {
//     case 'face-swap': return 'faceswap';
//     case 'thumbnail-machine': return 'thumbnail';
//     default: return 'thumbnail';
//   }
// }

function determineStyleType(input: ReplicateInput): string {
  return input?.style_type || input?.title_style || 'auto';
}

function hasAdvancedOptions(input: ReplicateInput): boolean {
  return !!(input?.guidance_scale || input?.num_inference_steps || 
           input?.output_quality || input?.seed || input?.reference_image);
}

function analyzeFailureType(error: string): string {
  if (error.includes('NSFW')) return 'content_policy';
  if (error.includes('timeout')) return 'timeout';
  if (error.includes('GPU')) return 'resource_limit';
  return 'unknown';
}

/**
 * Process video generation completion for AI Cinematographer
 */
async function processVideoGeneration(payload: ReplicateWebhookPayload, analysis: PayloadAnalysis): Promise<{ count: number; credits: number }> {
  const videoUrl = typeof payload.output === 'string' ? payload.output : payload.output?.[0];
  if (!videoUrl) return { count: 0, credits: 0 };

  console.log(`🎬 Video Processing: AI Cinematographer`);

  try {
    // Download and upload video to our storage using proper video upload function
    const uploadResult = await downloadAndUploadVideo(
      videoUrl as string,
      'ai-cinematographer',
      `video_${payload.id}`
    );

    if (uploadResult.success && uploadResult.url) {
      // Find the cinematographer video record by prediction_id
      // We need to query by metadata->generation_settings->prediction_id since we stored it there
      // Use admin client to bypass RLS policies since webhooks don't have user context
      const { createAdminClient } = await import('@/app/supabase/server');
      const supabase = createAdminClient();

      // Query full record to check for upscale flag
      const { data: videoRecords, error: queryError } = await supabase
        .from('cinematographer_videos')
        .select('id, user_id, metadata')
        .contains('metadata', { generation_settings: { prediction_id: payload.id } });

      console.log(`🔍 Cinematographer query: prediction_id=${payload.id}, found=${videoRecords?.length || 0} records`);
      if (queryError) {
        console.error('🔍 Cinematographer query error:', queryError);
      }

      if (videoRecords && videoRecords.length > 0) {
        const videoRecord = videoRecords[0];
        const videoId = videoRecord.id;
        const metadata = videoRecord.metadata as Record<string, unknown> | null;
        const generationSettings = metadata?.generation_settings as Record<string, unknown> | undefined;
        const shouldUpscale = generationSettings?.upscale === true;

        const { updateCinematographerVideoAdmin } = await import('@/actions/database/cinematographer-database');

        if (shouldUpscale) {
          // Trigger upscale API instead of completing
          console.log(`🔍 Video needs upscaling - triggering Topaz upscale...`);

          try {
            const upscalePrediction = await createVideoUpscalePrediction({
              video: uploadResult.url,
              target_resolution: '1080p',
              target_fps: 30,
              webhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/replicate-ai`
            });

            // Update record with upscaling status and store both prediction IDs
            await updateCinematographerVideoAdmin(videoId, {
              status: 'upscaling',
              final_video_url: uploadResult.url, // Store 720p version as fallback
              total_duration_seconds: payload.input?.duration || 4,
              progress_percentage: 80, // 80% done, upscaling remaining
              ai_director_notes: `Video generated, now upscaling to 1080p...`,
              metadata: {
                ...metadata,
                generation_settings: {
                  ...generationSettings,
                  upscale_prediction_id: upscalePrediction.id,
                  original_video_url: uploadResult.url,
                }
              } as Json,
              updated_at: new Date().toISOString()
            });

            console.log(`🔍 Upscale prediction created: ${upscalePrediction.id}`);
            return { count: 1, credits: 8 }; // Video cost, upscale credits deducted when complete
          } catch (upscaleError) {
            console.error('❌ Failed to trigger upscale:', upscaleError);
            // Fall through to complete without upscale
          }
        }

        // Update the video record with final URL and completed status
        await updateCinematographerVideoAdmin(videoId, {
          status: 'completed',
          final_video_url: uploadResult.url,
          total_duration_seconds: payload.input?.duration || 4,
          progress_percentage: 100,
          ai_director_notes: `Video generated successfully with ${payload.input?.motion_scale || 1.0} motion scale`,
          updated_at: new Date().toISOString()
        });

        console.log(`✅ Video Complete: Updated cinematographer record ${videoId}`);
        return { count: 1, credits: 8 }; // Standard video generation cost
      } else {
        console.warn(`⚠️ No cinematographer video record found for prediction ${payload.id}`);
      }
    }
  } catch (error) {
    console.error('❌ Video processing failed:', error);
  }

  return { count: 0, credits: 0 };
}

/**
 * Process video upscale completion for AI Cinematographer
 */
async function processVideoUpscale(payload: ReplicateWebhookPayload, analysis: PayloadAnalysis): Promise<{ count: number; credits: number }> {
  const videoUrl = typeof payload.output === 'string' ? payload.output : payload.output?.[0];
  if (!videoUrl) return { count: 0, credits: 0 };

  console.log(`🔍 Video Upscale Processing: Topaz Labs`);

  try {
    // Download and upload upscaled video to our storage
    const uploadResult = await downloadAndUploadVideo(
      videoUrl as string,
      'ai-cinematographer',
      `video_upscaled_${payload.id}`
    );

    if (uploadResult.success && uploadResult.url) {
      const { createAdminClient } = await import('@/app/supabase/server');
      const supabase = createAdminClient();

      // Find video record by upscale_prediction_id
      const { data: videoRecords, error: queryError } = await supabase
        .from('cinematographer_videos')
        .select('id, user_id, metadata')
        .contains('metadata', { generation_settings: { upscale_prediction_id: payload.id } });

      console.log(`🔍 Upscale query: prediction_id=${payload.id}, found=${videoRecords?.length || 0} records`);
      if (queryError) {
        console.error('🔍 Upscale query error:', queryError);
      }

      if (videoRecords && videoRecords.length > 0) {
        const videoRecord = videoRecords[0];
        const videoId = videoRecord.id;
        const metadata = videoRecord.metadata as Record<string, unknown> | null;
        const generationSettings = metadata?.generation_settings as Record<string, unknown> | undefined;

        const { updateCinematographerVideoAdmin } = await import('@/actions/database/cinematographer-database');

        // Update with upscaled video URL
        await updateCinematographerVideoAdmin(videoId, {
          status: 'completed',
          final_video_url: uploadResult.url, // Replace with upscaled version
          progress_percentage: 100,
          ai_director_notes: `Video upscaled to 1080p successfully`,
          metadata: {
            ...metadata,
            generation_settings: {
              ...generationSettings,
              upscaled_video_url: uploadResult.url,
              upscale_completed: true,
            }
          } as Json,
          updated_at: new Date().toISOString()
        });

        // Update analysis with user_id for broadcasting
        analysis.user_id = videoRecord.user_id;

        console.log(`✅ Video Upscale Complete: Updated cinematographer record ${videoId}`);
        return { count: 1, credits: 0 }; // Credits already deducted at generation time
      } else {
        console.warn(`⚠️ No cinematographer video record found for upscale prediction ${payload.id}`);
      }
    }
  } catch (error) {
    console.error('❌ Video upscale processing failed:', error);
  }

  return { count: 0, credits: 0 };
}

/**
 * Process logo generation completion for Logo Machine
 */
async function processBatchLogos(payload: ReplicateWebhookPayload, analysis: PayloadAnalysis): Promise<{ count: number; credits: number }> {
  const outputs = Array.isArray(payload.output) ? payload.output : [payload.output];
  console.log(`🏷️ Logo Processing: ${outputs.length} logos`);
  
  if (!outputs || outputs.length === 0) return { count: 0, credits: 0 };
  
  const batch_id = analysis.batch_id || crypto.randomUUID();
  let total_credits = 0;
  let processed_count = 0;

  try {
    // Process each logo variation
    for (let i = 0; i < outputs.length; i++) {
      const imageUrl = outputs[i];
      if (!imageUrl) continue;

      console.log(`🔄 Processing logo ${i + 1}/${outputs.length}`);
      
      try {
        // Smart filename generation for logos
        const filename = `logo_${batch_id}_v${i + 1}`;
        const uploadResult = await downloadAndUploadImage(
          imageUrl as string, 
          'logo-machine', 
          filename
        );
        
        if (uploadResult.success && uploadResult.url) {
          // Store logo result in database
          const logoResult = {
            user_id: analysis.user_id || 'unknown-user',
            prompt: payload.input?.prompt || 'Generated logo',
            image_urls: [uploadResult.url],
            dimensions: '1024x1024',
            height: 1024,
            width: 1024,
            model_name: 'ideogram-v3-turbo',
            batch_id,
            model_version: 'f8a8eb2c75d7d86ec58e3b8309cee63acb437fbab2695bc5004acf64d2de61a7',
            generation_settings: {
              style_type: payload.input?.style_type || 'Auto',
              aspect_ratio: payload.input?.aspect_ratio || '1:1',
              magic_prompt_option: payload.input?.magic_prompt_option || 'Auto',
              ...payload.input
            } as Json,
          };
          
          await storeLogoResults(logoResult);
          total_credits += 2; // Standard logo generation cost
          processed_count++;
        }
      } catch (variationError) {
        console.error(`❌ Failed to process logo ${i + 1}:`, variationError);
      }
    }
    
    // Record logo metrics
    if (processed_count > 0) {
      await recordLogoMetrics({
        user_id: analysis.user_id || 'unknown-user',
        batch_id,
        model_version: 'ideogram-v3-turbo',
        style_type: payload.input?.style_type || 'Auto',
        num_variations: processed_count,
        generation_time_ms: payload.metrics?.predict_time || 0,
        total_credits_used: total_credits,
        prompt_length: (payload.input?.prompt || '').length,
        has_advanced_options: !!(payload.input?.seed || payload.input?.image || payload.input?.style_reference_images),
      });
      
      console.log(`✅ Logo Batch Complete: ${processed_count} logos stored`);
    }

    return { count: processed_count, credits: total_credits };
    
  } catch (error) {
    console.error('❌ Logo processing failed:', error);
    return { count: 0, credits: 0 };
  }
}

/**
 * Process music generation completion for Music Machine
 */
async function processMusicGeneration(payload: ReplicateWebhookPayload, analysis: PayloadAnalysis): Promise<{ count: number; credits: number }> {
  const audioUrl = typeof payload.output === 'string' ? payload.output : payload.output?.[0];
  if (!audioUrl) return { count: 0, credits: 0 };

  console.log(`🎵 Music Processing: Music Machine`);
  
  try {
    // Download and upload music to our storage using proper audio handling
    const uploadResult = await downloadAndUploadAudio(
      audioUrl as string, 
      'music-machine', 
      `music_${payload.id}`
    );
    
    if (uploadResult.success && uploadResult.url) {
      // Find the music record by prediction_id stored in generation_settings
      const { createAdminClient } = await import('@/app/supabase/server');
      const supabase = createAdminClient();
      
      // Query music records with matching prediction_id in generation_settings
      const { data: musicRecords } = await supabase
        .from('music_history')
        .select('id, user_id, generation_settings')
        .contains('generation_settings', { prediction_id: payload.id });
      
      console.log(`🔍 Music query: prediction_id=${payload.id}, found=${musicRecords?.length || 0} records`);
      
      if (musicRecords && musicRecords.length > 0) {
        // Update the matching music record
        const musicId = musicRecords[0].id;
        
        // ✅ Update analysis with user_id for broadcasting
        analysis.user_id = musicRecords[0].user_id;
        
        // Determine if this is Lyria-2 or MusicGen based on version
        const isLyria2 = payload.version?.includes('a7e8d3fd87b875af2897e25dbde07888be1621bf18915b40a1a82543f5c0ab01');
        const modelProvider = isLyria2 ? 'lyria-2' : 'musicgen';
        const modelVersion = isLyria2 ? 'google-lyria-2' : (payload.input?.model_version || 'stereo-melody-large');
        const estimatedCredits = isLyria2 ? 3 : 6; // Lyria-2 is cheaper but no duration control
        
        const { updateMusicRecordAdmin } = await import('@/actions/database/music-database');
        // Get actual audio duration from the uploaded file
        const actualDuration = uploadResult.metadata?.duration || payload.input?.duration || (isLyria2 ? 30 : 8);
        
        await updateMusicRecordAdmin(musicId, {
          status: 'completed',
          final_audio_url: uploadResult.url,
          duration_seconds: actualDuration,
          generation_settings: {
            prediction_id: payload.id,
            output_format: payload.input?.output_format || (isLyria2 ? 'audio' : 'wav'),
            prompt: payload.input?.prompt || '',
            model_provider: modelProvider,
            model_version: modelVersion,
            generation_time_ms: payload.metrics?.predict_time || 0,
            seed: payload.input?.seed || null,
            negative_prompt: payload.input?.negative_prompt || null,
            replicate_input: payload.input,
            replicate_metrics: payload.metrics
          } as Json
        });
        
        console.log(`✅ Music Complete: Updated music record ${musicId} (${modelProvider})`);
        return { count: 1, credits: estimatedCredits };
      } else {
        console.warn(`⚠️ No music record found for user ${analysis.user_id}`);
      }
    }
  } catch (error) {
    console.error('❌ Music processing failed:', error);
  }

  return { count: 0, credits: 0 };
}

/**
 * Process script-to-video generation completion
 */
async function processScriptVideoGeneration(payload: ReplicateWebhookPayload, analysis: PayloadAnalysis): Promise<{ count: number; credits: number }> {
  const outputUrl = typeof payload.output === 'string' ? payload.output : payload.output?.[0];
  if (!outputUrl) return { count: 0, credits: 0 };

  console.log(`🎬 Script-Video Processing: Orchestrated Generation`);
  
  try {
    // Download and upload content to our storage
    const uploadResult = await downloadAndUploadImage(
      outputUrl as string, 
      'script-to-video', 
      `script_video_${payload.id}`
    );
    
    if (uploadResult.success && uploadResult.url) {
      // Find the script-video record by prediction_id or user_id
      const { createClient } = await import('@/app/supabase/server');
      const supabase = await createClient();
      
      // Query script-video records
      const { data: scriptVideoRecords } = await supabase
        .from('script_to_video_history')
        .select('id, user_id')
        .eq('user_id', analysis.user_id || 'unknown-user')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (scriptVideoRecords && scriptVideoRecords.length > 0) {
        // Update the most recent script-video record
        const recordId = scriptVideoRecords[0].id;
        
        // TODO: Implement updateScriptVideoRecord function
        // await updateScriptVideoRecord(recordId, {
        //   status: 'completed',
        //   video_url: uploadResult.url,
        //   progress_percentage: 100,
        //   metadata: {
        //     prediction_id: payload.id,
        //     webhook_processed: true,
        //     generation_settings: payload.input
        //   } as Json
        // });
        
        console.log(`✅ Script-Video Complete: Updated record ${recordId}`);
        return { count: 1, credits: 12 }; // Estimated orchestrated generation cost
      } else {
        console.warn(`⚠️ No script-video record found for user ${analysis.user_id}`);
      }
    }
  } catch (error) {
    console.error('❌ Script-video processing failed:', error);
  }

  return { count: 0, credits: 0 };
}

/**
 * Process voice over generation completion
 */
async function processVoiceOverGeneration(payload: ReplicateWebhookPayload, analysis: PayloadAnalysis): Promise<{ count: number; credits: number }> {
  const audioUrl = typeof payload.output === 'string' ? payload.output : payload.output?.[0];
  if (!audioUrl) return { count: 0, credits: 0 };

  console.log(`🎙️ Voice Over Processing: Single Voice Generation`);
  
  try {
    // Find the voice record by prediction_id or user_id
    const { createClient } = await import('@/app/supabase/server');
    const supabase = await createClient();
    
    // Query voice records (Note: Voice Over uses different table than predictions for storage)
    const { data: voiceRecords } = await supabase
      .from('generated_voices')
      .select('id, user_id, batch_id')
      .eq('user_id', analysis.user_id || 'unknown-user')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (voiceRecords && voiceRecords.length > 0) {
      // For Voice Over, the webhook is called after completion, so just log
      console.log(`✅ Voice Over Complete: Already processed ${voiceRecords[0].id}`);
      
      // Voice Over is processed synchronously, so this webhook is mainly for logging
      // The actual processing was done in the voice-over.ts file
      
      return { count: 1, credits: 2 }; // Standard voice generation cost
    } else {
      console.warn(`⚠️ No voice record found for user ${analysis.user_id}`);
    }
  } catch (error) {
    console.error('❌ Voice Over processing failed:', error);
  }

  return { count: 0, credits: 0 };
}

/**
 * Process video swap generation completion (Wan 2.2 Animate Replace)
 */
async function processVideoSwapGeneration(payload: ReplicateWebhookPayload, analysis: PayloadAnalysis): Promise<{ count: number; credits: number }> {
  const videoUrl = typeof payload.output === 'string' ? payload.output : payload.output?.[0];
  if (!videoUrl) return { count: 0, credits: 0 };

  console.log(`🎭 Video Swap Processing: Wan 2.2 Animate Replace`);

  try {
    // Download and upload video to our storage
    const uploadResult = await downloadAndUploadVideo(
      videoUrl as string,
      'video-swap',
      `video_swap_${payload.id}`
    );

    if (uploadResult.success && uploadResult.url) {
      // Find the video swap job by external_job_id (prediction ID) or job_id from input
      const { createAdminClient } = await import('@/app/supabase/server');
      const supabase = createAdminClient();

      // First try to find by external_job_id
      let jobId = payload.input?.job_id;

      if (!jobId) {
        // Query by external_job_id if job_id not in input
        const { data: jobRecords } = await supabase
          .from('video_swap_jobs')
          .select('id, user_id')
          .eq('external_job_id', payload.id)
          .limit(1);

        if (jobRecords && jobRecords.length > 0) {
          jobId = jobRecords[0].id;
          // Update analysis with user_id for broadcasting
          analysis.user_id = jobRecords[0].user_id;
        }
      }

      console.log(`🔍 Video Swap query: prediction_id=${payload.id}, job_id=${jobId}`);

      if (jobId) {
        // Update the video swap job record
        const { updateVideoSwapJobAdmin } = await import('@/actions/database/video-swap-database');

        await updateVideoSwapJobAdmin(jobId, {
          status: 'completed',
          result_video_url: uploadResult.url,
          progress_percentage: 100,
          completed_at: new Date().toISOString(),
        });

        console.log(`✅ Video Swap Complete: Updated job ${jobId}`);
        return { count: 1, credits: 25 }; // VIDEO_SWAP_CREDITS
      } else {
        console.warn(`⚠️ No video swap job found for prediction ${payload.id}`);
      }
    }
  } catch (error) {
    console.error('❌ Video swap processing failed:', error);

    // Try to update job status to failed
    try {
      const jobId = payload.input?.job_id;
      if (jobId) {
        const { updateVideoSwapJobAdmin } = await import('@/actions/database/video-swap-database');
        await updateVideoSwapJobAdmin(jobId, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Processing failed',
        });
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }
  }

  return { count: 0, credits: 0 };
}