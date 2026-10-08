import { usage } from './usage';

/**
 * The person who opens a free video ad and says its first line on camera, with their own voice and lips (owner
 * 2026-10-06: "the UGC / person in the video is the coolest", "ultra is good, ... just the intro?", "no lip
 * movement!!!" about a silent clip, and "let first the script be ready"). A small call casts a person who fits the
 * business, with a place, a prop and a first-second action (the visual hook: a realtor jingles keys by a SOLD sign, a
 * barber clicks his clippers on), and GPT Image 2.5 makes their photo while the director writes the script; once the
 * script is ready, LTX 2.5 Fast at 720p makes them say scene 1 word for word from the first frame while doing the action,
 * with their own voice.
 * The owner picked it on 2026-10-06 after races on the same photos and lines (Kling O3 Pro 145 s / $0.70; LTX 2.5
 * Fast about 30 s / $0.54 at 720p; LTX 2.3 Fast about 40 s / $0.24 but more slips at the end of a clip). Every step
 * can fail: the narrator then says scene 1 as usual.
 */

/** The asset id the presenter's clip goes under. */
export const PRESENTER_ASSET = 'presenter';

const WRITER_MODEL = 'gemini-3.6-flash';
const PHOTO_MODEL = 'openai/gpt-image-2.5/flare/text-to-image';
const CLIP_MODEL = 'lightricks/ltx-2.5/image-to-video/fast';
/** The clip engine's lengths (6, 8 or 10 s) and the pace a person speaks the line at. */
const CLIP_MIN = 6;
const CLIP_MAX = 8;
const WORDS_PER_SECOND = 2.6;
const CLIP_TIMEOUT_MS = 4 * 60_000;

function key(name: 'FAL_KEY' | 'GOOGLE_GENERATIVE_AI_API_KEY'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not configured`);
  return value;
}

export interface Persona {
  /** One sentence describing the photo: the person, the clothes, the place, the prop and the framing. */
  photo: string;
  /** What the person does while saying the first words: the visual hook. */
  action: string;
}

/** The person who opens the video, cast from the website text: their photo and their first-second action (about $0.002). */
export async function castPersona(brief: string): Promise<Persona> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${WRITER_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key('GOOGLE_GENERATIVE_AI_API_KEY') },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `A short video ad for this business opens with a person talking to the camera, like a creator on social media. Cast them and give them a visual hook for the first second, so a scrolling viewer stops.

- The person: someone this business's customers would trust: a customer enjoying what the business offers, or someone at work in the trade. Never the business owner, never a celebrity. Modest everyday clothes.
- The place: where it happens, so the business is clear at a glance (in their car with the food, at the counter, in the shop, at the job, on the street outside).
- The prop: one thing in their hand or right beside them that shows the business (house keys and a SOLD sign, a taco, hair clippers, a coffee mug at a spotless counter). No words or logos on it, except a short real-world sign like SOLD.
- The action: one small movement they make while they say their first words, from the very first second, never a silent pause before talking: they hold the prop up to the lens, click it on, point at it, take a sip. They keep facing the camera and talk.

Answer JSON only: {"photo": "one sentence describing the photo: gender, age, look, clothes, the place, the prop, a vertical smartphone selfie or a phone on a stand, mouth closed", "action": "one sentence: the movement they make while saying their first words"}

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
  const answer = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
  const photo = String(answer.photo || '').trim();
  const action = String(answer.action || '').trim().slice(0, 300);
  if (!photo) throw new Error('no presenter was cast');
  return { photo, action };
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

/** The presenter doing their action and saying the line, with their own voice (LTX 2.5 Fast with sound, 720p, $0.09 a second). */
export async function talkingPresenter(photo: Buffer, line: string, action = ''): Promise<Buffer> {
  const seconds = clipSecondsFor(line);
  const headers = { 'Content-Type': 'application/json', Authorization: `Key ${key('FAL_KEY')}` };
  // Talking from the first frame while doing the action (owner 2026-10-08 on a 3-clip test: "pretty damn good, all of
  // the videos ... are better"): before, LTX held the action silently for 2-3 s and moved the lips with no sound. A clip
  // that still waits is cut just before its first word in buildProps.
  const prompt = [
    'The person is already talking from the very first frame: the first word starts within the first half second, with no silent pause before it.',
    action ? `While they say the first words: ${action}` : '',
    'They speak clearly to the viewer at a natural conversational pace, looking into the camera, steady framing, subtle natural head movement. They stay in frame and keep facing the camera until the end of the clip.',
    `They say: "${line.replace(/"/g, "'")}"`,
    "Audio: only the person's voice with natural room ambience, no background music, no soundtrack, no melody.",
    'No captions, no subtitles, no on-screen text, no logos.',
  ]
    .filter(Boolean)
    .join(' ');
  const submit = await fetch(`https://queue.fal.run/${CLIP_MODEL}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, image_url: `data:image/jpeg;base64,${photo.toString('base64')}`, duration: seconds, resolution: '720p', aspect_ratio: '9:16', fps: 25, generate_audio: true, camera_motion: 'static' }),
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
