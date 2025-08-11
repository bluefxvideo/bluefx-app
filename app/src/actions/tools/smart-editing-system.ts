'use server';

import { createFluxKontextPrediction, waitForFluxKontextCompletion } from '../models/flux-kontext-pro';

export interface EditingPreferences {
  maintainCharacterConsistency: boolean;
  followOriginalStyle: boolean;
  keepNarrativeFlow: boolean;
  allowCompleteFredom: boolean;
}

export interface SegmentEditRequest {
  segmentIndex: number;
  changes: {
    newText?: string;
    regenerateImage?: boolean;
    regenerateVoice?: boolean;
    customImagePrompt?: string;
  };
  editingPreferences: EditingPreferences;
  originalStoryContext: any; // From the orchestrator
}

/**
 * Smart segment editing that respects or ignores original AI context
 */
export async function editSegmentIntelligently(
  request: SegmentEditRequest,
  userId: string
): Promise<{
  success: boolean;
  updatedSegment?: any;
  updatedImageUrl?: string;
  updatedAudioUrl?: string;
  error?: string;
}> {
  try {
    const { segmentIndex, changes, editingPreferences, originalStoryContext } = request;
    const segmentContext = originalStoryContext.segmentContexts[segmentIndex];
    
    const result: any = {};

    // Handle image regeneration
    if (changes.regenerateImage) {
      if (changes.customImagePrompt && editingPreferences.allowCompleteFredom) {
        // Complete user freedom - use their prompt exactly
        console.log('🎨 User override mode - using custom prompt');
        result.imageUrl = await regenerateImageWithPrompt(changes.customImagePrompt);
        
      } else if (editingPreferences.followOriginalStyle) {
        // Maintain original AI style and character consistency  
        console.log('🎨 Style-consistent mode - maintaining AI coherence');
        
        const consistentPrompt = buildConsistentImagePrompt(
          segmentContext,
          originalStoryContext.originalStoryboardPlan,
          changes.newText || segmentContext.original_purpose
        );
        
        result.imageUrl = await regenerateImageWithPrompt(consistentPrompt);
        
      } else {
        // Balanced approach - new content but maintain characters
        console.log('🎨 Balanced mode - new style but consistent characters');
        
        const balancedPrompt = buildBalancedImagePrompt(
          segmentContext,
          originalStoryContext.originalStoryboardPlan.characters,
          changes.newText
        );
        
        result.imageUrl = await regenerateImageWithPrompt(balancedPrompt);
      }
    }

    // Handle voice regeneration
    if (changes.regenerateVoice) {
      const voiceSettings = editingPreferences.followOriginalStyle
        ? deriveVoiceFromOriginalTone(segmentContext.original_emotional_tone)
        : { voice_id: 'anna', speed: 'normal', emotion: 'neutral' };
        
      // Use the voice service to regenerate this segment
      result.audioUrl = await regenerateSegmentVoice(
        changes.newText || segmentContext.original_purpose,
        voiceSettings,
        userId
      );
    }

    // Handle text changes
    if (changes.newText) {
      result.updatedText = changes.newText;
      result.characterCount = changes.newText.length;
      
      // Auto-update image prompt if following original style
      if (editingPreferences.followOriginalStyle && !changes.customImagePrompt) {
        result.suggestedImagePrompt = buildConsistentImagePrompt(
          segmentContext,
          originalStoryContext.originalStoryboardPlan,
          changes.newText
        );
      }
    }

    return {
      success: true,
      updatedSegment: result
    };

  } catch (error) {
    console.error('Smart editing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Editing failed'
    };
  }
}

/**
 * Build image prompt that maintains original AI character consistency
 */
function buildConsistentImagePrompt(
  segmentContext: any,
  originalPlan: any,
  newContent?: string
): string {
  const characters = originalPlan.characters
    .filter((char: any) => segmentContext.original_characters.includes(char.name))
    .map((char: any) => `${char.detailed_description} (maintain exact same appearance)`)
    .join(', ');

  const sceneDescription = newContent || segmentContext.original_purpose;

  return `
    ${sceneDescription}.
    Characters: ${characters}.
    Visual approach: ${segmentContext.original_visual_approach}.
    Style: ${originalPlan.visual_style}.
    Emotional tone: ${segmentContext.original_emotional_tone}.
    CRITICAL: Maintain identical character appearance as described.
  `.trim();
}

/**
 * Build balanced prompt - new scene but consistent characters
 */
function buildBalancedImagePrompt(
  segmentContext: any,
  originalCharacters: any[],
  newContent?: string
): string {
  const mainCharacters = originalCharacters
    .filter(char => char.role_in_story?.includes('main'))
    .map(char => char.detailed_description)
    .join(', ');

  const sceneDescription = newContent || 'updated scene';

  return `
    ${sceneDescription}.
    Characters: ${mainCharacters} (keep same character appearance).
    Cinematic composition, professional storytelling.
  `.trim();
}

/**
 * Helper functions
 */
async function regenerateImageWithPrompt(prompt: string): Promise<string> {
  const prediction = await createFluxKontextPrediction({
    prompt,
    aspect_ratio: '16:9',
    output_format: 'png',
    safety_tolerance: 2
  });

  const completed = await waitForFluxKontextCompletion(prediction.id);
  
  if (completed.status === 'succeeded' && completed.output) {
    return completed.output;
  }
  
  throw new Error('Image generation failed');
}

function deriveVoiceFromOriginalTone(emotionalTone: string): any {
  if (emotionalTone.toLowerCase().includes('excited')) {
    return { voice_id: 'anna', speed: 'faster', emotion: 'excited' };
  } else if (emotionalTone.toLowerCase().includes('dramatic')) {
    return { voice_id: 'felix', speed: 'normal', emotion: 'dramatic' };
  } else if (emotionalTone.toLowerCase().includes('calm')) {
    return { voice_id: 'nina', speed: 'slower', emotion: 'calm' };
  }
  
  return { voice_id: 'anna', speed: 'normal', emotion: 'neutral' };
}

async function regenerateSegmentVoice(text: string, settings: any, userId: string): Promise<string> {
  // This would integrate with your voice service
  // Placeholder implementation
  return `voice-url-${userId}-${Date.now()}`;
}