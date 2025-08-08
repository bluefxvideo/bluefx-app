import { NextRequest, NextResponse } from 'next/server';
import { downloadAndUploadImage } from '@/actions/supabase-storage';
import { 
  updatePredictionRecord, 
  storeThumbnailResults, 
  recordGenerationMetrics 
} from '@/actions/database/thumbnail-database';
import { updateMusicRecord } from '@/actions/database/music-database';
import { createClient } from '@/app/supabase/server';

/**
 * ENHANCED AI-Orchestrated Webhook Handler
 * Intelligent processing with real-time broadcasting and multi-tool support
 */

interface ReplicateWebhookPayload {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version: string;
  input: any;
  output?: any;
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
    await updatePredictionRecord(payload.id, {
      status: payload.status,
      output_data: payload.output,
      completed_at: payload.completed_at,
      logs: payload.logs,
    });

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
  
  // AI Decision: Multiple validation points
  return !!(
    userAgent?.includes('Replicate') &&
    contentType?.includes('application/json') &&
    payload.id &&
    payload.status &&
    payload.version
  );
}

/**
 * AI payload analysis for intelligent processing
 */
async function analyzeWebhookPayload(payload: ReplicateWebhookPayload) {
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
                    payload.input?.metadata?.user_id;

  analysis.batch_id = payload.metadata?.batch_id || 
                     payload.input?.batch_id;

  // AI Decision: Determine tool type from multiple signals
  if (payload.version?.includes('flux-thumbnails-v2') || payload.input?.prompt) {
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
  } else if (payload.version?.includes('musicgen') || 
            (payload.input?.model_version && payload.input.model_version.includes('stereo'))) {
    analysis.tool_type = 'music-machine';
    analysis.processing_strategy = 'single_music_generation';
    analysis.expected_outputs = 1;
    analysis.requires_real_time_update = true;
  } else if (payload.input?.topic || payload.input?.title_style) {
    analysis.tool_type = 'title-generator';
    analysis.processing_strategy = 'text_processing';
    analysis.expected_outputs = payload.input?.title_count || 10;
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
  analysis: any
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
    } else if (analysis.processing_strategy === 'single_music_generation') {
      const musicResult = await processMusicGeneration(payload, analysis);
      results_processed = musicResult.count;
      credits_used = musicResult.credits;
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
async function processBatchThumbnails(payload: ReplicateWebhookPayload, analysis: any) {
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
        imageUrl, 
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
          model_name: determineModelVersion(payload),
          model_version: determineModelVersion(payload),
          batch_id,
          generation_settings: payload.input,
          metadata: {
            variation_index: i + 1,
            total_variations: outputs.length,
            type: 'thumbnail'
          },
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
      prompt_length: (payload.input?.prompt || '').length,
      has_advanced_options: hasAdvancedOptions(payload.input),
    });
    
    console.log(`✅ Batch Complete: ${thumbnailResults.length} thumbnails stored`);
  }

  return { count: thumbnailResults.length, credits: credits_used };
}

/**
 * Enhanced single result processing
 */
async function processSingleResult(payload: ReplicateWebhookPayload, analysis: any) {
  const imageUrl = typeof payload.output === 'string' ? payload.output : payload.output?.[0];
  if (!imageUrl) return { count: 0, credits: 0 };

  console.log(`🎯 Single Processing: ${analysis.tool_type}`);
  
  const batch_id = analysis.batch_id || crypto.randomUUID();
  let credits_used = 0;

  try {
    const uploadResult = await downloadAndUploadImage(
      imageUrl, 
      analysis.tool_type, 
      batch_id
    );
    
    if (uploadResult.success && uploadResult.url) {
      const result = {
        user_id: analysis.user_id || 'unknown-user',
        prompt: payload.input?.prompt || 'Generated content',
        image_urls: [uploadResult.url],
        dimensions: '1024x1024',
        height: 1024,
        width: 1024,
        model_name: determineModelVersion(payload),
        model_version: determineModelVersion(payload),
        batch_id,
        generation_settings: payload.input,
        metadata: {
          variation_index: 1,
          total_variations: 1,
          type: determineResultType(analysis.tool_type)
        },
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
 * Enhanced music generation processing
 */
async function processMusicGeneration(payload: ReplicateWebhookPayload, analysis: any) {
  const audioUrl = typeof payload.output === 'string' ? payload.output : payload.output?.[0];
  if (!audioUrl) return { count: 0, credits: 0 };

  console.log(`🎵 Music Processing: ${analysis.tool_type}`);
  
  try {
    // Download and upload audio file to our storage
    const uploadResult = await downloadAndUploadAudio(
      audioUrl, 
      'music', 
      `music_${payload.id}`
    );
    
    if (uploadResult.success && uploadResult.url) {
      // Update the music record in database
      const updateResult = await updateMusicRecord(payload.id, {
        status: 'completed',
        audio_url: uploadResult.url,
        quality_rating: 5
      });
      
      if (updateResult.success) {
        console.log(`✅ Music Complete: Stored ${analysis.tool_type}`);
        return { count: 1, credits: 0 }; // Credits already deducted during generation
      }
    }
  } catch (error) {
    console.error('❌ Music processing failed:', error);
    
    // Update record with error status
    await updateMusicRecord(payload.id, {
      status: 'failed',
      progress_percentage: 0
    });
  }

  return { count: 0, credits: 0 };
}

/**
 * Download and upload audio file (similar to image upload)
 */
async function downloadAndUploadAudio(
  audioUrl: string,
  bucket: string,
  filename: string
): Promise<{ success: boolean; url?: string; file_size_mb?: number; error?: string }> {
  try {
    console.log(`🎵 Downloading audio from: ${audioUrl}`);
    
    // Download the audio file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
    }
    
    const audioBlob = await response.blob();
    const fileSizeMB = audioBlob.size / (1024 * 1024);
    
    // Create File object
    const audioFile = new File([audioBlob], `${filename}.mp3`, {
      type: 'audio/mpeg'
    });
    
    // Upload to Supabase storage
    const supabase = await createClient();
    const uploadPath = `music/${filename}.mp3`;
    
    const { data, error } = await supabase.storage
      .from('audio')
      .upload(uploadPath, audioFile, {
        contentType: 'audio/mpeg',
        upsert: true
      });
    
    if (error) {
      console.error('Audio upload error:', error);
      return { success: false, error: error.message };
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('audio')
      .getPublicUrl(uploadPath);
    
    console.log(`✅ Audio uploaded successfully: ${publicUrlData.publicUrl}`);
    
    return {
      success: true,
      url: publicUrlData.publicUrl,
      file_size_mb: Number(fileSizeMB.toFixed(2))
    };
    
  } catch (error) {
    console.error('Audio download/upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Audio upload failed'
    };
  }
}

/**
 * Enhanced failure handling
 */
async function handleFailedGeneration(payload: ReplicateWebhookPayload, analysis: any): Promise<WebhookProcessingResult> {
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
async function handleProcessingUpdate(payload: ReplicateWebhookPayload, analysis: any): Promise<WebhookProcessingResult> {
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
async function broadcastToUser(userId: string, message: any) {
  try {
    const supabase = createClient();
    
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

function determineResultType(toolType: string): 'thumbnail' | 'faceswap' | 'recreate' {
  switch (toolType) {
    case 'face-swap': return 'faceswap';
    case 'thumbnail-machine': return 'thumbnail';
    default: return 'thumbnail';
  }
}

function determineStyleType(input: any): string {
  return input?.style_type || input?.title_style || 'auto';
}

function hasAdvancedOptions(input: any): boolean {
  return !!(input?.guidance_scale || input?.num_inference_steps || 
           input?.output_quality || input?.seed || input?.reference_image);
}

function analyzeFailureType(error: string): string {
  if (error.includes('NSFW')) return 'content_policy';
  if (error.includes('timeout')) return 'timeout';
  if (error.includes('GPU')) return 'resource_limit';
  return 'unknown';
}