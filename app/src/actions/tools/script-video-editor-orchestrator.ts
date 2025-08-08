'use server';

import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * Script-to-Video Editor Orchestrator
 * Handles intelligent editing operations without full regeneration
 */

export interface VideoEditRequest {
  // Project context
  project_id: string;
  user_id: string;
  current_composition: VideoComposition;
  
  // Edit operation
  edit_type: 'add_segment' | 'remove_segment' | 'modify_segment' | 'regenerate_image' | 'adjust_timing' | 'reorder_segments';
  
  // Edit parameters
  edit_data: {
    segment_id?: string;
    new_text?: string;
    new_position?: number;
    image_regeneration_prompt?: string;
    timing_adjustment?: {
      start_time?: number;
      end_time?: number;
      duration?: number;
    };
  };
}

export interface VideoEditResponse {
  success: boolean;
  
  // Updated composition
  updated_composition?: VideoComposition;
  affected_segments?: string[];
  regenerated_assets?: {
    images?: string[];
    audio_segments?: string[];
    captions?: CaptionData[];
  };
  
  // Re-processing details
  whisper_reanalysis_required: boolean;
  timeline_recalculation_required: boolean;
  remotion_template_updated: boolean;
  
  // Standard metadata
  edit_id: string;
  processing_time_ms: number;
  credits_used: number;
  
  error?: string;
  warnings?: string[];
}

interface VideoComposition {
  project_id: string;
  segments: VideoSegment[];
  total_duration: number;
  audio_url: string;
  timeline_data: TimelineData;
  caption_sync: CaptionData[];
  remotion_template: RemotionTemplate;
}

interface VideoSegment {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
  duration: number;
  image_url: string;
  image_prompt: string;
  position_index: number;
}

interface TimelineData {
  total_duration: number;
  segment_boundaries: number[];
  voice_timing: VoiceTiming[];
}

interface VoiceTiming {
  segment_id: string;
  words: WordTiming[];
  pause_duration: number;
}

interface WordTiming {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

interface CaptionData {
  word: string;
  start_time: number;
  end_time: number;
  segment_id: string;
  x_position: number;
  y_position: number;
}

interface RemotionTemplate {
  composition_id: string;
  assets: RemotionAsset[];
  timeline: RemotionTimelineItem[];
  style_config: RemotionStyleConfig;
}

interface RemotionAsset {
  id: string;
  type: 'image' | 'audio' | 'text';
  src: string;
  duration: number;
}

interface RemotionTimelineItem {
  asset_id: string;
  start_frame: number;
  end_frame: number;
  layer: number;
}

interface RemotionStyleConfig {
  caption_style: string;
  transition_effects: string[];
  aspect_ratio: string;
}

// Edit impact analysis schemas
const EditImpactAnalysisSchema = z.object({
  impact_scope: z.enum(['isolated', 'adjacent_segments', 'full_timeline', 'audio_reprocessing']),
  affected_segment_ids: z.array(z.string()),
  requires_whisper_reanalysis: z.boolean(),
  requires_timeline_recalculation: z.boolean(),
  requires_audio_regeneration: z.boolean(),
  estimated_processing_time: z.number(),
  estimated_credits: z.number(),
  optimization_strategy: z.string(),
  reasoning: z.string()
});

const SegmentRecalculationSchema = z.object({
  updated_segments: z.array(z.object({
    id: z.string(),
    new_start_time: z.number(),
    new_end_time: z.number(),
    new_duration: z.number(),
    timing_adjustment_reason: z.string()
  })),
  total_duration_change: z.number(),
  cascade_effects: z.array(z.string()),
  optimization_applied: z.array(z.string())
});

/**
 * Intelligent Video Editor Orchestrator
 * Makes smart decisions about what needs regeneration vs what can be preserved
 */
export async function executeVideoEdit(
  request: VideoEditRequest
): Promise<VideoEditResponse> {
  const startTime = Date.now();
  const edit_id = crypto.randomUUID();
  let total_credits = 0;
  const warnings: string[] = [];

  try {
    console.log(`🎬 Edit Orchestrator: Processing ${request.edit_type} for project ${request.project_id}`);

    // Step 1: AI Impact Analysis - Decide what needs to be regenerated
    const { object: impactAnalysis } = await generateObject({
      model: openai('gpt-4o'),
      schema: EditImpactAnalysisSchema,
      system: `You are an expert video editing AI. Analyze edit operations and determine the minimal scope of regeneration needed.

IMPACT ANALYSIS RULES:
- Isolated: Only affects one segment, no timing changes
- Adjacent: Affects neighboring segments due to timing changes  
- Full Timeline: Major changes requiring complete recalculation
- Audio Reprocessing: Changes that require new voice generation

OPTIMIZATION STRATEGIES:
- Preserve existing assets when possible
- Minimize whisper reanalysis (expensive)
- Use incremental updates for timeline changes
- Batch similar operations for efficiency`,
      
      prompt: `Analyze this edit operation:

Edit Type: ${request.edit_type}
Current Composition: ${JSON.stringify({
        segment_count: request.current_composition.segments.length,
        total_duration: request.current_composition.total_duration,
        segments: request.current_composition.segments.map(s => ({
          id: s.id,
          text: s.text.substring(0, 100),
          duration: s.duration
        }))
      })}
Edit Data: ${JSON.stringify(request.edit_data)}

Determine:
1. What is the minimal scope of regeneration needed?
2. Can we preserve existing audio and just adjust timing?
3. Which segments are actually affected?
4. What's the most efficient processing strategy?`
    });

    console.log(`🧠 Impact Analysis: ${(impactAnalysis as any).impact_scope} scope, affects ${(impactAnalysis as any).affected_segment_ids.length} segments`);
    total_credits += 1; // AI analysis cost

    // Step 2: Execute Edit Based on AI's Impact Analysis
    let updated_composition = { ...request.current_composition };
    const regenerated_assets: any = {};

    switch (request.edit_type) {
      case 'add_segment':
        updated_composition = await handleAddSegment(request, impactAnalysis);
        break;
        
      case 'remove_segment':
        updated_composition = await handleRemoveSegment(request, impactAnalysis);
        break;
        
      case 'modify_segment':
        updated_composition = await handleModifySegment(request, impactAnalysis);
        break;
        
      case 'regenerate_image':
        const imageResult = await handleRegenerateImage(request, impactAnalysis);
        updated_composition = imageResult.composition;
        regenerated_assets.images = imageResult.new_images;
        total_credits += imageResult.credits_used;
        break;
        
      case 'adjust_timing':
        updated_composition = await handleTimingAdjustment(request, impactAnalysis);
        break;
        
      case 'reorder_segments':
        updated_composition = await handleReorderSegments(request, impactAnalysis);
        break;
    }

    // Step 3: Smart Whisper Reanalysis (Only if AI determined it's necessary)
    if ((impactAnalysis as any).requires_whisper_reanalysis) {
      console.log('🎤 AI determined Whisper reanalysis required...');
      
      const whisperResult = await reanalyzeAudioWithWhisper({
        audio_url: updated_composition.audio_url,
        updated_segments: updated_composition.segments,
        previous_timing: request.current_composition.timeline_data
      });
      
      updated_composition.caption_sync = whisperResult.updated_captions;
      total_credits += 3; // Whisper analysis cost
      regenerated_assets.captions = whisperResult.updated_captions;
    } else {
      console.log('✅ AI optimized: Preserving existing caption sync');
      // Preserve existing captions and just adjust timing if needed
      updated_composition.caption_sync = adjustCaptionTiming(
        request.current_composition.caption_sync,
        (impactAnalysis as any).affected_segment_ids
      );
    }

    // Step 4: Timeline Recalculation (AI-optimized)
    if ((impactAnalysis as any).requires_timeline_recalculation) {
      console.log('📐 Recalculating timeline with AI optimization...');
      
      const { object: timelineRecalc } = await generateObject({
        model: openai('gpt-4o'),
        schema: SegmentRecalculationSchema,
        system: 'You are a timeline optimization expert. Recalculate segment timing with minimal disruption.',
        prompt: `Recalculate timeline for these changes:
        
        Impact Analysis: ${JSON.stringify(impactAnalysis)}
        Updated Segments: ${JSON.stringify(updated_composition.segments)}
        
        Optimize for:
        1. Smooth transitions between segments
        2. Natural speech pacing
        3. Caption readability timing
        4. Minimal disruption to unchanged segments`
      });
      
      // Apply AI's timeline optimizations
      updated_composition.timeline_data = applyTimelineRecalculation(
        updated_composition.timeline_data,
        timelineRecalc
      );
      
      total_credits += 1; // Timeline optimization cost
    } else {
      console.log('✅ AI optimized: Preserving existing timeline');
    }

    // Step 5: Update Remotion Template (Smart updates only)
    updated_composition.remotion_template = await updateRemotionTemplate({
      current_template: request.current_composition.remotion_template,
      updated_composition,
      impact_analysis: impactAnalysis,
      regenerated_assets
    });

    // Step 6: Save updated composition
    await saveCompositionUpdate(request.project_id, updated_composition, edit_id);

    const processing_time_ms = Date.now() - startTime;
    console.log(`🎉 Edit Orchestrator: ${request.edit_type} completed in ${processing_time_ms}ms`);

    return {
      success: true,
      updated_composition,
      affected_segments: (impactAnalysis as any).affected_segment_ids,
      regenerated_assets,
      whisper_reanalysis_required: (impactAnalysis as any).requires_whisper_reanalysis,
      timeline_recalculation_required: (impactAnalysis as any).requires_timeline_recalculation,
      remotion_template_updated: true,
      edit_id,
      processing_time_ms,
      credits_used: total_credits,
      warnings: warnings.length > 0 ? warnings : undefined
    };

  } catch (error) {
    console.error('🚨 Edit Orchestrator error:', error);
    
    return {
      success: false,
      whisper_reanalysis_required: false,
      timeline_recalculation_required: false,
      remotion_template_updated: false,
      edit_id,
      processing_time_ms: Date.now() - startTime,
      credits_used: total_credits,
      error: error instanceof Error ? error.message : 'Edit orchestration failed'
    };
  }
}

/**
 * Handle specific edit operations
 */

async function handleAddSegment(
  request: VideoEditRequest, 
  impactAnalysis: any
): Promise<VideoComposition> {
  console.log('➕ Adding new segment with AI optimization...');
  
  const newSegmentText = request.edit_data.new_text!;
  const insertPosition = request.edit_data.new_position || request.current_composition.segments.length;
  
  // AI generates optimal segment properties
  const { object: newSegmentPlan } = await generateObject({
    model: openai('gpt-4o'),
    schema: z.object({
      optimal_duration: z.number(),
      image_prompt: z.string(),
      voice_emotion: z.string(),
      timing_integration: z.object({
        fits_naturally: z.boolean(),
        requires_adjacent_adjustment: z.boolean(),
        suggested_total_duration: z.number()
      })
    }),
    system: 'Create optimal new segment that integrates seamlessly with existing timeline.',
    prompt: `New segment text: "${newSegmentText}"
    Insert position: ${insertPosition}
    Existing segments: ${JSON.stringify(request.current_composition.segments)}
    
    Generate segment that:
    1. Flows naturally with adjacent segments
    2. Has appropriate duration for content
    3. Includes compelling visual concept
    4. Maintains overall video pacing`
  });

  // Generate assets for new segment
  const [newImage, newVoiceSegment] = await Promise.all([
    generateSegmentImage((newSegmentPlan as any).image_prompt, '9:16'),
    generateVoiceSegment(newSegmentText, (newSegmentPlan as any).voice_emotion)
  ]);

  // Create new segment
  const newSegment: VideoSegment = {
    id: crypto.randomUUID(),
    text: newSegmentText,
    start_time: 0, // Will be calculated in timeline recalculation
    end_time: 0,
    duration: (newSegmentPlan as any).optimal_duration,
    image_url: newImage.url,
    image_prompt: (newSegmentPlan as any).image_prompt,
    position_index: insertPosition
  };

  // Insert into segments array
  const updatedSegments = [...request.current_composition.segments];
  updatedSegments.splice(insertPosition, 0, newSegment);
  
  // Update position indices
  updatedSegments.forEach((segment, index) => {
    segment.position_index = index;
  });

  return {
    ...request.current_composition,
    segments: updatedSegments
  };
}

async function handleRemoveSegment(
  request: VideoEditRequest, 
  impactAnalysis: any
): Promise<VideoComposition> {
  console.log('➖ Removing segment with AI optimization...');
  
  const segmentToRemove = request.edit_data.segment_id!;
  const updatedSegments = request.current_composition.segments.filter(
    segment => segment.id !== segmentToRemove
  );
  
  // Update position indices
  updatedSegments.forEach((segment, index) => {
    segment.position_index = index;
  });

  return {
    ...request.current_composition,
    segments: updatedSegments
  };
}

async function handleModifySegment(
  request: VideoEditRequest, 
  impactAnalysis: any
): Promise<VideoComposition> {
  console.log('✏️ Modifying segment with AI optimization...');
  
  const segmentId = request.edit_data.segment_id!;
  const newText = request.edit_data.new_text!;
  
  const updatedSegments = request.current_composition.segments.map(segment => {
    if (segment.id === segmentId) {
      return {
        ...segment,
        text: newText
      };
    }
    return segment;
  });

  return {
    ...request.current_composition,
    segments: updatedSegments
  };
}

async function handleRegenerateImage(
  request: VideoEditRequest, 
  impactAnalysis: any
): Promise<{ composition: VideoComposition; new_images: string[]; credits_used: number }> {
  console.log('🎨 Regenerating image with AI optimization...');
  
  const segmentId = request.edit_data.segment_id!;
  const newPrompt = request.edit_data.image_regeneration_prompt;
  
  // Find the segment
  const targetSegment = request.current_composition.segments.find(s => s.id === segmentId);
  if (!targetSegment) {
    throw new Error('Segment not found');
  }

  // Generate new image
  const newImage = await generateSegmentImage(
    newPrompt || targetSegment.image_prompt, 
    '9:16'
  );

  const updatedSegments = request.current_composition.segments.map(segment => {
    if (segment.id === segmentId) {
      return {
        ...segment,
        image_url: newImage.url,
        image_prompt: newPrompt || segment.image_prompt
      };
    }
    return segment;
  });

  return {
    composition: {
      ...request.current_composition,
      segments: updatedSegments
    },
    new_images: [newImage.url],
    credits_used: 4 // Image generation cost
  };
}

async function handleTimingAdjustment(
  request: VideoEditRequest, 
  impactAnalysis: any
): Promise<VideoComposition> {
  console.log('⏱️ Adjusting timing with AI optimization...');
  
  const segmentId = request.edit_data.segment_id!;
  const timingAdjustment = request.edit_data.timing_adjustment!;
  
  const updatedSegments = request.current_composition.segments.map(segment => {
    if (segment.id === segmentId) {
      return {
        ...segment,
        duration: timingAdjustment.duration || segment.duration,
        start_time: timingAdjustment.start_time || segment.start_time,
        end_time: timingAdjustment.end_time || segment.end_time
      };
    }
    return segment;
  });

  return {
    ...request.current_composition,
    segments: updatedSegments
  };
}

async function handleReorderSegments(
  request: VideoEditRequest, 
  impactAnalysis: any
): Promise<VideoComposition> {
  console.log('🔄 Reordering segments with AI optimization...');
  
  // This would implement drag-and-drop reordering logic
  // For now, return unchanged composition
  return request.current_composition;
}

/**
 * Helper functions for asset generation and processing
 */

async function generateSegmentImage(prompt: string, aspectRatio: string) {
  // Would call your existing image generation model
  return {
    url: `https://storage.example.com/images/${crypto.randomUUID()}.png`,
    credits_used: 4
  };
}

async function generateVoiceSegment(text: string, emotion: string) {
  // Would call your existing voice generation model
  return {
    url: `https://storage.example.com/audio/${crypto.randomUUID()}.mp3`,
    credits_used: 3
  };
}

async function reanalyzeAudioWithWhisper(params: any) {
  // Would call your Whisper integration
  return {
    updated_captions: [],
    word_timings: []
  };
}

function adjustCaptionTiming(existingCaptions: CaptionData[], affectedSegmentIds: string[]) {
  // Smart caption timing adjustment without full reanalysis
  return existingCaptions;
}

function applyTimelineRecalculation(currentTimeline: TimelineData, recalculation: any) {
  // Apply AI's timeline optimization
  return currentTimeline;
}

async function updateRemotionTemplate(params: any) {
  // Update only affected parts of Remotion template
  return params.current_template;
}

async function saveCompositionUpdate(projectId: string, composition: VideoComposition, editId: string) {
  // Save to database
  console.log(`💾 Saved composition update ${editId} for project ${projectId}`);
}

/**
 * Simplified editing functions for common operations
 */

export async function addNewSegment(
  project_id: string,
  user_id: string,
  current_composition: VideoComposition,
  new_text: string,
  position?: number
) {
  return executeVideoEdit({
    project_id,
    user_id,
    current_composition,
    edit_type: 'add_segment',
    edit_data: {
      new_text,
      new_position: position
    }
  });
}

export async function regenerateSegmentImage(
  project_id: string,
  user_id: string,
  current_composition: VideoComposition,
  segment_id: string,
  new_prompt?: string
) {
  return executeVideoEdit({
    project_id,
    user_id,
    current_composition,
    edit_type: 'regenerate_image',
    edit_data: {
      segment_id,
      image_regeneration_prompt: new_prompt
    }
  });
}