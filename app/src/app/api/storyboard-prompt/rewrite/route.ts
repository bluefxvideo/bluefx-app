import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

interface RewriteRequest {
  originalPrompt: string;
  instruction: string;
  referenceImageCount?: number;
}

/**
 * AI-powered prompt rewriter for storyboard customization
 * Uses Gemini 2.0 Flash to rewrite prompts based on user instructions
 */
export async function POST(request: NextRequest) {
  try {
    const { originalPrompt, instruction, referenceImageCount = 0 }: RewriteRequest = await request.json();

    if (!originalPrompt || !instruction) {
      return NextResponse.json(
        { success: false, error: 'Original prompt and instruction are required' },
        { status: 400 }
      );
    }

    // Build context about reference images
    const referenceContext = referenceImageCount > 0
      ? `\n\nThe user has uploaded ${referenceImageCount} reference image(s) that will be sent to the image generator. These images contain the user's product, character, or environment that should appear in the storyboard.`
      : '';

    const systemPrompt = `You are a storyboard prompt editor. Your job is to rewrite storyboard generation prompts to incorporate the user's specific requirements and reference images.

Rules:
1. Preserve the overall story structure and flow
2. Incorporate the user's instruction into the prompt naturally
3. If the user mentions using their product/character/reference, add explicit instructions like "use the uploaded reference image for the product" or "match the character to the reference photo"
4. Keep the same visual style and mood unless the user asks to change it
5. Ensure the prompt still works for a 3x3 grid (9 frames) storyboard generation
6. Be specific about which frames should feature which elements
7. Keep the rewritten prompt concise but complete

Output ONLY the rewritten prompt, no explanations or preamble.`;

    const userMessage = `Original storyboard prompt:
"""
${originalPrompt}
"""
${referenceContext}

User's instruction: "${instruction}"

Rewrite the prompt to incorporate the user's instruction. Make the changes seamlessly.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: systemPrompt + '\n\n' + userMessage }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    });

    const rewrittenPrompt = result.response.text()?.trim();

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
