/**
 * What the admin screens share when they read the credit ledger (`credit_transactions`):
 * the name of every operation, a reader that does not stop at the API's row cap, and the
 * viewer's calendar day.
 */

/**
 * What each ledger operation is called on the admin screens. The key is the operation a tool
 * names when it charges credits. A tool that is missing here still shows, under its raw name.
 */
export const TOOL_NAMES: Record<string, string> = {
  // The Phantom, and ReelEstate's automatic listing video (the same engine)
  'smart-video': 'The Phantom',
  'listing-video': 'ReelEstate Automatic: video',
  'listing-video-clip': 'ReelEstate Automatic: animated photo',

  // ReelEstate step by step, Photo Cleanup, Agent Clone, the Studio
  'reelestate-scrape': 'ReelEstate: listing link',
  'reelestate-analyze': 'ReelEstate: photo check',
  'reelestate-script': 'ReelEstate: script',
  'reelestate-voiceover': 'ReelEstate: voice-over',
  'reelestate-clips': 'ReelEstate: clips',
  'reelestate-render': 'ReelEstate: render',
  'reelestate-cleanup': 'ReelEstate: Photo Cleanup',
  'agent-clone-composite': 'Agent Clone: photo',
  'agent-clone-animate': 'Agent Clone: video',
  'agent-clone-voice-switch': 'Agent Clone: switch voice',
  'editor-animate-image': 'Studio: animate photo',
  'editor-edit-image': 'Studio: edit photo',

  // Clone Studio
  clone_studio_ingest: 'Clone Studio: read the ad',
  clone_studio_image: 'Clone Studio: picture',
  clone_studio_animation: 'Clone Studio: clip',
  clone_studio_music: 'Clone Studio: music',
  clone_studio_finish: 'Clone Studio: Finish the ad',
  clone_studio_auto: 'Clone Studio: Do it for me',

  // Video Maker (AI Cinematographer)
  'video-generation': 'Video Maker: video',
  'starting-shot': 'Video Maker: starting shot',
  'storyboard-generation': 'Video Maker: storyboard',
  'storyboard-frame-extraction': 'Video Maker: storyboard frame',
  'scene-image-generation': 'Video Maker: scene image',
  'video-voice-switch': 'Video Maker: switch voice',

  // Script to Video
  'script-to-video-generation': 'Script to Video',
  'video-export': 'Video export',

  // Other video tools
  'video-swap': 'Video Swap',
  'video-roughcut': 'Rough Cut',
  video_analyzer: 'Analyze Video',

  // AI Avatar
  talking_avatar_generation: 'AI Avatar: video',
  avatar_generation: 'AI Avatar: new avatar',
  'avatar-voice-switch': 'AI Avatar: switch voice',

  // Voice and music
  voice_over_generation: 'Voice Over',
  voice_changer: 'Voice Changer',
  'voice-clone': 'Voice clone',
  music_generation: 'Music',

  // Images
  'image-maker': 'Image Maker',
  'pro-thumbnail-generation': 'Thumbnail Maker: Pro',
  'thumbnail-generation': 'Thumbnail Maker',
  'face-swap-only': 'Thumbnail Maker: face swap',
  recreation: 'Thumbnail Maker: recreation',
  'title-generation': 'Thumbnail Maker: titles',
  'logo-generation': 'Logo',

  // Ebook
  ebook_generation: 'Ebook Writer',
  ebook_cover_generation: 'Ebook cover',

  // Older names still in the ledger
  voice_over: 'Voice Over',
  media_generation: 'Video Maker',
  content_generation: 'Content Multiplier',
  avatar_video: 'AI Avatar: video',
  ai_prediction: 'Thumbnail Maker',
  script_to_video: 'Script to Video',
  logo_generation: 'Logo',
  video_swap: 'Video Swap',
};

/** The name of an operation on the admin screens. */
export function toolName(operation: string | null | undefined): string {
  const id = operation || 'unknown';
  return TOOL_NAMES[id] || id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const PAGE = 1000;

/**
 * Reads a query to its end. The API answers with at most 1,000 rows per request whatever limit
 * is asked for: with one request, "Last 90 days" and "All time" showed the newest 1,000 charges
 * and nothing else. `page` runs the query for one window of rows; it must order the rows the
 * same way every time (a unique column last), or rows shift between pages.
 */
export async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  max = 200_000
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The viewer's clock: `Date.getTimezoneOffset()` of their browser (minutes, UTC minus local;
 * -180 in Romania in summer). Without it every day is a UTC day, and what the owner makes
 * between midnight and 3 a.m. is filed under the day before.
 */
export function viewerOffset(value: string | null): number {
  const minutes = Number(value);
  return Number.isFinite(minutes) && Math.abs(minutes) <= 14 * 60 ? Math.round(minutes) : 0;
}

/** The viewer's calendar day ("2026-10-02") of an instant. */
export function localDay(instant: string | number | Date, offset: number): string {
  return new Date(new Date(instant).getTime() - offset * 60_000).toISOString().slice(0, 10);
}

/** The instant at which a calendar day of the viewer starts. */
export function dayStart(day: string, offset: number): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + offset * 60_000);
}

/** The calendar days from `first` to `last`, both included. */
export function daysBetween(first: string, last: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${first}T00:00:00.000Z`); t <= Date.parse(`${last}T00:00:00.000Z`); t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}
