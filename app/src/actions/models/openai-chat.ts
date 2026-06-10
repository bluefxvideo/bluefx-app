'use server';

/**
 * Shared REST chat helper.
 * Originally generated from the OpenAI chat-completions API, now migrated to
 * Google Gemini via the Vercel AI SDK (@ai-sdk/google). The exported function
 * names, signatures, and return shapes are preserved so existing callers
 * continue to work unchanged.
 *
 * Env var: GOOGLE_GENERATIVE_AI_API_KEY
 */

import { google } from '@ai-sdk/google';
import { generateText, type CoreMessage } from 'ai';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
  }>;
}

interface ChatCompletionInput {
  model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'gpt-4o' | 'gpt-4o-mini';
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
}

interface ChatCompletionChoice {
  index: number;
  // Response messages always carry plain string content (built from result.text)
  message: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  };
  finish_reason: 'stop' | 'length' | 'content_filter';
}

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface ChatCompletionOutput {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: Usage;
}

/**
 * Convert OpenAI-style chat messages into Vercel AI SDK CoreMessages.
 * Handles plain-string content as well as the multimodal array form
 * (text + image_url) so Gemini's multimodal models can consume them.
 */
function toCoreMessages(messages: ChatMessage[]): CoreMessage[] {
  return messages.map((msg): CoreMessage => {
    // Plain string content
    if (typeof msg.content === 'string') {
      if (msg.role === 'system') {
        return { role: 'system', content: msg.content };
      }
      if (msg.role === 'assistant') {
        return { role: 'assistant', content: msg.content };
      }
      return { role: 'user', content: msg.content };
    }

    // Multimodal array content — map image_url -> image, text -> text.
    // System messages cannot carry parts; collapse to text.
    const textOnly = msg.content
      .map((part) => (part.type === 'text' ? part.text ?? '' : ''))
      .join('');

    if (msg.role === 'system') {
      return { role: 'system', content: textOnly };
    }

    if (msg.role === 'assistant') {
      // Assistant parts only support text in this helper's usage.
      return { role: 'assistant', content: textOnly };
    }

    const parts = msg.content.map((part) => {
      if (part.type === 'image_url' && part.image_url?.url) {
        return { type: 'image' as const, image: part.image_url.url };
      }
      return { type: 'text' as const, text: part.text ?? '' };
    });

    return { role: 'user', content: parts };
  });
}

/**
 * Create a chat completion (migrated to Google Gemini via the Vercel AI SDK).
 * Returns the same OpenAI-shaped ChatCompletionOutput so callers that read
 * `choices[0].message.content` / `usage` keep working unchanged.
 */
export async function createChatCompletion(params: ChatCompletionInput): Promise<ChatCompletionOutput> {
  try {
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      messages: toCoreMessages(params.messages),
      temperature: params.temperature,
      maxOutputTokens: params.max_tokens,
      topP: params.top_p,
      stopSequences:
        params.stop === undefined
          ? undefined
          : Array.isArray(params.stop)
            ? params.stop
            : [params.stop],
    });

    const finishReason: ChatCompletionChoice['finish_reason'] =
      result.finishReason === 'length'
        ? 'length'
        : result.finishReason === 'content-filter'
          ? 'content_filter'
          : 'stop';

    // Reconstruct the OpenAI-compatible response shape callers expect.
    return {
      id: result.response?.id ?? `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.response?.modelId ?? 'gemini-2.5-flash',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.text,
          },
          finish_reason: finishReason,
        },
      ],
      usage: {
        prompt_tokens: result.usage?.inputTokens ?? 0,
        completion_tokens: result.usage?.outputTokens ?? 0,
        total_tokens: result.usage?.totalTokens ?? 0,
      },
    };
  } catch (error) {
    console.error('createChatCompletion error:', error);
    throw error;
  }
}

/**
 * Helper function specifically for generating YouTube title variations
 */
export async function generateYouTubeTitles(
  originalTitle: string,
  numberOfVariations: number = 5,
  model: ChatCompletionInput['model'] = 'gpt-4o-mini'
): Promise<string[]> {
  try {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a YouTube title optimization expert. Generate ${numberOfVariations} catchy, click-worthy variations of the given title. Each variation should:
1. Be engaging and attention-grabbing
2. Maintain the core message of the original
3. Use power words and emotional hooks
4. Be between 40-60 characters for optimal display
5. Include relevant keywords for SEO

Return only the titles, one per line, without numbering or bullets.`
      },
      {
        role: 'user',
        content: `Original title: "${originalTitle}"`
      }
    ];

    const completion = await createChatCompletion({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 300,
      n: 1
    });

    const generatedText = completion.choices[0]?.message?.content || '';
    const titles = generatedText
      .split('\n')
      .map(title => title.trim())
      .filter(title => title.length > 0)
      .slice(0, numberOfVariations);

    return titles;
  } catch (error) {
    console.error('generateYouTubeTitles error:', error);
    throw new Error(`Failed to generate YouTube titles: ${error}`);
  }
}

/**
 * Analyze an image and create a detailed description for recreation
 * Uses OpenAI Vision to understand the image content and style
 */
export async function analyzeImageForRecreation(
  imageUrl: string,
  userPrompt?: string,
  recreationStyle?: 'similar' | 'improved' | 'style-transfer'
): Promise<string> {
  try {
    // Create style-specific analysis instructions
    const styleInstructions = {
      similar: 'Focus on maintaining the exact same visual style, colors, composition, and elements.',
      improved: 'Focus on identifying areas for quality enhancement while preserving the core design.',
      'style-transfer': 'Focus on the core concept and elements that can be adapted to a modern style.'
    };

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert graphic designer analyzing thumbnails for recreation. Your task is to create a detailed description that will help generate a new thumbnail based on the uploaded image.

Analyze the image and provide:
1. Main subject/focal point
2. Color scheme and palette
3. Text elements and typography style
4. Background elements and style
5. Overall composition and layout
6. Visual style (modern, vintage, minimalist, etc.)
7. Mood and atmosphere

${recreationStyle ? styleInstructions[recreationStyle] : ''}

Provide a comprehensive description that an AI image generator can use to recreate this thumbnail accurately.`
      },
      {
        role: 'user', 
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: userPrompt ? 
              `Please analyze this thumbnail image for recreation. User's additional instructions: "${userPrompt}"` :
              'Please analyze this thumbnail image for recreation.'
          }
        ]
      }
    ];

    const completion = await createChatCompletion({
      model: 'gpt-4o', // Use GPT-4o for vision capabilities
      messages,
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_tokens: 500
    });

    const analysis = completion.choices[0]?.message?.content as string || '';
    
    if (!analysis) {
      throw new Error('No analysis received from OpenAI Vision');
    }

    return analysis;
  } catch (error) {
    console.error('analyzeImageForRecreation error:', error);
    throw new Error(`Failed to analyze image for recreation: ${error}`);
  }
}