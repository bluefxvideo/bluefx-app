import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AssetInfo {
  label: string;
  type: 'character' | 'product' | 'environment' | 'other';
  description?: string;
}

interface RewriteRequest {
  originalPrompt: string;
  instruction: string;
  assets: AssetInfo[];
}

/**
 * AI-powered prompt rewriter for storyboard customization
 * Takes the original prompt, user instruction, and uploaded asset info
 * Returns a rewritten prompt that incorporates the user's assets
 */
export async function POST(request: NextRequest) {
  try {
    const { originalPrompt, instruction, assets }: RewriteRequest = await request.json();

    if (!originalPrompt || !instruction) {
      return NextResponse.json(
        { success: false, error: 'Original prompt and instruction are required' },
        { status: 400 }
      );
    }

    // Build context about the user's assets
    const assetContext = assets.length > 0
      ? `\n\nThe user has uploaded the following reference assets that should be used in the storyboard:\n${assets.map(a => `- "${a.label}" (${a.type})${a.description ? `: ${a.description}` : ''}`).join('\n')}`
      : '';

    const systemPrompt = `You are a storyboard prompt editor. Your job is to rewrite storyboard generation prompts to incorporate the user's specific assets and requirements.

Rules:
1. Preserve the overall story structure and flow
2. Replace generic references with the user's specific assets where appropriate
3. Add explicit instructions to use the uploaded reference images for character/product consistency
4. Keep the same visual style and mood
5. Ensure the prompt still works for a 3x3 grid (9 frames) storyboard generation
6. Be specific about which frames should feature which assets
7. Add "REFERENCE IMAGE: [asset label]" tags where the AI should use uploaded references

Output ONLY the rewritten prompt, no explanations.`;

    const userMessage = `Original storyboard prompt:
"""
${originalPrompt}
"""
${assetContext}

User's instruction: "${instruction}"

Rewrite the prompt to incorporate the user's instruction and assets. The rewritten prompt should explicitly reference the uploaded assets where needed.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const rewrittenPrompt = response.choices[0]?.message?.content?.trim();

    if (!rewrittenPrompt) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate rewritten prompt' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rewrittenPrompt,
    });

  } catch (error) {
    console.error('Error rewriting storyboard prompt:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rewrite prompt'
      },
      { status: 500 }
    );
  }
}
