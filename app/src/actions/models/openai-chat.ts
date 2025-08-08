'use server';

/**
 * Generated from: OpenAI API
 * Base URL: https://api.openai.com/v1
 * Purpose: Generate YouTube title variations using OpenAI's chat completions
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
  message: ChatMessage;
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
 * Create a chat completion for generating YouTube title variations
 */
export async function createChatCompletion(params: ChatCompletionInput): Promise<ChatCompletionOutput> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API Error ${response.status}: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    return await response.json();
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