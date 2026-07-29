import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Tempo (BPM) measured from the audio, not guessed by a language model —
 * asking an LLM for BPM returns a different number every run (100/120/100 on
 * the same clip, two of them self-reported "high confidence"), so tempo is
 * computed here by signal processing and is reproducible.
 *
 * Method: decode to mono PCM -> short-time energy -> half-wave-rectified
 * first difference (onset strength) -> autocorrelation over the plausible
 * tempo range -> pick the strongest lag, then fold octave errors (a 60 BPM
 * answer for a 120 BPM track) toward the range real ad music sits in.
 */

const SAMPLE_RATE = 22050;
const HOP = 256; // ~86 frames/sec — fine enough for 16th notes at 200 BPM
const MIN_BPM = 60;
const MAX_BPM = 190;
/** Below this autocorrelation ratio the track has no steady pulse we trust. */
const CONFIDENCE_FLOOR = 1.12;

export interface TempoResult {
  bpm: number;
  /** Peak-to-mean autocorrelation ratio at the winning lag. */
  strength: number;
  confidence: 'high' | 'medium' | 'low';
}

/** Decode any media file's audio to mono float32 PCM at SAMPLE_RATE. */
async function decodePcm(filePath: string): Promise<Float32Array> {
  const { stdout } = await execFileAsync(
    'ffmpeg',
    ['-i', filePath, '-vn', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', '-'],
    { maxBuffer: 512 * 1024 * 1024, encoding: 'buffer' }
  );
  const buf = stdout as unknown as Buffer;
  // Buffer may not be 4-byte aligned at the tail; floor to whole samples.
  const samples = Math.floor(buf.length / 4);
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) out[i] = buf.readFloatLE(i * 4);
  return out;
}

/** Onset strength envelope: rising energy between consecutive frames. */
function onsetEnvelope(pcm: Float32Array): Float32Array {
  const frames = Math.floor(pcm.length / HOP);
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * HOP;
    for (let i = start; i < start + HOP; i++) sum += pcm[i] * pcm[i];
    // log compression keeps loud sections from dominating the correlation
    energy[f] = Math.log1p(sum);
  }
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) {
    const d = energy[f] - energy[f - 1];
    onset[f] = d > 0 ? d : 0; // half-wave rectify: only attacks count
  }
  return onset;
}

function mean(a: Float32Array | number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return a.length ? s / a.length : 0;
}

/**
 * Fold octave errors. Autocorrelation happily locks onto half or double the
 * musical tempo; ad beds essentially always sit in 70-160, so pull outliers
 * into that window by doubling/halving.
 */
function foldToMusicalRange(bpm: number): number {
  let out = bpm;
  while (out < 70) out *= 2;
  while (out > 160) out /= 2;
  return out;
}

export async function detectTempo(filePath: string): Promise<TempoResult | null> {
  const pcm = await decodePcm(filePath);
  if (pcm.length < SAMPLE_RATE * 3) return null; // under 3s of audio — not enough

  const onset = onsetEnvelope(pcm);
  if (onset.length < 128) return null;

  // Mean-remove so the autocorrelation measures periodicity, not loudness
  const m = mean(onset);
  const centered = new Float32Array(onset.length);
  for (let i = 0; i < onset.length; i++) centered[i] = onset[i] - m;

  const framesPerSec = SAMPLE_RATE / HOP;
  const minLag = Math.floor((60 / MAX_BPM) * framesPerSec);
  const maxLag = Math.min(Math.ceil((60 / MIN_BPM) * framesPerSec), Math.floor(centered.length / 2));
  if (maxLag <= minLag) return null;

  const scores: number[] = [];
  let bestLag = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    const n = centered.length - lag;
    for (let i = 0; i < n; i++) sum += centered[i] * centered[i + lag];
    const score = sum / n;
    scores.push(score);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  const avgScore = mean(scores.map((s) => Math.abs(s)));
  const strength = avgScore > 0 ? bestScore / avgScore : 0;
  if (!(bestScore > 0) || strength < CONFIDENCE_FLOOR) return null;

  // Integer lags quantize badly: at ~86 frames/sec, lag 43 vs 44 is 120 vs
  // 117 BPM. Parabolic interpolation across the peak recovers sub-frame
  // precision (validated to ±1 BPM on synthetic click tracks).
  const peakIdx = bestLag - minLag;
  let refinedLag = bestLag;
  if (peakIdx > 0 && peakIdx < scores.length - 1) {
    const yPrev = scores[peakIdx - 1];
    const yPeak = scores[peakIdx];
    const yNext = scores[peakIdx + 1];
    const denom = yPrev - 2 * yPeak + yNext;
    if (denom !== 0) {
      const offset = (0.5 * (yPrev - yNext)) / denom;
      if (Math.abs(offset) <= 1) refinedLag = bestLag + offset;
    }
  }

  const rawBpm = (60 * framesPerSec) / refinedLag;
  const bpm = Math.round(foldToMusicalRange(rawBpm));

  return {
    bpm,
    strength: Number(strength.toFixed(2)),
    confidence: strength >= 2.2 ? 'high' : strength >= 1.5 ? 'medium' : 'low',
  };
}
