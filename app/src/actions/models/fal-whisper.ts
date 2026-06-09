'use server';

/**
 * Speech-to-text via fal.ai Whisper (fal-ai/whisper) — replaces OpenAI whisper-1.
 * Takes a public audio URL and returns the full transcript plus word-level timings
 * (chunk_level: 'word'). Synchronous fal.run call.
 */

export interface FalWhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface FalWhisperResult {
  success: boolean;
  text: string;
  words: FalWhisperWord[];
  error?: string;
}

export async function transcribeWithFalWhisper(
  audioUrl: string,
  language: string = 'en',
): Promise<FalWhisperResult> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) return { success: false, text: '', words: [], error: 'FAL_KEY not configured' };

  try {
    const res = await fetch('https://fal.run/fal-ai/whisper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${falKey}` },
      body: JSON.stringify({
        audio_url: audioUrl,
        task: 'transcribe',
        chunk_level: 'word', // word-level timestamps
        language,
        version: '3',
      }),
      signal: AbortSignal.timeout(180_000), // transcription of long audio can be slow
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('🚨 fal whisper error:', res.status, t.slice(0, 200));
      return { success: false, text: '', words: [], error: `fal whisper ${res.status}: ${t.slice(0, 150)}` };
    }

    const json = await res.json() as { text?: string; chunks?: Array<{ timestamp?: [number, number]; text?: string }> };
    const words: FalWhisperWord[] = (json.chunks || [])
      .filter(c => Array.isArray(c.timestamp) && c.timestamp.length === 2)
      .map(c => ({
        word: (c.text || '').trim(),
        start: c.timestamp![0] ?? 0,
        end: c.timestamp![1] ?? 0,
      }))
      .filter(w => w.word.length > 0);

    return { success: true, text: json.text || '', words };
  } catch (error) {
    console.error('🚨 fal whisper exception:', error);
    return { success: false, text: '', words: [], error: error instanceof Error ? error.message : 'fal whisper failed' };
  }
}
