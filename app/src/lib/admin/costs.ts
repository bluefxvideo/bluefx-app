/**
 * What our usage costs us at the AI providers, in US dollars (owner 2026-10-27: "I want to know how much everything
 * costs to me in US dollars. That's going to help me to keep costs down").
 *
 * Two sources:
 * - Exact: every Phantom job (smart_video_jobs.job.usage) records the dollars of each step it paid for, failed and
 *   free ones included. That covers the Phantom Ad Maker with its presenter, ReelEstate Automatic with its animated
 *   photos, and the free video ads (jobs of the free-video system account) with their bonus ads.
 * - Estimated: every other tool only records credits, so its cost is the credits (or the charge) times the price of
 *   the model it calls (fal / Replicate / Google price pages and the prices in our own code, checked 2026-10-27).
 *   The ledger lines of the job-based operations count $0 here, since the jobs already carry them.
 */

/** Ledger operations whose cost comes from the jobs (smart_video_jobs), not from the credits. */
export const JOB_COST_OPERATIONS = new Set(['smart-video', 'phantom-presenter', 'listing-video', 'listing-video-clip']);

type Rate = { perCredit: number } | { perCharge: number };

/**
 * Estimated provider cost of one ledger charge, by operation. perCredit: the credits scale with the seconds or images
 * made, so the cost does too. perCharge: a flat price per use.
 */
export const OPERATION_COST: Record<string, Rate> = {
  // Video Clip Maker: LTX 2.3 fast $0.02/credit, Seedance 1.5 Pro $0.013, Kling O3 Pro $0.0175 (2/4/8 credits a second).
  'video-generation': { perCredit: 0.018 },
  'starting-shot': { perCharge: 0.055 },
  'scene-image-generation': { perCredit: 0.03 }, // GPT Image 2.5 high 2K, 2 credits
  'storyboard-generation': { perCharge: 0.055 },
  'storyboard-frame-extraction': { perCharge: 0.01 },
  'video-voice-switch': { perCharge: 0.05 },

  // Clone Studio: Kling O3 clips 8 credits a second at $0.14 a second; pictures GPT Image 2.5 edit; the rest Gemini, Lyria, ElevenLabs.
  clone_studio_animation: { perCredit: 0.0175 },
  clone_studio_image: { perCredit: 0.013 },
  clone_studio_ingest: { perCharge: 0.03 },
  clone_studio_music: { perCharge: 0.08 },
  clone_studio_finish: { perCharge: 0.18 },
  clone_studio_auto: { perCharge: 0.15 },

  // AI Avatar: Basic LTX-2 audio-to-video, Fast LTX 2.3, Ultra Kling O3 (1 / 2 / 8 credits a second).
  talking_avatar_generation: { perCredit: 0.02 },
  avatar_generation: { perCharge: 0.04 },
  'avatar-voice-switch': { perCharge: 0.05 },

  // Other video tools
  'video-swap': { perCredit: 0.0175 }, // Kling 2.6 Pro motion control, 8 credits per source second
  'video-roughcut': { perCharge: 0.2 }, // Deepgram + the edit writer
  video_analyzer: { perCharge: 0.02 }, // Gemini flash-lite (+ a download)
  'editor-animate-image': { perCredit: 0.04 }, // LTX 2.3 fast, 1 credit a second
  'editor-edit-image': { perCharge: 0.05 },
  'agent-clone-animate': { perCredit: 0.06 }, // LTX 2.5 fast with sound on Replicate, 1 credit a second
  'agent-clone-composite': { perCharge: 0.06 },
  'agent-clone-voice-switch': { perCharge: 0.05 },
  'script-to-video-generation': { perCharge: 0.3 },

  // ReelEstate step by step
  'reelestate-scrape': { perCharge: 0.02 },
  'reelestate-analyze': { perCredit: 0.003 },
  'reelestate-script': { perCharge: 0.005 },
  'reelestate-voiceover': { perCharge: 0.05 },
  'reelestate-clips': { perCredit: 0.02 },
  'reelestate-cleanup': { perCredit: 0.0175 }, // Seedream edit, 2 credits a photo

  // Images
  'image-maker': { perCredit: 0.022 }, // GPT Image 2.5 high, 2/3/6 credits per image
  'pro-thumbnail-generation': { perCharge: 0.045 },
  'thumbnail-generation': { perCharge: 0.045 },
  'face-swap-only': { perCharge: 0.05 },
  recreation: { perCharge: 0.05 },
  'title-generation': { perCharge: 0.002 },
  'logo-generation': { perCharge: 0.05 },
  ebook_cover_generation: { perCharge: 0.05 },
  ebook_generation: { perCharge: 0.05 },

  // Voice and music
  voice_over_generation: { perCharge: 0.07 }, // MiniMax speech 2.8 HD, by characters
  voice_changer: { perCharge: 0.05 },
  'voice-clone': { perCharge: 0.05 },
  music_generation: { perCharge: 0.06 }, // Lyria 3 Pro $0.08, MiniMax music $0.03
};

/** The estimated dollars of one ledger charge; 0 for the job-based operations; null when the operation has no price yet. */
export function estimatedCost(operation: string | null | undefined, credits: number): number | null {
  if (!operation) return null;
  if (JOB_COST_OPERATIONS.has(operation)) return 0;
  const rate = OPERATION_COST[operation];
  if (!rate) return null;
  return 'perCredit' in rate ? Math.abs(credits) * rate.perCredit : rate.perCharge;
}

/** The dollars a Phantom job's usage list recorded. */
export function jobUsageCost(usage: unknown): number {
  if (!Array.isArray(usage)) return 0;
  return usage.reduce((sum, entry) => sum + (typeof entry?.usd === 'number' && Number.isFinite(entry.usd) ? entry.usd : 0), 0);
}

/** Which tool row a Phantom job's cost belongs to. */
export function jobTool(job: { freeAccount: boolean; bonus: boolean; listing: boolean }): string {
  if (job.freeAccount) return job.bonus ? 'free-video-bonus' : 'free-video-ads';
  if (job.bonus) return 'free-video-bonus';
  return job.listing ? 'listing-video' : 'smart-video';
}
