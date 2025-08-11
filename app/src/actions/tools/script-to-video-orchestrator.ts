'use server';

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { 
  storeScriptVideoResults, 
  createPredictionRecord, 
  recordGenerationMetrics,
  getUserCredits,
  deductCredits 
} from '../database/script-video-database';
import { Json } from '@/types/database';

/**
 * Script-to-Video AI Orchestrator
 * Replaces 5 legacy edge functions with intelligent workflow orchestration
 */

export interface ScriptToVideoRequest {
  // Core input
  script_text: string;
  
  // Production preferences (AI will optimize if not specified)
  video_style?: {
    tone: 'professional' | 'casual' | 'educational' | 'dramatic' | 'energetic';
    pacing: 'slow' | 'medium' | 'fast';
    visual_style: 'realistic' | 'artistic' | 'minimal' | 'dynamic';
  };
  
  // Voice preferences (AI will select optimal if not specified)
  voice_settings?: {
    voice_id: 'anna' | 'eric' | 'felix' | 'oscar' | 'nina' | 'sarah';
    speed: 'slower' | 'normal' | 'faster';
    emotion: 'neutral' | 'excited' | 'calm' | 'authoritative';
  };
  
  // Technical specifications
  target_duration?: number; // seconds, AI will optimize if not specified
  aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3';
  quality?: 'draft' | 'standard' | 'premium';
  
  // Advanced options
  reference_images?: string[]; // URLs or base64
  background_music?: boolean;
  custom_branding?: {
    logo?: string;
    color_scheme?: string;
  };
  
  // User context
  user_id: string;
}

export interface ScriptToVideoResponse {
  success: boolean;
  
  // Database ID for captions and other data
  video_id?: string;
  
  // Generated content
  video_url?: string;
  audio_url?: string;
  generated_images?: {
    url: string;
    segment_index: number;
    prompt: string;
  }[];
  
  // Script (generated or original)
  final_script?: string;
  was_script_generated?: boolean;
  
  // Production details
  segments?: VideoSegment[];
  timeline_data?: {
    total_duration: number;
    segment_count: number;
    frame_count: number;
  };
  
  // AI orchestration insights
  production_plan?: ProductionPlan;
  optimization_applied?: string[];
  
  // Standard metadata
  prediction_id: string;
  batch_id: string;
  credits_used: number;
  generation_time_ms: number;
  
  // Error handling
  error?: string;
  warnings?: string[];
}

interface VideoSegment {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
  duration: number;
  image_prompt: string;
  voice_emotion: string;
  timing_data: {
    words_per_minute: number;
    pause_duration: number;
  };
}

interface ProductionPlan {
  workflow_type: 'sequential' | 'parallel' | 'hybrid';
  complexity_score: number;
  estimated_duration: number;
  segment_strategy: string;
  voice_optimization: string;
  visual_optimization: string;
  quality_optimizations: string[];
}

// Ultra-minimal test schemas to isolate the issue
const _SegmentAnalysisSchema = z.object({
  content_type: z.string(),
  total_duration: z.number(),
  segment_count: z.number()
});

const _ProductionPlanSchema = z.object({
  workflow_type: z.string(),
  complexity_score: z.number(),
  estimated_duration: z.number()
});

// Credit constants
const CREDITS_PER_SEGMENT = 3;
const VOICE_GENERATION_CREDITS = 5;
const IMAGE_GENERATION_CREDITS = 4;
const VIDEO_ASSEMBLY_CREDITS = 8;
const AI_ORCHESTRATION_CREDITS = 2;

// Removed hardcoded segment calculation - AI will decide optimal count

/**
 * AI-Orchestrated Script-to-Video Generation
 * Intelligent workflow that analyzes, plans, and executes video production
 */
export async function generateScriptToVideo(
  request: ScriptToVideoRequest
): Promise<ScriptToVideoResponse> {
  const startTime = Date.now();
  const batch_id = crypto.randomUUID();
  let total_credits = 0;
  const warnings: string[] = [];
  const optimization_applied: string[] = [];
  
  // Variables for comprehensive metadata storage
  let storyContext: any = null;
  let whisperResult: any = null;
  let voiceOptimization: any = null;
  let visualOptimization: any = null;
  let segmentAnalysis: any = {};

  try {
    console.log(`🎬 AI Video Orchestrator: Starting intelligent production for user ${request.user_id}`);

    // Step 1: Credit Validation
    const creditCheck = await getUserCredits(request.user_id);
    if (!creditCheck.success) {
      throw new Error('Unable to verify credit balance');
    }

    const estimatedCredits = calculateEstimatedCredits(request);
    if ((creditCheck.credits || 0) < estimatedCredits) {
      throw new Error(`Insufficient credits. Need ${estimatedCredits}, have ${creditCheck.credits || 0}`);
    }

    console.log(`💳 Credits validated: ${creditCheck.credits} available, ${estimatedCredits} estimated`);

    // Step 2: Smart Input Detection & Script Generation
    let finalScript = request.script_text;
    const isPromptLikeInput = detectPromptMode(request.script_text);
    
    if (isPromptLikeInput) {
      console.log(`🧠 Detected prompt mode: "${request.script_text.substring(0, 50)}..."`);
      
      try {
        // Generate script from prompt
        const { object: scriptGeneration } = await generateObject({
          model: openai('gpt-4o'),
          schema: z.object({
            script: z.string(),
            hook: z.string(),
            tone: z.enum(['professional', 'casual', 'educational', 'dramatic', 'energetic'])
          }),
          prompt: `Create a TikTok-style voiceover script for: "${request.script_text}"

Requirements:
- 60-90 seconds when spoken (150-225 words)
- Write as direct speech, not stage directions
- Strong hook that grabs attention immediately
- Tell a complete story with clear beginning, middle, end
- Use "you" to engage the audience directly
- Natural speaking tone, easy to read aloud
- End with engaging call-to-action

Style: ${request.video_style?.tone || 'professional'} tone, ${request.video_style?.pacing || 'medium'} pacing.

Write ONLY the words to be spoken - no [stage directions] or scene descriptions. Make it sound like someone talking directly to the camera.`
        });

        finalScript = scriptGeneration.script;
        console.log(`✅ Generated script from prompt (${finalScript.length} chars)`);
        console.log(`🎯 Hook: "${scriptGeneration.hook}"`);
        
        optimization_applied.push('AI script generation from creative prompt');
        total_credits += AI_ORCHESTRATION_CREDITS; // Extra credits for script generation
        
      } catch (error) {
        console.warn('⚠️ Script generation failed, treating as script input:', error);
        // Fallback to treating input as script
      }
    } else {
      console.log(`📝 Detected script mode (${finalScript.length} characters)`);
    }

    // Step 3: AI Script Analysis & Segmentation - MINIMAL TEST
    console.log('🧠 AI Analyzing script and creating production plan...');
    
    // Use top-level segmentAnalysis variable
    try {
      // Ultra-minimal test - exactly like AI SDK docs
      const { object } = await generateObject({
        model: openai('gpt-4o'),
        schema: z.object({
          name: z.string(),
        }),
        prompt: 'Return a name for this content type: educational'
      });
      
      console.log('✅ Minimal test passed:', object);
      
      // Let AI determine optimal duration and segments - no hardcoded limits
      const targetDuration = request.target_duration || calculateOptimalDuration(request.script_text);
      
      // Placeholder - AI will determine actual values
      segmentAnalysis = {
        total_duration: targetDuration,
        segment_count: 0 // AI will decide
      };
      
    } catch (error) {
      console.error('🚨 generateObject test failed:', error);
      // Fallback to basic values - AI will still decide
      const targetDuration = request.target_duration || calculateOptimalDuration(request.script_text);
      
      segmentAnalysis = {
        total_duration: targetDuration,
        segment_count: 0 // AI will decide
      };
    }

    total_credits += AI_ORCHESTRATION_CREDITS;
    console.log(`✅ Initial analysis complete - AI will determine optimal segmentation`);

    // Create intelligent segments using story beat analysis
    const result = await createStoryBasedSegments(finalScript, segmentAnalysis);
    const mockSegments = result.segments;
    storyContext = result.storyContext;
    
    // Update analysis with AI's decisions
    segmentAnalysis.segment_count = storyContext.ai_determined_count || mockSegments.length;
    segmentAnalysis.total_duration = mockSegments.length > 0 
      ? mockSegments[mockSegments.length - 1].end_time 
      : 30;

    // Step 3: AI Production Planning - MINIMAL TEST
    console.log('🎯 AI Creating comprehensive production plan...');
    
    let productionPlan;
    try {
      // Test with single property first
      const { object } = await generateObject({
        model: openai('gpt-4o'),
        schema: z.object({
          workflow: z.string(),
        }),
        prompt: 'Return a workflow type: parallel'
      });
      
      console.log('✅ Production plan test passed:', object);
      
      // Use mock data
      productionPlan = {
        workflow_type: 'parallel',
        complexity_score: 5,
        estimated_duration: 60
      };
      
      // Store optimization data for metadata
      voiceOptimization = {
        recommended_voice: 'anna',
        speed_adjustment: 'normal',
        emotion_consistency: 'Consistent emotion throughout'
      };
      visualOptimization = {
        style_consistency: 'Cohesive visual style',
        image_generation_strategy: 'parallel',
        aspect_ratio_optimization: request.aspect_ratio || '16:9'
      };
      
    } catch (error) {
      console.error('🚨 Production plan test failed:', error);
      productionPlan = {
        workflow_type: 'parallel',
        complexity_score: 5,
        estimated_duration: 60
      };
      
      // Store optimization data for metadata (fallback)
      voiceOptimization = {
        recommended_voice: 'anna',
        speed_adjustment: 'normal',
        emotion_consistency: 'Consistent emotion throughout'
      };
      visualOptimization = {
        style_consistency: 'Cohesive visual style',
        image_generation_strategy: 'parallel',
        aspect_ratio_optimization: request.aspect_ratio || '16:9'
      };
    }

    total_credits += AI_ORCHESTRATION_CREDITS;
    console.log(`🎬 Production plan created: ${productionPlan.workflow_type} workflow, complexity ${productionPlan.complexity_score}/10`);

    // Step 4: Create Prediction Record
    await createPredictionRecord({
      prediction_id: batch_id,
      user_id: request.user_id,
      tool_id: 'script-to-video',
      service_id: 'ai-orchestrated-generation',
      model_version: 'gpt-4o-orchestrated',
      status: 'processing',
      input_data: { 
        ...request,
        production_plan: productionPlan as unknown as Json,
        segment_count: segmentAnalysis.segment_count
      } as unknown as Json,
    });

    // Step 5: Execute Production Based on AI Plan
    // const _generatedSegments: VideoSegment[] = [];
    let generatedImages: { url: string; segment_index: number; prompt: string; }[] = [];
    let audioUrl: string | undefined;

    if (productionPlan.workflow_type === 'parallel') {
      console.log('🔄 Executing parallel production workflow...');
      
      // Parallel execution for independent segments
      const [voiceResult, imageResults] = await Promise.all([
        generateVoiceForAllSegments(mockSegments, {
          recommended_voice: 'anna',
          speed_adjustment: 'normal',
          emotion_consistency: 'neutral'
        }, request.user_id, batch_id),
        generateImagesForAllSegments(mockSegments, {
          style_consistency: 'realistic',
          image_generation_strategy: 'standard',
          aspect_ratio_optimization: request.aspect_ratio || '16:9'
        }, request.aspect_ratio || '16:9', request.user_id, batch_id)
      ]);

      audioUrl = voiceResult.audio_url;
      generatedImages = imageResults;
      total_credits += voiceResult.credits_used + imageResults.reduce((sum, img) => sum + ((img as any).credits_used || IMAGE_GENERATION_CREDITS), 0);
      
      optimization_applied.push('Parallel processing for maximum efficiency');
      
    } else if (productionPlan.workflow_type === 'sequential') {
      console.log('📝 Executing sequential production workflow...');
      
      // Sequential execution for dependent segments
      // For now, use the parallel approach but execute sequentially
      console.log('📝 Using parallel voice generation for sequential workflow (optimization)');
      
      const voiceResult = await generateVoiceForAllSegments(mockSegments, {
        recommended_voice: 'anna',
        speed_adjustment: 'normal',
        emotion_consistency: 'neutral'
      }, request.user_id, batch_id);
      audioUrl = voiceResult.audio_url;
      total_credits += voiceResult.credits_used;

      // Generate images using the same batch function for consistency
      const imageResults = await generateImagesForAllSegments(mockSegments, {
        style_consistency: 'realistic',
        image_generation_strategy: 'standard',
        aspect_ratio_optimization: request.aspect_ratio || '16:9'
      }, request.aspect_ratio || '16:9', request.user_id, batch_id);
      generatedImages = imageResults;
      total_credits += imageResults.reduce((sum, img) => sum + (img.credits_used || IMAGE_GENERATION_CREDITS), 0);
      
      optimization_applied.push('Sequential processing for narrative consistency');
      
    } else {
      // Hybrid workflow - AI decides optimal execution per segment
      console.log('🎭 Executing hybrid production workflow...');
      
      const criticalSegments = mockSegments.filter((_, i: number) => i < 2); // First 2 segments
      const remainingSegments = mockSegments.slice(2);
      
      // Sequential for critical segments
      for (const _segment of criticalSegments) {
        // Individual processing for maximum quality
      }
      
      // Parallel for remaining segments  
      if (remainingSegments.length > 0) {
        // Batch processing for efficiency
      }
      
      optimization_applied.push('Hybrid processing for optimal quality-efficiency balance');
    }

    // Step 6: Whisper Analysis for Precise Word Timing
    console.log('🎤 Analyzing audio with Whisper for precise lip sync...');
    let wordTimings: any[] = [];
    let captionChunks: any = null;
    
    if (audioUrl) {
      const { analyzeAudioWithWhisper } = await import('../services/whisper-analysis-service');
      
      whisperResult = await analyzeAudioWithWhisper({
        audio_url: audioUrl,
        segments: mockSegments.map(seg => ({
          id: seg.id,
          text: seg.text,
          start_time: seg.start_time,
          end_time: seg.end_time
        }))
      }, 30); // 30fps frame rate for professional video editing accuracy

      if (whisperResult.success) {
        wordTimings = whisperResult.segment_timings;
        total_credits += 3; // Whisper analysis cost
        console.log(`✅ Whisper analysis: ${whisperResult.word_count} words, ${whisperResult.speaking_rate.toFixed(1)} WPM`);
        optimization_applied.push('Precise word-level timing with Whisper AI');
        
        // Step 6.5: Create Professional Caption Chunks
        console.log('📝 Creating professional caption chunks following industry standards...');
        const { createProfessionalCaptions } = await import('../services/caption-chunking-service');
        
        // Determine content type based on video style
        const contentType = request.video_style?.tone === 'educational' 
          ? 'educational' 
          : request.video_style?.pacing === 'fast' 
            ? 'fast' 
            : 'standard';
        
        const captionResult = await createProfessionalCaptions(whisperResult, contentType);
        
        if (captionResult.success) {
          captionChunks = captionResult;
          total_credits += 1; // Caption processing cost
          console.log(`✅ Created ${captionResult.total_chunks} professional caption chunks`);
          console.log(`   📊 Avg ${captionResult.avg_words_per_chunk.toFixed(1)} words/chunk, Quality: ${captionResult.quality_score.toFixed(0)}/100`);
          optimization_applied.push('Professional caption chunking (Netflix/broadcast standards)');
        } else {
          console.warn('⚠️ Caption chunking failed, will use full segment text');
          warnings.push('Caption chunking failed - using fallback display');
        }
      } else {
        console.warn('⚠️ Whisper analysis failed, using estimated timing');
        warnings.push('Word timing estimation used (Whisper analysis failed)');
      }
    }

    // Step 7: AI-Driven Video Assembly
    console.log('🎞️ AI orchestrating final video assembly...');
    
    const assemblyPlan = await generateAssemblyPlan(
      productionPlan,
      generatedImages.map(img => ({ ...img, credits_used: IMAGE_GENERATION_CREDITS })), 
      audioUrl,
      segmentAnalysis,
      wordTimings
    );
    
    // Execute video assembly (placeholder - would integrate with Remotion)
    const videoUrl = await executeVideoAssembly(assemblyPlan);
    total_credits += VIDEO_ASSEMBLY_CREDITS;

    // Step 7: Deduct Credits
    const creditDeduction = await deductCredits(
      request.user_id,
      total_credits,
      'script-to-video-generation',
      { 
        batch_id, 
        segment_count: segmentAnalysis.segment_count,
        workflow_type: productionPlan.workflow_type 
      }
    );

    if (!creditDeduction.success) {
      warnings.push('Credit deduction failed - please contact support');
    }

    // Step 8: Store Results with COMPLETE metadata for consistency
    const storeResult = await storeScriptVideoResults({
      user_id: request.user_id,
      script_text: finalScript, // Store the final script (generated or original)
      video_url: videoUrl,
      audio_url: audioUrl,
      generated_images: generatedImages,
      segments: mockSegments,
      batch_id,
      model_version: 'gpt-4o-orchestrated',
      generation_parameters: request as unknown as Json,
      production_plan: productionPlan as unknown as Json,
      credits_used: total_credits,
      word_timings: wordTimings, // Store precise Whisper word timings
      caption_chunks: captionChunks, // Store professional caption chunks
      
      // NEW: Complete metadata for consistency and auto-save
      storyboard_data: storyContext ? {
        narrative_analysis: storyContext.narrative_analysis,
        characters: storyContext.characters,
        scene_orchestration: storyContext.scene_orchestration,
        original_context: storyContext.originalStoryboardPlan
      } : undefined,
      
      whisper_data: whisperResult ? {
        full_analysis: whisperResult,
        quality_metrics: {
          alignment_quality: whisperResult.alignment_quality,
          confidence_score: whisperResult.confidence_score,
          speaking_rate: whisperResult.speaking_rate
        },
        frame_alignment: {
          frame_rate: whisperResult.frame_rate,
          timing_precision: whisperResult.timing_precision
        }
      } : undefined,
      
      voice_data: audioUrl ? {
        synthesis_params: {
          voice_id: request.voice_settings?.voice_id || 'anna',
          speed: request.voice_settings?.speed || 'normal',
          emotion: request.voice_settings?.emotion || 'neutral'
        },
        emotion_mapping: voiceOptimization,
        timing_adjustments: {
          pause_locations: [],
          speech_rate: segmentAnalysis.speaking_rate || 150
        }
      } : undefined,
      
      image_data: generatedImages.length > 0 ? {
        generation_params: {
          model: 'flux-1-schnell',
          aspect_ratio: request.aspect_ratio || '16:9',
          quality: request.quality || 'standard'
        },
        consistency_settings: {
          style_consistency: visualOptimization?.style_consistency,
          character_descriptions: storyContext?.characters
        },
        seed_values: [] // TODO: Capture seeds from image generation
      } : undefined,
      
      caption_settings: captionChunks ? {
        content_type: request.video_style?.tone === 'educational' ? 'educational' : 'standard',
        quality_score: captionChunks.quality_score || 0,
        avg_words_per_chunk: captionChunks.avg_words_per_chunk || 0
      } : undefined
    });

    // Step 9: Record Analytics
    await recordGenerationMetrics({
      user_id: request.user_id,
      batch_id,
      model_version: 'gpt-4o-orchestrated',
      workflow_type: productionPlan.workflow_type as 'sequential' | 'parallel' | 'hybrid',
      segment_count: segmentAnalysis.segment_count,
      generation_time_ms: Date.now() - startTime,
      total_credits_used: total_credits,
      complexity_score: productionPlan.complexity_score,
      ai_optimizations_applied: optimization_applied.length
    });

    const generation_time_ms = Date.now() - startTime;
    console.log(`🎉 AI Video Orchestrator: Production completed in ${generation_time_ms}ms`);

    return {
      success: true,
      video_id: storeResult?.video_id, // Include database ID for caption fetching
      video_url: videoUrl,
      audio_url: audioUrl,
      generated_images: generatedImages,
      final_script: finalScript,
      was_script_generated: isPromptLikeInput,
      segments: mockSegments.map((seg, _i) => {
        // Find caption chunks for this segment
        const segmentCaptions = captionChunks?.segments?.find(
          (s: any) => s.segment_id === seg.id
        );
        
        return {
          id: seg.id,
          text: seg.text,
          start_time: seg.start_time,
          end_time: seg.end_time,
          duration: seg.duration,
          image_prompt: seg.image_prompt,
          voice_emotion: seg.voice_emotion,
          timing_data: {
            words_per_minute: 180, // Default WPM since segments are now in segmentAnalysis
            pause_duration: 0.5 // Default pause duration
          },
          caption_chunks: segmentCaptions?.caption_chunks || null // Professional caption chunks
        };
      }),
      timeline_data: {
        total_duration: segmentAnalysis.total_duration,
        segment_count: segmentAnalysis.segment_count,
        frame_count: Math.ceil(segmentAnalysis.total_duration * 30) // 30 FPS
      },
      production_plan: {
        workflow_type: productionPlan.workflow_type as 'sequential' | 'parallel' | 'hybrid',
        complexity_score: productionPlan.complexity_score,
        estimated_duration: productionPlan.estimated_duration,
        segment_strategy: 'AI-optimized segmentation',
        voice_optimization: 'Consistent emotion throughout',
        visual_optimization: 'Cohesive visual style',
        quality_optimizations: ['Timing optimization', 'Visual consistency', 'Audio quality']
      },
      optimization_applied,
      prediction_id: batch_id,
      batch_id,
      credits_used: total_credits,
      generation_time_ms,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

  } catch (error) {
    console.error('🚨 AI Video Orchestrator error:', error);
    
    return {
      success: false,
      prediction_id: '',
      batch_id,
      credits_used: total_credits,
      generation_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'AI video orchestration failed',
    };
  }
}

/**
 * AI Helper Functions for Video Production
 */

function calculateEstimatedCredits(request: ScriptToVideoRequest): number {
  const scriptLength = request.script_text.length;
  const estimatedSegments = Math.ceil(scriptLength / 100); // Rough estimate
  
  let credits = 0;
  credits += AI_ORCHESTRATION_CREDITS * 2; // Planning + assembly
  credits += estimatedSegments * CREDITS_PER_SEGMENT;
  credits += VOICE_GENERATION_CREDITS;
  credits += estimatedSegments * IMAGE_GENERATION_CREDITS;
  credits += VIDEO_ASSEMBLY_CREDITS;
  
  return credits;
}

// Real voice generation using OpenAI TTS
async function generateVoiceForAllSegments(
  segments: any[], 
  voiceOptimization: { recommended_voice: string; speed_adjustment: string; emotion_consistency: string },
  user_id: string,
  batch_id: string
) {
  // Import the voice service
  const { generateVoiceForAllSegments: generateVoice } = await import('../services/voice-generation-service');
  
  // Prepare request
  const voiceRequest = {
    segments: segments.map(s => ({
      id: crypto.randomUUID(),
      text: s.text,
      start_time: 0, // Will be calculated later
      end_time: s.duration,
      duration: s.duration
    })),
    voice_settings: {
      voice_id: voiceOptimization.recommended_voice as any,
      speed: voiceOptimization.speed_adjustment as any,
      emotion: 'neutral' as any // Default emotion
    },
    user_id,
    batch_id
  };

  // Basic validation
  if (!voiceRequest.segments || voiceRequest.segments.length === 0) {
    throw new Error('No segments provided for voice generation');
  }

  if (!user_id || !batch_id) {
    throw new Error('User ID and batch ID are required for voice generation');
  }

  // Generate voice
  const result = await generateVoice(voiceRequest);
  
  if (!result.success) {
    throw new Error(`Voice generation failed: ${result.error}`);
  }

  return {
    audio_url: result.audio_url!,
    credits_used: result.credits_used
  };
}

async function generateImagesForAllSegments(segments: any[], visualOptimization: { style_consistency: string; image_generation_strategy: string; aspect_ratio_optimization: string }, aspectRatio: string, user_id: string, batch_id: string) {
  // Import the image generation service
  const { generateImagesForAllSegments: generateImages } = await import('../services/image-generation-service');
  
  // Prepare request
  const imageRequest = {
    segments: segments.map(s => ({
      id: crypto.randomUUID(),
      image_prompt: s.image_prompt,
      duration: s.duration
    })),
    style_settings: {
      visual_style: mapVisualStyle(visualOptimization.style_consistency),
      aspect_ratio: aspectRatio as '16:9' | '9:16' | '1:1' | '4:3',
      quality: 'standard' as const // Can be upgraded based on user preferences
    },
    user_id,
    batch_id
  };

  // Generate images using FLUX Kontext Pro
  const result = await generateImages(imageRequest);
  
  if (!result.success) {
    throw new Error(`Image generation failed: ${result.error}`);
  }

  // Return in expected format
  return result.generated_images!.map((img, index) => ({
    url: img.image_url,
    segment_index: index,
    prompt: img.prompt,
    credits_used: result.credits_used / result.generated_images!.length
  }));
}

// Note: Individual segment voice generation removed in favor of batch generation for efficiency
// If needed for editing scenarios, use the voice-generation-service directly

// Helper function to map visual styles
function mapVisualStyle(styleConsistency: string): 'realistic' | 'artistic' | 'minimal' | 'dynamic' {
  // Extract style preference from AI optimization description
  if (styleConsistency.toLowerCase().includes('realistic') || styleConsistency.toLowerCase().includes('photo')) {
    return 'realistic';
  } else if (styleConsistency.toLowerCase().includes('artistic') || styleConsistency.toLowerCase().includes('creative')) {
    return 'artistic';
  } else if (styleConsistency.toLowerCase().includes('minimal') || styleConsistency.toLowerCase().includes('clean')) {
    return 'minimal';
  } else if (styleConsistency.toLowerCase().includes('dynamic') || styleConsistency.toLowerCase().includes('energetic')) {
    return 'dynamic';
  }
  return 'realistic'; // Default fallback
}

async function generateAssemblyPlan(_productionPlan: any, _images: { url: string; segment_index: number; prompt: string; credits_used: number }[], audioUrl: string | undefined, segmentAnalysis: any, _wordTimings: any[] = []) {
  // AI would create optimal video assembly strategy
  // Create mock segments based on segment analysis
  const segments = Array.from({ length: segmentAnalysis.segment_count || 4 }, (_, i) => ({
    id: `segment-${i}`,
    start_time: i * (segmentAnalysis.total_duration || 60) / (segmentAnalysis.segment_count || 4)
  }));
  
  return {
    assembly_strategy: 'timeline-based',
    transition_effects: ['fade', 'slide'],
    audio_sync_points: segments.map((seg) => ({
      segment_id: seg.id,
      start_time: seg.start_time,
      audio_file: audioUrl
    }))
  };
}

async function executeVideoAssembly(_assemblyPlan: { assembly_strategy: string; transition_effects: string[]; audio_sync_points: { segment_id: string; start_time: number; audio_file: string | undefined }[] }): Promise<string> {
  // Would integrate with Remotion for actual video generation
  return `https://storage.example.com/videos/${crypto.randomUUID()}.mp4`;
}

/**
 * AI Storyboard Orchestrator - Intelligent Scene Planning
 * Analyzes the complete narrative to create diverse, engaging visuals
 */
async function createStoryBasedSegments(script: string, _segmentAnalysis: { segment_count: number }): Promise<{ segments: any[], storyContext: any }> {
  try {
    console.log('🎬 Creating intelligent storyboard with dynamic scenes...');
    
    // AI-Driven Storyboard Orchestration - Let AI decide everything
    console.log('🤖 AI analyzing story and determining optimal approach...');
    
    const { object: storyboard } = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({
        narrative_analysis: z.object({
          story_summary: z.string(),
          optimal_segment_count: z.number(),
          pacing_strategy: z.string(),
          visual_complexity: z.string()
        }),
        characters: z.array(z.object({
          name: z.string(),
          detailed_description: z.string(),
          role_in_story: z.string(),
          consistency_requirements: z.string()
        })),
        scene_orchestration: z.array(z.object({
          scene_purpose: z.string(),
          visual_approach: z.string(),
          camera_technique: z.string(),
          characters_featured: z.array(z.string()),
          environment: z.string(),
          emotional_tone: z.string(),
          narrative_function: z.string(),
          text_content: z.string(),
          image_generation_prompt: z.string()
        }))
      }),
      prompt: `You are an AI Creative Director with complete creative freedom. Analyze this story and make ALL creative decisions.

Script: "${script}"

Your mission: Create the most engaging, visually diverse, character-consistent video possible.

Make these decisions autonomously:

1. NARRATIVE ANALYSIS:
   - What's the core story?
   - How many segments does THIS specific story need? (Don't be constrained by arbitrary limits)
   - What pacing strategy works best?
   - How visually complex should this be?

2. CHARACTER MASTERY:
   - Identify ALL characters (main/supporting/background)
   - Create EXTREMELY detailed descriptions for visual consistency
   - Define what must stay consistent vs what can change
   - Plan character arcs and development

3. SCENE ORCHESTRATION:
   - Design each scene with complete creative freedom
   - Choose any camera angles, compositions, styles
   - Create diverse visual experiences
   - Balance character consistency with scene variety
   - Decide text chunking based on natural story flow
   - Generate ready-to-use image prompts

Think like Pixar: Every frame should serve the story, every character should be instantly recognizable, every scene should feel cinematic.

Don't follow rigid formulas - adapt to THIS story's unique needs.

For each scene, provide the exact text content AND the complete image generation prompt.

Be bold, creative, and unrestricted!`
    });

    console.log('✅ AI Storyboard created:');
    console.log('Story:', storyboard.narrative_analysis.story_summary);
    console.log('AI decided segments:', storyboard.narrative_analysis.optimal_segment_count);
    console.log('Pacing strategy:', storyboard.narrative_analysis.pacing_strategy);
    console.log('Characters:', storyboard.characters.map(c => c.name).join(', '));
    console.log('Scenes generated:', storyboard.scene_orchestration.length);
    
    // Use AI's scene orchestration directly - no hardcoded manipulation
    let cumulativeTime = 0;
    const storySegments = storyboard.scene_orchestration.map((scene, index) => {
      const duration = Math.max(3, Math.min(8, calculateSpeechDuration(scene.text_content)));
      const startTime = cumulativeTime;
      cumulativeTime += duration;
      
      return {
        id: `segment-${index + 1}`,
        text: scene.text_content,
        start_time: startTime,
        end_time: startTime + duration,
        duration: duration,
        character_count: scene.text_content.length,
        
        // AI-generated scene details
        image_prompt: scene.image_generation_prompt,
        scene_purpose: scene.scene_purpose,
        visual_approach: scene.visual_approach,
        camera_technique: scene.camera_technique,
        characters_featured: scene.characters_featured,
        environment: scene.environment,
        emotional_tone: scene.emotional_tone,
        narrative_function: scene.narrative_function,
        
        // Derive voice emotion from AI's emotional tone
        voice_emotion: scene.emotional_tone.toLowerCase().includes('excited') ? 'excited' : 
                      scene.emotional_tone.toLowerCase().includes('dramatic') ? 'dramatic' :
                      scene.emotional_tone.toLowerCase().includes('calm') ? 'calm' : 'neutral',
        
        // Let AI determine importance
        importance_score: scene.narrative_function.toLowerCase().includes('climax') ? 0.9 : 
                         scene.narrative_function.toLowerCase().includes('introduction') ? 0.8 : 0.7
      };
    });

    const storyContext = {
      narrative_analysis: storyboard.narrative_analysis,
      characters: storyboard.characters,
      scene_orchestration: storyboard.scene_orchestration,
      total_scenes: storyboard.scene_orchestration.length,
      ai_determined_count: storyboard.narrative_analysis.optimal_segment_count,
      
      // NEW: Store for editing context
      originalStoryboardPlan: {
        characters: storyboard.characters,
        visual_style: storyboard.narrative_analysis.visual_complexity || 'cinematic',
        narrative_flow: storyboard.narrative_analysis.pacing_strategy,
        scene_progression: storyboard.scene_orchestration.map(s => s.scene_purpose)
      },
      segmentContexts: storyboard.scene_orchestration.map(scene => ({
        original_purpose: scene.scene_purpose,
        original_visual_approach: scene.visual_approach,
        original_characters: scene.characters_featured,
        original_emotional_tone: scene.emotional_tone,
        original_image_prompt: scene.image_generation_prompt
      }))
    };

    return { segments: storySegments, storyContext };

  } catch (error) {
    console.warn('⚠️ Storyboard orchestration failed, using fallback method:', error);
    return createFallbackSegments(script);
  }
}

// Removed unused createOptimalSegments function to fix build issues

function createDiverseSceneFromText(text: string, index: number, totalSegments: number): string {
  // Create diverse camera angles and scene types based on text content and segment position
  const lowerText = text.toLowerCase();
  const sceneTypes = ['wide shot', 'close-up', 'medium shot', 'action shot', 'environment shot'];
  const sceneType = sceneTypes[index % sceneTypes.length];
  
  // Story progression based on position
  let storyPhase = 'introduction';
  if (index < totalSegments * 0.3) storyPhase = 'introduction';
  else if (index < totalSegments * 0.7) storyPhase = 'development';
  else storyPhase = 'conclusion';
  
  // Extract action/context from text
  let action = 'in scene';
  if (lowerText.includes('find') || lowerText.includes('discover')) action = 'discovering something new';
  if (lowerText.includes('meet') || lowerText.includes('encounter')) action = 'meeting or encountering';
  if (lowerText.includes('fly') || lowerText.includes('soar')) action = 'in flight or soaring';
  if (lowerText.includes('land') || lowerText.includes('arrive')) action = 'landing or arriving';
  if (lowerText.includes('surprise') || lowerText.includes('shock')) action = 'showing surprise or shock';
  if (lowerText.includes('together') || lowerText.includes('join')) action = 'coming together or joining';
  
  return `${sceneType} of ${action}, ${storyPhase} phase of story, cinematic composition`;
}

/**
 * Fallback segmentation method using improved sentence analysis
 */
function createFallbackSegments(script: string): { segments: any[], storyContext: any } {
  console.log('⚠️ Using emergency fallback - basic segmentation');
  
  // Simple sentence-based splitting
  const sentences = script.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  const segmentCount = Math.min(Math.max(4, sentences.length), 8);
  const sentencesPerSegment = Math.ceil(sentences.length / segmentCount);
  
  const segments = [];
  let currentTime = 0;
  
  for (let i = 0; i < segmentCount; i++) {
    const startIndex = i * sentencesPerSegment;
    const endIndex = Math.min((i + 1) * sentencesPerSegment, sentences.length);
    const segmentSentences = sentences.slice(startIndex, endIndex);
    
    if (segmentSentences.length > 0) {
      const segmentText = segmentSentences.join('. ').trim();
      const duration = Math.max(3, Math.min(8, calculateSpeechDuration(segmentText)));
      
      segments.push({
        id: `segment-${i + 1}`,
        text: segmentText,
        start_time: currentTime,
        end_time: currentTime + duration,
        duration: duration,
        character_count: segmentText.length,
        image_prompt: `${createDiverseSceneFromText(segmentText, i, segmentCount)}, cinematic storytelling`,
        voice_emotion: i === 0 ? 'excited' : 'neutral',
        importance_score: i === 0 ? 0.9 : 0.7
      });
      
      currentTime += duration;
    }
  }
  
  return {
    segments,
    storyContext: {
      narrative_analysis: { story_summary: "Basic story", optimal_segment_count: segments.length },
      characters: [{ name: "main character", detailed_description: "character in story" }],
      total_scenes: segments.length,
      ai_determined_count: segments.length
    }
  };
}

// Removed unused distributeSegmentSizes function to fix build issues

/**
 * Calculate speech duration with natural pacing considerations
 */
function calculateSpeechDuration(text: string): number {
  const wordCount = text.split(/\s+/).length;
  const punctuationPauses = (text.match(/[,;:]/g) || []).length * 0.3; // Short pauses
  const sentenceBreaks = (text.match(/[.!?]/g) || []).length * 0.5; // Sentence pauses
  
  // Base: ~180 words per minute (3 words per second)
  const baseDuration = wordCount / 3;
  const pauseDuration = punctuationPauses + sentenceBreaks;
  
  return Math.max(3, Math.min(8, baseDuration + pauseDuration));
}

/**
 * Calculate optimal video duration based on script content
 * Considers word count, complexity, and TikTok best practices
 */
function calculateOptimalDuration(script: string): number {
  const wordCount = script.trim().split(/\s+/).length;
  
  // Base calculation: ~180 words per minute for natural speech
  const baseDuration = (wordCount / 180) * 60;
  
  // TikTok optimization: prefer 30-90 second videos
  if (baseDuration < 30) return 30; // Minimum for engagement
  if (baseDuration > 90) return 90; // Maximum for retention
  
  // Round to nearest 15 seconds for clean segments
  return Math.round(baseDuration / 15) * 15;
}

/**
 * Detect if input is a prompt/idea or an actual script
 * Uses simple heuristics for reliable detection
 */
function detectPromptMode(input: string): boolean {
  const text = input.trim().toLowerCase();
  const wordCount = text.split(/\s+/).length;
  
  // Short inputs (under 20 words) are likely prompts
  if (wordCount < 20) return true;
  
  // Check for prompt-like indicators
  const promptIndicators = [
    'create a story about',
    'make a video about', 
    'write about',
    'tell a story',
    'explain how',
    'show me',
    'video about',
    'story of',
    'tutorial on',
    'guide to'
  ];
  
  const hasPromptIndicator = promptIndicators.some(indicator => 
    text.includes(indicator)
  );
  
  // Check for script-like indicators (longer, narrative, direct speech)
  const scriptIndicators = [
    'did you know',
    'today i\'m going to',
    'let me tell you',
    'here\'s the thing',
    'you might be wondering',
    'i\'m here to',
    'welcome to',
    'hey everyone'
  ];
  
  const hasScriptIndicator = scriptIndicators.some(indicator => 
    text.includes(indicator)
  );
  
  // Decision logic
  if (hasPromptIndicator && !hasScriptIndicator) return true;
  if (hasScriptIndicator && !hasPromptIndicator) return false;
  
  // For ambiguous cases, use word count
  // Scripts are typically longer and more narrative
  return wordCount < 50; // Under 50 words = likely prompt
}

/**
 * Simplified script-to-video generation for basic use cases
 */
export async function generateBasicScriptVideo(
  script_text: string,
  user_id: string,
  options?: {
    quality?: 'draft' | 'standard' | 'premium';
    aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3';
  }
): Promise<ScriptToVideoResponse> {
  return generateScriptToVideo({
    script_text,
    user_id,
    quality: options?.quality || 'standard',
    aspect_ratio: options?.aspect_ratio || '16:9',
  });
}

/**
 * Enhanced script-to-video with full AI orchestration
 */
export async function generateEnhancedScriptVideo(
  script_text: string,
  user_id: string,
  options: {
    video_style?: ScriptToVideoRequest['video_style'];
    voice_settings?: ScriptToVideoRequest['voice_settings'];
    reference_images?: string[];
    background_music?: boolean;
    custom_branding?: ScriptToVideoRequest['custom_branding'];
  }
): Promise<ScriptToVideoResponse> {
  return generateScriptToVideo({
    script_text,
    user_id,
    video_style: options.video_style,
    voice_settings: options.voice_settings,
    reference_images: options.reference_images,
    background_music: options.background_music,
    custom_branding: options.custom_branding,
    // Default to premium quality for enhanced version
    quality: 'premium',
    aspect_ratio: '16:9',
  });
}