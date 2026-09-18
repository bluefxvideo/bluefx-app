import { DeepgramClient } from '@deepgram/sdk';
import { readFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Transcript, TranscriptSegment, WordTiming, SilenceGap } from './types.js';

const execAsync = promisify(exec);

/**
 * ffmpeg binary path. Inside the Docker container this is just `ffmpeg`
 * (installed via `apk add --no-cache ffmpeg`). Override with FFMPEG_PATH env var.
 */
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

/**
 * Detect silence gaps using ffmpeg silencedetect.
 * Critical for precise cut points — see ARCHITECTURE.md lesson #2:
 * Deepgram word timestamps are ~100-150ms late, so we use silence END
 * as the IN point for each kept range.
 */
export async function detectSilences(audioPath: string): Promise<SilenceGap[]> {
  const { stdout } = await execAsync(
    `${FFMPEG} -i "${audioPath}" -af silencedetect=noise=-30dB:d=0.15 -f null - 2>&1`,
    { timeout: 120_000 },
  );

  const silences: SilenceGap[] = [];
  let currentStart: number | null = null;

  for (const line of stdout.split('\n')) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    const endMatch = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/);
    if (startMatch) currentStart = parseFloat(startMatch[1]);
    if (endMatch && currentStart !== null) {
      silences.push({
        start: currentStart,
        end: parseFloat(endMatch[1]),
        duration: parseFloat(endMatch[2]),
      });
      currentStart = null;
    }
  }
  return silences;
}

/**
 * Transcribe audio using Deepgram Nova-3.
 *
 * Why Deepgram over Whisper:
 * - Transcribes ALL speech faithfully, including repeated takes
 *   (Whisper merges retakes into one clean line, hiding the mistakes we need to detect)
 * - Precise word-level timestamps (no fake 3.7-second words)
 * - Bills per-second, not per-minute
 */
export async function transcribeAudio(
  audioPath: string,
  language: string = 'en',
): Promise<Transcript> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY not set');

  const deepgram = new DeepgramClient({ apiKey });
  const audioBuffer = await readFile(audioPath);

  const response = await deepgram.listen.v1.media.transcribeFile(
    audioBuffer,
    {
      model: 'nova-3',
      language,
      smart_format: false,    // Don't clean up — we want raw speech with all stumbles
      punctuate: true,
      diarize: false,
      utterances: false,
      filler_words: true,     // Keep "um", "uh" — helps detect stumbles
      paragraphs: false,
    },
  );

  const result = (response as any).body || response;
  const channel = result?.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];

  if (!alternative) throw new Error('Deepgram returned no transcription');

  const fullText = alternative.transcript || '';
  const rawWords = alternative.words || [];

  const words: WordTiming[] = rawWords.map((w: any) => ({
    word: w.punctuated_word || w.word,
    start: w.start,
    end: w.end,
  }));

  const segments = buildSegments(words);
  const duration = words.length > 0 ? words[words.length - 1].end : 0;

  return {
    fullText,
    segments,
    words,
    duration,
    language,
  };
}

/**
 * Group words into fine-grained segments.
 * Splits on sentence-ending punctuation or pauses > 0.4s.
 * (Comma + pause > 0.25s is also a split point, to catch tight retake boundaries.)
 */
function buildSegments(words: WordTiming[]): TranscriptSegment[] {
  if (words.length === 0) return [];

  const segments: TranscriptSegment[] = [];
  let segmentWords: WordTiming[] = [];
  let segmentStart = words[0].start;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    segmentWords.push(word);

    const isLastWord = i === words.length - 1;
    const isEndOfSentence = /[.!?]$/.test(word.word.trim());
    const endsWithComma = /,$/.test(word.word.trim());

    let shouldSplit = isLastWord || isEndOfSentence;

    if (!shouldSplit && i < words.length - 1) {
      const gap = words[i + 1].start - word.end;
      if (gap > 0.4) shouldSplit = true;
      if (endsWithComma && gap > 0.25) shouldSplit = true;
    }

    if (shouldSplit) {
      segments.push({
        id: segments.length,
        text: segmentWords.map((w) => w.word).join(' ').trim(),
        start: segmentStart,
        end: word.end,
        words: [...segmentWords],
      });
      segmentWords = [];
      if (i < words.length - 1) {
        segmentStart = words[i + 1].start;
      }
    }
  }

  return segments;
}
