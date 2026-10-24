import sharp from 'sharp';
import { cropToFrame } from './brand';
import type { DirectorPlan } from './types';
import { usage } from './usage';

/**
 * Text never covers a face (owner 2026-10-24: "often you put text on the faces of people, I don't like that"). Over a
 * full-frame photo the words used to sit at the top whenever captions were on, so a face in the upper half disappeared
 * under the headline. Each full-frame photo is looked at once, cropped the way the viewer sees it, and the thirds that
 * hold a face are saved; the renderer then puts the words in a free third, or leaves them to the captions.
 */

export type FaceThird = 'top' | 'middle' | 'bottom';

const LOOK_MODEL = 'gemini-3.5-flash-lite';

/** The key a photo's faces are saved under: the same photo cropped elsewhere shows its faces elsewhere. */
export const faceKey = (asset: string, focus: string | null | undefined) => `${asset}@${focus || ''}`;

/** Which thirds of this vertical frame hold a face (about $0.0003). An empty list on any failure: the words stay where they were. */
async function facesIn(frame: Buffer): Promise<FaceThird[]> {
  try {
    const picture = await sharp(frame).resize(384, 683, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${LOOK_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GOOGLE_GENERATIVE_AI_API_KEY || '' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: picture.toString('base64') } },
              {
                text: 'This tall picture is split into three equal bands: top, middle and bottom. List every band in which a person\'s face (or most of a face) can be seen, including small or partly turned faces. Ignore faces printed on signs, screens or packaging. No faces at all: an empty list. Answer JSON only: {"faces": ["top", "middle", "bottom"]}',
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    usage.look();
    const text = (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
    const faces = JSON.parse(text).faces;
    return Array.isArray(faces) ? (['top', 'middle', 'bottom'] as const).filter((third) => faces.includes(third)) : [];
  } catch (error) {
    console.warn('⚠️ Face check failed, the words stay where they were:', String(error).slice(0, 160));
    return [];
  }
}

/**
 * Looks at every photo that fills a vertical frame under words (not a person talking: their scene has no title), and
 * saves its face thirds in `faces`, by faceKey. Photos already looked at keep their answer (an edit pays only for new ones).
 */
export async function findFaces(
  plan: DirectorPlan,
  assets: Record<string, { url: string; kind: 'image' | 'video' }>,
  faces: Record<string, FaceThird[]>,
  read: (url: string) => Promise<Buffer>
): Promise<Record<string, FaceThird[]>> {
  const wanted = new Map<string, { asset: string; focus: string | null | undefined }>();
  for (const scene of plan.scenes) {
    const { type, asset, focus } = scene.background;
    if (type !== 'mediaFull' || !asset || scene.speaker || !scene.blocks.length || assets[asset]?.kind !== 'image') continue;
    const key = faceKey(asset, focus);
    if (!(key in faces)) wanted.set(key, { asset, focus });
  }
  const found = await Promise.all(
    [...wanted].map(async ([key, { asset, focus }]) => {
      try {
        const frame = await cropToFrame(await read(assets[asset].url), focus, false);
        return [key, await facesIn(frame)] as const;
      } catch (error) {
        console.warn(`⚠️ Face check of ${asset} skipped:`, String(error).slice(0, 160));
        return [key, [] as FaceThird[]] as const;
      }
    })
  );
  return { ...faces, ...Object.fromEntries(found) };
}
