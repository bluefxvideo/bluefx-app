'use server';

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import type { ScriptGenerationRequest, ScriptGenerationResponse } from '@/types/script-generation';

// Types are imported but not re-exported to avoid build conflicts

/**
 * Generate a professional video script from a user's idea
 * Uses GPT-4o to create engaging, structured video content
 */
export async function generateScriptFromIdea(
  request: ScriptGenerationRequest
): Promise<ScriptGenerationResponse> {
  try {
    console.log(`🤖 Script Generation: Processing idea for user ${request.user_id}`);
    console.log(`💡 Idea: "${request.idea}"`);

    // Validate input
    if (!request.idea || request.idea.trim().length < 10) {
      return {
        success: false,
        script: '',
        credits_used: 0,
        error: 'Please provide a more detailed video idea (at least 10 characters)'
      };
    }

    const targetDuration = request.style?.target_duration || 45; // Default 45 seconds
    const tone = request.style?.tone || 'professional';
    const pacing = request.style?.pacing || 'medium';

    // Generate clean narration script using AI (no visual directions)
    const { object: scriptData } = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({
        narration: z.string().describe('The complete narration text only, no stage directions or visual cues'),
        estimated_word_count: z.number(),
        key_themes: z.array(z.string()).optional()
      }),
      prompt: `Create a compelling video narration script based on this idea: "${request.idea}"

Requirements:
- Target duration: ${targetDuration} seconds (approximately ${Math.round(targetDuration * 3)} words)
- Tone: ${tone}
- Pacing: ${pacing}
- Platform: Social media (TikTok/Instagram style)

IMPORTANT: Return ONLY the narration text that will be spoken.
- NO visual directions (like "opening shot", "cut to", "close-up")
- NO stage directions or camera instructions
- NO scene descriptions
- Just the pure script that the narrator will speak
- MUST include proper punctuation (periods, commas, question marks, exclamation points)
- Every sentence MUST end with appropriate punctuation (. ! ?)

Style Guidelines:
- Use conversational language that feels natural when spoken
- Keep sentences short and punchy for ${pacing} pacing
- Match ${tone} tone throughout
- Create an engaging hook in the first sentence
- End with a clear call-to-action
- Use proper grammar and punctuation throughout

AVOID these overused openings:
- "Have you ever heard..."
- "Ever wondered..."
- "Have you ever wondered..."
- "Did you know that..."
- "What if I told you..."

Instead, start with:
- A surprising fact or statistic ("90% of people don't know...")
- A bold statement ("This changes everything about...")
- A specific scenario ("Picture this: you're standing...")
- An action or moment ("The moment I discovered...")
- A direct question without "ever" ("Why do successful people...")
- A contradiction ("Everyone thinks X, but actually...")
- An intriguing number ("3 seconds. That's all it takes to...")

The script should flow naturally as spoken content, engaging viewers from start to finish.`
    });

    console.log(`✅ Script generated: ${scriptData.estimated_word_count} words`);

    // Calculate estimated duration based on average speaking speed
    const estimatedDuration = Math.round((scriptData.estimated_word_count / 180) * 60); // 180 words per minute

    const metadata = {
      word_count: scriptData.estimated_word_count,
      estimated_duration: estimatedDuration,
      tone_analysis: `${tone} tone with ${pacing} pacing`,
      key_points: scriptData.key_themes || []
    };

    return {
      success: true,
      script: scriptData.narration, // Clean narration text only
      metadata,
      credits_used: 3 // Script generation cost
    };

  } catch (error) {
    console.error('🚨 Script generation error:', error);
    
    return {
      success: false,
      script: '',
      credits_used: 0,
      error: error instanceof Error ? error.message : 'Failed to generate script'
    };
  }
}

/**
 * Quick script generation for multi-step workflow
 */
export async function generateQuickScript(
  idea: string,
  user_id: string,
  options?: {
    tone?: 'professional' | 'casual' | 'educational' | 'dramatic' | 'energetic';
  }
): Promise<ScriptGenerationResponse> {
  return generateScriptFromIdea({
    idea,
    user_id,
    style: {
      tone: options?.tone || 'professional',
      pacing: 'medium',
      target_duration: 45
    }
  });
}