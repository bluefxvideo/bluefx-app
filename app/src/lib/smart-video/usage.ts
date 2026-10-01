import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Smart Video — what one video costs in API calls.
 * Prices checked 2026-09-19 (ai.google.dev/pricing, fal.ai model pages); USD.
 */
const PRICES = {
  directorInputPerM: 2.0, // gemini-3.1-pro-preview, prompts <= 200k
  directorOutputPerM: 12.0, // includes thinking tokens
  ttsInputPerM: 1.0, // gemini-3.1-flash-tts-preview
  ttsAudioPerM: 20.0, // 25 audio tokens per second
  musicPerSong: 0.08, // lyria-3.5
  transcriptPerMinute: 0.03, // fal elevenlabs scribe
  soundPerSecond: 0.002, // fal elevenlabs sound effects
  lifestyleShotPerImage: 0.08, // fal nano-banana-2 edit, 1K
  drawingPerImage: 0.04, // fal gpt-image-2.5 flare text-to-image, 1024x1024 high
  motionPerSecond: 0.04, // fal ltx-2.3 image-to-video fast, 1080p
  cutoutPerImage: 0.005, // fal birefnet, compute-second billed; rounded up
  voiceMatchPerMinute: 0.02, // fal chatterbox hd speech-to-speech
  lookPerImage: 0.0003, // gemini-3.5-flash-lite, one small picture and a short answer
  captionNumbersPerCall: 0.003, // gemini-3.6-flash, the script's lines in, a short list out (thinking included)
  scenePicturePerImage: 0.048, // fal gpt-image-2.5 flare edit, 1080p high (edits run about 20% over text-to-image)
  castPicturePerImage: 0.04, // fal gpt-image-2.5 flare text-to-image, high
  pictureCheckPerPicture: 0.004, // gemini-3.6-flash, three to six small pictures in, a short verdict out (estimate)
  clipPerSecond: { best: 0.14, standard: 0.084 }, // fal kling o3: pro with sound, standard without (measured 2026-10-01)
};

export interface UsageEntry {
  step: string;
  usd: number;
  detail: string;
}

const store = new AsyncLocalStorage<UsageEntry[]>();

export const trackUsage = <T>(job: () => Promise<T>): Promise<{ result: T; usage: UsageEntry[] }> => {
  const entries: UsageEntry[] = [];
  return store.run(entries, async () => ({ result: await job(), usage: entries }));
};

const add = (step: string, usd: number, detail: string) => store.getStore()?.push({ step, usd, detail });

export const usage = {
  director: (meta: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } = {}) => {
    const input = meta.promptTokenCount || 0;
    const output = (meta.candidatesTokenCount || 0) + (meta.thoughtsTokenCount || 0);
    add('director', (input * PRICES.directorInputPerM + output * PRICES.directorOutputPerM) / 1e6, `${input} in / ${output} out tokens`);
  },
  voice: (meta: { promptTokenCount?: number; candidatesTokenCount?: number } = {}, seconds: number) => {
    const audioTokens = meta.candidatesTokenCount || Math.round(seconds * 25);
    add('voice take', ((meta.promptTokenCount || 0) * PRICES.ttsInputPerM + audioTokens * PRICES.ttsAudioPerM) / 1e6, `${seconds.toFixed(0)} s`);
  },
  music: () => add('music', PRICES.musicPerSong, '1 song'),
  transcript: (seconds: number) => add('word timings', (seconds / 60) * PRICES.transcriptPerMinute, `${seconds.toFixed(0)} s`),
  sound: (seconds: number) => add('signature sound', seconds * PRICES.soundPerSecond, `${seconds} s`),
  lifestyleShot: () => add('lifestyle photo', PRICES.lifestyleShotPerImage, '1 image'),
  drawing: () => add('whiteboard drawing', PRICES.drawingPerImage, '1 image'),
  motion: (seconds: number) => add('animated photo', seconds * PRICES.motionPerSecond, `${seconds} s clip`),
  cutout: () => add('product cut-out', PRICES.cutoutPerImage, '1 image'),
  voiceMatch: (seconds: number) => add('voice match', (seconds / 60) * PRICES.voiceMatchPerMinute, `${seconds.toFixed(0)} s`),
  look: () => add('picture check', PRICES.lookPerImage, '1 picture'),
  captionNumbers: (lines: number) => add('caption numbers', PRICES.captionNumbersPerCall, `${lines} lines`),
  scenePicture: (scene: number, free = false) => add(free ? 'scene picture (free remake)' : 'scene picture', PRICES.scenePicturePerImage, `scene ${scene}`),
  castPicture: () => add('cast picture', PRICES.castPicturePerImage, '1 image'),
  pictureCheck: () => add('scene picture check', PRICES.pictureCheckPerPicture, '1 picture'),
  frameLook: () => add('frame look', PRICES.pictureCheckPerPicture, '1 picture'),
  savedVoice: () => add('saved voice', PRICES.clipPerSecond.best, '1 voice'),
  scriptFix: (lines: number) => add('script fix', PRICES.captionNumbersPerCall, `${lines} lines`),
  clip: (seconds: number, engine: 'best' | 'standard', free = false) => add(free ? 'clip (free retake)' : 'clip', seconds * PRICES.clipPerSecond[engine], `${seconds} s, ${engine}`),
};
