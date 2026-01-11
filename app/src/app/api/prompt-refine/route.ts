import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

interface RefineRequest {
  prompt: string;
  instruction: string;
}

/**
 * AI-powered prompt refiner for customizing storyboard prompts
 * Uses Gemini 2.5 Flash to rewrite prompts based on user instructions
 */
export async function POST(request: NextRequest) {
  try {
    const { prompt, instruction }: RefineRequest = await request.json();

    if (!prompt || !instruction) {
      return NextResponse.json(
        { success: false, error: 'Prompt and instruction are required' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a storyboard prompt editor. Your job is to modify storyboard generation prompts based on user instructions.

Rules:
1. Preserve the overall story structure, timing, and flow
2. Make the requested changes naturally and seamlessly
3. Keep all frame numbers and grid structure intact
4. Be specific about product/character/setting changes across all relevant frames
5. Maintain the visual style and mood unless asked to change it
6. Keep the same level of detail in descriptions
7. Output ONLY the modified prompt, no explanations or preamble`;

    const userMessage = `Original storyboard prompt:
"""
${prompt}
"""

User's instruction: "${instruction}"

Modify the prompt to incorporate this change. Make the changes seamlessly across all relevant frames.`;

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
        maxOutputTokens: 8000,
      },
    });

    const refinedPrompt = result.response.text()?.trim();

    if (!refinedPrompt) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate refined prompt' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      refinedPrompt,
    });

  } catch (error) {
    console.error('Error refining prompt:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refine prompt'
      },
      { status: 500 }
    );
  }
}
