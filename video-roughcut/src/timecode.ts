/**
 * SMPTE timecode utilities for video editing export formats.
 * Lifted unchanged from /Users/gyorfiszilard/Dropbox/Calude Folder/video-roughcut/src/timecode.ts
 */

export function secondsToFrames(seconds: number, frameRate: number): number {
  return Math.round(seconds * frameRate);
}

export function framesToSeconds(frames: number, frameRate: number): number {
  return frames / frameRate;
}

/**
 * Align a time value to the nearest frame boundary.
 */
export function alignToFrame(seconds: number, frameRate: number): number {
  const frames = Math.round(seconds * frameRate);
  return frames / frameRate;
}

/**
 * Convert seconds to SMPTE timecode string (HH:MM:SS:FF).
 * Handles both drop-frame (29.97, 59.94) and non-drop-frame rates.
 */
export function secondsToTimecode(seconds: number, frameRate: number): string {
  const isDropFrame = isDropFrameRate(frameRate);
  const totalFrames = Math.round(seconds * frameRate);
  return framesToTimecode(totalFrames, frameRate, isDropFrame);
}

export function framesToTimecode(
  totalFrames: number,
  frameRate: number,
  dropFrame: boolean = false,
): string {
  const fps = Math.round(frameRate);

  if (dropFrame && (fps === 30 || fps === 60)) {
    // Drop-frame timecode calculation
    const dropFrames = fps === 60 ? 4 : 2;
    const framesPerMin = fps * 60 - dropFrames;
    const framesPer10Min = fps * 60 * 10 - dropFrames * 9;

    const d = Math.floor(totalFrames / framesPer10Min);
    const m = totalFrames % framesPer10Min;

    let adjustedFrames = totalFrames;
    if (m > dropFrames) {
      adjustedFrames +=
        dropFrames * (Math.floor((m - dropFrames) / framesPerMin) + 1) +
        d * dropFrames * 9;
    } else {
      adjustedFrames += d * dropFrames * 9;
    }

    const ff = adjustedFrames % fps;
    const ss = Math.floor(adjustedFrames / fps) % 60;
    const mm = Math.floor(adjustedFrames / (fps * 60)) % 60;
    const hh = Math.floor(adjustedFrames / (fps * 60 * 60));

    const sep = ';'; // semicolon for drop-frame
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}${sep}${pad(ff)}`;
  }

  // Non-drop-frame
  const ff = totalFrames % fps;
  const ss = Math.floor(totalFrames / fps) % 60;
  const mm = Math.floor(totalFrames / (fps * 60)) % 60;
  const hh = Math.floor(totalFrames / (fps * 60 * 60));

  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

export function isDropFrameRate(frameRate: number): boolean {
  return Math.abs(frameRate - 29.97) < 0.02 || Math.abs(frameRate - 59.94) < 0.02;
}

/**
 * Get the timebase and ntsc flag for FCP XML.
 */
export function getTimebaseInfo(frameRate: number): { timebase: number; ntsc: boolean } {
  if (Math.abs(frameRate - 23.976) < 0.1) return { timebase: 24, ntsc: true };
  if (Math.abs(frameRate - 24) < 0.1) return { timebase: 24, ntsc: false };
  if (Math.abs(frameRate - 25) < 0.1) return { timebase: 25, ntsc: false };
  if (Math.abs(frameRate - 29.97) < 0.1) return { timebase: 30, ntsc: true };
  if (Math.abs(frameRate - 30) < 0.1) return { timebase: 30, ntsc: false };
  if (Math.abs(frameRate - 59.94) < 0.1) return { timebase: 60, ntsc: true };
  if (Math.abs(frameRate - 60) < 0.1) return { timebase: 60, ntsc: false };
  return { timebase: Math.round(frameRate), ntsc: false };
}

export interface SequenceRate {
  /** FCP XML <timebase> */
  timebase: number;
  /** FCP XML <ntsc>: true means timebase × 1000/1001 */
  ntsc: boolean;
  /** Actual frames per second used for all frame math */
  fps: number;
  /** Drop-frame timecode display (29.97 / 59.94 only) */
  dropFrame: boolean;
}

/**
 * The source's own rate, for DaVinci Resolve. Resolve reads picture by frame number and
 * sound by time, so a 30.00 fps file described as 29.97 drifts out of sync (about 1.5 s
 * over 24 minutes). Unlike resolveSequenceRate(), 30 stays 30 and 60 stays 60.
 */
export function nativeSequenceRate(sourceFps: number | null | undefined): SequenceRate {
  const f = sourceFps && Number.isFinite(sourceFps) && sourceFps > 0 ? sourceFps : 30;
  const near = (target: number) => Math.abs(f - target) < 0.012;
  if (near(23.976)) return { timebase: 24, ntsc: true, fps: 24000 / 1001, dropFrame: false };
  if (near(29.97)) return { timebase: 30, ntsc: true, fps: 30000 / 1001, dropFrame: true };
  if (near(59.94)) return { timebase: 60, ntsc: true, fps: 60000 / 1001, dropFrame: true };
  const rounded = Math.max(1, Math.round(f));
  return { timebase: rounded, ntsc: false, fps: rounded, dropFrame: false };
}

/**
 * Map a source frame rate to the sequence rate we write into the XML.
 *
 * 30 fps sources (Ecamm, OBS, most phones) must be written as 29.97: Premiere builds
 * a 29.97 sequence for them, and frame math at 30 drifted about 1 second by minute 17.
 * That mapping is proven in production. 59.94/60 follow the same rule by analogy.
 * Other rates are written as-is and still need a real Premiere test.
 */
export function resolveSequenceRate(sourceFps: number | null | undefined): SequenceRate {
  const f = sourceFps && Number.isFinite(sourceFps) && sourceFps > 0 ? sourceFps : 29.97;
  const near = (target: number) => Math.abs(f - target) < 0.1;
  if (near(29.97) || near(30)) return { timebase: 30, ntsc: true, fps: 29.97, dropFrame: true };
  if (near(59.94) || near(60)) return { timebase: 60, ntsc: true, fps: 59.94, dropFrame: true };
  if (near(23.976)) return { timebase: 24, ntsc: true, fps: 23.976, dropFrame: false };
  if (near(24)) return { timebase: 24, ntsc: false, fps: 24, dropFrame: false };
  if (near(25)) return { timebase: 25, ntsc: false, fps: 25, dropFrame: false };
  if (near(50)) return { timebase: 50, ntsc: false, fps: 50, dropFrame: false };
  const rounded = Math.round(f);
  return { timebase: rounded, ntsc: false, fps: rounded, dropFrame: false };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
