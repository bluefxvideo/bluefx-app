import { animatePhoto, MOTION_CLIP_SECONDS } from './audio';
import { cropToFrame } from './brand';
import type { DirectorPlan } from './types';
import { usage } from './usage';

/**
 * The person who opens a video (owner 2026-10-06, for the free video funnel: "the UGC / person in the video is the
 * coolest", then "no lipsync, just a short"). A small model casts a person who fits the business, GPT Image 2.5
 * makes their photo, and the photo becomes a short moving clip (a warm look into the camera, a smile, a small nod)
 * that plays under the first line of the voice-over. It needs nothing from the voice, so it is made while the
 * voice and the other clips are made. Every step can fail; the video then keeps its own first scene.
 */

/** The asset id the presenter's clip goes under. */
export const PRESENTER_ASSET = 'presenter';

const PERSONA_MODEL = 'gemini-3.6-flash';
const PHOTO_MODEL = 'openai/gpt-image-2.5/flare/text-to-image';
/** What the person does in the clip: no talking, since the voice-over is not theirs. */
const PRESENTER_MOTION =
  'The person looks warmly into the camera, smiles and gives a small nod, with a little natural head and shoulder movement; mouth closed, not talking. Camera: static. A locked-off shot, the frame does not move. One continuous shot. Photorealistic, the scene stays exactly as in the image, no new objects, no text.';

function key(name: 'FAL_KEY' | 'GOOGLE_GENERATIVE_AI_API_KEY'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not configured`);
  return value;
}

/** One sentence that describes the presenter's photo, cast for this business's own customers. */
async function castPersona(brief: string, plan: DirectorPlan): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${PERSONA_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key('GOOGLE_GENERATIVE_AI_API_KEY') },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `A short video ad for this business opens with a friendly ${plan.voice.gender} person looking into the camera, like a creator on social media. Cast them: the kind of person this business's customers would trust, and a natural everyday place to film (in their car, at home, on the street outside, at work). Never the business owner, never a celebrity.

Answer JSON only: {"photo": "one sentence describing the photo: age, look, clothes and the place, a vertical smartphone selfie or a phone on a stand at chest height, looking straight into the lens, mouth closed, relaxed smile"}

The business (from its website):
${brief.slice(0, 4000)}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${PERSONA_MODEL} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  usage.presenterPersona();
  const json = await res.json();
  const photo = String(JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text || '{}').photo || '').trim();
  if (!photo) throw new Error('no presenter was cast');
  return photo;
}

/** The presenter's vertical photo (about $0.04). */
export async function castPresenter(brief: string, plan: DirectorPlan): Promise<Buffer> {
  const persona = await castPersona(brief, plan);
  console.log(`🎭 Presenter: ${persona}`);
  const res = await fetch(`https://fal.run/${PHOTO_MODEL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${key('FAL_KEY')}` },
    body: JSON.stringify({
      prompt: `Photorealistic vertical smartphone photo, UGC style, natural light, realistic skin texture, slightly imperfect framing: ${persona} Nothing written anywhere, no text, no logos, no watermark.`,
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

/** The presenter's short moving clip: MOTION_CLIP_SECONDS of the photo, still camera (about $0.24). */
export async function animatePresenter(photo: Buffer): Promise<Buffer> {
  const frame = await cropToFrame(photo, '50% 35%', false);
  return animatePhoto(frame, PRESENTER_MOTION, false, MOTION_CLIP_SECONDS, true);
}
