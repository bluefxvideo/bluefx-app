import { z } from 'zod';
import { fakeMode } from '@/lib/free-video/config';
import { getLead, isoMinutesAgo, leadsTable } from '@/lib/free-video/leads';
import { CLEAN_COPY_HOURS } from '@/lib/free-video/offer';
import { displayDomain } from '@/lib/free-video/website';
import { jobsTable, upload } from '@/lib/smart-video/jobs';
import type { SavedPlan } from '@/lib/smart-video/jobs';
import type { UsageEntry } from '@/lib/smart-video/usage';
import type { FreeVideoNextAd, FreeVideoNextAds } from '@/types/free-video';

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
 * $0.002), checked before anything is drawn; GPT Image 2.5 then draws each first frame, 4:5, with a made-up presenter
 * and the business's own photo as the reference (owner: "any generated person, like we do these hooks"). About $0.20 a
 * lead. A free job starts them while its video ad renders (runner.ts), so the result page has them when it opens; the
 * sweep writes them for a lead that has none yet (writeMissingNextAds).
 */

const WRITER_MODEL = 'gemini-3.6-flash';
const FRAME_EDIT_MODEL = 'openai/gpt-image-2.5/flare/edit';
const FRAME_NEW_MODEL = 'openai/gpt-image-2.5/flare/text-to-image';
/** 4:5, the shape of a feed post and of the cards on the result page. */
const FRAME_SIZE = { width: 1080, height: 1350 };
const PRICES = { writerPerCall: 0.002, framePerImage: 0.065 };
/** The writer tries again once when the checks find a problem, before anything is drawn. */
const WRITER_TRIES = 2;

/** What a free job adds to its usage when it starts the 3 (an estimate: the job's usage is saved before they are done). */
export const NEXT_ADS_USAGE: UsageEntry = { step: 'next 3 video ads', usd: PRICES.writerPerCall + 3 * PRICES.framePerImage, detail: '1 call + 3 first frames' };

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
  action: z.string().max(300).nullish(),
});
const AnswerSchema = z.object({ business: z.string().max(80), ads: z.array(IdeaSchema).length(3) });
export type NextAdIdea = z.infer<typeof IdeaSchema>;

/** One written video ad as the result page shows it and the AI Media Machine makes it after the purchase. */
export type NextAd = FreeVideoNextAd;
export type NextAds = FreeVideoNextAds;

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

/** The website's own text in a saved plan: the brief before the funnel's note to the director. */
export const websiteTextOf = (saved: SavedPlan) => String(saved.brief || '').split('NOTE FROM THE CLIENT:')[0];

function writerPrompt(domain: string, brief: string, freeLines: string[], photos: { id: string; description: string }[], fix: string[]): string {
  return `You write the next 3 short video ads for a small business. Its first free video ad is already made; these 3 are the next ones the owner gets. Each is a 40-second vertical video ad with a presenter talking to the camera, a voice-over, music and captions. The owner will see each one as a card: the first frame of the video with its opening line on it, and a short title. Make the owner want to see all 3, especially the first.

Write exactly these 3, in this order:

1. "happy-customer": the happy customer. A presenter tells a real customer's story, as that customer. Take it from a real review or testimonial on the website: "hook" is a short quote of that review's OWN words, copied exactly, in the same order (one sentence or the end of one, 4 to 12 words, the strongest praise), "quote" is the full sentence it comes from, copied exactly, and "customer" is the name the website gives (first name and last initial at most), or null. The rest of this ad stays true to that one review: the presenter says only what that customer's review says, with no added details (no rooms, jobs, results or feelings the review does not mention) and nothing from other reviews; then one line about the business with its offer, and the call to action. If the website shows no review or testimonial at all, write "why-us" instead: why customers choose this business, from facts only this business has (years, licenses, guarantees, awards, what is included, how it works), and leave "quote" and "customer" null.

2. "problem-fixer": the problem fixer. First decide the business's main service: the one its name and page title say, and the one the website names most often. A service the website lists as an extra, an add-on or "in addition to" its main work is never the main service, even when a photo shows it (for a painter: painting, never the popcorn ceiling removal it offers "in addition to painting"). "hook" names the problem that main service fixes, the one most of its customers have and recognize in a second (what makes them hesitate to buy or hire, or what bothers them every day), in their own everyday words, as a short question or statement (6 to 12 words). Among the main service's problems, prefer one the photos can show (a before photo, the damage, the mess). A question reads as a real question ("Is...", "Does...", "Why..."); a statement ends without a question mark. The video ad then shows how this business solves that problem, with its real services and details.

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
- "action": one sentence: the small movement the presenter makes while saying the first words, the one clear thing of the frame (they point at the cracked paint, hold up the sample), still facing the camera.
- "business": the business's short name as the website writes it.
${fix.length ? `\nAn earlier answer had these problems; avoid them: ${fix.join('; ')}\n` : ''}
Answer JSON only: {"business": "...", "ads": [{"kind": "...", "hook": "...", "highlight": "...", "title": "...", "quote": "..." or null, "customer": "..." or null, "brief": "...", "photo": "a1" or null, "frame": "...", "action": "..."}, {...}, {...}]}

The website text:
${brief.slice(0, 9000)}`;
}

/** One small Gemini call writes the 3 ideas (about $0.002). */
export async function writeNextAdIdeas(domain: string, saved: SavedPlan, fix: string[] = []): Promise<{ business: string; ideas: NextAdIdea[] }> {
  const brief = websiteTextOf(saved);
  if (brief.trim().length < 200) throw new Error('Too little website text to write from');
  const freeLines = (saved.plan?.scenes ?? []).map((scene) => scene.narration).filter(Boolean).slice(0, 8);
  const photos = photosOf(saved);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${WRITER_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key('GOOGLE_GENERATIVE_AI_API_KEY') },
    body: JSON.stringify({
      contents: [{ parts: [{ text: writerPrompt(domain, brief, freeLines, photos, fix) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${WRITER_MODEL} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const answer = AnswerSchema.parse(JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text || '{}'));
  const known = new Set(photos.map((photo) => photo.id));
  const ideas = answer.ads.map((idea) => ({
    ...idea,
    hook: possessives(idea.hook),
    highlight: possessives(idea.highlight),
    photo: idea.photo && known.has(idea.photo) ? idea.photo : null,
    customer: shortName(idea.customer),
  }));
  return { business: answer.business.trim(), ideas };
}

/** The possessive the writer keeps dropping however it is asked ("your home curb appeal", 3 of 4 runs on 2026-10-19). */
const possessives = (text: string) => text.replace(/\bhome curb appeal\b/gi, (match) => match.replace(/home/i, (home) => `${home}'s`));

/** A customer's name as the page may show it: the first name and the last initial ("Christine Andrews" → "Christine A."); null for none. */
function shortName(name: string | null | undefined): string | null {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length || /^(none|null|n\/a)$/i.test(words[0])) return null;
  return words.length > 1 ? `${words[0]} ${words[words.length - 1][0].toUpperCase()}.` : words[0];
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
        // A whole number of the website: "20" inside "2012" does not count.
        const onSite = siteNumbers.has(clean) || new RegExp(`(^|[^\\d])${clean.replace(/[.]/g, '\\.')}(?![\\d])`).test(brief);
        if (!onSite) problems.push(`#${n}: "${clean}" is not on the website`);
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
 * Writes the 3 video ads (again once when the checks find a problem, keeping the answer with fewer) and draws their
 * first frames. `save` stores each frame and returns its address; without it the frames stay out of storage (a dry run
 * returns them in `frames`). The frames are drawn side by side; one that fails leaves its card with the business's photo.
 */
export async function makeNextAds(
  domain: string,
  saved: SavedPlan,
  save: ((n: number, frame: Buffer) => Promise<string>) | null
): Promise<{ result: NextAds; frames: (Buffer | null)[] }> {
  const brief = websiteTextOf(saved);
  let best: { business: string; ideas: NextAdIdea[]; problems: string[] } | null = null;
  let calls = 0;
  for (let attempt = 1; attempt <= WRITER_TRIES; attempt++) {
    calls++;
    const written = await writeNextAdIdeas(domain, saved, best?.problems ?? []);
    const problems = checkNextAds(brief, written.ideas);
    if (!best || problems.length < best.problems.length) best = { ...written, problems };
    if (!problems.length) break;
  }
  const { business, ideas, problems } = best as NonNullable<typeof best>;
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
      problems,
      costUsd: Math.round((calls * PRICES.writerPerCall + drawn * PRICES.framePerImage) * 1000) / 1000,
      writtenAt: new Date().toISOString(),
    },
    frames,
  };
}

/** Stores a lead's frame in the funnel's bucket. */
export const saveNextAdFrame = (leadId: string) => (n: number, frame: Buffer) => upload(`${nextAdsDir(leadId)}/n${n}.jpg`, frame, 'image/jpeg');

// ---------------------------------------------------------------------------------------------
// A lead's 3, saved on free_video_leads.next_ads
// ---------------------------------------------------------------------------------------------

/** Leads whose 3 are being written in this process: a second start does nothing. */
const writing = new Set<string>();
/** Leads whose writing failed in this process, and when: the sweep tries such a lead again after RETRY_AFTER_MS, not every minute. */
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 6 * 60 * 60_000;

/** Whether a lead still needs its 3: none yet, and not a customer (a customer makes video ads in the AI Media Machine). False on a failed read and in fake mode. */
export async function nextAdsWanted(leadId: string): Promise<boolean> {
  if (fakeMode()) return false;
  try {
    const { data, error } = await leadsTable().select('next_ads, is_customer').eq('id', leadId).maybeSingle();
    return !error && Boolean(data) && !data.next_ads && !data.is_customer;
  } catch {
    return false;
  }
}

/**
 * Writes a lead's 3 in the background and saves them on the lead, never over ones already there. False when they are
 * already being written in this process. addCost: the sweep adds what they cost to the lead; a free job adds
 * NEXT_ADS_USAGE to its own usage instead, which settleLead adds to the lead (the two writes would race).
 */
export function startNextAds(leadId: string, domain: string, saved: SavedPlan, addCost: boolean): boolean {
  if (writing.has(leadId)) return false;
  writing.add(leadId);
  void (async () => {
    const started = Date.now();
    try {
      const { result } = await makeNextAds(domain, saved, saveNextAdFrame(leadId));
      const patch: Record<string, unknown> = { next_ads: result };
      if (addCost) {
        const lead = await getLead(leadId);
        if (lead) patch.est_cost_usd = Math.round((lead.est_cost_usd + result.costUsd) * 1000) / 1000;
      }
      const { data, error } = await leadsTable().update(patch).eq('id', leadId).is('next_ads', null).select('id');
      if (error) throw new Error(error.message);
      failedAt.delete(leadId);
      if (data?.length) {
        const checks = result.problems.length ? `, checks: ${result.problems.join('; ')}` : '';
        console.log(`✅ [free-video] Lead ${leadId}: the next 3 video ads are written (${Math.round((Date.now() - started) / 1000)} s, $${result.costUsd}${checks})`);
      }
    } catch (error) {
      failedAt.set(leadId, Date.now());
      console.warn(`⚠️ [free-video] Lead ${leadId}: the next 3 video ads were not written:`, String(error).slice(0, 200));
    } finally {
      writing.delete(leadId);
    }
  })();
  return true;
}

/** The sweep starts at most this many a run, so a backlog never fires dozens of image calls at once. */
const CATCH_UP_PER_SWEEP = 2;

/**
 * The sweep's share: a finished lead without its 3 (a free video ad made before they existed, a writing that failed, a
 * held video ad the owner released) gets them, while its 2 free bonuses run (CLEAN_COPY_HOURS) and once its video ad
 * has been ready for 5 minutes (the job's own writing has had its time). Returns how many were started.
 */
export async function writeMissingNextAds(own: (query: any) => any): Promise<number> {
  if (fakeMode()) return 0;
  const { data, error } = await own(
    leadsTable()
      .select('id, job_id, website_domain')
      .eq('status', 'done')
      .is('next_ads', null)
      .eq('is_customer', false)
      .gt('finished_at', isoMinutesAgo(CLEAN_COPY_HOURS * 60))
      .lt('finished_at', isoMinutesAgo(5))
  )
    .order('finished_at', { ascending: false })
    .limit(20);
  if (error) {
    console.error('❌ [free-video] Sweep: leads without their next 3 video ads not read:', error.message);
    return 0;
  }
  let started = 0;
  for (const lead of (data ?? []) as { id: string; job_id: string | null; website_domain: string }[]) {
    if (started >= CATCH_UP_PER_SWEEP) break;
    const failed = failedAt.get(lead.id);
    if (!lead.job_id || writing.has(lead.id) || (failed && Date.now() - failed < RETRY_AFTER_MS)) continue;
    const { data: job, error: jobError } = await jobsTable().select('plan').eq('id', lead.job_id).maybeSingle();
    if (jobError || !job?.plan) continue;
    if (startNextAds(lead.id, displayDomain(lead.website_domain), job.plan as SavedPlan, true)) started++;
  }
  return started;
}
