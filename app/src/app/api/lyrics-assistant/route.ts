import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { openai } from '@ai-sdk/openai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      messages,
      musicStyle,
      currentLyrics,
    }: {
      messages: UIMessage[];
      musicStyle?: string;
      currentLyrics?: string;
    } = body;

    // Build context-aware system message for songwriting
    let systemMessage = `You are a professional songwriter assistant. Help users write song lyrics.

IMPORTANT RULES:
- Match the requested mood, genre, and theme
- Use proper song structure tags: [Verse], [Chorus], [Bridge], [Intro], [Outro]
- Keep lines singable - not too wordy, with natural rhythm
- Create rhymes where appropriate but don't force them
- Be creative but follow user direction closely
- When asked to modify specific lines, provide alternatives while keeping the overall context
- Respond with JUST the lyrics/lines requested - no explanations unless the user asks "why" or "explain"
- Keep responses concise and focused on the lyrics`;

    // Add music style context if provided
    if (musicStyle) {
      systemMessage += `\n\nThe user is writing a ${musicStyle} song. Match the lyrical style and vocabulary to this genre.`;
    }

    // Add current lyrics context if provided
    if (currentLyrics && currentLyrics.trim().length > 0) {
      systemMessage += `\n\nCurrent lyrics being worked on:\n"""${currentLyrics}"""\n\nUse this context to maintain consistency in theme, style, and rhyme patterns.`;
    }

    const result = streamText({
      model: openai('gpt-4o'),
      messages: convertToModelMessages(messages),
      system: systemMessage,
      temperature: 0.8,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Lyrics assistant error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate lyrics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
