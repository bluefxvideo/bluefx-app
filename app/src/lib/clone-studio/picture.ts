import { downloadAndUploadImage } from '@/actions/supabase-storage';
import { generateWithFalNanaBanana2, type NanoBananaAspectRatio } from '@/actions/models/fal-nano-banana-2';
import { editWithGptImage2 } from '@/actions/models/fal-gpt-image-2';
import { generateWithGptImage25 } from '@/actions/models/fal-gpt-image-25';
import { ensureFalCompatibleImage } from '@/lib/fal-image-guard';
import { imageEngine } from '@/lib/image-engine';
import { usage } from '@/lib/smart-video/usage';
import { CLONE_MAX_IMAGE_VERSIONS, type CloneImageEngine, type CloneProject, type CloneScene } from '@/types/clone-studio';
import { smallPicture } from './files';

/**
 * Clone Studio's pictures: the scene picture (the source frame with the client's people and
 * products swapped in), the picture of an invented cast member, and the director's own look
 * at a finished picture. No credits move here and nothing is written to the board: the
 * callers (the scene card's button, the "Do it for me" run) do both.
 */

const CHECK_MODEL = 'gemini-3.6-flash';
/** The points of the check that fail a picture. "frame" (another angle or crop) is noted by the model and let through. */
const SERIOUS = ['done', 'identity', 'leftovers', 'damage', 'added', 'kept'];

/**
 * The edit prompt intentionally does NOT restate the original character
 * description (it would fight the user's swap instruction) and does NOT
 * carry the scene's action-arc invariants — those describe the whole scene's
 * motion and can reference objects that aren't in this frame, which makes the
 * edit model ADD them (a "the can never comes off" rule conjured a can into
 * an untouched hand). The frame itself is the only ground truth; invariants
 * stay in the animation prompt where they belong.
 */
export function buildSceneEditPrompt(scene: Pick<CloneScene, 'user_instruction'>, refCount: number): string {
  const parts: string[] = [];
  parts.push('Edit the first image — a single frame from a video ad.');
  if (scene.user_instruction?.trim()) {
    parts.push(`Apply these changes: ${scene.user_instruction.trim()}.`);
  } else {
    parts.push('Recreate this frame faithfully with no content changes.');
  }
  if (refCount > 0) {
    parts.push(
      refCount === 1
        ? 'Use the additional reference image for the exact identity and appearance of the replacement person or product.'
        : `Use the ${refCount} additional reference images for the exact identity and appearance of the replacement people or products.`
    );
  }
  parts.push(
    "Preserve everything else from the first image EXACTLY: framing, camera angle, perspective, lens look, lighting, color grade, background, setting, all other people and objects, and the subject's pose and expression."
  );
  parts.push(
    'Do NOT add, remove, or relocate any object beyond what the requested changes require. If the frame shows a physically impossible or comedic state, that state must remain true in the edited frame.'
  );
  parts.push('Photorealistic, seamless edit. No borders, no added text, no watermark.');
  return parts.join(' ');
}

/** The photos a scene's picture is made with: the project's photos the scene did not drop, then the scene's own. */
export function sceneReferences(project: CloneProject, scene: CloneScene): string[] {
  const excluded = new Set(scene.excluded_project_ref_urls || []);
  const projectRefs = (project.analysis_summary?.project_ref_urls || []).filter((url) => !excluded.has(url));
  return [...new Set([...projectRefs, ...(scene.user_ref_urls || [])])].slice(0, 6);
}

/**
 * Makes the swapped picture of one scene and stores it. Always edits from the ORIGINAL
 * frame (fresh edits do not compound artifacts). `attemptId` only names the temporary files.
 */
export async function makeScenePicture(project: CloneProject, scene: CloneScene, attemptId: string, engineChoice?: CloneImageEngine): Promise<string> {
  // FAL rejects images over ~5MB after base64 inflation — compress if needed
  const keyframe = (await ensureFalCompatibleImage(scene.keyframe_url, attemptId, `scene${scene.n}-key`))!;
  const refs: string[] = [];
  for (const [i, url] of sceneReferences(project, scene).entries()) {
    const guarded = await ensureFalCompatibleImage(url, attemptId, `scene${scene.n}-ref${i + 1}`);
    if (guarded) refs.push(guarded);
  }

  const prompt = buildSceneEditPrompt(scene, refs.length);
  // GPT Image 2.5 edits by default (see src/lib/image-engine.ts); nb2 stays
  // available per scene and as the IMAGE_ENGINE=nb2 rollback.
  const engine: CloneImageEngine = engineChoice || (imageEngine() === 'gpt25' ? 'gpt2' : 'nb2');
  const result =
    engine === 'gpt2'
      ? await editWithGptImage2({ prompt, image_urls: [keyframe, ...refs] })
      : await generateWithFalNanaBanana2({
          prompt,
          image_input: [keyframe, ...refs],
          aspect_ratio: (project.aspect_ratio || 'auto') as NanoBananaAspectRatio,
          output_format: 'jpeg',
        });
  if (!result.success || !result.imageUrl) throw new Error(result.error || 'Image generation failed');

  // Persist to our storage — fal URLs are temporary
  const stored = await downloadAndUploadImage(result.imageUrl, 'clone-studio', undefined, {
    bucket: 'images',
    folder: `clone-studio/${project.id}`,
    filename: `scene-${String(scene.n).padStart(2, '0')}-edit-${Date.now()}.jpg`,
    contentType: 'image/jpeg',
  });
  if (!stored.success || !stored.url) throw new Error(`Could not store the generated image: ${stored.error}`);
  return stored.url;
}

/**
 * A scene with a new current picture. image_versions is the FULL history (newest first)
 * INCLUDING the current image; edited_image_url is just the selected pointer. Stable order
 * means the version strip never reshuffles on restore. Legacy rows (current not in the
 * list) converge here.
 */
export function withPicture(scene: CloneScene, url: string): CloneScene {
  const history = scene.image_versions || [];
  const withCurrent = scene.edited_image_url && !history.includes(scene.edited_image_url) ? [scene.edited_image_url, ...history] : history;
  return { ...scene, edited_image_url: url, image_versions: [url, ...withCurrent.filter((old) => old !== url)].slice(0, CLONE_MAX_IMAGE_VERSIONS) };
}

/** A picture of a person or product the client has no photo of, from the director's description. */
export async function makeCastPicture(projectId: string, prompt: string): Promise<string> {
  const result = await generateWithGptImage25({ prompt, aspect_ratio: '1:1', quality: 'high', output_format: 'jpeg' });
  if (!result.success || !result.imageUrl) throw new Error(result.error || 'Image generation failed');
  const stored = await downloadAndUploadImage(result.imageUrl, 'clone-studio', undefined, {
    bucket: 'images',
    folder: `clone-studio/${projectId}/refs`,
    filename: `cast-${Date.now()}.jpg`,
    contentType: 'image/jpeg',
  });
  if (!stored.success || !stored.url) throw new Error(`Could not store the generated image: ${stored.error}`);
  return stored.url;
}

export interface PictureVerdict {
  pass: boolean;
  /** The points that failed: done, identity, leftovers, frame, damage, added, kept. */
  failed: string[];
  /** One short sentence a client can read. */
  why: string;
}

const CHECK = `You check one frame of an ad remake. You get, in this order: the ORIGINAL frame, the NEW frame made from it, then the client's reference photos (if any).

Judge the NEW frame on these points:
1. done: every requested change is visible in the new frame (the replaced thing is gone, the replacement is there).
2. identity: where the instruction points to a reference photo, the new frame shows that same person or product (face, hair, packaging), not a lookalike.
3. leftovers: nothing of the replaced brand, product or person is still visible, and no source logo or on-screen text is left when its removal was asked. Clothes or a costume that the instruction says the replacement wears are no leftover.
4. frame: camera angle, framing and the positions of everything else are kept as in the original, unless the instruction asked otherwise.
5. damage: no distorted faces or hands, no extra limbs or fingers, no duplicated objects, no garbled text, no pasted-on look.
6. added: nothing was added that the instruction did not ask for.
7. kept: every thing of the original frame that the instruction does not mention is still there and still the same thing (a toilet, a table, a tool in a hand, a second person or animal). A swap that swallowed its neighbour, or that put the replacement in the place of another thing, fails here. So does a replacement that is seen from another side than what it replaces (seen from behind stays seen from behind).

Be strict about done, identity, leftovers, damage and kept. Be lenient about small differences in light and colour.
"why" says in one short plain sentence what is wrong with the NEW frame, in words that could be given to the picture model as a correction ("The source logo is still on the apron."). Empty when the frame passes.
Answer JSON only: {"pass": true or false, "failed": [the names of the points that fail], "why": "..."}`;

/**
 * The director's own look at a scene picture: was the swap done, is it the client's person
 * and product, is anything of the source left, is the picture damaged? Null when the look
 * itself failed: a picture nobody could check counts as fine.
 */
export async function checkScenePicture(input: { keyframe: string; picture: string; instruction: string; refs: string[] }): Promise<PictureVerdict | null> {
  try {
    const image = async (url: string) => ({ inlineData: { mimeType: 'image/jpeg', data: await smallPicture(url) } });
    const parts: unknown[] = [{ text: `${CHECK}\n\nThe edit that was asked for: "${input.instruction}"\n\nORIGINAL frame:` }, await image(input.keyframe), { text: 'NEW frame:' }, await image(input.picture)];
    for (const [i, ref] of input.refs.entries()) parts.push({ text: `Reference photo ${i + 1}:` }, await image(ref));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CHECK_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GOOGLE_GENERATIVE_AI_API_KEY || '' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
    const json = await res.json();
    usage.pictureCheck();
    const text = (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
    const verdict = JSON.parse(text);
    const failed: string[] = Array.isArray(verdict.failed) ? verdict.failed.map((point: unknown) => String(point).toLowerCase().trim()) : [];
    // A different framing alone does not spoil an ad: only the points a viewer would notice fail a picture.
    const serious = failed.filter((point) => SERIOUS.includes(point));
    const pass = Boolean(verdict.pass) || (failed.length > 0 && serious.length === 0);
    return { pass, failed: pass ? [] : serious.length ? serious : failed, why: pass ? '' : String(verdict.why || '').trim() };
  } catch (error) {
    console.warn('Clone Studio: a picture could not be checked:', String(error).slice(0, 160));
    return null;
  }
}
