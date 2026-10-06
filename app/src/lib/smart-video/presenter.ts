import { usage } from './usage';

/**
 * The person who opens a free video ad and says its first line on camera, with their own voice and lips (owner
 * 2026-10-06: "the UGC / person in the video is the coolest", "ultra is good, ... just the intro?", "no lip
 * movement!!!" about a silent clip, and "let first the script be ready"). A small call casts a person who fits the
 * business and GPT Image 2.5 makes their photo while the director writes the script; once the script is ready,
 * LTX 2.3 Fast (the AI Avatar "Fast" engine) makes them say scene 1 word for word, with their own voice. The owner
 * picked it on 2026-10-06 from a race on the same photo and line: Kling O3 Pro 145 s / $0.70, LTX 2.5 Pro 46 s /
 * $1.02, LTX 2.5 Fast 33 s / $0.78, LTX 2.3 Fast 42 s / $0.24, all with good lip sync. Every step can fail: the
 * narrator then says scene 1 as usual.
 */

/** The asset id the presenter's clip goes under. */
export const PRESENTER_ASSET = 'presenter';

const WRITER_MODEL = 'gemini-3.6-flash';
const PHOTO_MODEL = 'openai/gpt-image-2.5/flare/text-to-image';
const CLIP_MODEL = 'fal-ai/ltx-2.3/image-to-video/fast';
/** The clip engine's lengths (seconds, even only) and the pace a person speaks the line at. */
const CLIP_MIN = 6;
const CLIP_MAX = 8;
const WORDS_PER_SECOND = 2.6;
const CLIP_TIMEOUT_MS = 4 * 60_000;

function key(name: 'FAL_KEY' | 'GOOGLE_GENERATIVE_AI_API_KEY'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not configured`);
  return value;
}

/** The person who opens the video, cast from the website text: one sentence describing their photo (about $0.002). */
export async function castPersona(brief: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${WRITER_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key('GOOGLE_GENERATIVE_AI_API_KEY') },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `A short video ad for this business opens with a friendly person talking to the camera, like a creator on social media. Cast them: the kind of person this business's customers would trust, filmed in a natural everyday place (in their car, at home, on the street outside, at work). Never the business owner, never a celebrity.

Answer JSON only: {"photo": "one sentence describing the photo: gender, age, look, clothes and the place, a vertical smartphone selfie or a phone on a stand at chest height, looking straight into the lens, mouth closed, relaxed smile"}

The business (from its website):
${brief.slice(0, 4000)}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`${WRITER_MODEL} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  usage.presenterPersona();
  const json = await res.json();
  const photo = String(JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text || '{}').photo || '').trim();
  if (!photo) throw new Error('no presenter was cast');
  return photo;
}

/** The presenter's vertical photo (about $0.04). */
export async function castPresenter(photo: string): Promise<Buffer> {
  const res = await fetch(`https://fal.run/${PHOTO_MODEL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${key('FAL_KEY')}` },
    body: JSON.stringify({
      prompt: `Photorealistic vertical smartphone photo, UGC style, natural light, realistic skin texture, slightly imperfect framing: ${photo} Nothing written anywhere, no text, no logos, no watermark.`,
      quality: 'high',
      image_size: { width: 1088, height: 1920 },
      output_format: 'jpeg',
      num_images: 1,
    }),
    signal: AbortSignal.timeout(150_000),
  });
  if (!res.ok) throw new Error(`Presenter photo failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  usage.presenterPhoto();
  return Buffer.from(await (await fetch(json.images[0].url)).arrayBuffer());
}

/** The longest scene 1 the presenter says; a longer one stays with the narrator. */
export const PRESENTER_MAX_WORDS = 16;

/** The clip length for a line: the engine takes whole seconds. */
export function clipSecondsFor(line: string): number {
  const words = line.split(/\s+/).filter(Boolean).length;
  const seconds = Math.min(CLIP_MAX, Math.max(CLIP_MIN, Math.ceil(words / WORDS_PER_SECOND + 1.2)));
  return seconds % 2 ? seconds + 1 : seconds;
}

/** The presenter saying the line, with their own voice (LTX 2.3 Fast with sound, 1080p, $0.04 a second). */
export async function talkingPresenter(photo: Buffer, line: string): Promise<Buffer> {
  const seconds = clipSecondsFor(line);
  const headers = { 'Content-Type': 'application/json', Authorization: `Key ${key('FAL_KEY')}` };
  const prompt = [
    'The person in the image looks straight into the camera and speaks clearly to the viewer at a natural conversational pace, steady framing, subtle natural head movement.',
    `They say: "${line.replace(/"/g, "'")}"`,
    "Audio: only the person's voice with natural room ambience, no background music, no soundtrack, no melody.",
    'No captions, no subtitles, no on-screen text, no logos.',
  ].join(' ');
  const submit = await fetch(`https://queue.fal.run/${CLIP_MODEL}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, image_url: `data:image/jpeg;base64,${photo.toString('base64')}`, duration: seconds, resolution: '1080p', aspect_ratio: '9:16', fps: 25, generate_audio: true }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!submit.ok) throw new Error(`Presenter clip submit failed (${submit.status}): ${(await submit.text()).slice(0, 200)}`);
  const { status_url: statusUrl, response_url: responseUrl } = await submit.json();
  const deadline = Date.now() + CLIP_TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline) throw new Error('Presenter clip took too long');
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const status = await (await fetch(statusUrl, { headers, signal: AbortSignal.timeout(30_000) })).json();
    if (status.status === 'COMPLETED') break;
    if (status.status === 'FAILED' || status.error) throw new Error(`Presenter clip failed: ${JSON.stringify(status).slice(0, 200)}`);
  }
  const result = await (await fetch(responseUrl, { headers, signal: AbortSignal.timeout(30_000) })).json();
  if (!result.video?.url) throw new Error('Presenter clip came back without a video');
  usage.presenterClip(seconds);
  return Buffer.from(await (await fetch(result.video.url)).arrayBuffer());
}
