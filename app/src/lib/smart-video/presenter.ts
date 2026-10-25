import { isFalSafetyRefusal } from '@/actions/models/fal-error';
import { ILLUSTRATION_LOOKS } from './audio';
import { isIllustrated } from './types';
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

/**
 * A person drawn at random, so videos do not all open with the same face (owner 2026-10-24: the casting kept picking
 * "a friendly woman in her late 20s" and the photo model drew the same brunette for five styles). The casting judges
 * first who fits this ad (owner: "it can figure out what the best avatar would be for that specific ad") and uses
 * this person only where several kinds of person fit equally. The first pool (all ages, 8 looks, half men) gave three
 * Asian men in a row and plainer faces; the owner wants mostly women in his buyers' looks.
 */
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
export function castingSeed(): string {
  // Owner 2026-10-24 ("why is now every single video a male Asian guy? The woman was much better"): mostly women, the
  // looks of his buyers (small-town US, UK and Australia), mostly 25 to 45. Other looks come from the casting itself
  // when the business calls for them (an Asian restaurant, a senior service).
  const man = Math.random() < 0.3;
  const age = pick(['in their late 20s', 'in their late 20s', 'in their early 30s', 'in their early 30s', 'in their mid 30s', 'in their early 40s', 'in their late 40s']);
  const look = pick(['white', 'white', 'white', 'white', 'white', 'white', 'Black', 'Black', 'Latina or Latino', 'Latina or Latino', 'mixed-race']);
  const detail = pick(
    man
      ? ['short dark hair', 'a neat beard', 'light stubble', 'short brown hair', 'wavy hair', 'short blond hair']
      : ['long brown hair', 'shoulder-length blonde hair', 'dark hair in a ponytail', 'wavy auburn hair', 'long dark hair', 'a sleek bob', 'curly hair']
  );
  return `a ${man ? 'man' : 'woman'} ${age}, ${look}, with ${detail}`;
}

/** The person who opens the video, cast from the website text: their photo and their first-second action (about $0.002). */
export async function castPersona(brief: string): Promise<Persona> {
  const seed = castingSeed();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${WRITER_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key('GOOGLE_GENERATIVE_AI_API_KEY') },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `A short video ad for this business opens with a person talking to the camera, like a creator on social media. Cast them and give them a visual hook for the first second, so a scrolling viewer stops.

- The person: someone this business's customers would trust: a customer enjoying what the business offers, or someone at work in the trade. Never the business owner, never a celebrity. Modest everyday clothes. Judge first who THIS ad's customers would trust most and who looks like them: gender, age and look that fit the business and its offer (a gym-goer for a gym, a retiree for a senior service, a mum for a kids' business, a tradesperson for a trade). When the client's note says who should present, cast exactly that. Cast an Asian person only when the business itself is Asian (an Asian restaurant or shop, or a business that says it serves an Asian community), never for a general business such as a massage studio, a cleaner or an advisor. Where several kinds of person fit equally well, use this person, so videos do not all open with the same face: ${seed}. A friendly, attractive, camera-confident person, like a well-liked social media creator.
- The place: where it happens, so the business is clear at a glance (in their car with the food, at the counter, in the shop, at the job, on the street outside).
- The prop: one thing in their hand or right beside them that shows the business (house keys and a SOLD sign, a taco, hair clippers, a coffee mug at a spotless counter). No words or logos on it, except a short real-world sign like SOLD.
- The action: one small movement they make while they say their first words, from the very first second, never a silent pause before talking: they hold the prop up to the lens, click it on, point at it, take a sip. They keep facing the camera and talk.

Answer JSON only: {"photo": "one sentence describing the photo: gender, age, ethnicity, hair and look exactly as cast, clothes, the place, the prop, a vertical smartphone selfie or a phone on a stand, mouth closed", "action": "one sentence: the movement they make while saying their first words"}

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

/** What the news anchor does in the first second, instead of the casting's prop action (owner 2026-10-24: the news studio look). */
export const ANCHOR_ACTION = 'The anchor looks up from the papers on the desk straight into the camera and starts the report with a warm, confident smile.';

/** The presenter's vertical photo (about $0.04); in a cartoon, comic or vintage video, a person in the pictures' look; in a news video, an anchor at a studio desk. */
export async function castPresenter(photo: string, style?: string | null, horizontal = false): Promise<Buffer> {
  // A wide video (owner 2026-10-24: "why don't the YouTube versions have a presenter?") gets a wide photo and clip.
  const shape = horizontal ? 'horizontal 16:9' : 'vertical';
  const drawn = isIllustrated(style) && ILLUSTRATION_LOOKS[style].drawnPresenter ? ILLUSTRATION_LOOKS[style].look : null;
  const prompt =
    style === 'news'
        ? // The casting note (a selfie in a car with a slice) won over the studio twice, once as a split screen: the anchor is drawn from the casting pool instead.
          `Photorealistic ${shape} still from a local TV news broadcast, one single photograph filling the whole frame (no split screen, no collage, no inset): a friendly, professional news anchor in a smart dark blazer (the anchor is ${castingSeed()}), sitting at a sleek glossy news desk in a modern TV studio with blue and red lighting and a large glowing video wall of a city skyline behind, front-facing medium shot from the chest up, looking straight into the camera with the mouth closed, hands resting on a few papers. Nothing written anywhere, no text, no logos, no channel names, no watermark.`
        : style === 'vintage'
        ? // The owner's favourite sample: a 1950s TV announcer in a suit, in the business, showing what it sells.
          `${ILLUSTRATION_LOOKS.vintage.look} One single ${shape} photograph (no split screen, no collage): a smiling 1950s television commercial announcer, smartly dressed in a suit and tie (a 1950s dress for a woman), neatly styled 1950s hair, standing in the place from this casting note and showing its product or prop with one hand, front-facing medium shot, classic studio lighting, looking at the camera with the mouth closed. Keep the casting note's gender and age; ignore its clothes and camera style: ${photo} Nothing written anywhere, no text, no logos, no watermark.`
        : drawn
        ? `${drawn} A ${shape} picture, front-facing medium shot, the person looking at the camera with the mouth closed, a plain simple background: ${photo} Nothing written anywhere, no text, no logos, no watermark.`
        : `Photorealistic ${horizontal ? 'horizontal 16:9 phone video still, the phone held sideways, the person in the middle of the frame' : 'vertical smartphone photo'}, UGC style, natural light, realistic skin texture, slightly imperfect framing: ${photo} Nothing written anywhere, no text, no logos, no watermark.`;
  const res = await fetch(`https://fal.run/${PHOTO_MODEL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${key('FAL_KEY')}` },
    body: JSON.stringify({
      prompt,
      quality: 'high',
      image_size: horizontal ? { width: 1920, height: 1088 } : { width: 1088, height: 1920 },
      output_format: 'jpeg',
      num_images: 1,
    }),
    signal: AbortSignal.timeout(150_000),
  });
  if (!res.ok) {
    const text = await res.text();
    // GPT Image turns some businesses down (2026-10-25: a CBD shop's presenter, 422 content_policy_violation, and the
    // free video ad went out without its presenter). Nano Banana 2 takes them: the same photo is made there instead.
    if (isFalSafetyRefusal(text)) {
      console.warn('🛟 Presenter photo refused by GPT Image; making it on Nano Banana 2');
      return presenterOnNanoBanana(prompt, horizontal);
    }
    throw new Error(`Presenter photo failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  usage.presenterPhoto();
  return Buffer.from(await (await fetch(json.images[0].url)).arrayBuffer());
}

/** The presenter's photo on Nano Banana 2 (fal), for the photos GPT Image turns down (about $0.08). */
async function presenterOnNanoBanana(prompt: string, horizontal: boolean): Promise<Buffer> {
  const res = await fetch('https://fal.run/fal-ai/nano-banana-2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${key('FAL_KEY')}` },
    body: JSON.stringify({ prompt, aspect_ratio: horizontal ? '16:9' : '9:16', resolution: '1K', output_format: 'jpeg', num_images: 1 }),
    signal: AbortSignal.timeout(150_000),
  });
  if (!res.ok) throw new Error(`Presenter photo failed on Nano Banana 2 too (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  if (!json.images?.[0]?.url) throw new Error('Nano Banana 2 made no presenter photo');
  usage.presenterPhoto();
  return Buffer.from(await (await fetch(json.images[0].url)).arrayBuffer());
}

const EDIT_MODEL = 'openai/gpt-image-2.5/flare/edit';

/**
 * The client's own photo put in the current presenter's place (owner 2026-10-23: "I want to be the exact doctor"): the
 * same place, clothes, pose, prop and framing as the presenter's photo, with the client's face, hair and build. Returns
 * a vertical photo ready to film (about $0.07).
 */
export async function swapIntoPresenter(presenterPhoto: Buffer, person: Buffer, horizontal = false): Promise<Buffer> {
  const dataUri = (data: Buffer) => `data:image/jpeg;base64,${data.toString('base64')}`;
  const res = await fetch(`https://fal.run/${EDIT_MODEL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${key('FAL_KEY')}` },
    body: JSON.stringify({
      prompt:
        'Image 1 is a scene. Image 2 is a real person. Make image 1 again with the person from image 2 in it: their exact face, head shape, hair, skin, age and build, so they are clearly the same person as in image 2. Keep everything else from image 1: the same clothes, pose, hands, framing, place, light and camera. Looking into the camera, mouth closed, a slight smile. Photorealistic, realistic skin texture. Nothing written anywhere: no text, no letters, no logos.',
      image_urls: [dataUri(presenterPhoto), dataUri(person)],
      image_size: horizontal ? { width: 1920, height: 1088 } : { width: 1088, height: 1920 },
      quality: 'high',
      output_format: 'jpeg',
      num_images: 1,
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) throw new Error(`Putting the client in the presenter's place failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  usage.presenterPhoto();
  return Buffer.from(await (await fetch(json.images[0].url)).arrayBuffer());
}

/** A first line too long for the presenter, said again in at most PRESENTER_MAX_WORDS words with the same meaning (about $0.001). Null when the answer is still too long. */
export async function shortenPresenterLine(line: string, brief: string): Promise<string | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${WRITER_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key('GOOGLE_GENERATIVE_AI_API_KEY') },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `This is the first line of a video ad, said on camera by a person. Say it again in at most ${PRESENTER_MAX_WORDS - 2} words, in the same language, with the same meaning and the same facts. Keep it a hook a scrolling viewer stops for. Add nothing that is not in the line.\n\nLINE: ${line}\n\nThe business, for context only:\n${brief.slice(0, 1500)}\n\nAnswer JSON only: {"line": "the shorter line"}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`${WRITER_MODEL} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  usage.presenterPersona();
  const json = await res.json();
  const short = String(JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text || '{}').line || '').trim();
  return short && short.split(/\s+/).length <= PRESENTER_MAX_WORDS ? short : null;
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
export async function talkingPresenter(photo: Buffer, line: string, action = '', style?: string | null, horizontal = false): Promise<Buffer> {
  // A drawn presenter (cartoon, comic) stays drawn: a soft watercolor face came back photoreal (2026-10-24), so keep the style explicit.
  const drawn = isIllustrated(style) && ILLUSTRATION_LOOKS[style].drawnPresenter ? `Keep the exact art style of the image in every frame (${ILLUSTRATION_LOOKS[style].look.split(',')[0].toLowerCase()}): it stays an illustration and never turns into a photo or live action.` : '';
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
    drawn,
    "Audio: only the person's voice with natural room ambience, no background music, no soundtrack, no melody.",
    'No captions, no subtitles, no on-screen text, no logos.',
  ]
    .filter(Boolean)
    .join(' ');
  const submit = await fetch(`https://queue.fal.run/${CLIP_MODEL}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, image_url: `data:image/jpeg;base64,${photo.toString('base64')}`, duration: seconds, resolution: '720p', aspect_ratio: horizontal ? '16:9' : '9:16', fps: 25, generate_audio: true, camera_motion: 'static' }),
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
