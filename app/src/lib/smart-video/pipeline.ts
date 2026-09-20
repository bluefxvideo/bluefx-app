import { directVideo, reviseVideo } from './director';
import {
  MOTION_CLIP_SECONDS,
  animatePhoto,
  cutOutProduct,
  generateLifestyleShot,
  generateMusic,
  generateSound,
  generateVoice,
  pcmToWav,
  transcribeWords,
  type SpokenWord,
} from './audio';
import { alignScript, cueTime } from './timing';
import { buildTheme, cropToFrame, cutOutLogo } from './brand';
import { extractAudio } from './prepare-assets';
import type { DirectorBlock, DirectorPlan, SmartAsset, StoreFile, VideoFormat, VideoLength } from './types';
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
const VOICE_PART_WORDS = 130; // a long script is recorded in parts: shorter takes skip less and retake cheaply
const VOICE_PART_GAP = 0.35; // breath between parts

const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' });

export type SmartVideoStage = 'directing' | 'producing';

/** Everything generated for a video. Saved with the plan, so a revision can reuse it. */
export interface SmartVideoMedia {
  /** The shape of the video; a revision keeps it. Absent on older videos = vertical. */
  format?: VideoFormat;
  /** The narrator's recording; null when people in the client's clips say everything. */
  voice: { url: string; words: SpokenWord[]; durationSeconds: number } | null;
  /** Word timings of what is said in each talking clip, by asset id. */
  clipWords: Record<string, SpokenWord[]>;
  musicUrl: string | null;
  soundUrl: string | null;
  /** What the renderer loads: uploads, cut-outs, lifestyle photos, animated clips. */
  assets: Record<string, { url: string; kind: 'image' | 'video'; cutoutUrl?: string; portrait?: boolean }>;
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
  { length = 'auto', format = 'vertical', onStage = () => {} }: SmartVideoOptions
): Promise<Omit<SmartVideoResult, 'usage'>> {
  onStage('directing');
  console.log(`🎬 Smart Video: directing (${assets.length} files)...`);
  const horizontal = format === 'horizontal';
  const plan = await directVideo(brief, assets, length, format);
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

  const [voice, musicUrl, soundUrl, logoUrl, cutoutUrls, lifestyleAssets, motionUrls, heardInClips] = await Promise.all([
    narration.length ? recordVoice(narration, languageName, plan, store) : null,
    generateMusic(plan.musicPrompt, plan.style)
      .then((mp3) => store(mp3, 'music.mp3', 'audio/mpeg'))
      .catch((error) => {
        console.warn('⚠️ Music failed, rendering without it:', String(error).slice(0, 200));
        return null;
      }),
    plan.signatureSound
      ? generateSound(plan.signatureSound.prompt)
          .then((mp3) => store(mp3, 'signature.mp3', 'audio/mpeg'))
          .catch(() => null)
      : null,
    logoAsset ? cutOutLogo(logoAsset.data).then((png) => store(png, 'logo-cutout.png', 'image/png')).catch(() => null) : null,
    cutouts,
    lifestyle,
    motion,
    clipWords,
  ]);

  const media: SmartVideoMedia = {
    format,
    voice,
    clipWords: heardInClips,
    musicUrl,
    soundUrl,
    assets: Object.fromEntries([
      ...[...motionUrls].map(([id, url]) => [`${id}-motion`, { url, kind: 'video' as const, portrait: !horizontal }] as const),
      ...lifestyleAssets,
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
            },
          ] as const
      ),
    ]),
  };
  const props = buildProps(plan, media);
  return { props, plan, media, durationSeconds: props.duration, warnings: clientWarnings(plan) };
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
  onStage: (stage: SmartVideoStage) => void = () => {}
): Promise<SmartVideoResult> {
  const { result, usage } = await trackUsage(async () => {
    onStage('directing');
    const plan = await reviseVideo(previous.plan, note, brief, previous.media.assets, previous.media.format);
    onStage('producing');
    const media = { ...previous.media };
    // Only the narrator's lines are recorded; a speaker scene needs the clip's saved word timings.
    const clipWordsSaved = media.clipWords || {};
    const spoken = (p: DirectorPlan) => p.scenes.filter((scene) => !(scene.speaker && clipWordsSaved[scene.speaker.asset])).map((scene) => scene.narration);
    if (JSON.stringify(spoken(plan)) !== JSON.stringify(spoken(previous.plan)) || plan.voice.gender !== previous.plan.voice.gender) {
      media.voice = spoken(plan).length ? await recordVoice(spoken(plan), LANGUAGE_NAMES.of(plan.language) || plan.language, plan, store) : null;
    }
    if (plan.musicPrompt !== previous.plan.musicPrompt) {
      media.musicUrl = await generateMusic(plan.musicPrompt, plan.style)
        .then((mp3) => store(mp3, 'music.mp3', 'audio/mpeg'))
        .catch(() => previous.media.musicUrl);
    }
    if (plan.signatureSound?.prompt !== previous.plan.signatureSound?.prompt) {
      media.soundUrl = plan.signatureSound
        ? await generateSound(plan.signatureSound.prompt)
            .then((mp3) => store(mp3, 'signature.mp3', 'audio/mpeg'))
            .catch(() => null)
        : null;
    }
    const props = buildProps(plan, media);
    return { props, plan, media, durationSeconds: props.duration, warnings: clientWarnings(plan) };
  });
  return { ...result, usage };
}

/** Pins a plan to its recorded voice: scene times, text cues, captions, soundtrack. Pure. */
export function buildProps(plan: DirectorPlan, media: SmartVideoMedia) {
  const { voice, musicUrl, soundUrl } = media;
  const motionUrls = new Map(
    Object.entries(media.assets).flatMap(([id, asset]) => (id.endsWith('-motion') ? [[id.slice(0, -'-motion'.length), asset.url] as const] : []))
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
      cursor = at + (srcEnd - srcStart);
    } else {
      timed.push({ start: cursor, tokens: [] });
    }
    if (i === soundAfter && soundUrl) {
      sfx.push({ url: soundUrl, at: cursor + 0.05, volume: 0.55 });
      cursor += SOUND_GAP;
    }
  });
  const duration = Math.ceil((lastWordEnd + TAIL) * 10) / 10;

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
      background: startFrom !== undefined ? { ...scene.background, startFrom, playbackRate: 1 } : motionBackground(scene.background, motionUrls, end - start),
      blocks: (startFrom !== undefined ? speakerBlocks(scene.blocks) : scene.blocks).map((block, k, shown) => {
        // The first headline of a scene is on screen from its first frame: no empty openings.
        const opening = k === shown.findIndex((b) => b.type === 'title' || b.type === 'badge');
        const staged = stageBlock(block, k, opening ? () => undefined : at, plan.language, i === 0);
        return startFrom !== undefined && staged.type === 'title' ? { ...staged, size: 's', rotate: 0, anim: undefined } : staged;
      }),
    };
  });

  const spoken = timed.flatMap((t) => t.tokens);
  const props = {
    duration,
    format: media.format || 'vertical',
    style: plan.style,
    theme: buildTheme(plan.style, plan.theme),
    assets: media.assets,
    audio: {
      voice: { url: voice?.url, cuts },
      music: musicUrl ? { url: musicUrl, liftAt: lastWordEnd + 0.6 } : undefined,
      sfx,
    },
    captions: plan.captions
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

/**
 * Records the narration and times every word. The voice model sometimes skips
 * or merges sentences, so each take is transcribed and checked scene by scene,
 * and a take with a missing scene is redone. Long scripts are recorded in parts.
 */
async function recordVoice(narration: string[], languageName: string, plan: DirectorPlan, store: StoreFile) {
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
      if (!best || best.worst < MIN_SCENE_COVERAGE) throw new Error('The voice-over kept skipping part of the script');
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
  const durationSeconds = offset - VOICE_PART_GAP;
  const url = await store(pcmToWav(Buffer.concat(audio), rate), 'voice.wav', 'audio/wav');
  console.log(`✅ Voice: ${durationSeconds.toFixed(1)} s in ${parts.length} part(s), ${words.length} words timed`);
  return { url, words, durationSeconds };
}

// A background whose photo was animated plays the clip instead, slowed so it spans the scene.
function motionBackground<T extends { asset?: string | null }>(background: T, motionUrls: Map<string, string>, sceneSeconds: number) {
  if (!background.asset || !motionUrls.has(background.asset)) return background;
  const playbackRate = Math.min(1, Math.max(0.4, (MOTION_CLIP_SECONDS - 0.2) / sceneSeconds));
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
function stageBlock(block: DirectorBlock, index: number, at: (cue?: string | null) => number | undefined, language: string, hook: boolean) {
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
      const { cue, ...title } = block;
      // Size follows the longest line, so short punchy lines come out huge.
      const longest = Math.max(...title.text.split('\n').map((line) => line.length));
      const size = longest <= 10 ? 'xl' : longest <= (hook ? 16 : 14) ? 'l' : longest <= 19 ? 'm' : 's';
      const stamp = title.tone === 'accent' && size === 'xl';
      return { ...title, size, anim: stamp ? 'stamp' : undefined, rotate: stamp ? -4 : size === 'm' ? -2 : 0, at: at(cue) };
    }
    default: {
      const { cue, ...rest } = block;
      return { ...rest, at: at(cue) };
    }
  }
}
