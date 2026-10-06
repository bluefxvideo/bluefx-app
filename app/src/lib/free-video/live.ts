/**
 * The live status page's record of a running free job (FreeVideoLive, owner 2026-10-06: "visualize and
 * actually show what we are building"). The job tells the recorder about the website photos it kept, the
 * director's plan and every file it saves; the recorder keeps one FreeVideoLive and hands each new version
 * to `write` in order. Every url in it is a real file of this job, never a stand-in.
 *
 * Pure apart from `write`, so the offline checks and the local paid test (free-video-test.ts) use it too.
 */

import { createHash } from 'node:crypto';
import { scriptOf } from '@/lib/smart-video/jobs';
import type { DirectorPlan, SmartAsset } from '@/lib/smart-video/types';
import type { FreeVideoLive, FreeVideoLiveScene } from '@/types/free-video';

/** At most this many website photos on the page. */
export const LIVE_PHOTOS = 8;

/**
 * The website photos for the page: real photos and clips (not logos or flat artwork), in the order the job
 * kept them, each picture once (a website often serves the same file under two names).
 */
export function livePhotos(assets: SmartAsset[]): string[] {
  const seen = new Set<string>();
  const photos: string[] = [];
  for (const asset of assets) {
    if (asset.kind !== 'video' && asset.flatBackground) continue;
    const key = createHash('sha1').update(asset.data).digest('hex');
    if (seen.has(key)) continue;
    seen.add(key);
    photos.push(asset.url);
    if (photos.length >= LIVE_PHOTOS) break;
  }
  return photos;
}

type Scene = DirectorPlan['scenes'][number];

/** A scene's main picture: its background, else its first media block, else the first picture of its gallery. */
export function sceneImageId(scene: Scene): string | undefined {
  if (scene.background.asset) return scene.background.asset;
  for (const block of scene.blocks) {
    if (block.type === 'media') return block.asset;
    if (block.type === 'gallery') return block.assets[0];
  }
  return undefined;
}

/** The script, scene by scene, with the picture each scene shows (a website photo's url right away; made pictures follow). */
export function liveScenes(plan: DirectorPlan, assets: SmartAsset[]): FreeVideoLiveScene[] {
  const urls = new Map(assets.map((asset) => [asset.id, asset.url]));
  const drawings = new Set((plan.drawings ?? []).map((drawing) => drawing.id));
  const script = scriptOf(plan);
  return plan.scenes.map((scene, index) => {
    const imageId = sceneImageId(scene);
    const image = imageId ? urls.get(imageId) : undefined;
    return {
      say: script[index]?.say ?? scene.narration,
      show: script[index]?.show ?? [],
      ...(imageId ? { imageId } : {}),
      ...(image ? { image } : {}),
      ...(imageId && drawings.has(imageId) ? { drawing: true } : {}),
    };
  });
}

export type StoredKind = { kind: 'made'; id: string } | { kind: 'clip'; id: string } | { kind: 'voice' } | { kind: 'music' } | { kind: 'presenterPhoto' } | { kind: 'presenterClip' };

/**
 * What a saved file is for the live page, by its name (pipeline.ts and prepare-assets.ts name them):
 * voice.wav, music.mp3, presenter.jpg and presenter.mp4 (the on-camera presenter), <photo id>-motion.mp4 (a
 * moving clip), <lifestyle shot id>.jpg (a picture The Phantom made), <drawing id>-<time>.png (a whiteboard
 * drawing). null for everything else: the website copies saved before the plan, cut-outs, the signature sound.
 */
export function classifyStored(name: string, plan: DirectorPlan | null): StoredKind | null {
  if (name === 'voice.wav') return { kind: 'voice' };
  if (name === 'music.mp3') return { kind: 'music' };
  if (name === 'presenter.jpg') return { kind: 'presenterPhoto' };
  if (name === 'presenter.mp4') return { kind: 'presenterClip' };
  const motion = /^(.+)-motion\.mp4$/.exec(name);
  if (motion) return { kind: 'clip', id: motion[1] };
  if (!plan || /-cutout\.png$/.test(name)) return null;
  const base = name.replace(/\.[a-z0-9]+$/i, '');
  if ((plan.lifestyleShots ?? []).some((shot) => shot.id === base)) return { kind: 'made', id: base };
  const drawing = (plan.drawings ?? []).find((d) => name.endsWith('.png') && name.startsWith(`${d.id}-`));
  return drawing ? { kind: 'made', id: drawing.id } : null;
}

export interface LiveRecorder {
  /** Starts the record over (a new attempt must not show the last one's pieces). */
  reset: () => void;
  /** The job's prepared assets: the website photos it kept. */
  assets: (assets: SmartAsset[]) => void;
  /** The plan as the job will make it (after the free limits). */
  plan: (plan: DirectorPlan, assets: SmartAsset[]) => void;
  /** A file the job saved. */
  stored: (name: string, url: string) => void;
  /** The record now (a copy). */
  snapshot: () => FreeVideoLive;
  /** Resolves once every write so far has finished. */
  flush: () => Promise<void>;
}

/** One running job's record. `write` gets each new version, one after the other; a failed write is logged by the writer and skipped. */
export function liveRecorder(write: (live: FreeVideoLive) => Promise<void>): LiveRecorder {
  let live: FreeVideoLive = {};
  let plan: DirectorPlan | null = null;
  let chain: Promise<void> = Promise.resolve();
  const copy = (): FreeVideoLive => JSON.parse(JSON.stringify(live)) as FreeVideoLive;
  const save = () => {
    const version = copy();
    chain = chain.then(() => write(version)).catch(() => undefined);
  };
  return {
    reset: () => {
      live = {};
      plan = null;
      save();
    },
    assets: (assets) => {
      const photos = livePhotos(assets);
      if (!photos.length) return;
      live.photos = photos;
      save();
    },
    plan: (next, assets) => {
      plan = next;
      live.look = next.style;
      live.scenes = liveScenes(next, assets);
      save();
    },
    stored: (name, url) => {
      const what = classifyStored(name, plan);
      if (!what) return;
      if (what.kind === 'voice') live.voiceUrl = url;
      else if (what.kind === 'music') live.musicUrl = url;
      else if (what.kind === 'presenterPhoto') live.presenterPhoto = url;
      else if (what.kind === 'presenterClip') live.presenterClip = url;
      else if (what.kind === 'clip') live.clips = { ...live.clips, [what.id]: url };
      else if (what.kind === 'made') live.made = { ...live.made, [what.id]: url };
      save();
    },
    snapshot: copy,
    flush: () => chain,
  };
}
