import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { openai } from '@ai-sdk/openai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    keyword,
  }: {
    messages: UIMessage[];
    keyword: any;
  } = await req.json();

  // Build system message with keyword data if provided
  const systemMessage = keyword ? `You are an expert SEO and keyword analyst. Analyze the following keyword data and provide detailed insights:

Keyword: ${keyword?.keyword || 'N/A'}
Search Volume: ${keyword?.search_volume?.toLocaleString() || 'N/A'} monthly searches
SEO Difficulty: ${keyword?.difficulty_score || 'N/A'}/100 (${
    keyword?.difficulty_score && keyword.difficulty_score > 80
      ? 'Very High'
      : keyword?.difficulty_score && keyword.difficulty_score > 60
      ? 'High'
      : keyword?.difficulty_score && keyword.difficulty_score > 40
      ? 'Medium'
      : 'Low'
  })
Trend: ${
    keyword?.trend_status === 'up' || keyword?.trend_status === 'rising'
      ? 'Rising'
      : keyword?.trend_status === 'down' || keyword?.trend_status === 'declining'
      ? 'Declining'
      : 'Stable'
  }
CPC: ${keyword?.cost_per_click ? `$${keyword.cost_per_click.toFixed(2)}` : 'N/A'}
Intent: ${keyword?.search_intent || 'Unknown'}
Competition Level: ${keyword?.competition_level || 'Unknown'}

Provide a comprehensive analysis covering:
1. Search intent and user behavior
2. Competition level analysis
3. Content optimization strategies
4. Related keywords and topics
5. Platform-specific optimization tips

Make your response detailed, actionable, and formatted with clear sections.`
  : 'You are a helpful assistant that can answer questions and help with tasks';

  const result = streamText({
    model: openai('gpt-4o'),
    messages: convertToModelMessages(messages),
    system: systemMessage,
    temperature: 0.7,
    maxTokens: 1000,
  });

  return result.toUIMessageStreamResponse();
}