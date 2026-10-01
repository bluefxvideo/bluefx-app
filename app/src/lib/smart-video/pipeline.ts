import sharp from 'sharp';
import { directVideo, reviseVideo } from './director';
import {
  MOTION_CLIP_SECONDS,
  animatePhoto,
  changeTempo,
  cutOutProduct,
  generateDrawing,
  generateLifestyleShot,
  generateMusic,
  generateSound,
  generateVoice,
  pcmToWav,
  transcribeWords,
  type SpokenWord,
} from './audio';
import { captionDigits, withDigits, type NumberSpan } from './numbers';
import { alignScript, cueTime } from './timing';
import { buildTheme, cropToFrame, cutOutLogo } from './brand';
import { tracePng } from './drawing-path';
import {
  LISTING_MAX_PAUSE,
  LISTING_MIN_PHOTOS,
  LISTING_MOTION,
  LISTING_TAIL,
  LISTING_TEMPO,
  listingClipSeconds,
  listingFigure,
  listingVoiceEnd,
  type ListingOptions,
} from './listing';
import { extractAudio } from './prepare-assets';
import type { DirectorBlock, DirectorPlan, SmartAsset, StoreFile, StyleName, VideoFormat, VideoLength } from './types';
import { trackUsage, type UsageEntry } from './usage';

/**
 * Smart Video — brief + files in, render-ready SmartVideo props out.
 * director → (voice → word timings) ‖ music ‖ signature sound ‖ logo cut-out → timeline.
 */

const VOICE_LEAD = 0.25; // silence before the first word
const TEXT_LEAD = 0.12; // text lands just before its word
const SCENE_LEAD = 0.3; // a scene opens just before its first word
const SOUND_GAP = 0.9; // room made in the voice for the signature sound
const HANDOVER_PAUSE = 0.45; // a breath between a person talking and the narrator
const TAIL = 4.2; // music-only ending that holds the contact card
const VOICE_TAKES = 3;
// Spoken numbers come back as digits, so a faithful take still misses some words.
const MIN_SCENE_COVERAGE = 0.5;
const MISSING_SCENE_COVERAGE = 0.3;
const VOICE_PART_WORDS = 130; // a long script is recorded in parts: shorter takes skip less and retake cheaply
const VOICE_PART_GAP = 0.35; // breath between parts
const MUSIC_ALONE = 0.4; // music level when nobody speaks over it (the level it lifts to after the last word)

const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' });

export type SmartVideoStage = 'directing' | 'producing';

/** What the client wants to hear. Both are on unless the client switches one off. */
export interface SmartVideoSound {
  /** The narrator reading the script. Off: the words are shown as captions and nobody reads them. */
  voiceOver: boolean;
  music: boolean;
}
const FULL_SOUND: SmartVideoSound = { voiceOver: true, music: true };
/** Without the narrator the words have to be read: captions are on whatever the plan says. */
const showsCaptions = (plan: DirectorPlan, sound: SmartVideoSound) => plan.captions || !sound.voiceOver;

/** Everything generated for a video. Saved with the plan, so a revision can reuse it. */
export interface SmartVideoMedia {
  /** The shape of the video; a revision keeps it. Absent on older videos = vertical. */
  format?: VideoFormat;
  /** Voice-over and music on or off; a revision keeps the choice or changes it. Absent on older videos = both on. */
  sound?: SmartVideoSound;
  /**
   * The narrator's recording; null when people in the client's clips say everything.
   * Recorded even with the voice-over off: every picture, text and caption is timed to it.
   */
  voice: { url: string; words: SpokenWord[]; durationSeconds: number } | null;
  /** Word timings of what is said in each talking clip, by asset id. */
  clipWords: Record<string, SpokenWord[]>;
  musicUrl: string | null;
  soundUrl: string | null;
  /** The numbers the captions show as digits ("ten eggs" → "10 eggs"), by narration line. Absent on older videos. */
  digits?: Record<string, NumberSpan[]>;
  /** The video is an automatic listing video; a revision keeps its recipe and its plain cuts. */
  listing?: ListingOptions;
  /**
   * What the renderer loads: uploads, cut-outs, lifestyle photos, animated clips.
   * `seconds`: an animated clip's length.
   * `path`: a whiteboard drawing's lines as x0, y0, x1, y1, ... (0 to 1), in the order the hand draws them.
   */
  assets: Record<
    string,
    { url: string; kind: 'image' | 'video'; cutoutUrl?: string; portrait?: boolean; width?: number; height?: number; seconds?: number; path?: number[] }
  >;
}

export interface SmartVideoResult {
  props: Record<string, unknown>;
  plan: DirectorPlan;
  media: SmartVideoMedia;
  durationSeconds: number;
  /** API spend of this video, step by step (USD). */
  usage: UsageEntry[];
  /** Notes for the client about things only they can fix (e.g. no contact detail). */
  warnings: string[];
}

export interface SmartVideoOptions {
  length?: VideoLength;
  format?: VideoFormat;
  /** A look the client picked; null lets the director choose. */
  look?: StyleName | null;
  sound?: SmartVideoSound;
  /** The automatic listing video (ReelEstate). */
  listing?: ListingOptions | null;
  /**
   * A listing's animated photos are paid per photo. `charge` is asked before a photo is animated
   * (false = no credits: the photo stays still); `refund` gives the credits back when its clip fails.
   */
  clips?: { charge: (assetId: string) => Promise<boolean>; refund: (assetId: string) => Promise<void> };
  onStage?: (stage: SmartVideoStage) => void;
}

export async function createSmartVideo(
  brief: string,
  assets: SmartAsset[],
  store: StoreFile,
  loadStored: (url: string) => Promise<Buffer>,
  options: SmartVideoOptions = {}
): Promise<SmartVideoResult> {
  const { result, usage } = await trackUsage(() => produce(brief, assets, store, loadStored, options));
  return { ...result, usage };
}

async function produce(
  brief: string,
  assets: SmartAsset[],
  store: StoreFile,
  loadStored: (url: string) => Promise<Buffer>,
  { length = 'auto', format = 'vertical', look = null, sound = FULL_SOUND, listing = null, clips, onStage = () => {} }: SmartVideoOptions
): Promise<Omit<SmartVideoResult, 'usage'>> {
  // A listing whose page is off the market often keeps a single photo: say so before anything is spent.
  const photos = assets.filter((a) => a.kind === 'image').length;
  if (listing && photos < LISTING_MIN_PHOTOS) {
    throw new Error(
      `A listing video needs at least ${LISTING_MIN_PHOTOS} photos and ${photos === 1 ? 'only 1 came' : `${photos} came`} with this listing. Add your own photos, or check that the link shows an active listing.`
    );
  }
  onStage('directing');
  console.log(`🎬 Smart Video: directing (${assets.length} files${listing ? `, listing video of ${listing.seconds} s` : ''})...`);
  const horizontal = format === 'horizontal';
  const plan = await directVideo(brief, assets, length, format, look, listing);
  console.log(`✅ Plan: ${plan.scenes.length} scenes, style "${plan.style}" (${plan.styleReason}), language ${plan.language}`);

  onStage('producing');
  // People talking in the client's clips carry their own scenes; the narrator records the rest.
  const speakerClips = [...new Set(plan.scenes.flatMap((scene) => (scene.speaker ? [scene.speaker.asset] : [])))];
  const narration = plan.scenes.filter((scene) => !scene.speaker).map((scene) => scene.narration);
  const languageName = LANGUAGE_NAMES.of(plan.language) || plan.language;
  const logoRole = plan.assets.find((a) => a.role === 'logo' && a.logoOnSolidBackground);
  const logoAsset = logoRole && assets.find((a) => a.id === logoRole.id && a.kind === 'image');

  // Packshots the director wants to float: background removed once per asset.
  const cutoutIds = new Set(
    plan.scenes.flatMap((scene) => scene.blocks.flatMap((b) => (b.type === 'media' && b.cutout ? [b.asset] : [])))
  );
  const cutouts = Promise.all(
    assets
      .filter((a) => cutoutIds.has(a.id) && a.kind === 'image')
      .map(async (a) => {
        const url = await cutOutProduct(a.data, a.mimeType)
          .then((png) => store(png, `${a.id}-cutout.png`, 'image/png'))
          .catch(() => null);
        return [a.id, url] as const;
      })
  ).then((pairs) => new Map(pairs));

  const lifestyle = Promise.all(
    (plan.lifestyleShots || []).map(async (shot) => {
      const from = assets.find((a) => a.id === shot.fromAsset) as SmartAsset;
      const url = await generateLifestyleShot(from.data, from.mimeType, shot.prompt, horizontal)
        .then((jpg) => store(jpg, `${shot.id}.jpg`, 'image/jpeg'))
        .catch((error) => {
          console.warn(`⚠️ Lifestyle photo ${shot.id} failed:`, String(error).slice(0, 160));
          return from.url; // the packshot still beats a blank scene
        });
      return [shot.id, { url, kind: 'image' as const, portrait: !horizontal }] as const;
    })
  );

  // Stills the director wants moving. The clip is made from the vertical crop the
  // background would show anyway; on failure the still simply stays.
  const focusOf = (id: string) => plan.scenes.find((scene) => scene.background.asset === id)?.background.focus;
  // Real footage already gives the video motion; animating stills on top only adds cost.
  const showsClip = plan.scenes.some((scene) =>
    [scene.background.asset, ...scene.blocks.map((b) => ('asset' in b ? b.asset : null))].some((id) => assets.find((a) => a.id === id)?.kind === 'video')
  );
  const motion = Promise.all(
    (showsClip ? [] : plan.animate || []).map(async (shot) => {
      try {
        const original = assets.find((a) => a.id === shot.asset && a.kind === 'image');
        const generated = original ? null : (await lifestyle).find(([id]) => id === shot.asset);
        const image = original ? original.data : generated ? await loadStored(generated[1].url) : null;
        if (!image) return null;
        const clip = await animatePhoto(await cropToFrame(image, focusOf(shot.asset), horizontal), shot.prompt, horizontal);
        return [shot.asset, await store(clip, `${shot.asset}-motion.mp4`, 'video/mp4')] as const;
      } catch (error) {
        console.warn(`⚠️ Animating ${shot.asset} failed:`, String(error).slice(0, 160));
        return null;
      }
    })
  ).then((pairs) => new Map(pairs.filter((pair): pair is readonly [string, string] => pair !== null)));

  const clipWords = Promise.all(
    speakerClips.map(async (id) => {
      const clip = assets.find((a) => a.id === id) as SmartAsset;
      return [id, await transcribeWords(await extractAudio(clip.data), plan.language)] as const;
    })
  ).then((pairs) => Object.fromEntries(pairs));

  const drawings = makeDrawings(plan.drawings || [], store);

  const [voice, musicUrl, soundUrl, logoUrl, cutoutUrls, lifestyleAssets, motionUrls, heardInClips, drawingAssets, digits] = await Promise.all([
    narration.length ? recordVoice(narration, languageName, plan, store, listing ? listingFit(listing, narration.length) : undefined) : null,
    sound.music
      ? generateMusic(plan.musicPrompt, plan.style)
          .then((mp3) => store(mp3, 'music.mp3', 'audio/mpeg'))
          .catch((error) => {
            console.warn('⚠️ Music failed, rendering without it:', String(error).slice(0, 200));
            return null;
          })
      : null,
    // A video without voice-over and without music is silent: no signature sound either.
    plan.signatureSound && (sound.voiceOver || sound.music)
      ? generateSound(plan.signatureSound.prompt)
          .then((mp3) => store(mp3, 'signature.mp3', 'audio/mpeg'))
          .catch(() => null)
      : null,
    logoAsset ? cutOutLogo(logoAsset.data).then((png) => store(png, 'logo-cutout.png', 'image/png')).catch(() => null) : null,
    cutouts,
    lifestyle,
    motion,
    clipWords,
    drawings,
    showsCaptions(plan, sound) ? captionDigits(plan.scenes.map((scene) => scene.narration), languageName) : {},
  ]);

  const media: SmartVideoMedia = {
    format,
    sound,
    ...(listing ? { listing } : {}),
    voice,
    clipWords: heardInClips,
    musicUrl,
    soundUrl,
    digits,
    assets: Object.fromEntries([
      ...[...motionUrls].map(([id, url]) => [`${id}-motion`, { url, kind: 'video' as const, portrait: !horizontal }] as const),
      ...lifestyleAssets,
      ...drawingAssets,
      ...assets.map(
        (a) =>
          [
            a.id,
            {
              url: logoUrl && a.id === logoAsset?.id ? logoUrl : a.url,
              kind: a.kind,
              cutoutUrl: cutoutUrls.get(a.id) || undefined,
              // A tall picture cannot fill a wide frame; the renderer shows it whole instead.
              portrait: Boolean(a.width && a.height && a.height > a.width * 1.15),
              // The picture's own shape: a card that crops a square or tall photo to a wide one cuts faces.
              width: a.width,
              height: a.height,
            },
          ] as const
      ),
    ]),
  };
  if (listing?.animate) await animateListingPhotos(plan, media, assets, store, clips);
  const props = buildProps(plan, media);
  return { props, plan, media, durationSeconds: props.duration, warnings: [...clientWarnings(plan), ...softPhotoWarnings(plan, assets)] };
}

/**
 * A listing video's photos become moving clips. This runs after the voice is recorded, because a
 * clip is made as long as its photo is on screen (6 to 12 seconds). A photo whose clip fails, or
 * that the client has no credits for, stays a still: the video is made either way.
 */
async function animateListingPhotos(
  plan: DirectorPlan,
  media: SmartVideoMedia,
  assets: SmartAsset[],
  store: StoreFile,
  clips: SmartVideoOptions['clips']
): Promise<void> {
  const horizontal = media.format === 'horizontal';
  const timed = buildProps(plan, media).scenes;
  // One clip per photo, as long as the longest scene that shows it
  const wanted = new Map<string, { seconds: number; focus?: string | null }>();
  plan.scenes.forEach((scene, i) => {
    const photo = assets.find((a) => a.id === scene.background.asset && a.kind === 'image');
    if (!photo || scene.background.type !== 'mediaFull') return;
    const seconds = timed[i].end - timed[i].start;
    if (seconds > (wanted.get(photo.id)?.seconds ?? 0)) wanted.set(photo.id, { seconds, focus: scene.background.focus });
  });
  console.log(`🎞️ Animating ${wanted.size} listing photos...`);
  await Promise.all(
    [...wanted].map(async ([id, { seconds, focus }]) => {
      if (clips && !(await clips.charge(id))) return;
      try {
        const photo = assets.find((a) => a.id === id) as SmartAsset;
        const clipSeconds = listingClipSeconds(seconds);
        const clip = await animatePhoto(await cropToFrame(photo.data, focus, horizontal), LISTING_MOTION, horizontal, clipSeconds, true);
        media.assets[`${id}-motion`] = { url: await store(clip, `${id}-motion.mp4`, 'video/mp4'), kind: 'video', portrait: !horizontal, seconds: clipSeconds };
      } catch (error) {
        console.warn(`⚠️ Animating ${id} failed, the photo stays still:`, String(error).slice(0, 160));
        await clips?.refund(id).catch(() => undefined);
      }
    })
  );
}

/**
 * Changes a finished video from a note in plain words. Only what the note
 * touches is redone: the voice when the spoken words change, the music or the
 * signature sound when their prompts change. Everything else is reused.
 */
export async function reviseSmartVideo(
  previous: { plan: DirectorPlan; media: SmartVideoMedia },
  note: string,
  brief: string,
  store: StoreFile,
  onStage: (stage: SmartVideoStage) => void = () => {},
  added: SmartAsset[] = [],
  /** Voice-over and music as the client wants them now; absent = as they were. */
  soundNow?: SmartVideoSound
): Promise<SmartVideoResult> {
  const { result, usage } = await trackUsage(async () => {
    const sound = soundNow ?? previous.media.sound ?? FULL_SOUND;
    onStage('directing');
    // A change of the sound alone needs no new plan: the same video is rendered with another soundtrack.
    const plan = note.trim() ? await reviseVideo(previous.plan, note, brief, previous.media.assets, previous.media.format, added, previous.media.listing ?? null) : previous.plan;
    onStage('producing');
    const media = { ...previous.media, sound, assets: { ...previous.media.assets }, clipWords: { ...(previous.media.clipWords || {}) } };
    await addFiles(plan, media, added, store);
    await measurePhotos(media);
    await traceDrawings(plan, media);
    // Whiteboard: a drawing that is new, or whose description changed, is drawn again; the others are kept.
    const before = new Map((previous.plan.drawings || []).map((d) => [d.id, d.prompt]));
    const redraw = (plan.drawings || []).filter((d) => !media.assets[d.id] || before.get(d.id) !== d.prompt);
    for (const [id, asset] of await makeDrawings(redraw, store)) media.assets[id] = asset;
    // Only the narrator's lines are recorded; a speaker scene needs the clip's saved word timings.
    const clipWordsSaved = media.clipWords || {};
    const spoken = (p: DirectorPlan) => p.scenes.filter((scene) => !(scene.speaker && clipWordsSaved[scene.speaker.asset])).map((scene) => scene.narration);
    if (JSON.stringify(spoken(plan)) !== JSON.stringify(spoken(previous.plan)) || plan.voice.gender !== previous.plan.voice.gender) {
      const fit = previous.media.listing ? listingFit(previous.media.listing, spoken(plan).length) : undefined;
      media.voice = spoken(plan).length ? await recordVoice(spoken(plan), LANGUAGE_NAMES.of(plan.language) || plan.language, plan, store, fit) : null;
    }
    // Music is made when the plan asks for other music, or when it is switched on for a video made without.
    if (sound.music && (plan.musicPrompt !== previous.plan.musicPrompt || !media.musicUrl)) {
      media.musicUrl = await generateMusic(plan.musicPrompt, plan.style)
        .then((mp3) => store(mp3, 'music.mp3', 'audio/mpeg'))
        .catch(() => previous.media.musicUrl);
    }
    const wantsSignature = Boolean(plan.signatureSound) && (sound.voiceOver || sound.music);
    if (plan.signatureSound?.prompt !== previous.plan.signatureSound?.prompt || (wantsSignature && !media.soundUrl)) {
      media.soundUrl = wantsSignature && plan.signatureSound
        ? await generateSound(plan.signatureSound.prompt)
            .then((mp3) => store(mp3, 'signature.mp3', 'audio/mpeg'))
            .catch(() => null)
        : null;
    }
    // Lines that are new in this edit (or a video made before captions showed digits) are read for numbers.
    const unread = showsCaptions(plan, sound) ? plan.scenes.map((scene) => scene.narration).filter((line) => !(line.trim() in (media.digits || {}))) : [];
    if (unread.length) media.digits = { ...media.digits, ...(await captionDigits(unread, LANGUAGE_NAMES.of(plan.language) || plan.language)) };
    const props = buildProps(plan, media);
    return { props, plan, media, durationSeconds: props.duration, warnings: clientWarnings(plan) };
  });
  return { ...result, usage };
}

/**
 * A photo much smaller than the card it is shown in comes out soft. The engine cannot sharpen it,
 * but the client can upload a larger one, so they are told which photo it is.
 */
const SOFT_PHOTO_PX = 500;
function softPhotoWarnings(plan: DirectorPlan, assets: SmartAsset[]): string[] {
  const shown = new Set(plan.scenes.flatMap((scene) => [scene.background.asset, ...scene.blocks.flatMap((b) => ('asset' in b ? [b.asset] : 'assets' in b ? b.assets : []))]));
  const logos = new Set(plan.assets.filter((a) => a.role === 'logo').map((a) => a.id));
  return assets
    .filter((a) => a.kind === 'image' && shown.has(a.id) && !logos.has(a.id) && a.width && a.height && Math.max(a.width, a.height) < SOFT_PHOTO_PX)
    .map((a) => `The photo "${a.filename}" is small (${a.width} x ${a.height} pixels) and looks soft in the video. A larger version of it will look sharper.`);
}

/** Drawings made before their lines were traced: trace them once, so an edit's hand follows the lines too. */
async function traceDrawings(plan: DirectorPlan, media: SmartVideoMedia): Promise<void> {
  await Promise.all(
    (plan.drawings || []).map(async ({ id }) => {
      const asset = media.assets[id];
      if (!asset || asset.path?.length || !/^https?:/.test(asset.url)) return;
      try {
        const png = Buffer.from(await (await fetch(asset.url, { signal: AbortSignal.timeout(20_000) })).arrayBuffer());
        media.assets[id] = { ...asset, path: await tracePng(png) };
      } catch {
        // an untraced drawing is revealed row by row, as before
      }
    })
  );
}

/** Videos made before sizes were saved: measure their photos once, so an edit shows them in their own shape. */
async function measurePhotos(media: SmartVideoMedia): Promise<void> {
  await Promise.all(
    Object.entries(media.assets).map(async ([id, asset]) => {
      if (asset.kind !== 'image' || asset.width || !/^https?:/.test(asset.url)) return;
      try {
        const { width, height } = await sharp(Buffer.from(await (await fetch(asset.url, { signal: AbortSignal.timeout(20_000) })).arrayBuffer())).metadata();
        if (width && height) media.assets[id] = { ...asset, width, height };
      } catch {
        // an unmeasured photo keeps the card the director chose
      }
    })
  );
}

/** Whiteboard drawings, in parallel. One that fails leaves its scene on the plain board rather than failing the video. */
async function makeDrawings(list: { id: string; prompt: string }[], store: StoreFile) {
  const made = await Promise.all(
    list.map(async (d) => {
      try {
        const { png, width, height, path } = await generateDrawing(d.prompt);
        const url = await store(png, `${d.id}-${Date.now().toString(36)}.png`, 'image/png');
        return [d.id, { url, kind: 'image' as const, width, height, path }] as const;
      } catch (error) {
        console.warn(`⚠️ Drawing ${d.id} failed:`, String(error).slice(0, 160));
        return null;
      }
    })
  );
  return made.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

/** Files that came with an edit: whatever the new plan does with them (float, logo, talking clip) is prepared here. */
async function addFiles(plan: DirectorPlan, media: SmartVideoMedia, added: SmartAsset[], store: StoreFile): Promise<void> {
  const cutoutIds = new Set(plan.scenes.flatMap((scene) => scene.blocks.flatMap((b) => (b.type === 'media' && b.cutout ? [b.asset] : []))));
  const speakerIds = new Set(plan.scenes.flatMap((scene) => (scene.speaker ? [scene.speaker.asset] : [])));
  await Promise.all(
    added.map(async (a) => {
      const role = plan.assets.find((entry) => entry.id === a.id);
      const isLogo = a.kind === 'image' && role?.role === 'logo' && role.logoOnSolidBackground;
      const [logoUrl, cutoutUrl, heard] = await Promise.all([
        isLogo ? cutOutLogo(a.data).then((png) => store(png, `${a.id}-logo-cutout.png`, 'image/png')).catch(() => null) : null,
        a.kind === 'image' && cutoutIds.has(a.id) ? cutOutProduct(a.data, a.mimeType).then((png) => store(png, `${a.id}-cutout.png`, 'image/png')).catch(() => null) : null,
        a.kind === 'video' && speakerIds.has(a.id) ? transcribeWords(await extractAudio(a.data), plan.language) : null,
      ]);
      media.assets[a.id] = {
        url: logoUrl || a.url,
        kind: a.kind,
        cutoutUrl: cutoutUrl || undefined,
        portrait: Boolean(a.width && a.height && a.height > a.width * 1.15),
        width: a.width,
        height: a.height,
      };
      if (heard) media.clipWords[a.id] = heard;
    })
  );
}

/** Pins a plan to its recorded voice: scene times, text cues, captions, soundtrack. Pure. */
export function buildProps(plan: DirectorPlan, media: SmartVideoMedia) {
  const { voice, musicUrl, soundUrl } = media;
  const sound = media.sound ?? FULL_SOUND;
  // Photos that were animated, with the length of each clip
  const motionClips = new Map(
    Object.entries(media.assets).flatMap(([id, asset]) => (id.endsWith('-motion') ? [[id.slice(0, -'-motion'.length), asset.seconds ?? MOTION_CLIP_SECONDS] as const] : []))
  );
  // A scene is carried either by the narrator's recording or by a person talking in a clip.
  const speakerOf = (i: number) => {
    const speaker = plan.scenes[i].speaker;
    return speaker && media.clipWords?.[speaker.asset] ? speaker : null;
  };
  const narrated = plan.scenes.map((_, i) => i).filter((i) => !speakerOf(i));
  const narratorTokens = voice ? alignScript(narrated.map((i) => plan.scenes[i].narration), voice.words).sceneTokens : [];
  const soundAfter = soundUrl && plan.signatureSound ? Math.min(plan.signatureSound.afterScene, plan.scenes.length - 2) : -1;

  // Walk the scenes in order, laying each one's audio on the timeline right after the last.
  // `pause`: a beat of music after each narrated scene (a listing video uses it to reach its length).
  const layOut = (pause: number) => {
    const cuts: { url?: string; at: number; srcStart: number; srcEnd: number; volume?: number }[] = [];
    const sfx: { url: string; at: number; volume: number }[] = [];
    const timed: { start: number; tokens: { token: string; raw: string; time: number }[]; startFrom?: number }[] = [];
    let cursor = 0;
    let lastWordEnd = 0;
    plan.scenes.forEach((scene, i) => {
      const speaker = speakerOf(i);
      if (speaker) {
        const heard = media.clipWords[speaker.asset].filter((w) => w.end > speaker.from - 0.25 && w.start < speaker.to + 0.25);
        const srcStart = Math.max(0, (heard[0]?.start ?? speaker.from) - 0.35);
        const srcEnd = (heard[heard.length - 1]?.end ?? speaker.to) + 0.4;
        const tokens = alignScript([scene.narration], heard).sceneTokens[0].map((t) => ({ ...t, time: t.time - srcStart + cursor }));
        cuts.push({ url: media.assets[speaker.asset].url, at: cursor, srcStart, srcEnd, volume: 1 });
        timed.push({ start: cursor, tokens, startFrom: srcStart });
        lastWordEnd = (heard[heard.length - 1]?.end ?? speaker.to) - srcStart + cursor;
        cursor += srcEnd - srcStart;
        // The narrator never starts on the speaker's heels.
        if (i + 1 < plan.scenes.length && !speakerOf(i + 1)) cursor += HANDOVER_PAUSE;
      } else if (voice) {
        const k = narrated.indexOf(i);
        const srcStart = k === 0 ? 0 : Math.max(0, (narratorTokens[k][0]?.time ?? 0) - 0.15);
        const srcEnd = k + 1 < narrated.length ? Math.max(srcStart + 0.2, (narratorTokens[k + 1][0]?.time ?? voice.durationSeconds) - 0.15) : voice.durationSeconds;
        const at = cursor + (i === 0 ? VOICE_LEAD : 0);
        const tokens = narratorTokens[k].map((t) => ({ ...t, time: t.time - srcStart + at }));
        cuts.push({ at, srcStart, srcEnd });
        // The picture changes just before the first word of the scene.
        timed.push({ start: i === 0 ? 0 : Math.max(0, (tokens[0]?.time ?? at) - SCENE_LEAD), tokens });
        const lastHeard = k + 1 < narrated.length ? srcEnd : (voice.words[voice.words.length - 1]?.end ?? srcEnd);
        lastWordEnd = lastHeard - srcStart + at;
        cursor = at + (srcEnd - srcStart) + (k + 1 < narrated.length ? pause : 0);
      } else {
        timed.push({ start: cursor, tokens: [] });
      }
      if (i === soundAfter && soundUrl) {
        sfx.push({ url: soundUrl, at: cursor + 0.05, volume: 0.55 });
        cursor += SOUND_GAP;
      }
    });
    return { cuts, sfx, timed, lastWordEnd };
  };
  let laid = layOut(0);
  // A listing video whose voice ends early gets a longer beat between its photos, up to LISTING_MAX_PAUSE each.
  if (media.listing && narrated.length > 1) {
    const early = listingVoiceEnd(media.listing.seconds) - laid.lastWordEnd;
    if (early > 0.05) laid = layOut(Math.min(LISTING_MAX_PAUSE, early / (narrated.length - 1)));
  }
  const { cuts, sfx, timed, lastWordEnd } = laid;
  // A listing video ends on its chosen length: the ending that holds the contact card takes up
  // what the pauses and the voice's tempo left over.
  const tail = media.listing ? Math.min(LISTING_TAIL[1], Math.max(LISTING_TAIL[0], media.listing.seconds - lastWordEnd)) : TAIL;
  const duration = Math.ceil((lastWordEnd + tail) * 10) / 10;

  const scenes = plan.scenes.map((scene, i) => {
    const { start, tokens, startFrom } = timed[i];
    const end = i + 1 < timed.length ? timed[i + 1].start : duration;
    const at = (cue: string | null | undefined) => {
      const time = cueTime(tokens, cue);
      return time === null ? undefined : Math.max(start, time - TEXT_LEAD);
    };
    return {
      start,
      end,
      // A speaker's clip plays in step with its own sound; other photos may have been animated.
      speaker: startFrom !== undefined || undefined,
      // A listing video goes from photo to photo on a plain cut, as footage does: no fade through black between rooms.
      ...(media.listing && i > 0 ? { cut: true } : {}),
      background: startFrom !== undefined ? { ...scene.background, startFrom, playbackRate: 1 } : motionBackground(scene.background, motionClips, end - start),
      blocks: (startFrom !== undefined ? speakerBlocks(scene.blocks) : scene.blocks).map((block, k, shown) => {
        // The first headline of a scene is on screen from its first frame: no empty openings.
        const opening = k === shown.findIndex((b) => b.type === 'title' || b.type === 'badge');
        const staged = stageBlock(block, k, opening ? () => undefined : at, plan.language, i === 0, at);
        // A listing's asking price does not count up: every number on the way would be a wrong price.
        if (media.listing && staged.type === 'number') return { ...staged, still: true };
        // The figures of a home read as figures: "3,225", not "3225".
        if (media.listing && staged.type === 'tiles') return { ...staged, items: staged.items.map((item) => ({ ...item, big: listingFigure(item.big, item.top, plan.language) })) };
        return startFrom !== undefined && staged.type === 'title' ? { ...staged, size: 's', rotate: 0, anim: undefined } : staged;
      }),
    };
  });

  // The captions show a number as digits ("10 eggs"); the voice was given it in words.
  const spoken = timed.flatMap((t, i) => withDigits(t.tokens, media.digits?.[plan.scenes[i].narration.trim()]));
  // Voice-over off: the narrator's recording still sets every time above, and stays out of the soundtrack.
  // A person talking in the client's own clip is the picture, not a voice-over, and keeps their sound.
  const heard = sound.voiceOver ? cuts : cuts.filter((cut) => cut.url);
  const silent = !sound.voiceOver && !sound.music;
  const props = {
    duration,
    format: media.format || 'vertical',
    style: plan.style,
    theme: buildTheme(plan.style, plan.theme),
    assets: media.assets,
    audio: {
      voice: { url: voice?.url, cuts: heard },
      music:
        sound.music && musicUrl
          ? // Music that nobody speaks over plays at its full level from the start.
            { url: musicUrl, liftAt: lastWordEnd + 0.6, ...(heard.length ? {} : { volume: MUSIC_ALONE }) }
          : undefined,
      // No voice-over and no music means no sound at all: the pops and whooshes go too.
      sfx: silent ? [] : sfx,
      ...(silent ? { autoSfx: false } : {}),
    },
    captions: showsCaptions(plan, sound)
      ? {
          // A word ends where the next begins (or after a beat).
          words: spoken.map((word, n) => ({
            text: word.raw,
            start: word.time,
            end: Math.max(word.time + 0.12, Math.min(spoken[n + 1]?.time ?? lastWordEnd, word.time + 0.9)),
          })),
        }
      : undefined,
    scenes,
  };
  return props;
}

function clientWarnings(plan: DirectorPlan): string[] {
  const warnings = [...(plan.warnings || [])];
  const contact = plan.scenes[plan.scenes.length - 1].blocks.find((b) => b.type === 'highlight');
  const reachable = contact && 'text' in contact && /[@\d]|\.[a-z]{2,}/i.test(contact.text);
  // A product ad sends people to the shop ("Get it on Amazon"), not to a phone number.
  if (!reachable && plan.format !== 'product' && !warnings.some((w) => /contact|phone|email|website/i.test(w))) {
    warnings.unshift('Your text has no phone, email or website, so the last screen cannot tell viewers how to reach you.');
  }
  return warnings;
}

/** What brings a listing's recording to the length the client chose: where the last word should end, and what the pauses can add. */
const listingFit = (listing: ListingOptions, lines: number) => ({
  endAt: listingVoiceEnd(listing.seconds) - VOICE_LEAD,
  pauses: LISTING_MAX_PAUSE * Math.max(0, lines - 1),
});

/**
 * Records the narration and times every word. The voice model sometimes skips
 * or merges sentences, so each take is transcribed and checked scene by scene,
 * and a take with a missing scene is redone. Long scripts are recorded in parts.
 *
 * `fit` (a listing video): where the last word should end, and how much the pauses between the
 * photos can add. A recording that runs long is sped up; one that runs short is slowed down only
 * by what the pauses cannot cover. Both stay within LISTING_TEMPO.
 */
async function recordVoice(narration: string[], languageName: string, plan: DirectorPlan, store: StoreFile, fit?: { endAt: number; pauses: number }) {
  const parts: string[][] = [[]];
  let count = 0;
  for (const line of narration) {
    const words = line.split(/\s+/).length;
    if (count && count + words > VOICE_PART_WORDS) {
      parts.push([]);
      count = 0;
    }
    parts[parts.length - 1].push(line);
    count += words;
  }

  const recorded = await Promise.all(
    parts.map(async (lines, p) => {
      let best: { pcm: Buffer; rate: number; words: SpokenWord[]; durationSeconds: number; worst: number } | null = null;
      for (let take = 1; take <= VOICE_TAKES; take++) {
        console.log(`🎤 Generating voice (part ${p + 1}/${parts.length}, take ${take})...`);
        const voice = await generateVoice(lines, languageName, plan.voice);
        const words = await transcribeWords(pcmToWav(voice.pcm, voice.rate), plan.language);
        const coverage = alignScript(lines, words).sceneCoverage;
        const worst = Math.min(...coverage);
        if (!best || worst > best.worst) best = { ...voice, words, worst };
        if (worst >= MIN_SCENE_COVERAGE) break;
        console.warn(`⚠️ Voice part ${p + 1}, take ${take} dropped part of the script (worst scene ${(worst * 100).toFixed(0)}% heard): "${lines[coverage.indexOf(worst)]}"`);
      }
      // A retake is worth it below MIN_SCENE_COVERAGE, but brand names and foreign words also transcribe oddly.
      // Only a line that is truly missing (a skipped sentence scores near zero) is worth failing the video for.
      if (!best || best.worst < MISSING_SCENE_COVERAGE) throw new Error('The voice-over kept skipping part of the script');
      if (best.worst < MIN_SCENE_COVERAGE) console.warn(`⚠️ Voice part ${p + 1}: kept the best take (worst scene ${(best.worst * 100).toFixed(0)}% matched)`);
      return best;
    })
  );

  const rate = recorded[0].rate;
  const gap = Buffer.alloc(Math.round(VOICE_PART_GAP * rate) * 2);
  const words: SpokenWord[] = [];
  const audio: Buffer[] = [];
  let offset = 0;
  for (const [i, part] of recorded.entries()) {
    words.push(...part.words.map((w) => ({ ...w, start: w.start + offset, end: w.end + offset })));
    audio.push(part.pcm, ...(i + 1 < recorded.length ? [gap] : []));
    offset += part.durationSeconds + VOICE_PART_GAP;
  }
  let durationSeconds = offset - VOICE_PART_GAP;
  let pcm: Buffer = Buffer.concat(audio);
  const lastWord = words[words.length - 1]?.end;
  if (fit && lastWord) {
    const wanted = lastWord > fit.endAt ? fit.endAt : Math.max(lastWord, fit.endAt - fit.pauses);
    const tempo = Math.min(LISTING_TEMPO[1], Math.max(LISTING_TEMPO[0], lastWord / wanted));
    if (Math.abs(tempo - 1) >= 0.01) {
      pcm = await changeTempo(pcm, rate, tempo);
      for (const word of words) Object.assign(word, { start: word.start / tempo, end: word.end / tempo });
      durationSeconds = pcm.length / 2 / rate;
      console.log(`🎚️ Voice at ${(tempo * 100).toFixed(0)}% of its recorded pace: the last word now ends at ${(lastWord / tempo).toFixed(1)} s instead of ${lastWord.toFixed(1)} s`);
    }
  }
  const url = await store(pcmToWav(pcm, rate), 'voice.wav', 'audio/wav');
  console.log(`✅ Voice: ${durationSeconds.toFixed(1)} s in ${parts.length} part(s), ${words.length} words timed`);
  return { url, words, durationSeconds };
}

// A background whose photo was animated plays the clip instead, slowed so it spans the scene.
function motionBackground<T extends { asset?: string | null }>(background: T, motionClips: Map<string, number>, sceneSeconds: number) {
  const clipSeconds = background.asset ? motionClips.get(background.asset) : undefined;
  if (!background.asset || clipSeconds === undefined) return background;
  const playbackRate = Math.min(1, Math.max(0.4, (clipSeconds - 0.2) / sceneSeconds));
  return { ...background, asset: `${background.asset}-motion`, playbackRate };
}

// A person talking is the picture: their scene keeps a name tag and one short line, never a wall of text.
function speakerBlocks(blocks: DirectorBlock[]): DirectorBlock[] {
  const kept: DirectorBlock[] = [];
  const pill = blocks.find((b) => b.type === 'pill');
  const title = blocks.find((b) => b.type === 'title');
  if (pill) kept.push(pill);
  if (title?.type === 'title') kept.push({ ...title, text: title.text.replace(/\s*\n\s*/g, ' ') });
  return kept;
}

// Director block → renderer block: cues become times; small decorative
// rotations are added here so the director never deals with them.
function stageBlock(
  block: DirectorBlock,
  index: number,
  at: (cue?: string | null) => number | undefined,
  language: string,
  hook: boolean,
  // The opening title has no cue of its own (`at` answers nothing for it), but its underline still follows the voice.
  underline: (cue?: string | null) => number | undefined = at
) {
  switch (block.type) {
    case 'chips':
    case 'rows':
      return { type: block.type, items: block.items.map((item) => ({ icon: item.icon, text: item.text, at: at(item.cue) })) };
    case 'tiles':
      return { type: 'tiles', items: block.items.map(({ cue, ...item }) => ({ ...item, at: at(cue) })) };
    case 'media': {
      const { cue, footerPill, ...media } = block;
      return {
        ...media,
        rotate: index % 2 ? 1.5 : -1.5,
        at: at(cue),
        footerPill: footerPill ? { text: footerPill.text, at: at(footerPill.cue) } : undefined,
      };
    }
    case 'number': {
      const { cue, ...number } = block;
      // "$0FEE" → "$0 FEE": a worded unit never touches the figure.
      const suffix = number.suffix && /^\p{L}/u.test(number.suffix) ? ` ${number.suffix}` : number.suffix;
      const prefix = number.prefix && /\p{L}$/u.test(number.prefix) ? `${number.prefix} ` : number.prefix;
      return { ...number, prefix, suffix, locale: language, at: at(cue) };
    }
    case 'title': {
      const { cue, underlineCue, ...title } = block;
      // Size follows the longest line, so short punchy lines come out huge.
      const longest = Math.max(...title.text.split('\n').map((line) => line.length));
      const size = longest <= 10 ? 'xl' : longest <= (hook ? 16 : 14) ? 'l' : longest <= 19 ? 'm' : 's';
      const stamp = title.tone === 'accent' && size === 'xl';
      // The line under a title is drawn when the narrator says the words; a cue that is not in the narration draws none.
      const underlineAt = underlineCue ? underline(underlineCue) : undefined;
      return { ...title, size, anim: stamp ? 'stamp' : undefined, rotate: stamp ? -4 : size === 'm' ? -2 : 0, at: at(cue), underlineAt };
    }
    default: {
      const { cue, ...rest } = block;
      return { ...rest, at: at(cue) };
    }
  }
}
