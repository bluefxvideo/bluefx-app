'use server';

import { OpenAI } from 'openai';

export interface KeywordAnalysisRequest {
  keyword: {
    keyword: string;
    search_volume: number | null;
    difficulty_score: number | null;
    competition_level: string | null;
    cost_per_click: number | null;
    trend_status?: string;
    search_intent?: string;
  };
  messages?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

export interface KeywordAnalysisResponse {
  success: boolean;
  content?: string;
  error?: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeKeyword(
  request: KeywordAnalysisRequest
): Promise<KeywordAnalysisResponse> {
  try {
    const { keyword, messages = [] } = request;

    // Build the system prompt with keyword data
    const systemPrompt = {
      role: 'system' as const,
      content: `You are an expert SEO and keyword analyst. Analyze the following keyword data and provide detailed insights:

Keyword: ${keyword.keyword}
Search Volume: ${keyword.search_volume?.toLocaleString() || 'N/A'} monthly searches
SEO Difficulty: ${keyword.difficulty_score || 'N/A'}/100 (${
        keyword.difficulty_score && keyword.difficulty_score > 80
          ? 'Very High'
          : keyword.difficulty_score && keyword.difficulty_score > 60
          ? 'High'
          : keyword.difficulty_score && keyword.difficulty_score > 40
          ? 'Medium'
          : 'Low'
      })
Trend: ${
        keyword.trend_status === 'up' || keyword.trend_status === 'rising'
          ? 'Rising'
          : keyword.trend_status === 'down' || keyword.trend_status === 'declining'
          ? 'Declining'
          : 'Stable'
      }
CPC: ${keyword.cost_per_click ? `$${keyword.cost_per_click.toFixed(2)}` : 'N/A'}
Intent: ${keyword.search_intent || 'Unknown'}
Competition Level: ${keyword.competition_level || 'Unknown'}

Provide a comprehensive analysis covering:
1. Search intent and user behavior
2. Competition level analysis
3. Content optimization strategies
4. Related keywords and topics
5. Platform-specific optimization tips

Make your response detailed, actionable, and formatted with clear sections.`
    };

    // Prepare messages for OpenAI
    const openaiMessages = [systemPrompt, ...messages];

    // If this is the initial request (no user messages), add a prompt
    if (messages.length === 0) {
      openaiMessages.push({
        role: 'user' as const,
        content: 'Please provide a comprehensive analysis of this keyword.'
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: 'No response from AI'
      };
    }

    return {
      success: true,
      content
    };
  } catch (error) {
    console.error('Keyword analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    };
  }
}

export async function streamKeywordAnalysis(
  request: KeywordAnalysisRequest
): Promise<ReadableStream<Uint8Array>> {
  const { keyword, messages = [] } = request;

  // Build the system prompt with keyword data
  const systemPrompt = {
    role: 'system' as const,
    content: `You are an expert SEO and keyword analyst. Analyze the following keyword data and provide detailed insights:

Keyword: ${keyword.keyword}
Search Volume: ${keyword.search_volume?.toLocaleString() || 'N/A'} monthly searches
SEO Difficulty: ${keyword.difficulty_score || 'N/A'}/100 (${
      keyword.difficulty_score && keyword.difficulty_score > 80
        ? 'Very High'
        : keyword.difficulty_score && keyword.difficulty_score > 60
        ? 'High'
        : keyword.difficulty_score && keyword.difficulty_score > 40
        ? 'Medium'
        : 'Low'
    })
Trend: ${
      keyword.trend_status === 'up' || keyword.trend_status === 'rising'
        ? 'Rising'
        : keyword.trend_status === 'down' || keyword.trend_status === 'declining'
        ? 'Declining'
        : 'Stable'
    }
CPC: ${keyword.cost_per_click ? `$${keyword.cost_per_click.toFixed(2)}` : 'N/A'}
Intent: ${keyword.search_intent || 'Unknown'}
Competition Level: ${keyword.competition_level || 'Unknown'}

Provide a comprehensive analysis covering:
1. Search intent and user behavior
2. Competition level analysis
3. Content optimization strategies
4. Related keywords and topics
5. Platform-specific optimization tips

Make your response detailed, actionable, and formatted with clear sections.`
  };

  // Prepare messages for OpenAI
  const openaiMessages = [systemPrompt, ...messages];

  // If this is the initial request (no user messages), add a prompt
  if (messages.length === 0) {
    openaiMessages.push({
      role: 'user' as const,
      content: 'Please provide a comprehensive analysis of this keyword.'
    });
  }

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: openaiMessages,
    temperature: 0.7,
    max_tokens: 1000,
    stream: true,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}