import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlink } from 'fs/promises';
import type { JobRequest, JobStatus, CallbackPayload } from './types.js';
import { transcribeAudio, detectSilences } from './transcribe.js';
import { analyzeTranscript } from './analyze.js';
import { generateFCPXML } from './generate-xml.js';
import { resolveSequenceRate } from './timecode.js';
import {
  downloadAudio,
  uploadXML,
  uploadResolveXML,
  uploadTranscriptJson,
  readTranscriptionCache,
  writeTranscriptionCache,
} from './storage.js';

/**
 * Process a single rough-cut job end-to-end.
 *
 * Pipeline (matches the CLI):
 *   1. Download audio MP3 from Supabase Storage (browser uploaded it there)
 *   2. Check transcription cache (SHA-256 hash key)
 *   3. If miss: Deepgram transcribe + ffmpeg silence detection, write to cache
 *   4. Claude decides what to remove and trim (analyze.ts)
 *   5. Generate FCP XML at the source's sequence rate, path-free pathurl for Premiere reconnect
 *   6. Upload XML + transcript JSON to Supabase Storage
 *   7. POST final callback to Next.js webhook
 */
export async function processJob(job: JobRequest): Promise<void> {
  const tmpAudioPath = join(tmpdir(), `roughcut-${randomUUID()}.mp3`);

  const emitProgress = async (status: JobStatus, progress: number) => {
    const payload: CallbackPayload = { jobId: job.jobId, status, progress };
    await postCallback(job.callbackUrl, payload).catch((err) => {
      // Swallow callback errors during progress — don't fail the job if webhook is briefly down
      console.warn(`[${job.jobId}] progress callback failed: ${err.message}`);
    });
  };

  try {
    // 1. Download audio
    await emitProgress('transcribing', 5);
    await downloadAudio(job.audioUrl, tmpAudioPath);

    // 2. Check cache
    let transcript, silences;
    const cached = await readTranscriptionCache(job.audioHash);
    if (cached) {
      console.log(`[${job.jobId}] cache hit for hash ${job.audioHash.slice(0, 8)}...`);
      transcript = cached.transcript;
      silences = cached.silences;
      await emitProgress('transcribing', 40);
    } else {
      console.log(`[${job.jobId}] cache miss — calling Deepgram`);
      // 3. Transcribe + silence detection in parallel
      await emitProgress('transcribing', 15);
      const [t, s] = await Promise.all([
        transcribeAudio(tmpAudioPath),
        detectSilences(tmpAudioPath),
      ]);
      transcript = t;
      silences = s;
      await writeTranscriptionCache(job.audioHash, transcript, silences).catch((err) => {
        // Caching is best-effort — don't fail the job
        console.warn(`[${job.jobId}] failed to write cache: ${err.message}`);
      });
    }

    // 4. Analyze with Claude. Frame alignment uses the same rate the XML will use.
    await emitProgress('analyzing', 50);
    const sequenceFps = resolveSequenceRate(job.videoMetadata.frameRate).fps;
    const editDecision = await analyzeTranscript(transcript, sequenceFps, silences);

    // 5. Generate XML
    await emitProgress('generating', 85);
    // One XML per editor: Premiere and DaVinci Resolve read frame rates and stereo differently.
    const xmlMetadata = { ...job.videoMetadata, fileName: job.videoFilename };
    const xmlContent = generateFCPXML(xmlMetadata, editDecision, 'premiere');
    const resolveXmlContent = generateFCPXML(xmlMetadata, editDecision, 'resolve');

    // 6. Upload outputs
    const [xmlPath, transcriptPath] = await Promise.all([
      uploadXML(job.userId, job.jobId, xmlContent),
      uploadTranscriptJson(job.userId, job.jobId, transcript),
      uploadResolveXML(job.userId, job.jobId, resolveXmlContent),
    ]);

    // 7. Final callback
    const timeSavedSeconds = Math.round(editDecision.removedDuration);
    const payload: CallbackPayload = {
      jobId: job.jobId,
      status: 'done',
      progress: 100,
      xmlPath,
      transcriptPath,
      removals: editDecision.removals,
      segmentsRemoved: editDecision.removedCount,
      timeSavedSeconds,
    };
    await postCallback(job.callbackUrl, payload);

    console.log(
      `[${job.jobId}] done — removed ${editDecision.removedCount} segments ` +
        `(${timeSavedSeconds}s), XML at ${xmlPath}`,
    );
  } catch (err: any) {
    console.error(`[${job.jobId}] failed:`, err);
    const payload: CallbackPayload = {
      jobId: job.jobId,
      status: 'failed',
      progress: 0,
      error: userFacingError(err),
    };
    await postCallback(job.callbackUrl, payload).catch(() => {});
  } finally {
    // Always clean up temp audio
    await unlink(tmpAudioPath).catch(() => {});
  }
}

/**
 * What the user sees when a job fails. Raw errors name the providers (fal, Deepgram,
 * the model) and carry API details, so they stay in the worker log only.
 */
function userFacingError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (message.startsWith('The AI response was cut off')) {
    return 'This video is too long to analyze in one go. Try a shorter video.';
  }
  return 'Something went wrong while making your rough cut. Please try again.';
}

async function postCallback(callbackUrl: string, payload: CallbackPayload): Promise<void> {
  const internalKey = process.env.INTERNAL_API_KEY || '';
  const res = await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Api-Key': internalKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`callback HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }
}
