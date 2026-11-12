import type { DirectorBlock, DirectorPlan } from './types';
import { usage } from './usage';

/**
 * Script first (owner 2026-11-02): the client changes only the voice-over. The words on screen of each scene they
 * changed are matched to the new line here, so a claim taken out of the voice-over ("eliminate tennis elbow pain")
 * does not stay on screen. Only those texts change, the voice-over stays exactly as approved, and a failure keeps the
 * texts as they were: the video is made either way.
 *
 * Number cards follow the line too (2026-11-12, Todd Barna): he changed "sixty-five euros" to "fifty seven dollars"
 * and the card on screen still said €65. A card whose number the new line no longer says is taken off the scene.
 */

const MODEL = 'gemini-3.6-flash';

type Slot = { get: () => string; set: (text: string) => void };
type NumberBlock = Extract<DirectorBlock, { type: 'number' }>;

/** The words a block shows that can be reworded (number cards are handled on their own, see numberText). */
function slotsOf(block: DirectorBlock): Slot[] {
  switch (block.type) {
    case 'title':
    case 'pill':
    case 'badge':
    case 'highlight':
    case 'caption':
    case 'quote':
      return [{ get: () => block.text, set: (text) => void (block.text = text) }];
    case 'stars':
      return block.text ? [{ get: () => block.text || '', set: (text) => void (block.text = text) }] : [];
    case 'media':
      return block.footerPill ? [{ get: () => block.footerPill!.text, set: (text) => void (block.footerPill!.text = text) }] : [];
    case 'chips':
    case 'rows':
      return block.items.map((item) => ({ get: () => item.text, set: (text: string) => void (item.text = text) }));
    case 'tiles':
      return block.items.flatMap((item) => [
        { get: () => item.top, set: (text: string) => void (item.top = text) },
        { get: () => item.big, set: (text: string) => void (item.big = text) },
      ]);
    default:
      return [];
  }
}

const numberText = (block: NumberBlock) => `${block.prefix || ''}${block.value}${block.suffix || ''}`;

/** "$57", "57 €", "1,299.00 USD", "65,00 €" -> prefix, value, suffix; null when there is no number in it. */
export function parseNumberText(text: string): { prefix: string; value: number; suffix: string } | null {
  const match = text.trim().match(/^([^\d]*?)\s*(\d[\d.,]*)\s*(.*)$/);
  if (!match) return null;
  let digits = match[2].replace(/[.,]$/, '');
  // A comma before the last 1-2 digits is a decimal comma ("65,00"); any other comma or dot before 3 digits groups thousands.
  if (/,\d{1,2}$/.test(digits)) digits = digits.replace(/\./g, '').replace(',', '.');
  else digits = digits.replace(/,/g, '').replace(/\.(?=\d{3}(\D|$))/g, '');
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  // Whole amounts count up cleaner without ".00"
  return { prefix: match[1].trim(), value: Math.round(value * 100) / 100, suffix: match[3].trim() ? ` ${match[3].trim()}`.replace(/^ ([%+])/, '$1') : '' };
}

export async function matchScreenWords(plan: DirectorPlan, changed: number[]): Promise<DirectorPlan> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const scenes = changed
    .map((i) => ({
      i,
      slots: plan.scenes[i].blocks.flatMap(slotsOf),
      numbers: plan.scenes[i].blocks.filter((block): block is NumberBlock => block.type === 'number'),
    }))
    .filter((scene) => scene.slots.length > 0 || scene.numbers.length > 0);
  if (!key || !scenes.length) return plan;
  const ask = scenes.map(({ i, slots, numbers }) => ({
    scene: i + 1,
    line: plan.scenes[i].narration,
    texts: slots.map((slot) => slot.get()),
    numbers: numbers.map(numberText),
  }));
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `These scenes of a video ad have a new spoken line, written by the business owner. Each scene shows short texts on screen that were written for the old line. Rewrite each text so it says only what the new line says: keep a text that still fits word for word, change one that no longer fits, and never show a claim, number, price or promise the new line does not make. Keep each text as short as it was (same style, same capital letters), in the language of the line. Return exactly as many texts per scene, in the same order.\n\nSome scenes also show number cards (a price, a percentage, a count). For each card return the number exactly as the new line says it, written with digits and its currency sign or unit in the same place as before ("sixty-five euros" -> "€65", "fifty seven dollars" -> "$57", "forty percent" -> "40%"), and "cue": the words of the new line that say it. When the new line no longer says that number, return "" for the number. Return exactly as many numbers per scene, in the same order.\n\n${JSON.stringify(ask)}\n\nAnswer JSON only: [{"scene": 1, "texts": ["..."], "numbers": [{"number": "...", "cue": "..."}]}]`,
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`${MODEL} failed (${res.status})`);
    const json = await res.json();
    usage.director(json.usageMetadata, MODEL);
    const answer = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text || '[]') as {
      scene: number;
      texts?: string[];
      numbers?: { number?: string; cue?: string }[];
    }[];
    for (const { i, slots, numbers } of scenes) {
      const reply = answer.find((a) => a.scene === i + 1);
      const texts = reply?.texts;
      if (Array.isArray(texts) && texts.length === slots.length) {
        slots.forEach((slot, k) => {
          const text = String(texts[k] ?? '').trim();
          // A text much longer than before would not fit its place on screen.
          if (text && text.length <= Math.max(24, slot.get().length * 1.6)) slot.set(text);
        });
      }
      const said = reply?.numbers;
      if (!Array.isArray(said) || said.length !== numbers.length) continue;
      const blocks = plan.scenes[i].blocks;
      numbers.forEach((block, k) => {
        const text = String(said[k]?.number ?? '').trim();
        const parsed = text ? parseNumberText(text) : null;
        if (parsed) {
          const before = numberText(block);
          if (parsed.value !== block.value) block.was = null; // an old "was" price belongs to the old number
          block.value = parsed.value;
          block.prefix = parsed.prefix || null;
          block.suffix = parsed.suffix || null;
          const cue = String(said[k]?.cue ?? '').trim();
          if (cue) block.cue = cue;
          if (before !== numberText(block)) console.log(`🖊️ Scene ${i + 1}: number card ${before} -> ${numberText(block)}`);
        } else if (!text && blocks.length > 1) {
          // The new line no longer says this number: it leaves the screen (a scene keeps at least one block).
          blocks.splice(blocks.indexOf(block), 1);
          console.log(`🖊️ Scene ${i + 1}: number card ${numberText(block)} removed, the new line does not say it`);
        }
      });
    }
    console.log(`🖊️ Words on screen matched to ${scenes.length} changed lines`);
  } catch (error) {
    console.warn('⚠️ The words on screen could not be matched to the changed lines, they stay as written:', String(error).slice(0, 160));
  }
  return plan;
}
