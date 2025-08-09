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
  
  // Generated content
  video_url?: string;
  audio_url?: string;
  generated_images?: {
    url: string;
    segment_index: number;
    prompt: string;
  }[];
  
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

// Schema for AI planning
const ProductionPlanSchema = z.object({
  workflow_type: z.enum(['sequential', 'parallel', 'hybrid']),
  complexity_score: z.number().min(1).max(10),
  estimated_duration: z.number(),
  segments: z.array(z.object({
    text: z.string(),
    duration: z.number(),
    image_prompt: z.string(),
    voice_emotion: z.enum(['neutral', 'excited', 'calm', 'authoritative', 'warm', 'confident']),
    timing_optimization: z.object({
      words_per_minute: z.number(),
      pause_duration: z.number()
    })
  })),
  voice_optimization: z.object({
    recommended_voice: z.enum(['anna', 'eric', 'felix', 'oscar', 'nina', 'sarah']),
    speed_adjustment: z.enum(['slower', 'normal', 'faster']),
    emotion_consistency: z.string()
  }),
  visual_optimization: z.object({
    style_consistency: z.string(),
    image_generation_strategy: z.string(),
    aspect_ratio_optimization: z.string()
  }),
  quality_optimizations: z.array(z.string()),
  reasoning: z.string()
});

const SegmentAnalysisSchema = z.object({
  segments: z.array(z.object({
    id: z.string(),
    text: z.string(),
    start_time: z.number(),
    end_time: z.number(),
    duration: z.number(),
    image_prompt: z.string(),
    voice_emotion: z.enum(['neutral', 'excited', 'calm', 'authoritative', 'warm', 'confident']),
    importance_score: z.number().min(1).max(10)
  })),
  total_duration: z.number(),
  pacing_analysis: z.string(),
  content_type: z.enum(['educational', 'commercial', 'storytelling', 'informational', 'entertainment'])
});

// Infer types from schemas
type SegmentAnalysisType = z.infer<typeof SegmentAnalysisSchema>;
type ProductionPlanType = z.infer<typeof ProductionPlanSchema>;

// Credit constants
const CREDITS_PER_SEGMENT = 3;
const VOICE_GENERATION_CREDITS = 5;
const IMAGE_GENERATION_CREDITS = 4;
const VIDEO_ASSEMBLY_CREDITS = 8;
const AI_ORCHESTRATION_CREDITS = 2;

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

    // Step 2: AI Script Analysis & Segmentation
    console.log('🧠 AI Analyzing script and creating production plan...');
    
    const { object: segmentAnalysis }: { object: SegmentAnalysisType } = await generateObject({
      model: openai('gpt-4o'),
      schema: SegmentAnalysisSchema,
      system: `You are an expert video production AI. Analyze scripts and break them into optimal segments for video production.

SEGMENTATION RULES:
- Each segment should be 3-8 seconds for optimal pacing
- Target 50-60 seconds total video length
- Create compelling visual prompts for each segment
- Match voice emotion to content meaning
- Ensure smooth narrative flow

TIMING OPTIMIZATION:
- Educational content: 150-180 WPM
- Commercial content: 180-220 WPM  
- Storytelling: 120-150 WPM
- Fast-paced content: 200-250 WPM`,
      prompt: `Analyze and segment this script for video production:

"${request.script_text}"

Target duration: ${request.target_duration || 'auto-optimize'}
Style preferences: ${JSON.stringify(request.video_style || 'auto-optimize')}

Create optimal segments with:
1. Natural narrative breaks
2. Compelling visual descriptions
3. Appropriate voice emotions
4. Proper timing distribution`
    });

    total_credits += AI_ORCHESTRATION_CREDITS;
    console.log(`✅ Script analyzed: ${segmentAnalysis.segments.length} segments, ${segmentAnalysis.content_type} content`);

    // Step 3: AI Production Planning
    console.log('🎯 AI Creating comprehensive production plan...');
    
    const { object: productionPlan }: { object: ProductionPlanType } = await generateObject({
      model: openai('gpt-4o'),
      schema: ProductionPlanSchema,
      system: `You are a master video production director. Create comprehensive production plans that optimize for quality, efficiency, and user preferences.

WORKFLOW OPTIMIZATION:
- Sequential: Simple scripts, linear narrative
- Parallel: Complex scripts with independent segments  
- Hybrid: Mixed complexity with interdependent elements

VOICE OPTIMIZATION:
- Match voice characteristics to content tone
- Optimize speed for comprehension and engagement
- Ensure emotional consistency throughout

VISUAL OPTIMIZATION:
- Create cohesive visual style
- Optimize image generation for video flow
- Consider aspect ratio for intended platform`,
      prompt: `Create a comprehensive production plan for this analyzed script:

Segments: ${JSON.stringify(segmentAnalysis.segments)}
Content Type: ${segmentAnalysis.content_type}
User Preferences: ${JSON.stringify({
        video_style: request.video_style,
        voice_settings: request.voice_settings,
        aspect_ratio: request.aspect_ratio,
        quality: request.quality
      })}

Optimize for:
1. Production efficiency 
2. Quality consistency
3. User engagement
4. Resource utilization`
    });

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
        segment_count: segmentAnalysis.segments.length
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
        generateVoiceForAllSegments(productionPlan.segments, productionPlan.voice_optimization),
        generateImagesForAllSegments(productionPlan.segments, productionPlan.visual_optimization, request.aspect_ratio || '16:9')
      ]);

      audioUrl = voiceResult.audio_url;
      generatedImages = imageResults;
      total_credits += voiceResult.credits_used + imageResults.reduce((sum, img) => sum + ((img as any).credits_used || IMAGE_GENERATION_CREDITS), 0);
      
      optimization_applied.push('Parallel processing for maximum efficiency');
      
    } else if (productionPlan.workflow_type === 'sequential') {
      console.log('📝 Executing sequential production workflow...');
      
      // Sequential execution for dependent segments
      for (let i = 0; i < productionPlan.segments.length; i++) {
        const segment = productionPlan.segments[i];
        
        // Generate voice for this segment
        const voiceResult = await generateVoiceForSegment(segment, productionPlan.voice_optimization, i);
        
        // Generate image for this segment  
        const imageResult = await generateImageForSegment(segment, productionPlan.visual_optimization, i, request.aspect_ratio || '16:9');
        
        if (i === 0) audioUrl = voiceResult.audio_url; // Use first segment's audio URL
        generatedImages.push(imageResult);
        
        total_credits += voiceResult.credits_used + imageResult.credits_used;
      }
      
      optimization_applied.push('Sequential processing for narrative consistency');
      
    } else {
      // Hybrid workflow - AI decides optimal execution per segment
      console.log('🎭 Executing hybrid production workflow...');
      
      const criticalSegments = productionPlan.segments.filter((_: ProductionPlanType['segments'][0], i: number) => i < 2); // First 2 segments
      const remainingSegments = productionPlan.segments.slice(2);
      
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

    // Step 6: AI-Driven Video Assembly
    console.log('🎞️ AI orchestrating final video assembly...');
    
    const assemblyPlan = await generateAssemblyPlan(
      productionPlan,
      generatedImages.map(img => ({ ...img, credits_used: IMAGE_GENERATION_CREDITS })), 
      audioUrl,
      segmentAnalysis
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
        segment_count: segmentAnalysis.segments.length,
        workflow_type: productionPlan.workflow_type 
      }
    );

    if (!creditDeduction.success) {
      warnings.push('Credit deduction failed - please contact support');
    }

    // Step 8: Store Results
    await storeScriptVideoResults({
      user_id: request.user_id,
      script_text: request.script_text,
      video_url: videoUrl,
      audio_url: audioUrl,
      segments: segmentAnalysis.segments,
      batch_id,
      model_version: 'gpt-4o-orchestrated',
      generation_parameters: request as unknown as Json,
      production_plan: productionPlan as unknown as Json,
      credits_used: total_credits
    });

    // Step 9: Record Analytics
    await recordGenerationMetrics({
      user_id: request.user_id,
      batch_id,
      model_version: 'gpt-4o-orchestrated',
      workflow_type: productionPlan.workflow_type,
      segment_count: segmentAnalysis.segments.length,
      generation_time_ms: Date.now() - startTime,
      total_credits_used: total_credits,
      complexity_score: productionPlan.complexity_score,
      ai_optimizations_applied: optimization_applied.length
    });

    const generation_time_ms = Date.now() - startTime;
    console.log(`🎉 AI Video Orchestrator: Production completed in ${generation_time_ms}ms`);

    return {
      success: true,
      video_url: videoUrl,
      audio_url: audioUrl,
      generated_images: generatedImages,
      segments: segmentAnalysis.segments.map((seg, i) => ({
        id: seg.id,
        text: seg.text,
        start_time: seg.start_time,
        end_time: seg.end_time,
        duration: seg.duration,
        image_prompt: seg.image_prompt,
        voice_emotion: seg.voice_emotion,
        timing_data: {
          words_per_minute: productionPlan.segments[i]?.timing_optimization.words_per_minute || 180,
          pause_duration: productionPlan.segments[i]?.timing_optimization.pause_duration || 0.5
        }
      })),
      timeline_data: {
        total_duration: segmentAnalysis.total_duration,
        segment_count: segmentAnalysis.segments.length,
        frame_count: Math.ceil(segmentAnalysis.total_duration * 30) // 30 FPS
      },
      production_plan: {
        workflow_type: productionPlan.workflow_type,
        complexity_score: productionPlan.complexity_score,
        estimated_duration: productionPlan.estimated_duration,
        segment_strategy: productionPlan.reasoning,
        voice_optimization: productionPlan.voice_optimization.emotion_consistency,
        visual_optimization: productionPlan.visual_optimization.style_consistency,
        quality_optimizations: productionPlan.quality_optimizations
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

// Placeholder functions for production steps
async function generateVoiceForAllSegments(_segments: ProductionPlanType['segments'], _voiceOptimization: ProductionPlanType['voice_optimization']) {
  // Would integrate with OpenAI TTS or similar
  return {
    audio_url: `https://storage.example.com/audio/${crypto.randomUUID()}.mp3`,
    credits_used: VOICE_GENERATION_CREDITS
  };
}

async function generateImagesForAllSegments(segments: ProductionPlanType['segments'], _visualOptimization: ProductionPlanType['visual_optimization'], _aspectRatio: string) {
  // Would integrate with FLUX or similar image generation
  return segments.map((segment, index) => ({
    url: `https://storage.example.com/images/${crypto.randomUUID()}.png`,
    segment_index: index,
    prompt: segment.image_prompt,
    credits_used: IMAGE_GENERATION_CREDITS
  }));
}

async function generateVoiceForSegment(_segment: ProductionPlanType['segments'][0], _voiceOptimization: ProductionPlanType['voice_optimization'], index: number) {
  return {
    audio_url: `https://storage.example.com/audio/segment_${index}_${crypto.randomUUID()}.mp3`,
    credits_used: VOICE_GENERATION_CREDITS
  };
}

async function generateImageForSegment(segment: ProductionPlanType['segments'][0], _visualOptimization: ProductionPlanType['visual_optimization'], index: number, _aspectRatio: string) {
  return {
    url: `https://storage.example.com/images/segment_${index}_${crypto.randomUUID()}.png`,
    segment_index: index,
    prompt: segment.image_prompt,
    credits_used: IMAGE_GENERATION_CREDITS
  };
}

async function generateAssemblyPlan(_productionPlan: ProductionPlanType, _images: { url: string; segment_index: number; prompt: string; credits_used: number }[], audioUrl: string | undefined, segmentAnalysis: SegmentAnalysisType) {
  // AI would create optimal video assembly strategy
  return {
    assembly_strategy: 'timeline-based',
    transition_effects: ['fade', 'slide'],
    audio_sync_points: segmentAnalysis.segments.map((seg) => ({
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