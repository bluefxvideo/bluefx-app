import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { writeFile } from 'fs/promises';
import type { Transcript, SilenceGap } from './types.js';

/**
 * Private bucket. The worker uses the service role; the app hands users short-lived
 * signed URLs. Nothing in this bucket is publicly readable.
 */
const BUCKET = 'video-roughcut';

let _client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/** Download the job's audio from the signed URL the app created, to a temp file. */
export async function downloadAudio(audioUrl: string, tempPath: string): Promise<void> {
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Failed to download audio: ${res.status} ${res.statusText}`);
  await writeFile(tempPath, Buffer.from(await res.arrayBuffer()));
}

async function uploadText(path: string, body: string, contentType: string): Promise<string> {
  const { error } = await supabase().storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Failed to upload ${path}: ${error.message}`);
  return path;
}

/** Upload the XML. Returns its storage path: outputs/{userId}/{jobId}/roughcut.xml */
export function uploadXML(userId: string, jobId: string, xmlContent: string): Promise<string> {
  return uploadText(`outputs/${userId}/${jobId}/roughcut.xml`, xmlContent, 'application/xml');
}

/** Upload the full transcript, kept for a later "review and adjust cuts" feature. */
export function uploadTranscriptJson(userId: string, jobId: string, transcript: Transcript): Promise<string> {
  return uploadText(`outputs/${userId}/${jobId}/transcript.json`, JSON.stringify(transcript), 'application/json');
}

async function downloadJson<T>(path: string): Promise<T | null> {
  const { data, error } = await supabase().storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return JSON.parse(await data.text()) as T;
}

/**
 * Transcription cache keyed on the SHA-256 of the audio bytes. A re-run of the same
 * audio skips Deepgram. The table's *_url columns hold storage paths.
 */
export interface CachedTranscription {
  transcript: Transcript;
  silences: SilenceGap[];
}

export async function readTranscriptionCache(audioHash: string): Promise<CachedTranscription | null> {
  const { data, error } = await supabase()
    .from('transcription_cache')
    .select('transcription_json_url, silences_json_url')
    .eq('audio_hash', audioHash)
    .maybeSingle();
  if (error || !data?.transcription_json_url) return null;

  try {
    const transcript = await downloadJson<Transcript>(data.transcription_json_url);
    if (!transcript) return null;
    const silences = data.silences_json_url
      ? (await downloadJson<SilenceGap[]>(data.silences_json_url)) ?? []
      : [];

    await supabase()
      .from('transcription_cache')
      .update({ last_used_at: new Date().toISOString() })
      .eq('audio_hash', audioHash);

    return { transcript, silences };
  } catch {
    return null;
  }
}

export async function writeTranscriptionCache(
  audioHash: string,
  transcript: Transcript,
  silences: SilenceGap[],
): Promise<void> {
  const [transcriptPath, silencesPath] = await Promise.all([
    uploadText(`transcription-cache/${audioHash}-transcript.json`, JSON.stringify(transcript), 'application/json'),
    uploadText(`transcription-cache/${audioHash}-silences.json`, JSON.stringify(silences), 'application/json'),
  ]);

  const { error } = await supabase().from('transcription_cache').upsert(
    {
      audio_hash: audioHash,
      transcription_json_url: transcriptPath,
      silences_json_url: silencesPath,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'audio_hash' },
  );
  if (error) throw new Error(`Failed to write transcription cache row: ${error.message}`);
}
