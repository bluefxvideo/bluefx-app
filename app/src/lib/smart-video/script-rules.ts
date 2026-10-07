/**
 * The script rules every rewritten Phantom video follows (owner 2026-10-07: "the hook etc is in the phantom too,
 * right?"). They started in the free video funnel (freeNote and script-checks.ts, 2026-10-06), where a test on 10
 * websites took the scripts from 6.8 to 8.6 out of 10. The director reads SCRIPT_RULES with the "rewrite" length rule
 * (director.ts); checkAdScript sends a plan back once when scene 1 opens like every other ad or a line says nothing.
 * Neither applies to "Say exactly what I wrote" or to the listing videos, which keep their own recipe.
 * Pure: the offline checks use it.
 */
import type { DirectorPlan } from '@/lib/smart-video/types';

export const SCRIPT_RULES =
  'Write scene 1 as one short hook of 6 to 12 words that the viewer cannot scroll past: their specific problem or wish, or a concrete fact only this business or product has (a number, a year, a place, the offer). Never a stock opener such as "Looking for…?", "Need a…?", "Craving…?", "Want a…?" or "Welcome to…". Examples of the tone: "This is the storm damage most homeowners never see." "Imagine never spending another Saturday cleaning your house." "Okay, these might be the best tacos in Austin." Make every line specific: the services, places, numbers, prices and names from the material. No empty phrases such as expert guidance, ready to help, look no further, at your service, trusted partner, top-notch or world-class. When the material offers something concrete (a free estimate or consultation, a discount, a first-visit price, a code), it is the reason to act: name it in the middle of the video and close on it in the last scene with a clear action (call, book, order, claim).';

/** Phrases that say nothing a viewer can check. Each one sends the plan back once. */
export const EMPTY_PHRASES = [
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

/** The openers every ad uses: scene 1 starting with one of these goes back once (owner 2026-10-06, "hook rule"). */
export const STOCK_OPENER = /^\s*(?:(?:are you|do you|still)\s+)?(?:looking for|searching for|in need of|need an?|need some|craving|want an?|welcome to|introducing|discover)\b/i;

type Scene = DirectorPlan['scenes'][number];

/** Everything a scene says and shows, lowercased. */
export function sceneText(scene: Scene): string {
  const shown = scene.blocks.flatMap((block) => {
    const b = block as { text?: string; items?: { text?: string }[] };
    return [b.text ?? '', ...(b.items ?? []).map((item) => item.text ?? '')];
  });
  return [scene.narration, ...shown].join(' ').toLowerCase();
}

/** The first problem with a rewritten script, written for the director, or null. The director's last try skips it. */
export function checkAdScript(plan: DirectorPlan): string | null {
  const opener = STOCK_OPENER.exec(plan.scenes[0]?.narration ?? '');
  if (opener) {
    return `scene 1 opens with "${opener[0].trim()}", the opening every ad uses. Open on the viewer's specific problem or wish, or a concrete fact only this business or product has (a number, a year, a place, the offer), in 6 to 12 words.`;
  }
  for (const [index, scene] of plan.scenes.entries()) {
    const empty = EMPTY_PHRASES.find((phrase) => sceneText(scene).includes(phrase));
    if (empty) return `scene ${index + 1} says "${empty}", which tells a viewer nothing. Replace it with something concrete from the material: a service, a number, a place, a price or the offer.`;
  }
  return null;
}
