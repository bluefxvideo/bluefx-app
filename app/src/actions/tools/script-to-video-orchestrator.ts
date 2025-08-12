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
  script_text: string;
  user_id: string;
  aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3';
  quality?: 'draft' | 'standard' | 'premium';
  voice_settings?: {
    voice_id?: string;
    speed?: 'slower' | 'normal' | 'faster';
    emotion?: 'neutral' | 'excited' | 'calm' | 'confident' | 'authoritative';
  };
  was_script_generated?: boolean; // Whether script was generated from an idea
  original_idea?: string; // The original idea if script was generated
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
}

interface ProductionPlan {
  workflow_type: 'parallel';
  complexity_score: number;
  estimated_duration: number;
}

// Credit calculation
const BASE_CREDITS = 10;
const CREDITS_PER_SEGMENT = 5;

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
  
  // Generation state
  let storyContext: any = null;
  let whisperResult: any = null;
  let segmentAnalysis = { total_duration: 0, segment_count: 0 };

  try {
    console.log(`🎬 AI Video Orchestrator: Starting intelligent production for user ${request.user_id}`);

    // Step 1: Credit Validation
    const creditCheck = await getUserCredits(request.user_id);
    if (!creditCheck.success) {
      throw new Error('Unable to verify credit balance');
    }

    const estimatedCredits = BASE_CREDITS + (Math.ceil(request.script_text.length / 100) * CREDITS_PER_SEGMENT);
    if ((creditCheck.credits || 0) < estimatedCredits) {
      throw new Error(`Insufficient credits. Need ${estimatedCredits}, have ${creditCheck.credits || 0}`);
    }

    console.log(`💳 Credits validated: ${creditCheck.credits} available, ${estimatedCredits} estimated`);

    // Step 2: Generate segments from script
    const finalScript = request.script_text;
    console.log(`📝 Processing script (${finalScript.length} characters)`);
    
    const targetDuration = calculateOptimalDuration(request.script_text);
    segmentAnalysis = { total_duration: targetDuration, segment_count: 0 };
    
    total_credits += 2; // Basic analysis
    console.log(`✅ Analysis complete - target duration: ${targetDuration}s`);

    // Create intelligent segments using story beat analysis
    const result = await createStoryBasedSegments(finalScript, segmentAnalysis);
    const mockSegments = result.segments;
    storyContext = result.storyContext;
    
    // Update analysis with AI's decisions
    segmentAnalysis.segment_count = storyContext.ai_determined_count || mockSegments.length;
    segmentAnalysis.total_duration = mockSegments.length > 0 
      ? mockSegments[mockSegments.length - 1].end_time 
      : 30;

    // Step 3: Create production plan
    console.log('🎯 Creating production plan...');
    
    const productionPlan = {
      workflow_type: 'parallel' as const,
      complexity_score: Math.min(10, Math.ceil(finalScript.length / 200)),
      estimated_duration: targetDuration
    };
    
    total_credits += 2; // Planning
    console.log(`🎬 Production plan: ${productionPlan.workflow_type} workflow, complexity ${productionPlan.complexity_score}/10`);

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

    // Step 5: Execute Production
    let generatedImages: { url: string; segment_index: number; prompt: string; }[] = [];
    let audioUrl: string | undefined = undefined;

    console.log('🔄 Executing parallel production workflow...');
    
    // Parallel execution
    const [voiceResult, imageResults] = await Promise.all([
      generateVoiceForAllSegments(mockSegments, request.user_id, batch_id, request.voice_settings),
      generateImagesForAllSegments(mockSegments, request.aspect_ratio || '16:9', request.user_id, batch_id)
    ]);

    audioUrl = voiceResult.audio_url;
    generatedImages = imageResults;
    total_credits += voiceResult.credits_used + (imageResults.length * 4); // 4 credits per image
    
    optimization_applied.push('Parallel processing for efficiency');

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
        
        // Use standard content type
        const contentType = 'standard';
        
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

    // Step 7: Video Assembly
    console.log('🎞️ Assembling video...');
    
    const videoUrl = await executeVideoAssembly(generatedImages, audioUrl);
    total_credits += 8; // Assembly credits

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

    // Step 8: Store Results
    const storeResult = await storeScriptVideoResults({
      user_id: request.user_id,
      script_text: finalScript,
      video_url: videoUrl,
      audio_url: audioUrl,
      generated_images: generatedImages,
      segments: mockSegments,
      batch_id,
      model_version: 'gpt-4o-orchestrated',
      generation_parameters: request as unknown as Json,
      production_plan: productionPlan as unknown as Json,
      credits_used: total_credits,
      word_timings: wordTimings,
      caption_chunks: captionChunks
    });

    // Step 9: Record Analytics
    await recordGenerationMetrics({
      user_id: request.user_id,
      batch_id,
      model_version: 'gpt-4o-orchestrated',
      workflow_type: 'parallel',
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
      was_script_generated: request.was_script_generated || false,
      segments: mockSegments.map((seg) => ({
        id: seg.id,
        text: seg.text,
        start_time: seg.start_time,
        end_time: seg.end_time,
        duration: seg.duration,
        image_prompt: seg.image_prompt
      })),
      timeline_data: {
        total_duration: segmentAnalysis.total_duration,
        segment_count: segmentAnalysis.segment_count,
        frame_count: Math.ceil(segmentAnalysis.total_duration * 30) // 30 FPS
      },
      production_plan: productionPlan,
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


// Real voice generation using OpenAI TTS
async function generateVoiceForAllSegments(
  segments: any[],
  user_id: string,
  batch_id: string,
  voice_settings?: {
    voice_id?: string;
    speed?: 'slower' | 'normal' | 'faster';
    emotion?: 'neutral' | 'excited' | 'calm' | 'confident' | 'authoritative';
  }
) {
  // Import the voice service
  const { generateVoiceForAllSegments: generateVoice } = await import('../services/voice-generation-service');
  
  // Map voice IDs from UI selections to OpenAI voices
  const voiceMapping: Record<string, string> = {
    'alloy': 'alloy',
    'nova': 'nova',
    'echo': 'echo',
    'onyx': 'onyx',
    'anna': 'alloy',   // Legacy mapping
    'eric': 'echo',    // Legacy mapping
    'felix': 'onyx',   // Legacy mapping
    'nina': 'nova'     // Legacy mapping
  };
  
  const selectedVoice = voice_settings?.voice_id || 'alloy';
  const mappedVoice = voiceMapping[selectedVoice] || 'alloy';
  
  console.log(`🎤 Using voice: ${selectedVoice} (mapped to: ${mappedVoice})`);
  
  // Prepare request
  const voiceRequest = {
    segments: segments.map(s => ({
      id: crypto.randomUUID(),
      text: s.text,
      start_time: 0,
      end_time: s.duration,
      duration: s.duration
    })),
    voice_settings: {
      voice_id: mappedVoice as any,
      speed: voice_settings?.speed || 'normal' as any,
      emotion: voice_settings?.emotion || 'neutral' as any
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

async function generateImagesForAllSegments(segments: any[], aspectRatio: string, user_id: string, batch_id: string) {
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
      visual_style: 'realistic' as const,
      aspect_ratio: aspectRatio as '16:9' | '9:16' | '1:1' | '4:3',
      quality: 'standard' as const
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


async function executeVideoAssembly(_images: any[], _audioUrl: string | undefined): Promise<string> {
  // Would integrate with Remotion for actual video generation
  return `https://storage.example.com/videos/${crypto.randomUUID()}.mp4`;
}

async function createStoryBasedSegments(script: string, _segmentAnalysis: { segment_count: number }): Promise<{ segments: any[], storyContext: any }> {
  try {
    console.log('🎬 Creating storyboard segments with visual consistency...');
    
    const { object: storyboard } = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({
        main_characters: z.string().describe('Description of main characters or subjects that appear throughout'),
        visual_style: z.string().describe('Consistent visual style and mood'),
        setting: z.string().describe('Primary setting or environment'),
        segments: z.array(z.object({
          text_content: z.string(),
          image_prompt: z.string().describe('Include character/setting consistency details')
        }))
      }),
      prompt: `Analyze this script and create 4-6 visual segments with CONSISTENT characters and settings: "${script}"

CRITICAL: Maintain visual consistency across all segments!
1. First identify the main character(s), setting, and visual style
2. Use THE SAME character descriptions in EVERY segment
3. Keep the setting/environment consistent or show logical progression
4. Include character details (appearance, clothing, colors) in EVERY prompt
5. Show story progression while maintaining character/setting consistency

For example, if the story is about "a pink flying pig named Percy", EVERY image prompt must include "Percy the pink flying pig with wings" to maintain consistency.

Split the script into natural segments with consistent visuals.`
    });

    console.log('✅ Storyboard created:', storyboard.segments.length, 'segments');
    console.log('🎨 Visual consistency:', {
      characters: storyboard.main_characters,
      style: storyboard.visual_style,
      setting: storyboard.setting
    });
    
    // Create segments with timing and enhanced prompts
    let cumulativeTime = 0;
    const storySegments = storyboard.segments.map((scene, index) => {
      const duration = Math.max(3, Math.min(8, calculateSpeechDuration(scene.text_content)));
      const startTime = cumulativeTime;
      cumulativeTime += duration;
      
      // Enhance prompt with consistency details
      const enhancedPrompt = `${scene.image_prompt}. Style: ${storyboard.visual_style}`;
      
      return {
        id: `segment-${index + 1}`,
        text: scene.text_content,
        start_time: startTime,
        end_time: startTime + duration,
        duration: duration,
        image_prompt: enhancedPrompt
      };
    });

    const storyContext = {
      total_scenes: storyboard.segments.length,
      ai_determined_count: storyboard.segments.length,
      main_characters: storyboard.main_characters,
      visual_style: storyboard.visual_style,
      setting: storyboard.setting
    };

    return { segments: storySegments, storyContext };

  } catch (error) {
    console.error('🚨 Storyboard generation failed:', error);
    throw new Error('Storyboard generation failed - please try again');
  }
}

function calculateSpeechDuration(text: string): number {
  const wordCount = text.split(/\s+/).length;
  const baseDuration = wordCount / 3; // ~180 words per minute
  return Math.max(3, Math.min(8, baseDuration + 0.5));
}

function calculateOptimalDuration(script: string): number {
  const wordCount = script.trim().split(/\s+/).length;
  const baseDuration = (wordCount / 180) * 60;
  
  if (baseDuration < 30) return 30;
  if (baseDuration > 90) return 90;
  
  return Math.round(baseDuration / 15) * 15;
}

export async function generateBasicScriptVideo(
  script_text: string,
  user_id: string,
  options?: {
    quality?: 'draft' | 'standard' | 'premium';
    aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3';
    voice_settings?: {
      voice_id?: string;
      speed?: 'slower' | 'normal' | 'faster';
      emotion?: 'neutral' | 'excited' | 'calm' | 'confident' | 'authoritative';
    };
    was_script_generated?: boolean;
    original_idea?: string;
  }
): Promise<ScriptToVideoResponse> {
  return generateScriptToVideo({
    script_text,
    user_id,
    quality: options?.quality || 'standard',
    aspect_ratio: options?.aspect_ratio || '16:9',
    voice_settings: options?.voice_settings,
    was_script_generated: options?.was_script_generated,
    original_idea: options?.original_idea
  });
}