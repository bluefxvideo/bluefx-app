import { directVideo } from './director';
import { MOTION_CLIP_SECONDS, animatePhoto, cutOutProduct, generateLifestyleShot, generateMusic, generateSound, generateVoice, transcribeWords } from './audio';
import { alignScript, cueTime } from './timing';
import { buildTheme, cropVertical, cutOutLogo } from './brand';
import type { DirectorBlock, DirectorPlan, SmartAsset, StoreFile } from './types';
import { trackUsage, type UsageEntry } from './usage';

/**
 * Smart Video — brief + files in, render-ready SmartVideo props out.
 * director → (voice → word timings) ‖ music ‖ signature sound ‖ logo cut-out → timeline.
 */

const VOICE_LEAD = 0.25; // silence before the first word
const TEXT_LEAD = 0.12; // text lands just before its word
const SCENE_LEAD = 0.3; // a scene opens just before its first word
const SOUND_GAP = 0.9; // room made in the voice for the signature sound
const TAIL = 4.2; // music-only ending that holds the contact card
const VOICE_TAKES = 3;
// Spoken numbers come back as digits, so a faithful take still misses some words.
const MIN_SCENE_COVERAGE = 0.5;

const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' });

export type SmartVideoStage = 'directing' | 'producing';

export interface SmartVideoResult {
  props: Record<string, unknown>;
  plan: DirectorPlan;
  durationSeconds: number;
  /** API spend of this video, step by step (USD). */
  usage: UsageEntry[];
}

export async function createSmartVideo(
  brief: string,
  assets: SmartAsset[],
  store: StoreFile,
  loadStored: (url: string) => Promise<Buffer>,
  onStage: (stage: SmartVideoStage) => void = () => {}
): Promise<SmartVideoResult> {
  const { result, usage } = await trackUsage(() => produce(brief, assets, store, loadStored, onStage));
  return { ...result, usage };
}

async function produce(
  brief: string,
  assets: SmartAsset[],
  store: StoreFile,
  loadStored: (url: string) => Promise<Buffer>,
  onStage: (stage: SmartVideoStage) => void
): Promise<Omit<SmartVideoResult, 'usage'>> {
  onStage('directing');
  console.log(`🎬 Smart Video: directing (${assets.length} files)...`);
  const plan = await directVideo(brief, assets);
  console.log(`✅ Plan: ${plan.scenes.length} scenes, style "${plan.style}" (${plan.styleReason}), language ${plan.language}`);

  onStage('producing');
  const narration = plan.scenes.map((s) => s.narration);
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
      const url = await generateLifestyleShot(from.data, from.mimeType, shot.prompt)
        .then((jpg) => store(jpg, `${shot.id}.jpg`, 'image/jpeg'))
        .catch((error) => {
          console.warn(`⚠️ Lifestyle photo ${shot.id} failed:`, String(error).slice(0, 160));
          return from.url; // the packshot still beats a blank scene
        });
      return [shot.id, { url, kind: 'image' as const }] as const;
    })
  );

  // Stills the director wants moving. The clip is made from the vertical crop the
  // background would show anyway; on failure the still simply stays.
  const focusOf = (id: string) => plan.scenes.find((scene) => scene.background.asset === id)?.background.focus;
  const motion = Promise.all(
    (plan.animate || []).map(async (shot) => {
      try {
        const original = assets.find((a) => a.id === shot.asset && a.kind === 'image');
        const generated = original ? null : (await lifestyle).find(([id]) => id === shot.asset);
        const image = original ? original.data : generated ? await loadStored(generated[1].url) : null;
        if (!image) return null;
        const clip = await animatePhoto(await cropVertical(image, focusOf(shot.asset)), shot.prompt);
        return [shot.asset, await store(clip, `${shot.asset}-motion.mp4`, 'video/mp4')] as const;
      } catch (error) {
        console.warn(`⚠️ Animating ${shot.asset} failed:`, String(error).slice(0, 160));
        return null;
      }
    })
  ).then((pairs) => new Map(pairs.filter((pair): pair is readonly [string, string] => pair !== null)));

  const [voice, musicUrl, soundUrl, logoUrl, cutoutUrls, lifestyleAssets, motionUrls] = await Promise.all([
    (async () => {
      // The voice model sometimes skips or merges sentences. Every take is
      // transcribed and checked scene by scene; a take with a missing scene is redone.
      let best: { wav: Buffer; words: Awaited<ReturnType<typeof transcribeWords>>; durationSeconds: number; worst: number } | null = null;
      for (let take = 1; take <= VOICE_TAKES; take++) {
        console.log(`🎤 Generating voice (take ${take})...`);
        const { wav, durationSeconds } = await generateVoice(narration, languageName, plan.voice);
        const words = await transcribeWords(wav, plan.language);
        const worst = Math.min(...alignScript(narration, words).sceneCoverage);
        if (!best || worst > best.worst) best = { wav, words, durationSeconds, worst };
        if (worst >= MIN_SCENE_COVERAGE) break;
        console.warn(`⚠️ Voice take ${take} dropped part of the script (worst scene ${(worst * 100).toFixed(0)}% heard)`);
      }
      if (!best || best.worst < MIN_SCENE_COVERAGE) throw new Error('The voice-over kept skipping part of the script');
      const url = await store(best.wav, 'voice.wav', 'audio/wav');
      console.log(`✅ Voice: ${best.durationSeconds.toFixed(1)} s, ${best.words.length} words timed, worst scene ${(best.worst * 100).toFixed(0)}% heard`);
      return { url, words: best.words, durationSeconds: best.durationSeconds };
    })(),
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
  ]);

  // ---- timeline ----
  const { sceneTokens, lastWordEnd } = alignScript(narration, voice.words);
  const soundAfter = soundUrl && plan.signatureSound ? Math.min(plan.signatureSound.afterScene, plan.scenes.length - 2) : -1;
  const cutAt = soundAfter >= 0 ? (sceneTokens[soundAfter + 1][0]?.time ?? 0) - 0.15 : Infinity;
  const onTimeline = (t: number) => t + VOICE_LEAD + (t >= cutAt ? SOUND_GAP : 0);

  const starts = plan.scenes.map((_, i) => (i === 0 ? 0 : Math.max(0, onTimeline(sceneTokens[i][0]?.time ?? 0) - SCENE_LEAD)));
  const duration = Math.ceil((onTimeline(lastWordEnd) + TAIL) * 10) / 10;

  const scenes = plan.scenes.map((scene, i) => {
    const at = (cue: string | null | undefined) => {
      const time = cueTime(sceneTokens[i], cue);
      return time === null ? undefined : Math.max(starts[i], onTimeline(time) - TEXT_LEAD);
    };
    return {
      start: starts[i],
      end: i + 1 < starts.length ? starts[i + 1] : duration,
      background: motionBackground(scene.background, motionUrls, (i + 1 < starts.length ? starts[i + 1] : duration) - starts[i]),
      blocks: scene.blocks.map((block, k) => {
        // The first headline of a scene is on screen from its first frame: no empty openings.
        const opening = k === scene.blocks.findIndex((b) => b.type === 'title' || b.type === 'badge');
        return stageBlock(block, k, opening ? () => undefined : at, plan.language, i === 0);
      }),
    };
  });

  const rendererAssets = Object.fromEntries([
    ...[...motionUrls].map(([id, url]) => [`${id}-motion`, { url, kind: 'video' as const }] as const),
    ...lifestyleAssets,
    ...assets.map((a) => [a.id, { url: logoUrl && a.id === logoAsset?.id ? logoUrl : a.url, kind: a.kind, cutoutUrl: cutoutUrls.get(a.id) || undefined }] as const),
  ]);

  const props = {
    duration,
    style: plan.style,
    theme: buildTheme(plan.style, plan.theme),
    assets: rendererAssets,
    audio: {
      voice: {
        url: voice.url,
        cuts:
          cutAt === Infinity
            ? [{ at: VOICE_LEAD, srcStart: 0, srcEnd: voice.durationSeconds }]
            : [
                { at: VOICE_LEAD, srcStart: 0, srcEnd: cutAt },
                { at: cutAt + VOICE_LEAD + SOUND_GAP, srcStart: cutAt, srcEnd: voice.durationSeconds },
              ],
      },
      music: musicUrl ? { url: musicUrl, liftAt: onTimeline(lastWordEnd) + 0.6 } : undefined,
      sfx: soundUrl && cutAt !== Infinity ? [{ url: soundUrl, at: cutAt + VOICE_LEAD + 0.05, volume: 0.55 }] : [],
    },
    captions: plan.captions ? { words: captionWords(sceneTokens, onTimeline, lastWordEnd) } : undefined,
    scenes,
  };
  return { props, plan, durationSeconds: duration };
}

// A background whose photo was animated plays the clip instead, slowed so it spans the scene.
function motionBackground<T extends { asset?: string | null }>(background: T, motionUrls: Map<string, string>, sceneSeconds: number) {
  if (!background.asset || !motionUrls.has(background.asset)) return background;
  const playbackRate = Math.min(1, Math.max(0.4, (MOTION_CLIP_SECONDS - 0.2) / sceneSeconds));
  return { ...background, asset: `${background.asset}-motion`, playbackRate };
}

// The script's own words on the video timeline; a word ends where the next begins (or after a beat).
function captionWords(sceneTokens: { raw: string; time: number }[][], onTimeline: (t: number) => number, lastWordEnd: number) {
  const flat = sceneTokens.flat();
  return flat.map((word, i) => {
    const start = onTimeline(word.time);
    const next = i + 1 < flat.length ? onTimeline(flat[i + 1].time) : onTimeline(lastWordEnd);
    return { text: word.raw, start, end: Math.max(start + 0.12, Math.min(next, start + 0.9)) };
  });
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
