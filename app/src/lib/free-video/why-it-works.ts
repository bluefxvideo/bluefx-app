/**
 * "Why this ad works" under a finished free video ad (owner 2026-10-11: "three to five bullet points on why this ad
 * works ... somewhere discreet, so it's not messing up the sales flow"). The owner reads them out in his YouTube
 * tutorials, and a visitor sees what the ad does and why that makes people act.
 *
 * One small Gemini call on the final script, started just before the render (the render takes far longer), with
 * the facts only the job knows: a person on camera, how many of the website's photos it shows, the website's own
 * offer, the length. When the call fails or answers too few usable lines, the list is built from those facts.
 * Never throws: a free video ad never fails over its notes.
 */

import type { SmartVideoResult } from '@/lib/smart-video/pipeline';
import { PRESENTER_ASSET } from '@/lib/smart-video/presenter';
import type { DirectorPlan, SmartAsset } from '@/lib/smart-video/types';
import type { FreeVideoLead } from '@/types/free-video';
import { FREE_DIRECTOR } from '@/lib/free-video/config';
import { namedOffer } from '@/lib/free-video/script-checks';

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
  /** A person says the first line on camera (the presenter clip made it into the video). */
  presenter: boolean;
  /** How many of the website's own photos the ad shows. */
  photos: number;
  /** The website's own offer that the script names ("free roof inspection"), or null. */
  offer: string | null;
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

/** The facts of a finished free video ad, from what is about to render and the website photos the job kept. */
export function adFacts(result: SmartVideoResult, assets: SmartAsset[], siteText: string, domain: string): AdFacts {
  const plan = result.plan;
  const websitePhotos = new Set(assets.filter((a) => a.kind === 'image' && !a.flatBackground).map((a) => a.id));
  const shown = new Set(plan.scenes.flatMap(shownIn).filter((id) => websitePhotos.has(id)));
  return {
    domain,
    presenter: plan.scenes[0]?.speaker?.asset === PRESENTER_ASSET,
    photos: shown.size,
    offer: namedOffer(plan, siteText),
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
 * The list from the facts alone, strongest first; always WHY_MIN to WHY_MAX lines (the hook, the ending and the
 * length are always known).
 */
export function fallbackWhy(plan: DirectorPlan, facts: AdFacts): string[] {
  const hook = hookOf(plan);
  const lines = [
    hook ? `It opens with a line made to stop the scroll: "${hook}"` : 'It opens with a line made to stop the scroll, before anything else.',
    facts.presenter ? 'A person says that first line to the camera, and a face is what makes people stop scrolling.' : null,
    facts.photos > 0
      ? `It shows ${facts.photos === 1 ? 'a real photo' : `${facts.photos} real photos`} from ${facts.domain}, so viewers see the actual business, not stock pictures.`
      : null,
    facts.offer ? `It names the website's own offer, "${facts.offer}", which gives people a reason to act now.` : null,
    `It ends with ${facts.domain} on screen, so viewers know exactly where to go next.`,
    facts.seconds > 0 && facts.seconds <= 60
      ? `At about ${facts.seconds} seconds it gets to the point fast and fits Reels, Shorts and TikTok.`
      : null,
  ].filter((line): line is string => Boolean(line));
  return lines.slice(0, WHY_MAX);
}

// Promises nobody can keep: the notes explain the ad, they never forecast results (owner 2026-10-11: "there's no
// way to know how much the ad will make").
const PROMISE = /\bguarantee|\d+\s?%|\bpercent\b|\bwill (?:get|bring|double|triple|boost|increase)\b|\bmore (?:sales|customers|clients|leads|calls)\b/i;

/** The model's lines, cleaned: plain text, no dashes as punctuation, no promises, no repeats, none too long. */
export function cleanWhy(lines: unknown): string[] {
  if (!Array.isArray(lines)) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of lines) {
    if (typeof raw !== 'string') continue;
    const line = raw
      .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
      .replace(/\*\*/g, '')
      .replace(/\s*[—–]\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
    if (line.length < 12 || line.length > WHY_MAX_CHARS || PROMISE.test(line)) continue;
    const key = line.toLowerCase().replace(/[.!?]+$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(/[.!?"]$/.test(line) ? line : `${line}.`);
  }
  return clean.slice(0, WHY_MAX);
}

/** The prompt: the facts and the script, scene by scene. Pure, so the offline checks can read it. */
export function whyPrompt(plan: DirectorPlan, facts: AdFacts): string {
  const script = plan.scenes
    .map((scene, index) => {
      const shown = scene.blocks.flatMap((block) => ('text' in block && block.text ? [block.text.replace(/\s*\n\s*/g, ' ')] : []));
      return `${index + 1}. Voice: "${scene.narration}"${shown.length ? ` | On screen: ${shown.map((text) => `"${text}"`).join(', ')}` : ''}`;
    })
    .join('\n');
  const known = [
    `The business website: ${facts.domain}`,
    facts.presenter ? 'A person says the first line to the camera, like a creator on social media.' : 'A narrator\'s voice carries the whole ad; nobody appears on camera.',
    facts.photos ? `The ad shows ${facts.photos} of the business's own photos from its website.` : 'The ad shows no photos from the website.',
    facts.look === 'whiteboard' ? 'The look: a hand draws simple sketches and words on a whiteboard, with the photos taped to the board.' : `The look: ${facts.look}.`,
    facts.offer ? `The script names the website's own offer: "${facts.offer}".` : null,
    facts.seconds ? `Length: about ${facts.seconds} seconds, vertical, for Reels, Shorts and TikTok.` : null,
  ]
    .filter(Boolean)
    .join('\n');
  return `You explain to a small business owner why the short video ad below works. They read your points in a small list under the video.

Write ${WHY_MIN} to ${WHY_MAX} points. Each one names something this ad really does (quote its words or name the picture) and says in plain words why that makes a viewer stop, trust the business or act. Use only the facts and the script below. Always cover the first line (the hook) and the ending. Then pick the strongest of: the person on camera, the business's real photos, a concrete detail from the website (a number, a place, a year, a service), the offer, the length.

Rules:
- At most 22 words a point. Plain words a busy owner understands: no marketing jargon such as "CTA", "social proof" or "pattern interrupt", no emojis, no dashes as punctuation.
- Never promise or estimate results: no numbers of customers, sales, calls or clicks, no percentages, no "guaranteed", no "will get you".
- Write in English even when the ad is in another language, and quote the ad's own words as they are.

Answer JSON only: {"points": ["...", "..."]}

FACTS:
${known}

THE SCRIPT, SCENE BY SCENE:
${script}`;
}

/** One call to the free director's model; null when it fails or answers nothing usable. */
async function askWhy(prompt: string): Promise<string[] | null> {
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
    return cleanWhy(JSON.parse(text)?.points);
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
  const points = await askWhy(whyPrompt(plan, facts));
  return points && points.length >= WHY_MIN ? points : fallbackWhy(plan, facts);
}

/** "Why this ad works" from the lead's live record (JSON from the database): its lines, at most WHY_MAX, or undefined. */
export function whyItWorksOf(lead: Pick<FreeVideoLead, 'live'>): string[] | undefined {
  const lines = lead.live?.whyItWorks;
  if (!Array.isArray(lines)) return undefined;
  const clean = lines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0).slice(0, WHY_MAX);
  return clean.length ? clean : undefined;
}
