import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { google } from '@ai-sdk/google';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      messages,
      transcript,
      videoTitle,
      referenceImageUrls,
    }: {
      messages: UIMessage[];
      transcript?: string;
      videoTitle?: string;
      referenceImageUrls?: string[];
    } = body;

    const referenceImageCount = referenceImageUrls?.length ?? 0;
    const hasRefs = referenceImageCount > 0;

    const systemMessage = `You are a viral YouTube thumbnail strategist who creates high-CTR thumbnail concepts optimized for AI image generation.

${videoTitle ? `Video title: ${videoTitle}` : ''}

${transcript ? `Video transcript (first 8000 chars): ${transcript.substring(0, 8000)}` : ''}

${hasRefs ? `REFERENCE IMAGES: The user has uploaded ${referenceImageCount} reference image(s) that will be passed to the image generation model alongside the prompt.
CRITICAL RULES FOR REFERENCE IMAGES:
- Do NOT describe the person's physical appearance (age, gender, ethnicity, hair color, body type, clothing) — the reference image defines how the person looks
- NEVER use: man, woman, girl, boy, young, old, blonde, brunette — the reference IS the person
- Only describe: expression (shocked, excited), pose (leaning forward, pointing), and the SCENE (background, lighting, props)
- Use "the person from the reference image" instead of gendered terms — this phrase tells the image model to use the uploaded photo for identity` : ''}

When asked to suggest thumbnail concepts, output ONLY the visual scene description for each concept.

Format each concept like this:

**Concept 1: [Name]**
Text overlay: "[2-4 WORD TEXT IN CAPS]"
Why it works: [brief explanation]
Prompt: [SCENE DESCRIPTION — 15-30 words, comma-separated keywords]

IMPORTANT rules for the Prompt field:
- Use SHORT comma-separated keywords/phrases (tag-soup style), NOT long natural language sentences
- Focus on: subject action, expression, key props, background mood, lighting direction
- Keep it 15-30 words — shorter prompts produce better results
- Do NOT start with "YouTube thumbnail" or include quality keywords like "4k, highly detailed" — added automatically
- Do NOT include any text overlay instructions — text is handled separately via the "Text overlay" field
- Do NOT end with "cinematic lighting, expressive, viral style" — added automatically
${hasRefs ? `- ALWAYS use "the person from the reference image" for any human subject — this phrase is MANDATORY, it tells the image model to match the uploaded photo
- NEVER use just "the person", "a man", or "a woman" — always include "from the reference image"
- Do NOT describe the person's appearance at all — only their expression and pose` : ''}

${hasRefs ? `Example GOOD prompt: "the person from the reference image, shocked expression, mouth open, leaning toward camera, pointing at glowing laptop, dramatic blue rim light from behind, dark moody background with purple gradient"

Example BAD prompt: "the person, shocked expression, mouth open" — MISSING "from the reference image", the model won't use the uploaded photo
Example ALSO BAD: "A young woman with long brown hair leaning toward the camera" — describes appearance, overrides the reference` : `Example GOOD prompt: "man leaning toward camera, wide eyes, mouth open in shock, glowing laptop beside him, dramatic blue rim light from behind, warm orange key light from left, dark moody background, purple gradient"

Example BAD prompt: "YouTube thumbnail, catchy, 4k, highly detailed, a man looking at phone, bold text reading WHAT, cinematic lighting, viral style"`}

Rules for text overlay:
- MUST be 2-4 words maximum (shorter = better)
- Write in ALL CAPS
- This is a SEPARATE field from the prompt — never put text instructions inside the prompt

When the user asks to modify a concept, provide the updated version in the same format.
Keep responses focused and concise.`;

    // Convert chat messages and inject reference images if present
    const modelMessages = convertToModelMessages(messages);

    console.log(`[concept-chat] referenceImageUrls: ${referenceImageUrls?.length ?? 0}`);

    if (hasRefs && referenceImageUrls) {
      const firstUserMsg = modelMessages.find(m => m.role === 'user');
      console.log(`[concept-chat] Injecting ${referenceImageUrls.length} image(s) into first user message`);
      if (firstUserMsg) {
        const existingContent = Array.isArray(firstUserMsg.content)
          ? firstUserMsg.content
          : [{ type: 'text' as const, text: firstUserMsg.content }];

        firstUserMsg.content = [
          ...referenceImageUrls.slice(0, 5).map(url => ({
            type: 'image' as const,
            image: new URL(url),
          })),
          ...existingContent,
        ];
      }
    }

    const result = streamText({
      model: google('gemini-3-flash-preview'),
      messages: modelMessages,
      system: systemMessage,
      temperature: 0.7,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Thumbnail concepts chat error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate concepts' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
