/**
 * Storyboard Context System - Hybrid Approach for Editing
 * Maintains AI coherence while allowing user freedom
 */

export interface StoryboardContext {
  // Original AI decisions
  originalPlan: {
    characters: Array<{
      name: string;
      detailed_description: string;
      consistency_requirements: string;
    }>;
    visual_style: string;
    narrative_flow: string;
    scene_progression: string[];
  };
  
  // Per-segment context
  segmentContexts: Array<{
    original_purpose: string;
    original_visual_approach: string;
    original_characters: string[];
    original_emotional_tone: string;
  }>;
  
  // User preferences
  editingMode: 'maintain_style' | 'free_form';
  characterConsistencyEnabled: boolean;
  visualStyleLocked: boolean;
}

export interface EditingOptions {
  maintainOriginalStyle: boolean;
  keepCharacterConsistency: boolean;
  followNarrativeFlow: boolean;
  customPromptOverride?: string;
}

/**
 * Smart editing that respects or breaks from original AI context
 */
export async function editSegmentWithContext(
  segmentIndex: number,
  changes: {
    text?: string;
    regenerateImage?: boolean;
    regenerateVoice?: boolean;
  },
  storyboardContext: StoryboardContext,
  editingOptions: EditingOptions
) {
  if (editingOptions.maintainOriginalStyle) {
    // Use original AI context for consistency
    return await editWithAICoherence(segmentIndex, changes, storyboardContext);
  } else {
    // Complete user freedom
    return await editWithUserFreedom(segmentIndex, changes);
  }
}

async function editWithAICoherence(
  segmentIndex: number,
  changes: any,
  context: StoryboardContext
) {
  const segmentContext = context.segmentContexts[segmentIndex];
  
  if (changes.regenerateImage) {
    // Maintain character consistency and visual style
    const originalCharacters = context.originalPlan.characters
      .filter(char => segmentContext.original_characters.includes(char.name))
      .map(char => char.detailed_description)
      .join(', ');
    
    const enhancedPrompt = `
      ${segmentContext.original_purpose}.
      Characters: ${originalCharacters} (maintain exact same appearance as previous scenes).
      Style: ${context.originalPlan.visual_style}.
      Approach: ${segmentContext.original_visual_approach}.
      CRITICAL: Keep character consistency with original storyboard.
    `;
    
    return await regenerateWithPrompt(enhancedPrompt);
  }
  
  // Handle other changes...
}

async function editWithUserFreedom(segmentIndex: number, changes: any) {
  // Complete freedom - ignore original context
  if (changes.regenerateImage && changes.customPromptOverride) {
    return await regenerateWithPrompt(changes.customPromptOverride);
  }
  
  // Standard regeneration without constraints
  return await standardRegeneration(changes);
}