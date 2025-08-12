/**
 * Script generation service for API routes
 * This is a non-server-action version that can be used in API routes
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import type { ScriptGenerationRequest, ScriptGenerationResponse } from '@/types/script-generation';

export async function generateScriptFromIdeaAPI(
  request: ScriptGenerationRequest
): Promise<ScriptGenerationResponse> {
  try {
    console.log(`🤖 Script Generation API: Processing idea for user ${request.user_id}`);
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

    // Set defaults for style
    const tone = request.style?.tone || 'professional';
    const pacing = request.style?.pacing || 'medium';
    const targetDuration = request.style?.target_duration || 45;

    // Calculate target word count (average speaking rate: 150 words per minute)
    const targetWordCount = Math.round((targetDuration / 60) * 150);

    console.log(`🎯 Target: ${targetWordCount} words, ${targetDuration}s duration, ${tone} tone`);

    // Generate script with GPT-4o
    const { object: scriptData } = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({
        script: z.string().describe('The complete video script with natural, engaging narration'),
        hook: z.string().describe('Opening hook to grab attention in first 3 seconds'),
        main_points: z.array(z.string()).describe('Key points covered in the script'),
        call_to_action: z.string().describe('Clear call-to-action for the end'),
        tone_match: z.string().describe('How well the script matches the requested tone'),
        word_count: z.number().describe('Actual word count of the script'),
        estimated_speaking_duration: z.number().describe('Estimated duration in seconds when spoken')
      }),
      prompt: `Create a compelling video script based on this idea: "${request.idea}"

Requirements:
- Tone: ${tone}
- Pacing: ${pacing}
- Target duration: ${targetDuration} seconds (approximately ${targetWordCount} words)
- Platform: TikTok/Instagram Reels style

The script should:
1. Start with a strong hook in the first 3 seconds
2. Be conversational and engaging
3. Use short, punchy sentences
4. Include natural pauses and emphasis
5. End with a clear call-to-action
6. Be suitable for text-to-speech narration

Focus on creating compelling NARRATION ONLY. 
Do not include stage directions, visual descriptions, or technical notes.
Write as if you're speaking directly to the viewer.`
    });

    console.log(`✅ Script generated: ${scriptData.word_count} words, ${scriptData.estimated_speaking_duration}s estimated duration`);

    // Build the final script with hook and CTA
    const finalScript = `${scriptData.hook}

${scriptData.script}

${scriptData.call_to_action}`;

    return {
      success: true,
      script: finalScript,
      metadata: {
        word_count: scriptData.word_count,
        estimated_duration: scriptData.estimated_speaking_duration,
        tone_analysis: scriptData.tone_match,
        key_points: scriptData.main_points
      },
      credits_used: 3 // Base cost for script generation
    };

  } catch (error) {
    console.error('❌ Script generation failed:', error);
    
    return {
      success: false,
      script: '',
      credits_used: 0,
      error: error instanceof Error ? error.message : 'Failed to generate script'
    };
  }
}