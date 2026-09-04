import { readFile, writeFile } from 'fs/promises';
import { createAdminClient } from '@/app/supabase/server';
import { convertVoiceWithChatterbox } from '@/actions/models/fal-chatterbox-s2s';
import type { ChatterboxPresetVoice } from '@/actions/models/chatterbox-voices';
import {
  extractAudioFromVideo,
  replaceAudioInVideo,
  convertAudioToMp3,
  createTempPath,
  cleanupTempFiles,
} from '@/actions/services/ffmpeg-service';

/**
 * Shared voice-conversion core (ChatterboxHD speech-to-speech).
 *
 * Takes a source that is already in storage (audio, or a video whose
 * speech should be re-voiced), converts the speech to the target voice and
 * writes the result next to the caller's other files. For a video source the
 * original picture is kept frame-for-frame and only the audio track is
 * replaced, so lip movement stays in sync.
 *
 * Used by the Voice Changer tab and by ReelEstate Agent Clone ("switch
 * voice" on a finished presenter clip). No auth or credits here — callers
 * own those.
 */

export type VoiceTarget =
  | { mode: 'preset'; voice: ChatterboxPresetVoice }
  | { mode: 'custom'; sampleUrl: string };

export interface VoiceConvertInput {
  /** Shared id for temp files and storage names, e.g. `voice_changer_...`. */
  batchId: string;
  /** Public URL of the source media (must be fetchable by the server and by fal). */
  sourceUrl: string;
  sourceIsVideo: boolean;
  /** Extension of the source file, used for the temp copy ffmpeg reads. */
  sourceExt: string;
  target: VoiceTarget;
  highQuality: boolean;
  /** Where results are written: `${bucket}/${folder}/${batchId}_result.*` */
  output: { bucket: string; folder: string };
}

export type VoiceConvertResult =
  | { success: true; resultType: 'video'; videoUrl: string; fileSize: number }
  | { success: true; resultType: 'audio'; audioUrl: string; fileSize: number }
  | { success: false; error: string };

export async function convertVoiceInMedia(input: VoiceConvertInput): Promise<VoiceConvertResult> {
  const { batchId, output } = input;
  const admin = createAdminClient();
  const tempFiles: string[] = [];

  const upload = async (path: string, body: Buffer, contentType: string) => {
    const { error } = await admin.storage.from(output.bucket).upload(path, body, { contentType, upsert: true });
    if (error) throw new Error(`Failed to store ${path.split('/').pop()}: ${error.message}`);
    return admin.storage.from(output.bucket).getPublicUrl(path).data.publicUrl;
  };

  try {
    // 1) Source audio for Chatterbox — extracted from the video when needed
    let chatterboxSourceUrl = input.sourceUrl;
    let videoTempPath: string | undefined;

    if (input.sourceIsVideo) {
      const sourceResponse = await fetch(input.sourceUrl);
      if (!sourceResponse.ok) {
        return { success: false, error: `Could not read the source video (${sourceResponse.status})` };
      }
      videoTempPath = await createTempPath('vc_video', input.sourceExt || 'mp4');
      tempFiles.push(videoTempPath);
      await writeFile(videoTempPath, Buffer.from(await sourceResponse.arrayBuffer()));

      const audioTempPath = await createTempPath('vc_extracted', 'wav');
      tempFiles.push(audioTempPath);
      console.log(`🎬 Voice convert: extracting audio (${batchId})`);
      await extractAudioFromVideo(videoTempPath, audioTempPath);

      chatterboxSourceUrl = await upload(
        `${output.folder}/${batchId}_extracted.wav`,
        await readFile(audioTempPath),
        'audio/wav',
      );
    }

    // 2) Speech-to-speech
    console.log(`🔄 Voice convert: ChatterboxHD (${batchId}, ${input.target.mode}, hq=${input.highQuality})`);
    const converted = await convertVoiceWithChatterbox({
      source_audio_url: chatterboxSourceUrl,
      target_voice: input.target.mode === 'preset' ? input.target.voice : undefined,
      target_voice_audio_url: input.target.mode === 'custom' ? input.target.sampleUrl : undefined,
      high_quality_audio: input.highQuality,
    });
    if (!converted.success || !converted.audioUrl) {
      return { success: false, error: converted.error || 'Voice conversion failed' };
    }

    const resultResponse = await fetch(converted.audioUrl);
    if (!resultResponse.ok) {
      return { success: false, error: 'Failed to download the converted audio' };
    }
    const resultBuffer = Buffer.from(await resultResponse.arrayBuffer());

    // 3a) Video: put the new track under the original picture
    if (input.sourceIsVideo && videoTempPath) {
      const convertedAudioPath = await createTempPath('vc_converted', 'wav');
      tempFiles.push(convertedAudioPath);
      await writeFile(convertedAudioPath, resultBuffer);

      const outputVideoPath = await createTempPath('vc_output', 'mp4');
      tempFiles.push(outputVideoPath);
      console.log(`🎬 Voice convert: replacing audio track (${batchId})`);
      await replaceAudioInVideo(videoTempPath, convertedAudioPath, outputVideoPath);

      const finalVideo = await readFile(outputVideoPath);
      const videoUrl = await upload(`${output.folder}/${batchId}_result.mp4`, finalVideo, 'video/mp4');
      return { success: true, resultType: 'video', videoUrl, fileSize: finalVideo.length };
    }

    // 3b) Audio: persist as MP3 (Chatterbox returns WAV; mp3 is what the
    // history table and the download expect). Falls back to fal's URL if
    // anything in the transcode/store step fails.
    let audioUrl = converted.audioUrl;
    let fileSize = resultBuffer.length;
    try {
      const wavPath = await createTempPath('vc_result', 'wav');
      tempFiles.push(wavPath);
      await writeFile(wavPath, resultBuffer);
      const mp3Path = await createTempPath('vc_result', 'mp3');
      tempFiles.push(mp3Path);
      await convertAudioToMp3(wavPath, mp3Path);
      const mp3 = await readFile(mp3Path);
      audioUrl = await upload(`${output.folder}/${batchId}_result.mp3`, mp3, 'audio/mpeg');
      fileSize = mp3.length;
    } catch (persistError) {
      console.warn('Voice convert: could not persist result audio, using provider URL:', persistError);
    }
    return { success: true, resultType: 'audio', audioUrl, fileSize };
  } catch (error) {
    console.error(`❌ Voice convert failed (${batchId}):`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Voice conversion failed' };
  } finally {
    if (tempFiles.length) await cleanupTempFiles(...tempFiles);
  }
}
