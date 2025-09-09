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
  let segmentAnalysis = { total_duration: 0, segment_count: 0 };
  let imageMetadata: any = null;

  try {
    console.log(`🎬 AI Video Orchestrator: Starting intelligent production for user ${request.user_id}`);

    // Validate script_text is a string
    if (!request.script_text || typeof request.script_text !== 'string') {
      throw new Error('Invalid script_text: must be a non-empty string');
    }

    const scriptText = request.script_text.trim();
    if (scriptText.length === 0) {
      throw new Error('Script text cannot be empty');
    }

    // Step 1: Credit Validation
    const creditCheck = await getUserCredits(request.user_id);
    if (!creditCheck.success) {
      throw new Error('Unable to verify credit balance');
    }

    const estimatedCredits = BASE_CREDITS + (Math.ceil(scriptText.length / 100) * CREDITS_PER_SEGMENT);
    if ((creditCheck.credits || 0) < estimatedCredits) {
      throw new Error(`Insufficient credits. Need ${estimatedCredits}, have ${creditCheck.credits || 0}`);
    }

    console.log(`💳 Credits validated: ${creditCheck.credits} available, ${estimatedCredits} estimated`);

    // Step 2: Generate audio FIRST to get exact duration
    const finalScript = scriptText;
    console.log(`📝 Processing script (${finalScript.length} characters)`);
    
    // Generate voice first to get actual duration
    console.log('🎤 Generating voice first to determine exact duration...');
    let audioUrl: string | undefined = undefined;
    let actualAudioDuration = 30; // Default fallback
    
    try {
      // Create a temporary single segment for voice generation
      const tempSegment = {
        id: 'temp-full',
        text: finalScript,
        start_time: 0,
        end_time: 30, // Temporary estimate
        duration: 30,
        image_prompt: ''
      };
      
      const voiceResult = await generateVoiceForAllSegments([tempSegment], request.user_id, batch_id, request.voice_settings);
      audioUrl = voiceResult.audio_url;
      actualAudioDuration = voiceResult.metadata?.actual_duration || 30;
      total_credits += voiceResult.credits_used;
      
      console.log(`✅ Voice generated - Actual duration: ${actualAudioDuration}s`);
    } catch (error) {
      console.error('❌ Initial voice generation failed:', error);
      throw new Error(`Voice generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Step 3: Calculate optimal segment count based on ACTUAL audio duration
    const segmentDuration = 5; // Default 5 seconds per segment
    const minSegmentDuration = 3;
    const maxSegmentDuration = 5;
    
    // Calculate ideal number of segments
    let segmentCount = Math.ceil(actualAudioDuration / segmentDuration);
    
    // Adjust segment duration if needed to stay within 3-5 second range
    let adjustedSegmentDuration = actualAudioDuration / segmentCount;
    
    // If segments would be too short, reduce count
    while (adjustedSegmentDuration < minSegmentDuration && segmentCount > 1) {
      segmentCount--;
      adjustedSegmentDuration = actualAudioDuration / segmentCount;
    }
    
    // If segments would be too long, increase count
    while (adjustedSegmentDuration > maxSegmentDuration) {
      segmentCount++;
      adjustedSegmentDuration = actualAudioDuration / segmentCount;
    }
    
    console.log(`📊 Segment calculation: ${actualAudioDuration}s audio → ${segmentCount} segments @ ~${adjustedSegmentDuration.toFixed(1)}s each`);
    
    segmentAnalysis = { 
      total_duration: actualAudioDuration, 
      segment_count: segmentCount 
    };
    
    // Step 4: Create segments with proper count
    const result = await createStoryBasedSegments(finalScript, segmentAnalysis, request.original_idea, segmentCount);
    const mockSegments = result.segments;
    storyContext = result.storyContext;
    
    // Adjust segment timings to match actual audio duration exactly
    const segmentLength = actualAudioDuration / mockSegments.length;
    mockSegments.forEach((segment, idx) => {
      segment.start_time = idx * segmentLength;
      segment.end_time = (idx + 1) * segmentLength;
      segment.duration = segmentLength;
      console.log(`📐 Segment ${idx + 1}: ${segment.start_time.toFixed(2)}s-${segment.end_time.toFixed(2)}s (${segment.duration.toFixed(2)}s)`);
    });

    // Step 3: Create production plan
    console.log('🎯 Creating production plan...');
    
    const productionPlan = {
      workflow_type: 'parallel' as const,
      complexity_score: Math.min(10, Math.ceil(finalScript.length / 200)),
      estimated_duration: actualAudioDuration
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

    // Step 5: Generate Images based on calculated segments
    // Voice was already generated above to get timing
    let generatedImages: { url: string; segment_index: number; prompt: string; }[] = [];
    
    // Store voice metadata for structured storage
    let voiceMetadata: any = {
      synthesis_params: {
        voice_id: request.voice_settings?.voice_id || 'anna',
        speed: request.voice_settings?.speed || 'normal',
        emotion: request.voice_settings?.emotion || 'neutral',
        model: 'openai-tts-1'
      },
      actual_duration: actualAudioDuration,
      generation_timestamp: new Date().toISOString(),
      credits_used: 2 // Voice generation credits
    };
    
    // Step 6: Generate Images using the properly timed segments
    
    try {
      const imageResults = await generateImagesForAllSegments(mockSegments, request.aspect_ratio || '16:9', request.user_id, batch_id);
      generatedImages = imageResults;
      total_credits += (imageResults.length * 4); // 4 credits per image
      console.log('✅ Images generated with estimated timing:', { 
        count: imageResults.length,
        first_url: imageResults[0]?.url ? 'Generated' : 'NULL'
      });
      optimization_applied.push('Images generated with estimated timing');
      
      // Store image metadata for structured storage
      imageMetadata = {
        generation_params: {
          aspect_ratio: request.aspect_ratio || '16:9',
          visual_style: 'realistic',
          quality: 'standard',
          model: 'flux-kontext-pro'
        },
        consistency_settings: {
          characters: storyContext?.main_characters || [],
          visual_style: storyContext?.visual_style || 'realistic',
          setting: storyContext?.setting || 'general'
        },
        seed_values: imageResults.map((img, idx) => ({
          segment_index: idx,
          prompt: img.prompt,
          url: img.url
        })),
        generation_timestamp: new Date().toISOString(),
        total_images: imageResults.length,
        credits_used: imageResults.length * 4
      };
    } catch (error) {
      console.error('❌ Image generation failed completely:', error);
      // Allow continuation with a warning instead of throwing
      warnings.push(`Image generation failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Set empty result to continue with other processing
      imagesResult = {
        success: false,
        generated_images: [],
        credits_used: 0,
            total_generation_time_ms: 0,
            error: error instanceof Error ? error.message : String(error)
          };
    }

    // Note: Video assembly happens in the React Video Editor with Remotion
    // No video URL at this stage - just assets and composition data

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

    // Step 8: Build Remotion-Native Composition (PRIMARY DATA)
    const totalFrames = Math.ceil(segmentAnalysis.total_duration * 30);
    
    const remotionComposition = {
      // Remotion Composition Config
      composition: {
        id: `video-${batch_id}`,
        durationInFrames: totalFrames,
        fps: 30,
        width: 1920,
        height: 1080
      },
      
      // Remotion Sequences (Frame-Perfect)
      sequences: [
        // Audio sequence (full track)
        {
          id: `audio-${batch_id}`,
          from: 0,
          durationInFrames: totalFrames,
          type: 'audio',
          layer: 0,
          props: {
            audioSrc: audioUrl || '',
            volume: 1.0
          }
        },
        
        // Image sequences
        ...mockSegments.map((seg, idx) => ({
          id: `image-${seg.id}`,
          from: Math.floor(seg.start_time * 30),
          durationInFrames: Math.floor(seg.duration * 30),
          type: 'image',
          layer: 1,
          props: {
            imageSrc: generatedImages[idx]?.url || '',
            imagePrompt: seg.image_prompt,
            scaleMode: 'cover',
            opacity: 1.0
          }
        })),
        
        // Text sequences (captions)
        ...mockSegments.map((seg, idx) => ({
          id: `text-${seg.id}`,
          from: Math.floor(seg.start_time * 30),
          durationInFrames: Math.floor(seg.duration * 30),
          type: 'text',
          layer: 2,
          props: {
            text: seg.text,
            fontSize: 48,
            fontFamily: 'Inter',
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#FFFFFF',
            strokeColor: '#000000',
            strokeWidth: 2,
            position: {
              x: 960,  // center horizontally
              y: 850   // bottom third
            }
          }
        }))
      ],
      
      // Assets Bundle
      assets: {
        audioUrl: audioUrl || '',
        imageUrls: generatedImages.map(img => img.url),
        voiceSegments: [], // Individual segments if needed
        customAssets: []   // User uploads
      },
      
      // Rendering Settings
      rendering: {
        codec: 'h264',
        crf: 23,
        pixelFormat: 'yuv420p',
        proRes: false,
        concurrency: 4
      }
    };
    
    // Generation Metadata (for regeneration)
    const generationMetadata = {
      // AI Orchestration
      orchestration: {
        batch_id,
        model_versions: {
          script: 'gpt-4o',
          voice: 'openai-tts-1',
          images: 'flux-kontext-pro',
          orchestrator: 'gpt-4o-orchestrated'
        },
        production_plan: {
          workflow_type: productionPlan.workflow_type,
          complexity_score: productionPlan.complexity_score,
          ai_optimizations_applied: optimization_applied
        }
      },
      
      // Script Generation
      script: {
        original_idea: request.original_idea || null,
        final_text: finalScript,
        was_generated: request.was_script_generated || false,
        word_count: finalScript.trim().split(/\s+/).length
      },
      
      // Voice Settings
      voice_synthesis: {
        voice_id: request.voice_settings?.voice_id || 'anna',
        speed: request.voice_settings?.speed || 'normal',
        emotion: request.voice_settings?.emotion || 'neutral',
        model: 'openai-tts-1',
        credits_used: voiceMetadata.credits_used
      },
      
      // Image Settings
      image_generation: {
        aspect_ratio: request.aspect_ratio || '16:9',
        visual_style: storyContext?.visual_style || 'realistic',
        quality: request.quality || 'standard',
        model: 'flux-kontext-pro',
        story_context: {
          characters: storyContext?.main_characters || [],
          setting: storyContext?.setting || '',
          mood: 'professional'
        },
        credits_used: imageMetadata?.credits_used || 0
      },
      
      // Whisper Analysis (removed - now done on-demand in editor)
      whisper_analysis: {
        speaking_rate: 0,
        confidence_avg: 0,
        word_count: 0,
        word_timings: []
      },
      
      // Credits & Performance
      credits_breakdown: {
        script_generation: request.was_script_generated ? 3 : 0,
        voice_generation: voiceMetadata.credits_used,
        image_generation: imageMetadata?.credits_used || 0,
        whisper_analysis: 0, // Removed - now done on-demand in editor
        caption_processing: 0, // Removed - now done on-demand in editor
        video_assembly: 8,
        total: total_credits
      },
      generation_time_ms: Date.now() - startTime
    };

    // Step 9: Store Results with Remotion-Native Primary Data
    const storeResult = await storeScriptVideoResults({
      user_id: request.user_id,
      script_text: finalScript,
      video_url: null, // Video rendered later in editor
      audio_url: audioUrl,
      generated_images: generatedImages,
      segments: mockSegments,
      batch_id,
      model_version: 'gpt-4o-orchestrated',
      generation_parameters: request as unknown as Json,
      production_plan: productionPlan as unknown as Json,
      credits_used: total_credits,
      word_timings: [],
      
      // PRIMARY: Remotion-Native Composition
      remotion_composition: remotionComposition,
      
      // SECONDARY: Generation Metadata (for regeneration)
      generation_metadata: generationMetadata,
      
      // TERTIARY: Editor Overlays (initially null)
      editor_overlays: null,
      
      // Legacy structured metadata (keep for compatibility)
      storyboard_data: storyContext ? {
        narrative_analysis: {
          total_scenes: storyContext.total_scenes,
          ai_determined_count: storyContext.ai_determined_count,
          original_idea: storyContext.original_idea
        },
        characters: storyContext.main_characters || [],
        scene_orchestration: mockSegments.map(seg => ({
          id: seg.id,
          text: seg.text,
          image_prompt: seg.image_prompt,
          enhanced_prompt: seg.image_prompt
        })),
        original_context: {
          visual_style: storyContext.visual_style,
          setting: storyContext.setting,
          characters: storyContext.main_characters || []
        }
      } : null,
      whisper_data: null, // Whisper analysis now done on-demand in editor
      voice_data: voiceMetadata,
      image_data: imageMetadata,
      caption_settings: null
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
      video_id: storeResult?.video_id,
      
      // PRIMARY: Remotion-Native Composition (ready for rendering)
      remotion_composition: remotionComposition,
      
      // SECONDARY: Generation metadata (for regeneration)
      generation_metadata: generationMetadata,
      
      // Legacy response format (for backward compatibility)
      video_url: null, // Video rendered later in editor
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
        frame_count: Math.ceil(segmentAnalysis.total_duration * 30)
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
  
  // Use the voice ID as-is - the voice service will handle the mapping
  const selectedVoice = voice_settings?.voice_id || 'anna';
  
  console.log(`🎤 Using voice: ${selectedVoice}`);
  
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
      voice_id: selectedVoice as any, // Pass the voice ID directly
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
    credits_used: result.credits_used,
    metadata: result.metadata // Pass through metadata including actual_duration
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
      aspect_ratio: aspectRatio as '16:9' | '9:16' | '1:1' | '4:3' | '4:5',
      quality: 'standard' as const
    },
    user_id,
    batch_id
  };

  // Generate images using FLUX Kontext Pro
  const result = await generateImages(imageRequest);
  
  if (!result.success) {
    console.error(`❌ Image generation failed: ${result.error}`);
    
    // Log details about failed segments if any
    if (result.failed_segments && result.failed_segments.length > 0) {
      console.log('❌ Failed segments:');
      result.failed_segments.forEach(failed => {
        if (failed.error.includes('sensitive')) {
          console.log(`   🚫 Segment ${failed.segment_id}: Content flagged as sensitive`);
        } else {
          console.log(`   ❌ Segment ${failed.segment_id}: ${failed.error}`);
        }
      });
    }
    
    // Return empty array instead of throwing - let the orchestrator handle it
    return [];
  }

  // Return in expected format
  const images = result.generated_images || [];
  
  // Log partial success if some images failed
  if (result.partial_failure && result.failed_segments) {
    console.log(`⚠️ Partial success: ${images.length} images generated, ${result.failed_segments.length} failed`);
    result.failed_segments.forEach(failed => {
      if (failed.error.includes('sensitive')) {
        console.log(`   🚫 Segment ${failed.segment_id}: Content flagged as sensitive`);
      }
    });
  }
  
  return images.map((img, index) => ({
    url: img.image_url,
    segment_index: index,
    prompt: img.prompt,
    credits_used: images.length > 0 ? result.credits_used / images.length : 0
  }));
}

// Note: Individual segment voice generation removed in favor of batch generation for efficiency
// If needed for editing scenarios, use the voice-generation-service directly


// Video assembly removed - happens in React Video Editor with Remotion

async function createStoryBasedSegments(script: string, _segmentAnalysis: { segment_count: number }, originalIdea?: string, targetSegmentCount?: number): Promise<{ segments: any[], storyContext: any }> {
  try {
    const segmentCount = targetSegmentCount || 6; // Use provided count or default to 6
    console.log(`🎬 Creating ${segmentCount} storyboard segments with visual consistency...`);
    
    const { object: storyboard } = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({
        main_characters: z.array(z.object({
          name: z.string().describe('Character identifier'),
          description: z.string().describe('Detailed visual description with specific colors, features, clothing, style')
        })).describe('Main characters with consistent visual descriptions'),
        visual_style: z.string().describe('Consistent visual style and mood across all segments'),
        setting: z.string().describe('Primary setting or environment'),
        segments: z.array(z.object({
          text_content: z.string().describe('CLEAN NARRATIVE TEXT ONLY - No segment labels, numbers, or descriptions. Just the pure spoken content that will be read aloud by the narrator.'),
          image_prompt: z.string().describe('Scene description that references character descriptions when characters appear')
        }))
      }),
      prompt: `Analyze this script and create a professional visual narrative: "${script}"

${originalIdea ? `CORE CONCEPT: "${originalIdea}" - This should be central to the story and main character design.` : ''}

IMPORTANT: Create EXACTLY ${segmentCount} segments. Split the narrative evenly across ${segmentCount} scenes.

STEP 1 - CHARACTER DESIGN:
First, extract and define the main characters with detailed, reusable visual descriptions. Include specific colors, features, clothing, and distinctive characteristics that will remain consistent whenever they appear.

STEP 2 - SEGMENT CREATION:
Create exactly ${segmentCount} natural story segments by dividing the narrative evenly. For each segment, provide:

TEXT_CONTENT: Pure narrative text that will be spoken by a narrator. NO segment labels, numbers, or visual descriptions. Only the actual words to be read aloud.

IMAGE_PROMPT: Separate visual description for generating the scene image. CRITICAL: When characters appear, you MUST reference their exact character descriptions by name to ensure visual consistency across all segments.

EXAMPLES OF GOOD TEXT_CONTENT:
✅ "The Aurora One soars through the clouds, its sleek design cutting through the morning sky."
✅ "Advanced technology meets elegant craftsmanship in this revolutionary aircraft."

EXAMPLES OF BAD TEXT_CONTENT (DO NOT DO THIS):
❌ "Segment 1: Opening shot - The Aurora One soars through clouds"
❌ "Scene description: Advanced technology meets craftsmanship"
❌ "Closing shot, the Aurora One flies into the horizon"

CRITICAL FOR CHARACTER CONSISTENCY:
- Every image prompt featuring a character MUST include their exact visual description
- Use specific details like colors, features, clothing, and distinctive characteristics
- The same character should look identical in every segment they appear in

Focus on natural story progression with clean narrative text that flows naturally when spoken.`
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
      const duration = Math.max(3, Math.min(5, calculateSpeechDuration(scene.text_content)));
      const startTime = cumulativeTime;
      cumulativeTime += duration;
      
      // Enhance prompt with character descriptions and style for consistency
      const characterDescriptions = storyboard.main_characters
        .map(char => `${char.name}: ${char.description}`)
        .join('. ');
      
      const enhancedPrompt = `${scene.image_prompt}. Characters: ${characterDescriptions}. Style: ${storyboard.visual_style}`;
      
      console.log(`Segment ${index + 1} text: "${scene.text_content}"`);
      console.log(`Segment ${index + 1} enhanced prompt: "${enhancedPrompt}"`);
      
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
      setting: storyboard.setting,
      original_idea: originalIdea // Preserve the original idea for consistency
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
  return Math.max(3, Math.min(5, baseDuration + 0.5));
}

function calculateOptimalDuration(script: string): number {
  // Ensure script is a valid string
  if (!script || typeof script !== 'string') {
    console.warn('⚠️ Invalid script provided to calculateOptimalDuration, using default');
    return 30; // Default duration
  }
  
  const trimmedScript = script.trim();
  if (trimmedScript.length === 0) {
    return 30; // Default for empty script
  }
  
  const wordCount = trimmedScript.split(/\s+/).length;
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