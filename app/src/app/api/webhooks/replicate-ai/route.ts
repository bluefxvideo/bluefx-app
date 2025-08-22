import { NextRequest, NextResponse } from 'next/server';
import { downloadAndUploadImage, downloadAndUploadVideo } from '@/actions/supabase-storage';
import { 
  updatePredictionRecord, 
  storeThumbnailResults, 
  recordGenerationMetrics 
} from '@/actions/database/thumbnail-database';
import { updateCinematographerVideo } from '@/actions/database/cinematographer-database';
import { storeLogoResults, recordLogoMetrics } from '@/actions/database/logo-database';
import { updateMusicRecord } from '@/actions/database/music-database';
import { updateScriptVideoRecord } from '@/actions/database/script-video-database';
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
    console.log(`🤖 AI Decision: Processing ${payload.id} - Status: ${payload.status}`);

    // Enhanced security validation
    if (!validateWebhookAuthenticity(request, payload)) {
      console.warn('🚨 Security: Suspicious webhook request blocked');
      return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 403 });
    }

    // AI Decision: Determine processing strategy based on payload
    const aiAnalysis = await analyzeWebhookPayload(payload);
    console.log(`🧠 AI Analysis: Tool=${aiAnalysis.tool_type}, Strategy=${aiAnalysis.processing_strategy}`);

    // Update prediction record with enhanced tracking
    try {
      await updatePredictionRecord(payload.id, {
        status: payload.status,
        output_data: payload.output as Json,
        completed_at: payload.completed_at,
        logs: payload.logs,
      });
    } catch (predictionError) {
      console.error('Prediction update error:', predictionError);
    }

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
                     payload.input?.batch_id || null;

  // AI Decision: Determine tool type from multiple signals
  // Check output type first - if it's a video file, it's likely AI Cinematographer
  const outputUrl = typeof payload.output === 'string' ? payload.output : payload.output?.[0];
  const isVideoOutput = outputUrl && (outputUrl.includes('.mp4') || outputUrl.includes('.mov') || outputUrl.includes('.webm'));
  
  // Check for AI Cinematographer first (more specific)
  if (isVideoOutput ||
      payload.version?.includes('dc91b71f6bafe90e311c8b6e03b9b5c1ce53f932b47e243c3a2ebf90d2d2a12d') || // Stable Video Diffusion
      payload.version?.includes('kling') || // Kling model
      (payload.input?.duration && payload.input?.aspect_ratio) ||
      (payload.input?.prompt && (payload.input?.motion_scale || payload.input?.reference_image))) {
    analysis.tool_type = 'ai-cinematographer';
    analysis.processing_strategy = 'single_video_generation';
    analysis.expected_outputs = 1;
    analysis.requires_real_time_update = true;
  } else if (payload.version?.includes('flux-thumbnails-v2') || 
            (payload.input?.prompt && payload.input?.num_outputs && !payload.input?.duration)) {
    analysis.tool_type = 'thumbnail-machine';
    analysis.processing_strategy = 'batch_thumbnails';
    analysis.expected_outputs = payload.input?.num_outputs || 4;
    analysis.requires_batch_processing = true;
    analysis.requires_real_time_update = true;
  } else if (payload.version?.includes('face-swap') || 
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
  } else if (payload.version?.includes('6ad9d07e53bf7e1f5ce9f58b11ad5d5fadc0e2e4b48fa35f47f55ff9b9db6de0') || // Meta MusicGen Stereo Melody
            (payload.input?.model_version && payload.input?.output_format)) {
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
  
  // Store results and record metrics
  if (thumbnailResults.length > 0) {
    await storeThumbnailResults(thumbnailResults);
    
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
    
    console.log(`✅ Batch Complete: ${thumbnailResults.length} thumbnails stored`);
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
  
  const batch_id = analysis.batch_id || crypto.randomUUID();
  let credits_used = 0;

  try {
    const uploadResult = await downloadAndUploadImage(
      imageUrl as string, 
      analysis.tool_type, 
      batch_id
    );
    
    if (uploadResult.success && uploadResult.url) {
      const result: ThumbnailResult = {
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
      };
      
      await storeThumbnailResults([result]);
      credits_used = analysis.tool_type === 'face-swap' ? 3 : 2;
      
      console.log(`✅ Single Result: Stored ${analysis.tool_type}`);
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
  
  // TODO: Implement intelligent retry logic, user notification, credit refunds
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
    // const _supabase = createClient();
    
    // AI Decision: Broadcast through Supabase Realtime
    const channel = `user_${userId}_updates`;
    
    // Note: In a real implementation, you'd use Supabase Realtime channels
    console.log(`📡 Broadcasting: ${channel}`, message);
    
    // Example of how you'd implement this:
    // await supabase.channel(channel).send({
    //   type: 'broadcast',
    //   event: 'webhook_update',
    //   payload: message
    // });
    
  } catch (error) {
    console.error('Broadcasting error:', error);
  }
}

/**
 * Enhanced AI helper functions
 */

function determineModelVersion(payload: ReplicateWebhookPayload): string {
  if (payload.version?.includes('flux-thumbnails-v2')) return 'flux-thumbnails-v2';
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
      
      const { data: videoRecords, error: queryError } = await supabase
        .from('cinematographer_videos')
        .select('id')
        .contains('metadata', { generation_settings: { prediction_id: payload.id } });
      
      console.log(`🔍 Cinematographer query: prediction_id=${payload.id}, found=${videoRecords?.length || 0} records`);
      if (queryError) {
        console.error('🔍 Cinematographer query error:', queryError);
      }
      
      if (videoRecords && videoRecords.length > 0) {
        const videoId = videoRecords[0].id;
        
        // Update the video record with final URL and completed status
        await updateCinematographerVideo(videoId, {
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
    // Download and upload music to our storage
    const uploadResult = await downloadAndUploadImage( // This function works for audio too
      audioUrl as string, 
      'music-machine', 
      `music_${payload.id}`
    );
    
    if (uploadResult.success && uploadResult.url) {
      // Find the music record by prediction_id
      const { createClient } = await import('@/app/supabase/server');
      const supabase = await createClient();
      
      // Query music records created around the time this prediction was made
      const { data: musicRecords } = await supabase
        .from('music_generations')
        .select('id, user_id')
        .eq('user_id', analysis.user_id || 'unknown-user')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (musicRecords && musicRecords.length > 0) {
        // Update the most recent music record (assuming it's the one for this prediction)
        const musicId = musicRecords[0].id;
        
        await updateMusicRecord(musicId, {
          status: 'completed',
          final_audio_url: uploadResult.url,
          duration_seconds: payload.input?.duration || 8,
          model_version: payload.input?.model_version || 'stereo-melody-large',
          generation_time_ms: payload.metrics?.predict_time || 0,
          metadata: {
            prediction_id: payload.id,
            output_format: payload.input?.output_format || 'wav',
            prompt: payload.input?.prompt || '',
            generation_settings: payload.input
          } as Json
        });
        
        console.log(`✅ Music Complete: Updated music record ${musicId}`);
        return { count: 1, credits: 6 }; // Standard music generation cost
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
        
        await updateScriptVideoRecord(recordId, {
          status: 'completed',
          video_url: uploadResult.url,
          progress_percentage: 100,
          metadata: {
            prediction_id: payload.id,
            webhook_processed: true,
            generation_settings: payload.input
          } as Json
        });
        
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