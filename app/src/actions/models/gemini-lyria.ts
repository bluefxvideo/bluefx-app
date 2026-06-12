'use server';

/**
 * Google Lyria 3 Pro via the Gemini API — full-length music generation.
 * Synchronous: the track comes back in the generateContent response (~20-40s),
 * so no webhooks/polling are needed. Output is MP3 (44.1kHz stereo, SynthID
 * watermarked). Uses the same GOOGLE_GENERATIVE_AI_API_KEY as the text models.
 *
 * Verified live 2026-06-12: lyria-3-pro-preview returned a ~1.4MB MP3 in ~21s.
 */

import { uploadImageToStorage } from '@/actions/supabase-storage';

const LYRIA_MODEL = 'lyria-3-pro-preview';

export async function generateLyriaInstrumental(prompt: string): Promise<{
  success: boolean;
  audioUrl?: string;
  error?: string;
}> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return { success: false, error: 'Google AI key not configured' };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${LYRIA_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['AUDIO'] },
        }),
        // Pro typically responds in ~20-40s; hard-stop well before infra limits.
        signal: AbortSignal.timeout(110_000),
      }
    );

    if (!res.ok) {
      const t = await res.text();
      console.error('🚨 Lyria API error:', res.status, t.slice(0, 300));
      // Safety-filter blocks come back as 4xx with an explanation — surface a friendly message.
      const friendly = res.status === 400 && /safety|blocked/i.test(t)
        ? 'That description was blocked by the music safety filter — try rephrasing (avoid artist names or copyrighted songs).'
        : `Music generation failed (${res.status}). Please try again.`;
      return { success: false, error: friendly };
    }

    const json = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
    };
    const audioPart = json.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data && (p.inlineData.mimeType || '').startsWith('audio/')
    );
    if (!audioPart?.inlineData?.data) {
      return { success: false, error: 'No audio returned — please try again.' };
    }

    // Persist to our storage (the response is inline base64, not a URL)
    const bytes = Buffer.from(audioPart.inlineData.data, 'base64');
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const upload = await uploadImageToStorage(blob, {
      bucket: 'audio', // the images bucket whitelists image/* only — audio/mpeg lives here
      folder: 'music',
      filename: `lyria_${crypto.randomUUID()}.mp3`,
      contentType: 'audio/mpeg',
    });

    if (!upload.success || !upload.url) {
      return { success: false, error: upload.error || 'Failed to save the generated track.' };
    }

    console.log(`🎵 Lyria 3 Pro track generated (${Math.round(bytes.length / 1024)} KB) → ${upload.url}`);
    return { success: true, audioUrl: upload.url };
  } catch (error) {
    console.error('🚨 Lyria generation error:', error);
    const msg = error instanceof Error && error.name === 'TimeoutError'
      ? 'Music generation took too long — please try again.'
      : 'Music generation failed. Please try again.';
    return { success: false, error: msg };
  }
}
