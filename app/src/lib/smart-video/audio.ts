import { usage } from './usage';

/**
 * Smart Video — voice, word timings, music and the optional signature sound.
 * Voice casting was tested head-to-head (2026-09-19, Romanian): Gemini TTS
 * "Laomedeia" beat ElevenLabs v3/v2 and MiniMax 2.8 on accent and pacing.
 */

const TTS_MODEL = 'gemini-3.1-flash-tts-preview';
const MUSIC_MODEL = 'lyria-3.5';
const VOICES = { female: 'Laomedeia', male: 'Charon' } as const;

function googleKey(): string {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error('Google AI key not configured');
  return key;
}

async function gemini(model: string, body: unknown, timeoutMs: number) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': googleKey() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${model} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function inlineAudio(json: any): { data: Buffer; mimeType: string } {
  for (const part of json.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData?.mimeType?.startsWith('audio/')) {
      return { data: Buffer.from(part.inlineData.data, 'base64'), mimeType: part.inlineData.mimeType };
    }
  }
  throw new Error('No audio in the response');
}

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function generateVoice(
  narration: string[],
  languageName: string,
  voice: { gender: 'female' | 'male'; direction: string }
): Promise<{ wav: Buffer; durationSeconds: number }> {
  const prompt =
    `Read the transcript below aloud in ${languageName}, as a native speaker. ` +
    `Delivery: ${voice.direction} Natural pace, clear diction, a short breath between paragraphs. ` +
    `Speak ONLY the transcript.\n\nTRANSCRIPT:\n${narration.join('\n')}`;
  const json = await gemini(
    TTS_MODEL,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[voice.gender] } } },
      },
    },
    180_000
  );
  const { data, mimeType } = inlineAudio(json);
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] || 24000);
  const durationSeconds = data.length / 2 / rate;
  usage.voice(json.usageMetadata, durationSeconds);
  return { wav: pcmToWav(data, rate), durationSeconds };
}

// Beds the music model never refuses, used when the director's prompt is blocked.
const SAFE_MUSIC: Record<string, string> = {
  playful: '120 BPM, bouncy instrumental bed. Instruments: ukulele, glockenspiel, pizzicato strings, hand claps, light kick drum. Attitude: happy, friendly, playful.',
  elegant: '84 BPM, elegant instrumental bed. Instruments: grand piano, soft strings, warm cello, light harp. Attitude: refined, calm, luxurious.',
  bold: '126 BPM, driving instrumental bed. Instruments: punchy drums, synth bass, electric guitar stabs, claps. Attitude: energetic, confident, motivating.',
  clean: '104 BPM, light instrumental bed. Instruments: muted guitar plucks, soft piano, finger snaps, warm bass. Attitude: optimistic, friendly, tidy.',
};
const MUSIC_RULES = ' Steady energy, no build-ups, no drops. No vocals. Sits under a voice-over. About 60 seconds.';

export async function generateMusic(prompt: string, style: string): Promise<Buffer> {
  const attempts = [prompt, prompt, (SAFE_MUSIC[style] || SAFE_MUSIC.clean) + MUSIC_RULES];
  let lastError: unknown;
  for (const text of attempts) {
    try {
      const json = await gemini(MUSIC_MODEL, { contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'] } }, 240_000);
      const audio = inlineAudio(json).data;
      usage.music();
      return audio;
    } catch (error) {
      lastError = error;
      console.warn('⚠️ Music attempt failed:', String(error).slice(0, 120));
    }
  }
  throw lastError;
}

function falKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL key not configured');
  return key;
}

async function fal(model: string, body: unknown) {
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${falKey()}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) throw new Error(`${model} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export async function generateSound(prompt: string, seconds = 1.4): Promise<Buffer> {
  const json = await fal('fal-ai/elevenlabs/sound-effects/v2', {
    text: `${prompt}, clean close recording, no background noise, no voices`,
    duration_seconds: seconds,
    prompt_influence: 0.6,
    output_format: 'mp3_44100_128',
  });
  usage.sound(seconds);
  return Buffer.from(await (await fetch(json.audio.url)).arrayBuffer());
}

export interface SpokenWord {
  text: string;
  start: number;
  end: number;
}

/** Word-level timings of the generated voice (ElevenLabs Scribe; strong on small languages). */
export async function transcribeWords(wav: Buffer, iso6391: string): Promise<SpokenWord[]> {
  const json = await fal('fal-ai/elevenlabs/speech-to-text', {
    audio_url: `data:audio/wav;base64,${wav.toString('base64')}`,
    language_code: iso6391,
    diarize: false,
    tag_audio_events: false,
  });
  usage.transcript(wav.length / 48000);
  return (json.words || [])
    .filter((w: { type?: string }) => !w.type || w.type === 'word')
    .map((w: { text: string; start: number; end: number }) => ({ text: w.text, start: w.start, end: w.end }));
}

/** Removes the background of a product photo (fal BiRefNet); returns a transparent PNG. */
export async function cutOutProduct(image: Buffer, mimeType: string): Promise<Buffer> {
  const json = await fal('fal-ai/birefnet/v2', {
    image_url: `data:${mimeType};base64,${image.toString('base64')}`,
    model: 'General Use (Heavy)',
    operating_resolution: '2048x2048',
    output_format: 'png',
    refine_foreground: true,
  });
  usage.cutout();
  return Buffer.from(await (await fetch(json.image.url)).arrayBuffer());
}

/** A new vertical photo of the client's real product in use, generated from its packshot. */
export async function generateLifestyleShot(packshot: Buffer, mimeType: string, prompt: string): Promise<Buffer> {
  const json = await fal('fal-ai/nano-banana-2/edit', {
    prompt: `${prompt} The product must be exactly the one in the reference image: same shape, colours, proportions and details. Natural candid photo, no text, no logos, no watermarks.`,
    image_urls: [`data:${mimeType};base64,${packshot.toString('base64')}`],
    aspect_ratio: '9:16',
    resolution: '1K',
    output_format: 'jpeg',
  });
  usage.lifestyleShot();
  return Buffer.from(await (await fetch(json.images[0].url)).arrayBuffer());
}

export const MOTION_CLIP_SECONDS = 6; // the model's shortest clip

/** Turns a vertical still into a short moving clip (fal LTX 2.3 Fast, queue API). Returns the MP4. */
export async function animatePhoto(image: Buffer, prompt: string): Promise<Buffer> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Key ${falKey()}` };
  const submit = await fetch('https://queue.fal.run/fal-ai/ltx-2.3/image-to-video/fast', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      image_url: `data:image/jpeg;base64,${image.toString('base64')}`,
      prompt: `${prompt} Smooth, slow, steady cinematic camera movement. Photorealistic, the scene stays exactly as in the image, no new objects, no text.`,
      duration: MOTION_CLIP_SECONDS,
      resolution: '1080p',
      aspect_ratio: '9:16',
      fps: 25,
      generate_audio: false,
    }),
  });
  if (!submit.ok) throw new Error(`Animation submit failed (${submit.status}): ${(await submit.text()).slice(0, 200)}`);
  const { status_url, response_url } = await submit.json();
  for (let waited = 0; waited < 300; waited += 4) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const status = await (await fetch(status_url, { headers })).json();
    if (status.status === 'COMPLETED') {
      const result = await (await fetch(response_url, { headers })).json();
      usage.motion(MOTION_CLIP_SECONDS);
      return Buffer.from(await (await fetch(result.video.url)).arrayBuffer());
    }
    if (status.status === 'FAILED') throw new Error('Animation failed');
  }
  throw new Error('Animation timed out');
}
