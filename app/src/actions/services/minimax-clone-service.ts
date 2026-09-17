'use server';

import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getUserCredits, deductCredits } from '@/actions/database/cinematographer-database';

const execFileAsync = promisify(execFile);

// What the clone tab advertises on its button. Charged only AFTER a
// successful clone, so a failed attempt costs nothing and needs no refund.
const VOICE_CLONE_CREDITS = 50;

// MiniMax's hard limits for a cloning sample. Checked here, before the
// provider call: a 5-second sample used to reach MiniMax, fail with the bare
// "voice duration too short", and one buyer retried it eight times in a row.
const VOICE_SAMPLE_MIN_SECONDS = 10;
const VOICE_SAMPLE_MAX_SECONDS = 300;

/** Length of a hosted audio file in seconds; ffprobe reads http(s) sources directly. */
async function probeSampleSeconds(url: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      url,
    ], { timeout: 30_000 });
    const seconds = parseFloat(stdout.trim());
    return seconds && !Number.isNaN(seconds) ? seconds : null;
  } catch (error) {
    console.warn('Voice clone: could not measure the sample, letting the provider decide:', error);
    return null;
  }
}

/** The one sentence a too-short or too-long sample gets, with the real length in it. */
function sampleLengthError(seconds: number | null): string {
  const opening = seconds == null
    ? 'Your sample'
    : `Your sample is ${seconds < 60 ? `${Math.round(seconds)} seconds` : `${(seconds / 60).toFixed(1)} minutes`} long. It`;
  return `${opening} needs to be between ${VOICE_SAMPLE_MIN_SECONDS} seconds and ${VOICE_SAMPLE_MAX_SECONDS / 60} minutes of clear speech. Record a longer sample (15 to 30 seconds works well) and try again. Nothing was charged.`;
}

// Lazy initialization
function getReplicate() {
  return new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
  });
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface VoiceCloneRequest {
  voice_file_url: string; // URL to audio file (10s-5min, <20MB)
  need_noise_reduction?: boolean;
  need_volume_normalization?: boolean;
}

export interface VoiceCloneResponse {
  success: boolean;
  voice_id?: string; // Minimax voice ID (e.g., "R8_FDU1SV5S")
  preview_url?: string;
  error?: string;
}

/**
 * Clone a voice using Minimax voice cloning via Replicate
 *
 * Requirements:
 * - Audio file: MP3, M4A, or WAV
 * - Duration: 10 seconds to 5 minutes
 * - File size: Less than 20MB
 *
 * The returned voice_id can be used with speech-2.6-hd for generation
 */
export async function cloneVoice(
  request: VoiceCloneRequest
): Promise<VoiceCloneResponse> {
  const replicate = getReplicate();

  try {
    console.log(`🎙️ Cloning voice from: ${request.voice_file_url}`);

    // Length gate: the sample is measured here so an out-of-range file never
    // reaches the provider and the user learns the actual number.
    const seconds = await probeSampleSeconds(request.voice_file_url);
    if (seconds != null && (seconds < VOICE_SAMPLE_MIN_SECONDS || seconds > VOICE_SAMPLE_MAX_SECONDS)) {
      console.warn(`Voice clone rejected before MiniMax: sample is ${seconds.toFixed(1)}s`);
      return { success: false, error: sampleLengthError(seconds) };
    }

    // Prepare input for voice cloning
    const input = {
      voice_file: request.voice_file_url,
      model: 'speech-2.6-hd', // Use the HD model for cloning
      need_noise_reduction: request.need_noise_reduction ?? true,
      need_volume_normalization: request.need_volume_normalization ?? true,
      accuracy: 0.7 // Text validation threshold
    };

    console.log(`🔊 Voice cloning settings:`, input);

    // Run voice cloning model
    const output = await replicate.run(
      'minimax/voice-cloning',
      { input }
    ) as { voice_id: string; preview?: string } | string;

    // Handle different response formats
    let voiceId: string;
    let previewUrl: string | undefined;

    if (typeof output === 'string') {
      // Some models return just the voice ID
      voiceId = output;
    } else if (output && typeof output === 'object') {
      voiceId = output.voice_id;
      previewUrl = output.preview;
    } else {
      throw new Error('Invalid response from voice cloning model');
    }

    if (!voiceId) {
      throw new Error('No voice ID received from cloning');
    }

    console.log(`✅ Voice cloned successfully: ${voiceId}`);

    return {
      success: true,
      voice_id: voiceId,
      preview_url: previewUrl
    };

  } catch (error) {
    console.error('❌ Voice cloning error:', error);
    const raw = error instanceof Error ? error.message : 'Voice cloning failed';
    // The provider's own wording, for the case where the gate above could not measure the file.
    if (/voice duration too (short|long)/i.test(raw)) {
      return { success: false, error: sampleLengthError(null) };
    }
    return { success: false, error: raw };
  }
}

/** Reduce a user-supplied filename to an S3-safe key segment, keeping the extension. */
function safeStorageName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const ext = dot > -1 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const base = (dot > -1 ? fileName.slice(0, dot) : fileName)
    .normalize('NFKD')                 // split accents from letters
    .replace(/[\u0300-\u036f]/g, '')   // drop the accent marks
    .replace(/[^A-Za-z0-9._-]+/g, '-') // everything else becomes a dash
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'voice';
  return ext ? `${base}.${ext}` : base;
}

/**
 * Create a signed upload slot so the BROWSER can push the audio straight to
 * storage. The old path base64-encoded the file into the server-action call,
 * which died somewhere in transport for multi-MB files (reproduced at 15MB,
 * fine at 321KB) — the user only ever saw a generic Server Components error.
 * Direct-to-storage uploads never touch our server, so file size stops
 * mattering up to the product's own 20MB rule.
 */
export async function prepareVoiceUpload(
  userId: string,
  fileName: string
): Promise<{ success: boolean; path?: string; token?: string; error?: string }> {
  const authed = await verifyCaller(userId);
  if (!authed.ok) return { success: false, error: authed.error };

  try {
    const supabase = getSupabaseClient();
    const storagePath = `${userId}/voice-cloning/${Date.now()}_${safeStorageName(fileName)}`;
    const { data, error } = await supabase.storage
      .from('script-videos')
      .createSignedUploadUrl(storagePath);
    if (error || !data?.token) {
      return { success: false, error: `Could not prepare upload: ${error?.message || 'no token'}` };
    }
    return { success: true, path: storagePath, token: data.token };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not prepare upload' };
  }
}

/** Clone from a file the browser already placed in storage via prepareVoiceUpload. */
export async function cloneVoiceFromStorage(
  userId: string,
  storagePath: string,
  options?: { noise_reduction?: boolean; volume_normalization?: boolean }
): Promise<VoiceCloneResponse> {
  const authed = await verifyCaller(userId);
  if (!authed.ok) return { success: false, error: authed.error };

  // The path must be the caller's own clone slot — nothing else is signable here.
  if (!storagePath.startsWith(`${userId}/voice-cloning/`)) {
    return { success: false, error: 'Invalid upload path' };
  }

  const creditCheck = await getUserCredits(userId);
  if (!creditCheck.success || (creditCheck.credits ?? 0) < VOICE_CLONE_CREDITS) {
    return {
      success: false,
      error: `Voice cloning costs ${VOICE_CLONE_CREDITS} credits and your balance is ${creditCheck.credits ?? 0}. Top up or free some credits and try again.`
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { data: signed, error: signErr } = await supabase.storage
      .from('script-videos')
      .createSignedUrl(storagePath, 3600);
    if (signErr || !signed?.signedUrl) {
      return { success: false, error: `Uploaded file not found: ${signErr?.message || 'no url'}` };
    }

    const result = await cloneVoice({
      voice_file_url: signed.signedUrl,
      need_noise_reduction: options?.noise_reduction ?? true,
      need_volume_normalization: options?.volume_normalization ?? true
    });

    if (result.success && result.voice_id) {
      const deduction = await deductCredits(userId, VOICE_CLONE_CREDITS, 'voice-clone', {
        voice_id: result.voice_id,
        storage_path: storagePath,
      });
      if (!deduction.success) {
        console.error('Voice clone succeeded but credit deduction failed:', deduction.error);
      }
    }

    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Voice cloning failed' };
  }
}

/** The caller's session must belong to the userId it claims to act for. */
async function verifyCaller(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { createClient: createSessionClient } = await import('@/app/supabase/server');
    const supabase = await createSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Not signed in. Reload the page and try again.' };
    if (user.id !== userId) return { ok: false, error: 'Session mismatch. Reload the page and try again.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not verify your session. Reload the page and try again.' };
  }
}
