import { dispatch } from "@designcombo/events";
import { ADD_VIDEO } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import { ITrack, ITrackItem } from "@designcombo/types";
import { stateManager } from "../store/state-manager-instance";
import { deleteItems } from "./delete-items";

/** Clip lengths the animation engine makes, in seconds. */
const CLIP_SECONDS = [6, 8, 10, 12, 14, 16, 18, 20];

/**
 * A clip may end this much before its photo's time on the timeline is up. The
 * last frame holds for that moment, which a viewer does not notice.
 */
const HOLD_MS = 300;

/** The shortest clip that covers a photo's time on the timeline. */
export function clipSecondsForSlot(slotMs: number): number {
  return (
    CLIP_SECONDS.find((seconds) => seconds * 1000 + HOLD_MS >= slotMs) ??
    CLIP_SECONDS[CLIP_SECONDS.length - 1]
  );
}

/** A photo on the timeline that is being animated. */
export interface AnimatedPhoto {
  itemId: string;
  src: string;
  /** Where the photo sat when the animation started, in case the photo is gone when the clip arrives. */
  from: number;
  to: number;
}

function isClipOf(item: ITrackItem, src: string): boolean {
  return item.type === "video" && item.metadata?.animatedFrom === src;
}

function overlaps(item: ITrackItem, from: number, to: number): boolean {
  return item.display.from < to && item.display.to > from;
}

/** True when an animated clip already plays over this photo. */
export function hasAnimatedClip(
  photo: ITrackItem,
  trackItemsMap: Record<string, ITrackItem>,
): boolean {
  const src = photo.details?.src;
  if (!src) return false;
  return Object.values(trackItemsMap).some(
    (item) => isClipOf(item, src) && overlaps(item, photo.display.from, photo.display.to),
  );
}

/** The clip track made in this session. After a reload the track is found by its clips. */
let clipTrackId: string | null = null;

/**
 * The track that holds the animated clips: one track right above the photos.
 * Made on the first clip, reused while the new clip's place on it is free.
 */
function clipTrackFor(photoItemId: string, from: number, to: number): string {
  const { tracks, trackItemsMap } = stateManager.getState();

  const existing = tracks.find((track) => {
    const items = track.items.map((id) => trackItemsMap[id]).filter(Boolean);
    const holdsClips =
      track.id === clipTrackId ||
      items.some((item) => item.type === "video" && item.metadata?.animatedFrom);
    return holdsClips && !items.some((item) => overlaps(item, from, to));
  });
  if (existing) return existing.id;

  const track: ITrack = {
    id: generateId(),
    type: "video",
    items: [],
    accepts: ["video"],
    magnetic: false,
    static: false,
  };
  const photoTrackIndex = tracks.findIndex((t) => t.items.includes(photoItemId));
  const at = photoTrackIndex === -1 ? 0 : photoTrackIndex;
  stateManager.updateState({
    tracks: [...tracks.slice(0, at), track, ...tracks.slice(at)],
  });
  clipTrackId = track.id;
  return track.id;
}

async function waitForItem(id: string): Promise<boolean> {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (stateManager.getState().trackItemsMap[id]) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function placeNow(
  photo: AnimatedPhoto,
  videoUrl: string,
  clipSeconds: number,
  cameraMotion?: string,
): Promise<string | null> {
  const state = stateManager.getState();
  const current = state.trackItemsMap[photo.itemId];
  const from = current?.display.from ?? photo.from;
  const to = current?.display.to ?? photo.to;
  // The clip plays for the photo's time. A clip that is too short ends early and the photo shows again.
  const shownMs = Math.min(to - from, clipSeconds * 1000 + HOLD_MS);
  if (shownMs <= 0) return null;

  // A clip made earlier from the same photo in the same place gives way to the new one
  const replaced = Object.values(state.trackItemsMap)
    .filter((item) => isClipOf(item, photo.src) && overlaps(item, from, from + shownMs))
    .map((item) => item.id);
  if (replaced.length > 0) deleteItems(stateManager, replaced);

  const id = generateId();
  dispatch(ADD_VIDEO, {
    payload: {
      id,
      details: { src: videoUrl },
      display: { from, to: from + shownMs },
      trim: { from: 0, to: shownMs },
      metadata: { animatedFrom: photo.src, cameraMotion },
    },
    options: {
      resourceId: "main",
      scaleMode: "fit",
      targetTrackId: clipTrackFor(photo.itemId, from, from + shownMs),
    },
  });

  if (!(await waitForItem(id))) {
    console.warn("⚠️ Animated clip did not reach the timeline:", id);
    return null;
  }
  return id;
}

// Clips that finish at the same moment are placed one after the other, so two
// of them never make the clip track twice.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Put an animated clip on the timeline in the place of its photo: same start
 * and same end, so the clip plays under the same words as the photo did. The
 * photo stays underneath, covered by the clip, and can be animated again.
 * Returns the new clip's id, or null when the clip could not be placed.
 */
export function placeAnimatedClip(
  photo: AnimatedPhoto,
  videoUrl: string,
  clipSeconds: number,
  cameraMotion?: string,
): Promise<string | null> {
  const placed = queue.then(() => placeNow(photo, videoUrl, clipSeconds, cameraMotion));
  queue = placed.catch(() => undefined);
  return placed;
}
