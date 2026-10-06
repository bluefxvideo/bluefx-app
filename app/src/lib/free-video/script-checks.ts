/**
 * Script checks for the free video ad (owner 2026-10-06: "how can you be sure that all scripts will be sharper?").
 * The director gets a plan back with the reason when it uses an empty phrase or leaves out the website's own offer,
 * the same way it gets one back for too few words. The director's last try skips these checks (pipeline.ts
 * checkScript), so a free video ad never fails over wording. Pure: the offline checks and the script test use it.
 */
import type { DirectorPlan } from '@/lib/smart-video/types';

/** Phrases that say nothing a customer can check. Each one sends the plan back once. */
const EMPTY_PHRASES = [
  'expert guidance',
  'ready to help',
  'here to help',
  'look no further',
  'at your service',
  'trusted partner',
  'second to none',
  'one-stop shop',
  'one stop shop',
  'top-notch',
  'top notch',
  'world-class',
  'world class',
  'state-of-the-art',
  'cutting-edge',
  "we've got you covered",
  'we have you covered',
  'take it to the next level',
  'exceptional service',
  'unmatched',
  'unparalleled',
  'we pride ourselves',
  'find your paradise',
  'quality service',
  'your satisfaction is our',
  'every step of the way',
  'tradition meets',
  'to perfection',
  'true taste of',
  'dream home',
  'look your best',
];

// The openers every ad uses: scene 1 starting with one of these goes back once (owner 2026-10-06, "hook rule").
const STOCK_OPENER = /^\s*(?:(?:are you|do you|still)\s+)?(?:looking for|searching for|in need of|need an?|need some|craving|want an?|welcome to|introducing|discover)\b/i;

// Offers a website makes in so many words: "free roof inspection", "free estimate", "20% off", "new patient special".
const FREE_THING =
  /\bfree\s+(?:[a-z'-]+\s+){0,3}?(consultations?|estimates?|quotes?|inspections?|valuations?|exams?|trials?|delivery|assessments?|analysis|evaluations?|appraisals?|check-?ups?|lessons?|classes|class|sessions?|day passes|day pass|guides?|reports?|audits?|demos?|samples?|tastings?|haircuts?|upgrades?|gifts?|whitening|cleanings?|tours?)\b/gi;
const OTHER_OFFERS = [
  /\b\d{1,2}\s?% off\b/gi,
  /\$\s?\d+(?:\.\d{2})? off\b/gi,
  /\bnew (?:patient|client|customer|member)s?\s+(?:special|offer|deal|discount)\b/gi,
];

/** The offers on the website, as found ("free roof inspection", "20% off"), most frequent first. */
export function websiteOffers(siteText: string): string[] {
  const counts = new Map<string, number>();
  const add = (found: string) => {
    const key = found.toLowerCase().replace(/\s+/g, ' ').trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const match of siteText.matchAll(FREE_THING)) add(match[0]);
  for (const pattern of OTHER_OFFERS) for (const match of siteText.matchAll(pattern)) add(match[0]);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([offer]) => offer);
}

/** The word that names an offer: "inspection" in "free roof inspection", "off" in "20% off". */
function offerWord(offer: string): string {
  const free = /^free\s+(?:.+\s)?(\S+)$/.exec(offer);
  if (free) return free[1].replace(/s$/, '');
  if (/new (?:patient|client|customer|member)/.test(offer)) return offer.split(' ')[1].replace(/s$/, '');
  return offer;
}

type Scene = DirectorPlan['scenes'][number];

/** Everything a scene says and shows, lowercased. */
function sceneText(scene: Scene): string {
  const shown = scene.blocks.flatMap((block) => {
    const b = block as { text?: string; items?: { text?: string }[] };
    return [b.text ?? '', ...(b.items ?? []).map((item) => item.text ?? '')];
  });
  return [scene.narration, ...shown].join(' ').toLowerCase();
}

/**
 * The first problem with a free video ad's script, written for the director, or null. `siteText` is the website's
 * text as the reader got it.
 */
export function checkFreeScript(plan: DirectorPlan, siteText: string): string | null {
  const opener = STOCK_OPENER.exec(plan.scenes[0]?.narration ?? '');
  if (opener) {
    return `scene 1 opens with "${opener[0].trim()}", the opening every ad uses. Open on this customer's specific problem or wish, or a concrete fact only this business has (a number, a year, a place, the offer), in 6 to 12 words.`;
  }
  for (const [index, scene] of plan.scenes.entries()) {
    const text = sceneText(scene);
    const empty = EMPTY_PHRASES.find((phrase) => text.includes(phrase));
    if (empty) {
      return `scene ${index + 1} says "${empty}", which tells a customer nothing. Replace it with something concrete from the website: a service, a number, a place, a price or the offer.`;
    }
  }
  const offers = websiteOffers(siteText);
  if (offers.length) {
    const all = plan.scenes.map(sceneText).join(' ');
    const last = sceneText(plan.scenes[plan.scenes.length - 1]);
    const named = offers.find((offer) => all.includes(offerWord(offer)));
    if (!named) {
      return `the website offers "${offers[0]}", and the script never names it. It is the reason to act: name it in the middle of the video and close on it in the last scene with a clear action, for example "Book your ${offers[0]} at the website on screen."`;
    }
    if (!last.includes(offerWord(named)) && !last.includes('free')) {
      return `the last scene does not close on the offer "${named}". End with a clear action that names it, for example "Book your ${named} at the website on screen."`;
    }
  }
  return null;
}
