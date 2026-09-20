import { z } from 'zod';
import { MAX_ANIMATED_PHOTOS, MAX_LIFESTYLE_PHOTOS } from './pricing';

/**
 * Smart Video — the director's plan.
 * The AI never writes timings or pixel positions: it writes what is said
 * (`narration`), what appears (`blocks`) and the spoken words each element
 * appears on (`cue`). Timings come from the generated voice.
 */

/** auto = the director rewrites freely and decides the length (the default); script = narrate the client's own words in full. */
export const VIDEO_LENGTHS = ['auto', 'script'] as const;
export type VideoLength = (typeof VIDEO_LENGTHS)[number];

export const STYLE_NAMES = ['playful', 'elegant', 'bold', 'clean'] as const;

const cue = z.string().nullish().describe('Exact words from this scene\'s narration on which the element appears; null = scene start');
const tone = z.enum(['light', 'brand', 'accent']).nullish();

const ItemSchema = z.object({ icon: z.string(), text: z.string(), cue });

export const BlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('title'), text: z.string(), tone, cue }),
  z.object({ type: z.literal('pill'), text: z.string(), tone: z.enum(['accent', 'dark', 'light', 'brand']).nullish(), cue }),
  z.object({ type: z.literal('badge'), text: z.string(), cue }),
  z.object({ type: z.literal('highlight'), text: z.string(), cue }),
  z.object({ type: z.literal('caption'), text: z.string(), cue }),
  z.object({ type: z.literal('emoji'), text: z.string(), cue }),
  z.object({ type: z.literal('logo'), asset: z.string(), cue }),
  z.object({
    type: z.literal('media'),
    asset: z.string(),
    shape: z.enum(['wide', 'photo', 'square', 'small', 'tall']).nullish(),
    focus: z.string().nullish().describe('CSS object-position of the subject, e.g. "60% 40%"'),
    startFrom: z.number().nullish().describe('For video: second to start from'),
    footerPill: z.object({ text: z.string(), cue }).nullish(),
    cutout: z.boolean().nullish().describe('Show the product without its background, floating on the scene'),
    cue,
  }),
  z.object({ type: z.literal('gallery'), assets: z.array(z.string()).min(2).max(3), cue }),
  z.object({ type: z.literal('stars'), rating: z.number().min(0).max(5), text: z.string().nullish(), cue }),
  z.object({ type: z.literal('quote'), text: z.string(), author: z.string().nullish(), cue }),
  z.object({ type: z.literal('number'), value: z.number(), was: z.number().nullish(), prefix: z.string().nullish(), suffix: z.string().nullish(), cue }),
  z.object({ type: z.literal('chips'), items: z.array(ItemSchema).min(1).max(5) }),
  z.object({ type: z.literal('rows'), items: z.array(ItemSchema).min(1).max(5) }),
  z.object({
    type: z.literal('tiles'),
    items: z.array(z.object({ top: z.string(), big: z.string(), icon: z.string(), color: z.string().nullish(), cue })).min(2).max(5),
  }),
]);

export const SceneSchema = z.object({
  narration: z.string().min(1),
  speaker: z
    .object({ asset: z.string(), from: z.number().min(0), to: z.number().positive() })
    .nullish()
    .describe('The narration of this scene is spoken by a person in this clip, between these seconds: their own voice is used'),
  background: z.object({
    type: z.enum(['brand', 'mediaBlur', 'mediaFull', 'imageTop']),
    asset: z.string().nullish(),
    focus: z.string().nullish(),
  }),
  blocks: z.array(BlockSchema).min(1).max(6),
});

export const DirectorPlanSchema = z.object({
  language: z.string().describe('ISO 639-1 code of the narration language'),
  format: z.enum(['announcement', 'tour', 'product']),
  style: z.enum(STYLE_NAMES),
  captions: z.boolean().describe('Word-by-word captions in the lower third'),
  styleReason: z.string(),
  theme: z.object({ bg: z.string().nullish(), accent: z.string().nullish() }).nullish(),
  voice: z.object({ gender: z.enum(['female', 'male']), direction: z.string() }),
  musicPrompt: z.string(),
  lifestyleShots: z
    .array(z.object({ id: z.string(), fromAsset: z.string(), prompt: z.string() }))
    .max(MAX_LIFESTYLE_PHOTOS)
    .nullish()
    .describe('Product format only: photos to generate of the real product in use'),
  animate: z
    .array(z.object({ asset: z.string(), prompt: z.string() }))
    .max(MAX_ANIMATED_PHOTOS)
    .nullish()
    .describe('Photos used as full-frame backgrounds that should become moving clips'),
  signatureSound: z.object({ prompt: z.string(), afterScene: z.number().int().min(0) }).nullish(),
  assets: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['logo', 'photo', 'product', 'clip', 'artwork', 'document', 'skip']),
      description: z.string(),
      factsFound: z.array(z.string()).nullish(),
      logoOnSolidBackground: z.boolean().nullish(),
    })
  ),
  warnings: z.array(z.string()).nullish().describe('What the client should know: missing contact, unusable files, facts that conflict'),
  scenes: z.array(SceneSchema).min(4).max(28),
});

export type DirectorPlan = z.infer<typeof DirectorPlanSchema>;
export type DirectorBlock = z.infer<typeof BlockSchema>;

export interface SmartAsset {
  id: string;
  filename: string;
  kind: 'image' | 'video';
  /** Bytes sent to the director (JPEG/PNG/MP4). */
  data: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  /** Measured colours: the flat background (if any) and the dominant saturated colours. */
  flatBackground?: string;
  palette?: string[];
  /** Where the renderer can load it from. */
  url: string;
}

/** Saves a generated file and returns the URL the renderer will load. */
export type StoreFile = (data: Buffer, name: string, contentType: string) => Promise<string>;
