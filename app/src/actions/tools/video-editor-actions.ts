'use server';

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Import orchestrators
import type { VideoEditRequest } from './script-video-editor-orchestrator';
import type { VideoRenderRequest } from './script-video-render-orchestrator';

/**
 * Video Editor Server Actions
 * Connects UI operations to appropriate orchestrators with smart decision making
 */

// Impact Analysis Types
export interface SegmentImpactAnalysis {
  operation: 'add' | 'remove' | 'modify';
  scope: 'isolated' | 'adjacent_segments' | 'full_timeline' | 'audio_reprocessing';
  affectedSegmentIds: string[];
  requiresUserChoice: boolean;
  strategies: SegmentStrategy[];
  recommendedStrategy: string;
}

export interface SegmentStrategy {
  id: string;
  name: string;
  description: string;
  creditsRequired: number;
  processingTime: number; // seconds
  affectedSegments: string[];
  preservesCustomizations: boolean;
  qualityImpact: 'none' | 'minor' | 'moderate' | 'significant';
}

// User Choice Dialog Data
export interface UserChoiceDialog {
  title: string;
  description: string;
  operation: string;
  strategies: SegmentStrategy[];
  defaultStrategy?: string;
  showCostBreakdown: boolean;
}

// Progress Tracking
export interface OperationProgress {
  operationId: string;
  type: 'add_segment' | 'remove_segment' | 'regenerate_asset' | 'export_video';
  status: 'queued' | 'analyzing' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  stage: string;
  estimatedTimeRemaining?: number;
  creditsUsed: number;
  result?: unknown;
  error?: string;
}

// Impact Analysis Schema
const SegmentImpactSchema = z.object({
  operation_scope: z.enum(['isolated', 'adjacent_segments', 'full_timeline', 'audio_reprocessing']),
  affected_segment_ids: z.array(z.string()),
  requires_user_choice: z.boolean(),
  voice_continuity_impact: z.enum(['none', 'minor_break', 'major_break', 'full_disruption']),
  narrative_coherence_impact: z.enum(['maintained', 'minor_gap', 'major_gap', 'broken']),
  timeline_recalculation_needed: z.boolean(),
  estimated_credits_range: z.object({
    min: z.number(),
    max: z.number()
  }),
  recommended_strategies: z.array(z.object({
    strategy_id: z.string(),
    name: z.string(),
    description: z.string(),
    credits_required: z.number(),
    processing_time_seconds: z.number(),
    quality_impact: z.enum(['none', 'minor', 'moderate', 'significant']),
    preserves_customizations: z.boolean(),
    technical_details: z.string()
  })),
  reasoning: z.string()
});

/**
 * Analyze the impact of adding a segment
 */
export async function analyzeSegmentAddition(
  currentSegments: unknown[],
  afterSegmentId: string | undefined,
  newText: string
): Promise<SegmentImpactAnalysis> {
  try {
    const insertIndex = afterSegmentId 
      ? (currentSegments || []).findIndex((s: any) => s.id === afterSegmentId) + 1
      : (currentSegments || []).length;
    
    const contextSegments = (currentSegments || []).slice(Math.max(0, insertIndex - 2), insertIndex + 2);
    
    const analysis = await generateObject({
      model: openai('gpt-4o'),
      schema: SegmentImpactSchema,
      prompt: `
        Analyze the impact of adding a new segment to this video:
        
        Current segments context:
        ${contextSegments.map((s: any, i: number) => `${i}: "${s.text}" (${s.duration}s)`).join('\n')}
        
        New segment text: "${newText}"
        Insertion position: ${insertIndex} (after ${afterSegmentId || 'beginning'})
        
        Consider:
        1. Voice continuity - Will adding this segment create jarring transitions?
        2. Narrative flow - Does this segment fit the story progression?
        3. Timeline impact - How much recalculation is needed?
        4. Credit optimization - What's the most cost-effective approach?
        
        Provide specific strategies:
        - Isolated: Generate only the new segment (cheapest, may be choppy)
        - Smart: Regenerate voice from insertion point (balanced approach)
        - Full: Regenerate entire video for perfect coherence (expensive, perfect)
        
        Be specific about credit costs and quality trade-offs.
      `
    });

    const result = analysis.object as Record<string, unknown>;
    
    return {
      operation: 'add',
      scope: (result.operation_scope as any),
      affectedSegmentIds: (result.affected_segment_ids as any),
      requiresUserChoice: (result.requires_user_choice as any),
      strategies: ((result.recommended_strategies as any) || []).map((s: any) => ({
        id: s.strategy_id as string,
        name: s.name as string,
        description: s.description as string,
        creditsRequired: s.credits_required as number,
        processingTime: s.processing_time_seconds as number,
        affectedSegments: result.affected_segment_ids as string[],
        preservesCustomizations: s.preserves_customizations as boolean,
        qualityImpact: s.quality_impact as string
      })),
      recommendedStrategy: (result.recommended_strategies as any)?.[0]?.strategy_id || 'isolated'
    };
    
  } catch (_error) {
    // Fallback to safe analysis
    return {
      operation: 'add',
      scope: 'isolated',
      affectedSegmentIds: [],
      requiresUserChoice: false,
      strategies: [
        {
          id: 'isolated',
          name: 'Add Independently',
          description: 'Add segment without affecting others. Quick and cheap.',
          creditsRequired: 5,
          processingTime: 30,
          affectedSegments: [],
          preservesCustomizations: true,
          qualityImpact: 'minor'
        }
      ],
      recommendedStrategy: 'isolated'
    };
  }
}

/**
 * Analyze the impact of removing a segment
 */
export async function analyzeSegmentRemoval(
  currentSegments: Array<Record<string, unknown>>,
  segmentId: string
): Promise<SegmentImpactAnalysis> {
  try {
    const segmentIndex = currentSegments.findIndex(s => s.id === segmentId);
    const targetSegment = currentSegments[segmentIndex];
    const beforeSegment = currentSegments[segmentIndex - 1];
    const afterSegment = currentSegments[segmentIndex + 1];
    
    const analysis = await generateObject({
      model: openai('gpt-4o'),
      schema: SegmentImpactSchema,
      prompt: `
        Analyze the impact of removing this segment:
        
        Target segment: "${targetSegment?.text}" (${targetSegment?.duration}s)
        Before segment: "${beforeSegment?.text || 'N/A'}"
        After segment: "${afterSegment?.text || 'N/A'}"
        
        Consider:
        1. Narrative gap - Will removing this create a story gap?
        2. Voice transition - Will the before→after transition sound natural?
        3. Timeline collapse - How to handle the timing adjustment?
        4. Content coherence - Is this segment crucial to understanding?
        
        Provide strategies for handling the removal gracefully.
      `
    });

    const result = analysis.object as Record<string, unknown>;
    
    return {
      operation: 'remove',
      scope: (result.operation_scope as any),
      affectedSegmentIds: (result.affected_segment_ids as any),
      requiresUserChoice: (result.requires_user_choice as any),
      strategies: ((result.recommended_strategies as any) || []).map((s: any) => ({
        id: s.strategy_id as string,
        name: s.name as string,
        description: s.description as string,
        creditsRequired: s.credits_required as number,
        processingTime: s.processing_time_seconds as number,
        affectedSegments: result.affected_segment_ids as string[],
        preservesCustomizations: s.preserves_customizations as boolean,
        qualityImpact: s.quality_impact as string
      })),
      recommendedStrategy: (result.recommended_strategies as any)?.[0]?.strategy_id || 'simple_remove'
    };
    
  } catch (_error) {
    return {
      operation: 'remove',
      scope: 'isolated',
      affectedSegmentIds: [segmentId],
      requiresUserChoice: false,
      strategies: [
        {
          id: 'simple_remove',
          name: 'Simple Removal',
          description: 'Remove segment and collapse timeline. May create abrupt transition.',
          creditsRequired: 0,
          processingTime: 5,
          affectedSegments: [segmentId],
          preservesCustomizations: true,
          qualityImpact: 'moderate'
        }
      ],
      recommendedStrategy: 'simple_remove'
    };
  }
}

/**
 * Execute segment addition with chosen strategy
 */
export async function executeSegmentAddition(
  projectId: string,
  userId: string,
  currentComposition: Record<string, unknown> | any,
  afterSegmentId: string | undefined,
  newText: string,
  strategy: string
): Promise<OperationProgress> {
  try {
    const operationId = `add_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create edit request for the Edit Orchestrator
    const _editRequest: VideoEditRequest = {
      project_id: projectId,
      user_id: userId,
      current_composition: currentComposition as any,
      edit_type: 'add_segment',
      edit_data: {
        new_text: newText,
        new_position: afterSegmentId ? ((currentComposition as any).segments || []).findIndex((s: any) => s.id === afterSegmentId) + 1 : ((currentComposition as any).segments || []).length
      }
    };
    
    // Call Edit Orchestrator (this would be the actual API call)
    // For now, return mock progress
    return {
      operationId,
      type: 'add_segment',
      status: 'processing',
      progress: 0,
      stage: 'Analyzing insertion point',
      estimatedTimeRemaining: strategy === 'isolated' ? 30 : strategy === 'smart' ? 120 : 300,
      creditsUsed: 0
    };
    
  } catch (_error) {
    return {
      operationId: 'error',
      type: 'add_segment',
      status: 'failed',
      progress: 0,
      stage: 'Failed',
      creditsUsed: 0,
      error: _error instanceof Error ? _error.message : 'Unknown error'
    };
  }
}

/**
 * Execute segment removal with chosen strategy
 */
export async function executeSegmentRemoval(
  projectId: string,
  userId: string,
  currentComposition: Record<string, unknown> | any,
  segmentId: string,
  strategy: string
): Promise<OperationProgress> {
  try {
    const operationId = `remove_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const _editRequest: VideoEditRequest = {
      project_id: projectId,
      user_id: userId,
      current_composition: currentComposition as any,
      edit_type: 'remove_segment',
      edit_data: {
        segment_id: segmentId
      }
    };
    
    return {
      operationId,
      type: 'remove_segment',
      status: 'processing',
      progress: 0,
      stage: 'Analyzing removal impact',
      estimatedTimeRemaining: strategy === 'simple_remove' ? 10 : 60,
      creditsUsed: 0
    };
    
  } catch (_error) {
    return {
      operationId: 'error',
      type: 'remove_segment',
      status: 'failed',
      progress: 0,
      stage: 'Failed',
      creditsUsed: 0,
      error: _error instanceof Error ? _error.message : 'Unknown error'
    };
  }
}

/**
 * Regenerate a single asset (image or voice)
 */
export async function regenerateSegmentAsset(
  projectId: string,
  userId: string,
  currentComposition: Record<string, unknown> | any,
  segmentId: string,
  assetType: 'image' | 'voice',
  customPrompt?: string
): Promise<OperationProgress> {
  try {
    const operationId = `regen_${assetType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const _editRequest: VideoEditRequest = {
      project_id: projectId,
      user_id: userId,
      current_composition: currentComposition as any,
      edit_type: 'regenerate_image', // or regenerate_voice based on assetType
      edit_data: {
        segment_id: segmentId,
        image_regeneration_prompt: customPrompt
      }
    };
    
    return {
      operationId,
      type: 'regenerate_asset',
      status: 'processing',
      progress: 0,
      stage: `Regenerating ${assetType}`,
      estimatedTimeRemaining: assetType === 'image' ? 45 : 60,
      creditsUsed: 0
    };
    
  } catch (_error) {
    return {
      operationId: 'error',
      type: 'regenerate_asset',
      status: 'failed',
      progress: 0,
      stage: 'Failed',
      creditsUsed: 0,
      error: _error instanceof Error ? _error.message : 'Unknown error'
    };
  }
}

/**
 * Start video export with render orchestrator
 */
export async function startVideoExport(
  projectId: string,
  userId: string,
  composition: Record<string, unknown>,
  exportSettings: Record<string, unknown>,
  platformPreset?: string
): Promise<OperationProgress> {
  try {
    const operationId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const _renderRequest: VideoRenderRequest = {
      project_id: projectId,
      user_id: userId,
      composition: composition as any,
      export_settings: exportSettings as any,
      render_quality: (exportSettings as any).quality || 'standard',
      platform_preset: platformPreset as any
    };
    
    // Call Render Orchestrator (this would be the actual API call)
    return {
      operationId,
      type: 'export_video',
      status: 'queued',
      progress: 0,
      stage: 'Preparing assets',
      estimatedTimeRemaining: 180,
      creditsUsed: 0
    };
    
  } catch (_error) {
    return {
      operationId: 'error',
      type: 'export_video',
      status: 'failed',
      progress: 0,
      stage: 'Failed',
      creditsUsed: 0,
      error: _error instanceof Error ? _error.message : 'Unknown error'
    };
  }
}

/**
 * Get operation progress
 */
export async function getOperationProgress(operationId: string): Promise<OperationProgress | null> {
  // This would check the status of an operation
  // For now, return mock progress
  
  if (operationId.startsWith('error')) {
    return null;
  }
  
  // Mock progressive updates
  const elapsed = Date.now() - parseInt(operationId.split('_')[1]);
  const progress = Math.min(Math.floor(elapsed / 1000) * 2, 100);
  
  return {
    operationId,
    type: operationId.includes('add') ? 'add_segment' : 
          operationId.includes('remove') ? 'remove_segment' :
          operationId.includes('regen') ? 'regenerate_asset' : 'export_video',
    status: progress >= 100 ? 'completed' : 'processing',
    progress,
    stage: progress < 25 ? 'Analyzing' : 
           progress < 50 ? 'Processing' : 
           progress < 75 ? 'Generating' : 
           progress < 100 ? 'Finalizing' : 'Complete',
    estimatedTimeRemaining: progress >= 100 ? 0 : Math.max(0, 120 - elapsed / 1000),
    creditsUsed: progress >= 100 ? Math.floor(Math.random() * 15) + 5 : 0
  };
}

/**
 * Cancel an operation
 */
export async function cancelOperation(_operationId: string): Promise<{ success: boolean; error?: string }> {
  // Implementation to cancel an operation
  return { success: true };
}

/**
 * Get cost preview for an operation
 */
export async function getCostPreview(
  operation: 'add' | 'remove' | 'regenerate' | 'export',
  strategy: string,
  _composition: Record<string, unknown>
): Promise<{
  creditsRequired: number;
  estimatedTime: number;
  breakdown: Array<{ item: string; credits: number; description: string }>;
}> {
  
  const costBreakdowns = {
    add: {
      isolated: [
        { item: 'Text Analysis', credits: 1, description: 'AI analysis of new content' },
        { item: 'Image Generation', credits: 3, description: 'Generate visual for new segment' },
        { item: 'Voice Generation', credits: 2, description: 'Generate voice for new text' }
      ],
      smart: [
        { item: 'Impact Analysis', credits: 2, description: 'Analyze voice continuity needs' },
        { item: 'Selective Regeneration', credits: 8, description: 'Regenerate affected segments' },
        { item: 'Timeline Optimization', credits: 2, description: 'Optimize segment timing' }
      ],
      full: [
        { item: 'Complete Re-analysis', credits: 5, description: 'Full script coherence analysis' },
        { item: 'Full Voice Regeneration', credits: 15, description: 'Regenerate entire voiceover' },
        { item: 'Asset Integration', credits: 3, description: 'Integrate all assets perfectly' }
      ]
    },
    remove: {
      simple_remove: [
        { item: 'Timeline Adjustment', credits: 0, description: 'Simple segment removal' }
      ],
      bridge_content: [
        { item: 'Gap Analysis', credits: 2, description: 'Analyze narrative gap' },
        { item: 'Bridge Generation', credits: 5, description: 'Generate transition content' }
      ]
    },
    regenerate: {
      image: [
        { item: 'Image Generation', credits: 4, description: 'Regenerate segment image' }
      ],
      voice: [
        { item: 'Voice Generation', credits: 3, description: 'Regenerate segment voice' },
        { item: 'Timing Adjustment', credits: 1, description: 'Adjust timing if needed' }
      ]
    },
    export: {
      draft: [
        { item: 'Video Assembly', credits: 5, description: 'Compile video at draft quality' },
        { item: 'Audio Sync', credits: 2, description: 'Synchronize audio and visuals' }
      ],
      standard: [
        { item: 'Video Assembly', credits: 8, description: 'Compile video at standard quality' },
        { item: 'Audio Enhancement', credits: 3, description: 'Enhance audio quality' },
        { item: 'Platform Optimization', credits: 2, description: 'Optimize for target platform' }
      ],
      premium: [
        { item: 'Video Assembly', credits: 12, description: 'Compile video at premium quality' },
        { item: 'Audio Enhancement', credits: 4, description: 'Premium audio processing' },
        { item: 'Platform Optimization', credits: 3, description: 'Advanced platform optimization' },
        { item: 'Quality Assurance', credits: 2, description: 'Quality checks and validation' }
      ]
    }
  };
  
  const breakdown = (costBreakdowns as Record<string, Record<string, Array<{item: string; credits: number; description: string}>>>)[operation]?.[strategy] || (costBreakdowns as Record<string, Record<string, Array<{item: string; credits: number; description: string}>>>)[operation]?.['isolated'] || [];
  const creditsRequired = breakdown.reduce((sum: number, item: {item: string; credits: number; description: string}) => sum + item.credits, 0);
  const estimatedTime = creditsRequired * 8; // Rough estimate: 8 seconds per credit
  
  return {
    creditsRequired,
    estimatedTime,
    breakdown
  };
}