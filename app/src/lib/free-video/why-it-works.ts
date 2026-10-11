/**
 * "Why this ad works" under a finished free video ad (owner 2026-10-11: "three to five bullet points on why this ad
 * works ... somewhere discreet, so it's not messing up the sales flow"). The owner reads them out in his YouTube
 * tutorials, and a visitor sees what the ad does and why that makes people act.
 *
 * One small Gemini call on the final script, started just before the render (the render takes far longer), with
 * the facts only the job knows: the AI presenter on camera, how many of the website's photos the video ad shows, the
 * website's own offer, what the last screen shows, the length. When the call fails or answers too few usable lines,
 * the list is built from those facts (the lines live in copy.ts WHY_IT_WORKS). Never throws: a free video ad never
 * fails over its notes.
 */

import type { SmartVideoResult } from '@/lib/smart-video/pipeline';
import { PRESENTER_ASSET } from '@/lib/smart-video/presenter';
import { sceneText } from '@/lib/smart-video/script-rules';
import type { DirectorPlan, SmartAsset } from '@/lib/smart-video/types';
import type { FreeVideoLead } from '@/types/free-video';
import { FREE_DIRECTOR } from '@/lib/free-video/config';
import { WHY_IT_WORKS } from '@/lib/free-video/copy';
import { lastScreenReaches } from '@/lib/free-video/gate';
import { websiteOffers } from '@/lib/free-video/script-checks';

export const WHY_MIN = 3;
export const WHY_MAX = 5;
/** A longer line is dropped, never cut: a cut sentence reads broken. */
export const WHY_MAX_CHARS = 170;
/** The page waits for no one: a call slower than this falls back to the facts. */
const WHY_TIMEOUT_MS = 30_000;

/** What the job knows about the finished ad, beyond its script. */
export interface AdFacts {
  /** The website as people read it. */
  domain: string;
  /** The AI presenter says the first line on camera (the presenter clip made it into the video ad). */
  presenter: boolean;
  /** How many of the website's own photos the video ad shows. */
  photos: number;
  /** The website's own offer that the script says in full ("free roof inspection"), or null. */
  offer: string | null;
  /** The last screen shows the website (else a phone number or an email: gate.ts lastScreenReaches). */
  domainShown: boolean;
  /** The ad's length without the end card, in whole seconds. */
  seconds: number;
  /** The look: whiteboard means hand-drawn sketches with the photos taped to the board. */
  look: string;
}

type Scene = DirectorPlan['scenes'][number];

/** The ids of every picture a scene shows. */
function shownIn(scene: Scene): string[] {
  const ids = scene.background.asset ? [scene.background.asset] : [];
  for (const block of scene.blocks) {
    if ('assets' in block) ids.push(...block.assets);
    else if ('asset' in block) ids.push(block.asset);
  }
  return ids;
}

/**
 * The website's offer the script says in full, or null. The notes quote it, so sharing one word with it is not
 * enough (script-checks.ts namedOffer is looser on purpose: it only asks the director to name the offer).
 */
export function offerSaid(plan: DirectorPlan, siteText: string): string | null {
  const all = plan.scenes.map(sceneText).join(' ').replace(/\s+/g, ' ');
  return websiteOffers(siteText).find((offer) => all.includes(offer.replace(/s$/, ''))) ?? null;
}

/** The facts of a finished free video ad, from what is about to render and the website photos the job kept. */
export function adFacts(result: SmartVideoResult, assets: SmartAsset[], siteText: string, domain: string): AdFacts {
  const plan = result.plan;
  const websitePhotos = new Set(assets.filter((a) => a.kind === 'image' && !a.flatBackground).map((a) => a.id));
  const shown = new Set(plan.scenes.flatMap(shownIn).filter((id) => websitePhotos.has(id)));
  return {
    domain,
    presenter: plan.scenes[0]?.speaker?.asset === PRESENTER_ASSET,
    photos: shown.size,
    offer: offerSaid(plan, siteText),
    domainShown: lastScreenReaches(plan, domain).domainShown,
    seconds: Math.round(result.durationSeconds),
    look: plan.style,
  };
}

/** The first line, short enough to quote. */
function hookOf(plan: DirectorPlan): string {
  const line = (plan.scenes[0]?.narration ?? '').replace(/\s+/g, ' ').trim();
  return line.length > 90 ? `${line.slice(0, 87).replace(/\s+\S*$/, '')}...` : line;
}

/**
 * The list from the facts alone, strongest first; the ending stays within WHY_MAX. A whiteboard video ad (every free
 * one) always gets at least WHY_MIN lines: the hook, the ending and the drawing are always known.
 */
export function fallbackWhy(plan: DirectorPlan, facts: AdFacts): string[] {
  const hook = hookOf(plan);
  const head = [
    hook ? WHY_IT_WORKS.hook(hook) : WHY_IT_WORKS.hookPlain,
    facts.presenter ? WHY_IT_WORKS.presenter : null,
    facts.photos > 0 ? WHY_IT_WORKS.photos(facts.photos, facts.domain) : null,
    facts.offer ? WHY_IT_WORKS.offer(facts.offer) : null,
  ].filter((line): line is string => Boolean(line));
  const ending = facts.domainShown ? WHY_IT_WORKS.endsOnSite(facts.domain) : WHY_IT_WORKS.endsOnContact;
  const tail = [
    facts.look === 'whiteboard' ? WHY_IT_WORKS.whiteboard : null,
    facts.seconds > 0 ? WHY_IT_WORKS.length(facts.seconds) : null,
  ].filter((line): line is string => Boolean(line));
  return [...head.slice(0, WHY_MAX - 1), ending, ...tail].slice(0, WHY_MAX);
}

// Promises nobody can keep: the notes explain the video ad, they never forecast results (owner 2026-10-11: "there's
// no way to know how much the ad will make"). A discount ("20% off") is an offer, not a forecast.
const PROMISE = /\bguarantee|\d+\s?%(?!\s?off\b)|\bpercent\b(?!\s+off\b)|\bwill (?:get|bring|double|triple|boost|increase)\b|\bmore (?:sales|customers|clients|leads|calls)\b/i;

/** The words of the whole script (voice and screen), lowercased: a quote of them is the video ad's own words. */
export const scriptTextOf = (plan: DirectorPlan) => plan.scenes.map(sceneText).join(' ').replace(/\s+/g, ' ');

/**
 * The model's lines, cleaned: plain text, no dashes as punctuation, no promises (a verbatim quote of the script is
 * the video ad's own words and is not judged), no repeats, none too long. A line that starts with "It" loses it
 * ("It opens with" → "Opens with"): the funnel never calls the video ad "it" (copy.ts).
 */
export function cleanWhy(lines: unknown, scriptText = ''): string[] {
  if (!Array.isArray(lines)) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of lines) {
    if (typeof raw !== 'string') continue;
    let line = raw
      .replace(/[“”]/g, '"')
      .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
      .replace(/\*\*/g, '')
      .replace(/\s*[—–]\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
    line = line.replace(/^it\s+(?!is\b|was\b)([a-z])(?=[a-z]*s\b)/i, (_, first: string) => first.toUpperCase());
    const judged = line.replace(/"([^"]+)"/g, (quote, words: string) => (scriptText && scriptText.includes(words.toLowerCase().replace(/\s+/g, ' ')) ? '' : quote));
    if (line.length < 12 || line.length > WHY_MAX_CHARS || PROMISE.test(judged)) continue;
    const key = line.toLowerCase().replace(/[.!?]+$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(/[.!?"]$/.test(line) ? line : `${line}.`);
  }
  return clean.slice(0, WHY_MAX);
}

/** What each picture of the plan is, in words: the director's own description of a website file, a drawing's or a made picture's prompt. */
function pictureWords(plan: DirectorPlan): Map<string, string> {
  const short = (text: string) => (text.length > 120 ? `${text.slice(0, 117).replace(/\s+\S*$/, '')}...` : text);
  return new Map<string, string>([
    ...plan.assets.filter((asset) => asset.role !== 'skip' && asset.role !== 'logo').map((asset) => [asset.id, short(asset.description)] as const),
    ...(plan.lifestyleShots ?? []).map((shot) => [shot.id, `a picture made from the business's photo: ${short(shot.prompt)}`] as const),
    ...(plan.drawings ?? []).map((drawing) => [drawing.id, `a hand-drawn sketch: ${short(drawing.prompt)}`] as const),
  ]);
}

/** The prompt: the facts and the script, scene by scene, with what each scene shows. Pure, so the offline checks can read it. */
export function whyPrompt(plan: DirectorPlan, facts: AdFacts): string {
  const words = pictureWords(plan);
  const script = plan.scenes
    .map((scene, index) => {
      const shown = scene.blocks.flatMap((block) => ('text' in block && block.text ? [block.text.replace(/\s*\n\s*/g, ' ')] : []));
      const pictures = [...new Set(shownIn(scene))].map((id) => words.get(id)).filter((text): text is string => Boolean(text));
      return `${index + 1}. Voice: "${scene.narration}"${shown.length ? ` | On screen: ${shown.map((text) => `"${text}"`).join(', ')}` : ''}${pictures.length ? ` | Picture: ${pictures.map((text) => `"${text}"`).join(', ')}` : ''}`;
    })
    .join('\n');
  const known = [
    `The business website: ${facts.domain}`,
    facts.presenter
      ? 'An AI presenter (a made-up person, not anyone from the business) says the first line to the camera, like a creator on social media.'
      : "A narrator's voice carries the whole video ad; nobody appears on camera.",
    facts.photos ? `The video ad shows ${facts.photos} of the business's own photos from its website.` : 'The video ad shows no photos from the website.',
    facts.look === 'whiteboard'
      ? `The look: a hand draws simple sketches and words on a whiteboard${facts.photos ? ', with the photos taped to the board' : ''}.`
      : `The look: ${facts.look}.`,
    facts.offer ? `The script names the website's own offer: "${facts.offer}".` : null,
    facts.domainShown ? `The last scene shows the website ${facts.domain} on screen.` : 'The last scene shows how to reach the business (a phone number or an email), not the website.',
    facts.seconds ? `Length: about ${facts.seconds} seconds, vertical, for Reels, Shorts and TikTok.` : null,
  ]
    .filter(Boolean)
    .join('\n');
  const options = [
    facts.presenter ? 'the AI presenter on camera' : null,
    facts.photos ? "the business's real photos" : null,
    'a concrete detail from the website (a number, a place, a year, a service)',
    facts.offer ? 'the offer' : null,
    facts.look === 'whiteboard' ? 'the hand-drawn whiteboard' : null,
    'the length',
  ]
    .filter(Boolean)
    .join(', ');
  return `You explain to a small business owner why the short video ad below works. They read your points in a small list under the video.

Write ${WHY_MIN} to ${WHY_MAX} points. Each one names something this video ad really does (quote its words, or name a picture by its description below) and says in plain words why that makes a viewer stop, trust the business or act. Use only the facts and the script below. Always cover the first line (the hook) and the ending. Then pick the strongest of: ${options}.

Rules:
- Start each point with what the video ad does, a verb such as "Opens with", "Shows", "Names" or "Ends with". Never start with "It" and never call the video ad "it".
- At most 22 words a point. Plain words a busy owner understands: no marketing jargon such as "CTA", "social proof" or "pattern interrupt", no emojis, no dashes as punctuation.
- Call the person on camera "the AI presenter". Never say they are real, the owner, staff or a customer.
- You cannot see the pictures: say what a picture shows only from its description below.
- Never promise or estimate results: no numbers or percentages of customers, sales, calls or clicks (the website's own discount, such as "20% off", is fine), no "guaranteed", no "will get you".
- Write in English even when the video ad is in another language, and quote its own words as they are.

Answer JSON only: {"points": ["...", "..."]}

FACTS:
${known}

THE SCRIPT, SCENE BY SCENE:
${script}`;
}

/** One call to the free director's model; null when it fails or answers nothing usable. */
async function askWhy(prompt: string, scriptText: string): Promise<string[] | null> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${FREE_DIRECTOR.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4, thinkingConfig: { thinkingLevel: 'low' } },
      }),
      signal: AbortSignal.timeout(WHY_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`⚠️ [free-video] Why-it-works call failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
      return null;
    }
    const json = await res.json();
    const text: string = (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
    return cleanWhy(JSON.parse(text)?.points, scriptText);
  } catch (error) {
    console.warn('⚠️ [free-video] Why-it-works call failed:', String(error).slice(0, 160));
    return null;
  }
}

/**
 * The list for the page: the model's points, or the list from the facts when it gave fewer than WHY_MIN usable
 * ones (mixing the two would say the hook twice). Never throws.
 */
export async function whyItWorks(plan: DirectorPlan, facts: AdFacts): Promise<string[]> {
  const points = await askWhy(whyPrompt(plan, facts), scriptTextOf(plan));
  return points && points.length >= WHY_MIN ? points : fallbackWhy(plan, facts);
}

/** "Why this ad works" from the lead's live record (JSON from the database): its lines, at most WHY_MAX, or undefined. */
export function whyItWorksOf(lead: Pick<FreeVideoLead, 'live'>): string[] | undefined {
  const lines = lead.live?.whyItWorks;
  if (!Array.isArray(lines)) return undefined;
  const clean = lines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0).slice(0, WHY_MAX);
  return clean.length ? clean : undefined;
}
