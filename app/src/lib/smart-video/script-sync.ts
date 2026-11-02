import type { DirectorBlock, DirectorPlan } from './types';
import { usage } from './usage';

/**
 * Script first (owner 2026-11-02): the client changes only the voice-over. The words on screen of each scene they
 * changed are matched to the new line here, so a claim taken out of the voice-over ("eliminate tennis elbow pain")
 * does not stay on screen. Only those texts change, the voice-over stays exactly as approved, and a failure keeps the
 * texts as they were: the video is made either way.
 */

const MODEL = 'gemini-3.6-flash';

type Slot = { get: () => string; set: (text: string) => void };

/** The words a block shows that can be reworded (numbers count up on screen and stay as they are). */
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

export async function matchScreenWords(plan: DirectorPlan, changed: number[]): Promise<DirectorPlan> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const scenes = changed
    .map((i) => ({ i, slots: plan.scenes[i].blocks.flatMap(slotsOf) }))
    .filter((scene) => scene.slots.length > 0);
  if (!key || !scenes.length) return plan;
  const ask = scenes.map(({ i, slots }) => ({ scene: i + 1, line: plan.scenes[i].narration, texts: slots.map((slot) => slot.get()) }));
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `These scenes of a video ad have a new spoken line, written by the business owner. Each scene shows short texts on screen that were written for the old line. Rewrite each text so it says only what the new line says: keep a text that still fits word for word, change one that no longer fits, and never show a claim, number, price or promise the new line does not make. Keep each text as short as it was (same style, same capital letters), in the language of the line. Return exactly as many texts per scene, in the same order.\n\n${JSON.stringify(ask)}\n\nAnswer JSON only: [{"scene": 1, "texts": ["..."]}]`,
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
    const answer = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text || '[]') as { scene: number; texts: string[] }[];
    for (const { i, slots } of scenes) {
      const texts = answer.find((a) => a.scene === i + 1)?.texts;
      if (!Array.isArray(texts) || texts.length !== slots.length) continue;
      slots.forEach((slot, k) => {
        const text = String(texts[k] ?? '').trim();
        // A text much longer than before would not fit its place on screen.
        if (text && text.length <= Math.max(24, slot.get().length * 1.6)) slot.set(text);
      });
    }
    console.log(`🖊️ Words on screen matched to ${scenes.length} changed lines`);
  } catch (error) {
    console.warn('⚠️ The words on screen could not be matched to the changed lines, they stay as written:', String(error).slice(0, 160));
  }
  return plan;
}
