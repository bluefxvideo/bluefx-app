import { z } from 'zod';
import { upload } from '@/lib/smart-video/jobs';
import type { SavedPlan } from '@/lib/smart-video/jobs';

/**
 * The next 3 video ads, written for every lead whose free video ad is done (owner 2026-10-19: "your next 3 video ads are
 * already written", shown on the result page and made in their AI Media Machine once they buy). The owner's 3 kinds, the
 * ad types small businesses run most and owners want (testimonial, problem solved, offer; Wyzowl 2026: 57% of video
 * marketers make testimonial videos):
 *   1. the happy customer: a presenter tells a real customer's story, its opening line a real review's own words
 *      (no review on the website: why choose this business),
 *   2. the problem fixer: the customers' biggest problem, then how the business solves it,
 *   3. the reason to act now: the business's real offer, guarantee or free quote (none: its own call to action).
 * Only facts from the website: never a made-up review, price, discount or number. One Gemini call writes the 3 (about
 * $0.002); GPT Image 2.5 then draws each first frame, 4:5, with a made-up presenter and the business's own photo as the
 * reference (owner: "any generated person, like we do these hooks"). About $0.20 a lead.
 */

const WRITER_MODEL = 'gemini-3.6-flash';
const FRAME_EDIT_MODEL = 'openai/gpt-image-2.5/flare/edit';
const FRAME_NEW_MODEL = 'openai/gpt-image-2.5/flare/text-to-image';
/** 4:5, the shape of a feed post and of the cards on the result page. */
const FRAME_SIZE = { width: 1080, height: 1350 };
const PRICES = { writerPerCall: 0.002, framePerImage: 0.065 };

export const NEXT_AD_KINDS = ['happy-customer', 'why-us', 'problem-fixer', 'act-now'] as const;
export type NextAdKind = (typeof NEXT_AD_KINDS)[number];

const IdeaSchema = z.object({
  kind: z.enum(NEXT_AD_KINDS),
  hook: z.string().min(3).max(120),
  highlight: z.string().max(80),
  title: z.string().min(3).max(70),
  quote: z.string().max(240).nullish(),
  customer: z.string().max(60).nullish(),
  brief: z.string().min(40).max(1400),
  photo: z.string().max(20).nullish(),
  frame: z.string().min(20).max(700),
});
const AnswerSchema = z.object({ business: z.string().max(80), ads: z.array(IdeaSchema).length(3) });
export type NextAdIdea = z.infer<typeof IdeaSchema>;

/** One written video ad as the result page shows it and the AI Media Machine makes it after the purchase. */
export interface NextAd extends NextAdIdea {
  /** #2, #3 and #4: the free video ad is #1. */
  n: 2 | 3 | 4;
  /** The first frame, 4:5; null when the drawing failed (the card shows the business's photo instead). */
  imageUrl: string | null;
}

export interface NextAds {
  business: string;
  ads: NextAd[];
  /** What the checks found (a quote that is not on the website, a number the website never says); empty when clean. */
  problems: string[];
  costUsd: number;
  writtenAt: string;
}

function key(name: 'FAL_KEY' | 'GOOGLE_GENERATIVE_AI_API_KEY'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not configured`);
  return value;
}

/** The photos of the business the director saw, by asset id, with what is on each. */
export function photosOf(saved: SavedPlan): { id: string; description: string; url: string }[] {
  const assets = saved.plan?.assets ?? [];
  const media = saved.media?.assets ?? {};
  return assets
    .filter((asset) => (asset.role === 'photo' || asset.role === 'product') && media[asset.id]?.kind === 'image' && media[asset.id]?.url)
    .map((asset) => ({ id: asset.id, description: asset.description, url: media[asset.id].url }));
}

function writerPrompt(domain: string, brief: string, freeLines: string[], photos: { id: string; description: string }[]): string {
  return `You write the next 3 short video ads for a small business. Its first free video ad is already made; these 3 are the next ones the owner gets. Each is a 40-second vertical video ad with a presenter talking to the camera, a voice-over, music and captions. The owner will see each one as a card: the first frame of the video with its opening line on it, and a short title. Make the owner want to see all 3, especially the first.

Write exactly these 3, in this order:

1. "happy-customer": the happy customer. A presenter tells a real customer's story, as that customer. Take it from a real review or testimonial on the website: "hook" is a short quote of that review's OWN words, copied exactly, in the same order (one sentence or the end of one, 4 to 12 words, the strongest praise), "quote" is the full sentence it comes from, copied exactly, and "customer" is the name the website gives (first name and last initial at most), or null. The rest of this ad stays true to that one review: the presenter says only what that customer's review says, with no added details (no rooms, jobs, results or feelings the review does not mention) and nothing from other reviews; then one line about the business with its offer, and the call to action. If the website shows no review or testimonial at all, write "why-us" instead: why customers choose this business, from facts only this business has (years, licenses, guarantees, awards, what is included, how it works), and leave "quote" and "customer" null.

2. "problem-fixer": the problem fixer. "hook" names the problem most of this business's customers have and recognize in a second (what makes them hesitate to buy or hire, or what bothers them every day), in their own everyday words, as a short question or statement (6 to 12 words). Pick the main problem behind the business's main service, never a side service, and prefer one the photos can show (a before photo, the damage, the mess). The video ad then shows how this business solves that problem, with its real services and details.

3. "act-now": the reason to act now. "hook" leads with the most concrete, attractive part of the business's best offer from the website (free, on-site, a number, how fast): a free estimate, quote, consultation or inspection, a discount, a guarantee, a first-visit price, a bonus, fast service (6 to 12 words). The video ad ends with exactly how to get it (call, book, order, visit the website). If the website offers nothing concrete, use its own call to action.

Rules for every ad:
- Only facts from the website text below. Never invent a review, a name, a price, a discount, a number, a guarantee or a promise. Every number you write must appear in the website text.
- Specific to this business: its services, places, numbers and names. No empty phrases (expert, top-notch, world-class, trusted, look no further, ready to help, quality you can count on), no stock openers (Looking for, Need a, Want a, Welcome to, Tired of), no exclamation marks in the hook, no em dashes, numbers as digits. Normal punctuation: a question ends with a question mark, possessives keep their apostrophe (your home's curb appeal).
- Each ad has a different angle from the free video ad, whose lines were: ${freeLines.map((line) => `"${line}"`).join(' ') || '(none)'}
- Write in the language of the website.

For each ad:
- "highlight": the last 2 to 5 words of "hook", copied exactly; they show in yellow.
- "title": the card's title, 3 to 7 words in sentence case (only the first word and names capitalized), plain and specific: what the video ad is about, as a person would say it. Not a copy of the hook, not a keyword phrase with place names.
- "brief": what the video ad says and shows, in 4 to 6 short sentences: the opening line, the story or the points, and the close with the call to action and the website address ${domain}. Facts from the website only. This is what the AI Media Machine makes the video ad from later.
- "photo": the id of the business photo that fits this ad best, or null. The photos: ${photos.map((photo) => `${photo.id} = ${photo.description}`).join('; ') || '(none)'}
- "frame": one sentence describing the first frame, a vertical 4:5 smartphone photo: the presenter (gender, age, look, everyday clothes; vary them across the 3 ads), the place, what they hold, point at or stand next to (from the chosen photo when there is one), looking into the camera with a warm, natural expression, doing one clear thing (pointing at, holding or showing something), natural light. For the happy customer, the presenter is that customer, happy at the result (in the finished room, with the product). For the problem fixer, the presenter shows the problem, which is clearly visible. For the reason to act now, the presenter is someone from the business, friendly and ready to help (with a clipboard, a sample, a tool of the trade). Nothing written anywhere in the picture.
- "business": the business's short name as the website writes it.

Answer JSON only: {"business": "...", "ads": [{"kind": "...", "hook": "...", "highlight": "...", "title": "...", "quote": "..." or null, "customer": "..." or null, "brief": "...", "photo": "a1" or null, "frame": "..."}, {...}, {...}]}

The website text:
${brief.slice(0, 9000)}`;
}

/** One small Gemini call writes the 3 ideas (about $0.002). */
export async function writeNextAdIdeas(domain: string, saved: SavedPlan): Promise<{ business: string; ideas: NextAdIdea[] }> {
  const brief = String(saved.brief || '').split('NOTE FROM THE CLIENT:')[0];
  if (brief.trim().length < 200) throw new Error('Too little website text to write from');
  const freeLines = (saved.plan?.scenes ?? []).map((scene) => scene.narration).filter(Boolean).slice(0, 8);
  const photos = photosOf(saved);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${WRITER_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key('GOOGLE_GENERATIVE_AI_API_KEY') },
    body: JSON.stringify({
      contents: [{ parts: [{ text: writerPrompt(domain, brief, freeLines, photos) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${WRITER_MODEL} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const answer = AnswerSchema.parse(JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text || '{}'));
  const known = new Set(photos.map((photo) => photo.id));
  const ideas = answer.ads.map((idea) => ({ ...idea, photo: idea.photo && known.has(idea.photo) ? idea.photo : null }));
  return { business: answer.business.trim(), ideas };
}

const squash = (text: string) =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}%$'"]+/gu, ' ')
    .trim();

/** What a reader could catch: a "review" that is not on the website, a number the website never says, a highlight that is not the end of the hook. */
export function checkNextAds(brief: string, ideas: NextAdIdea[]): string[] {
  const site = squash(brief);
  const siteNumbers = new Set((brief.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]$/, '')));
  const problems: string[] = [];
  ideas.forEach((idea, index) => {
    const n = index + 2;
    if (idea.kind === 'happy-customer') {
      const hook = squash(idea.hook.replace(/^["“]|["”]$/g, ''));
      if (!site.includes(hook)) problems.push(`#${n}: the quoted line is not word for word on the website`);
      if (idea.quote && !site.includes(squash(idea.quote))) problems.push(`#${n}: the full quote is not word for word on the website`);
    }
    if (idea.highlight && !squash(idea.hook).endsWith(squash(idea.highlight))) problems.push(`#${n}: the highlight is not the end of the opening line`);
    for (const text of [idea.hook, idea.title, idea.brief]) {
      for (const number of text.match(/\d[\d,.]*/g) ?? []) {
        const clean = number.replace(/[,.]$/, '');
        if (!siteNumbers.has(clean) && !brief.includes(clean)) problems.push(`#${n}: "${clean}" is not on the website`);
      }
    }
  });
  return [...new Set(problems)];
}

/** The first frame of one written video ad, 4:5 (about $0.065): a made-up presenter, with the business's photo as the reference. */
export async function drawNextAdFrame(idea: NextAdIdea, referenceUrl: string | null): Promise<Buffer> {
  const prompt =
    `Photorealistic vertical smartphone photo, 4:5, UGC style, natural light, realistic skin texture, slightly imperfect framing, the first frame of a social media video ad: ${idea.frame}` +
    (referenceUrl ? ' The place, work or product from the reference photo appears as it is in that photo.' : '') +
    ' The person looks into the camera. Nothing written anywhere: no text, no letters, no logos, no watermark.';
  const res = await fetch(`https://fal.run/${referenceUrl ? FRAME_EDIT_MODEL : FRAME_NEW_MODEL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${key('FAL_KEY')}` },
    body: JSON.stringify({
      prompt,
      ...(referenceUrl ? { image_urls: [referenceUrl] } : {}),
      image_size: FRAME_SIZE,
      quality: 'high',
      output_format: 'jpeg',
      num_images: 1,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`First frame failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return Buffer.from(await (await fetch(json.images[0].url)).arrayBuffer());
}

/** Where a lead's first frames are stored: outside the job folder, which claim.ts copies whole into the buyer's account. */
export const nextAdsDir = (leadId: string) => `free-video/next-ads/${leadId}`;

/**
 * Writes the 3 video ads and draws their first frames. `save` stores each frame and returns its address; without it the
 * frames stay out of storage (a dry run returns them in `frames`). The frames are drawn side by side; one that fails
 * leaves its card with the business's photo.
 */
export async function makeNextAds(
  domain: string,
  saved: SavedPlan,
  save: ((n: number, frame: Buffer) => Promise<string>) | null
): Promise<{ result: NextAds; frames: (Buffer | null)[] }> {
  const { business, ideas } = await writeNextAdIdeas(domain, saved);
  const photos = new Map(photosOf(saved).map((photo) => [photo.id, photo.url]));
  const frames = await Promise.all(
    ideas.map((idea) =>
      drawNextAdFrame(idea, idea.photo ? photos.get(idea.photo) ?? null : null).catch((error) => {
        console.warn(`⚠️ [free-video] A first frame for ${domain} failed:`, String(error).slice(0, 200));
        return null;
      })
    )
  );
  const ads: NextAd[] = [];
  for (const [index, idea] of ideas.entries()) {
    const n = (index + 2) as 2 | 3 | 4;
    const frame = frames[index];
    const imageUrl = frame && save ? await save(n, frame) : null;
    ads.push({ ...idea, n, imageUrl });
  }
  const drawn = frames.filter(Boolean).length;
  return {
    result: {
      business,
      ads,
      problems: checkNextAds(String(saved.brief || ''), ideas),
      costUsd: Math.round((PRICES.writerPerCall + drawn * PRICES.framePerImage) * 1000) / 1000,
      writtenAt: new Date().toISOString(),
    },
    frames,
  };
}

/** Stores a lead's frame in the funnel's bucket. */
export const saveNextAdFrame = (leadId: string) => (n: number, frame: Buffer) => upload(`${nextAdsDir(leadId)}/n${n}.jpg`, frame, 'image/jpeg');
