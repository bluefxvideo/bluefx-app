import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { convertVoiceWithChatterbox } from '@/actions/models/fal-chatterbox-s2s';
import { generateMusic, generateVoice, pcmToWav, type SpokenWord } from '@/lib/smart-video/audio';
import { captionDigits } from '@/lib/smart-video/numbers';
import { alignScript } from '@/lib/smart-video/timing';
import type { StoreFile } from '@/lib/smart-video/types';
import { usage } from '@/lib/smart-video/usage';
import type { CloneProject, CloneScene, FinishSettings, FinishStage, SceneFinish } from '@/types/clone-studio';
import { sceneClip, spokenLineOf } from '@/types/clone-studio';
import { NARRATOR_WORDS_PER_SECOND, clipPaceFactor, levelFilter, levelGain, measureLoudness, paceFactor, speakingRate } from './edit';
import { ownFile } from './files';
import { cleanupWorkDir, downloadToFile, makeWorkDir } from './segmentation';
import { buildCloneTimeline, type CloneTimeline, type CutScene } from './timeline';

/**
 * Clone Studio, "Finish the ad": the board's clips and pictures become a finished ad.
 *
 * Two halves. checkScene listens to a clip and looks at its picture, so the panel can
 * propose where each scene's voice comes from before anything is paid for. buildCloneFinish
 * is the paid run: it prepares the clips, records the narrator, makes the music and lays
 * everything on a timeline for the renderer.
 */

const run = promisify(execFile);
const BIG = { maxBuffer: 1 << 30 };

const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' });
const languageName = (code?: string) => {
  try {
    return (code && LANGUAGE_NAMES.of(code)) || 'English';
  } catch {
    return 'English';
  }
};

/** How the narrator reads. A delivery note only: it cannot change what is said. */
const NARRATOR_DELIVERY = 'Friendly, confident and upbeat, like a good radio spot. A quick pace with energy, a smile in the voice.';
const VOICE_TAKES = 3;
const MIN_LINE_COVERAGE = 0.5; // a take that dropped more than half of a line is recorded again
const MIN_VOICE_SAMPLE_SECONDS = 2.5; // shorter than this and a talking clip is no use as a voice to match

// ---------------------------------------------------------------------------
// Listening and looking
// ---------------------------------------------------------------------------

/** The sound of a clip as 24 kHz mono WAV, read straight from its address or file. Empty when it has none. */
export async function soundOf(source: string): Promise<Buffer> {
  try {
    const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', source, '-vn', '-ac', '1', '-ar', '24000', '-f', 'wav', '-'], { ...BIG, encoding: 'buffer', timeout: 120_000 });
    return stdout;
  } catch {
    return Buffer.alloc(0);
  }
}

export interface Heard {
  text: string;
  words: SpokenWord[];
  /** The language the service heard, e.g. "eng". */
  language?: string;
}

/** What is said in a recording, word by word (ElevenLabs Scribe via fal). Without a language the service detects it. */
export async function hear(wav: Buffer, language?: string): Promise<Heard> {
  if (wav.length < 4000) return { text: '', words: [] };
  const res = await fetch('https://fal.run/fal-ai/elevenlabs/speech-to-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${process.env.FAL_KEY}` },
    body: JSON.stringify({ audio_url: `data:audio/wav;base64,${wav.toString('base64')}`, ...(language ? { language_code: language } : {}), diarize: false, tag_audio_events: false }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`The words of a clip could not be read (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  usage.transcript(wav.length / 48000);
  const words: SpokenWord[] = (json.words || [])
    .filter((w: { type?: string }) => !w.type || w.type === 'word')
    .map((w: { text: string; start: number; end: number }) => ({ text: w.text, start: w.start, end: w.end }));
  return { text: words.map((w) => w.text).join(' ').trim(), words, language: json.language_code || undefined };
}

/**
 * Whether the person who says these words is on camera. The picture a clip was animated
 * from is its first frame, so one look at it is enough. When the look fails the clip is
 * treated as a person talking: its own sound is kept, nothing is replaced.
 */
async function speakerOnCamera(pictureUrl: string, heard: string): Promise<boolean> {
  try {
    const source = await fetch(pictureUrl, { signal: AbortSignal.timeout(30_000) });
    if (!source.ok) throw new Error(`picture ${source.status}`);
    const picture = await sharp(Buffer.from(await source.arrayBuffer())).rotate().resize(640, 640, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GOOGLE_GENERATIVE_AI_API_KEY || '' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: picture.toString('base64') } },
              {
                text: `This is the first frame of a short video clip. In the clip these words are heard: "${heard.slice(0, 400)}". Is the speaker on camera: a person whose face is in the frame, so that a viewer would watch their lips say the words? A product, food, a place, hands only, or a person seen from behind or far away means the words come from a narrator. Answer JSON only: {"on_camera": true or false}`,
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    usage.look();
    const text = (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
    return Boolean(JSON.parse(text).on_camera);
  } catch (error) {
    console.warn('Clone Studio: could not tell who talks, keeping the clip\'s own sound:', String(error).slice(0, 160));
    return true;
  }
}

/** The transcript writes a spoken price twice ("$12 dollars"); a caption writes it once. */
const asWritten = (heard: string) => heard.replace(/([$€£]\s?\d[\d.,]*)\s+(?:dollars?|euros?|pounds?|bucks)\b/gi, '$1');

/**
 * How a scene goes into the finished ad unless the client says otherwise.
 * A scene with a clip shows the clip; a person talking on camera keeps their own voice,
 * words with nobody on camera go to the narrator. A silent clip of a scene that had words
 * in the source ad is given to the narrator with an empty line: the client writes it. A
 * scene with only a picture shows the picture; a scene with neither is left out. Neither
 * the source ad's words nor its text on screen are ever proposed: they belong to someone
 * else's business (the panel shows them next to the boxes, as a reminder of what was there).
 */
export async function proposeFinish(scene: CloneScene): Promise<{ finish: SceneFinish; language?: string }> {
  const clip = sceneClip(scene);
  const kept = scene.finish;
  const written = spokenLineOf(scene.motion_prompt);
  const hadWords = Boolean(scene.analysis?.dialog?.trim());
  if (!clip) {
    const picture = scene.edited_image_url ? (kept?.picture === 'card' || kept?.picture === 'skip' ? kept.picture : 'still') : kept?.picture === 'card' ? 'card' : 'skip';
    const line = kept?.line ?? written;
    return { finish: { picture, sound: kept?.sound === 'none' || !(line || hadWords) ? 'none' : 'narrator', line, text: kept?.text ?? '', checked_clip_url: null } };
  }

  const heard = await hear(await soundOf(ownFile(clip)));
  // The captions use the client's own spelling when the clip says what the client wrote.
  const agrees = written && heard.words.length ? alignScript([written], heard.words).sceneCoverage[0] >= 0.6 : false;
  // A scene the director planned as a person talking, whose clip says its line, needs no second look:
  // the look (one small picture, a small model) once sent a close-up of the speaker to the narrator.
  const onCamera = !heard.text ? false : scene.plan?.speaker === 'on_camera' && agrees ? true : await speakerOnCamera(ownFile(scene.edited_image_url || scene.keyframe_url), heard.text);
  return {
    language: heard.text ? heard.language : undefined,
    finish: {
      picture: kept?.picture === 'card' || kept?.picture === 'skip' ? kept.picture : 'clip',
      sound: heard.text ? (onCamera ? 'clip' : 'narrator') : kept?.sound === 'narrator' || hadWords ? 'narrator' : 'none',
      // A line the client already wrote for the narrator stays when the new clip is silent too.
      line: heard.text ? (agrees ? written : asWritten(heard.text)) : kept?.sound === 'narrator' ? kept.line : '',
      text: kept?.text ?? '',
      heard: heard.text,
      checked_clip_url: clip,
    },
  };
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

async function probe(file: string): Promise<{ seconds: number; portrait: boolean; sound: boolean }> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file], BIG);
  const info = JSON.parse(stdout) as { streams?: { codec_type?: string; width?: number; height?: number }[]; format?: { duration?: string } };
  const video = info.streams?.find((s) => s.codec_type === 'video');
  return {
    seconds: Number(info.format?.duration) || 0,
    portrait: Boolean(video?.width && video.height && video.height > video.width * 1.15),
    sound: Boolean(info.streams?.some((s) => s.codec_type === 'audio')),
  };
}

/** The same sound at the loudness every voice and the music are brought to. */
async function levelled(file: string, out: string): Promise<string> {
  const gain = levelGain(await measureLoudness(file));
  await run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vn', '-af', levelFilter(gain), ...(out.endsWith('.mp3') ? ['-c:a', 'libmp3lame', '-b:a', '192k'] : ['-ac', '1', '-ar', '24000']), out], BIG);
  return out;
}

/**
 * The lines as the narrator reads them. In a fast-cut ad one sentence runs over several
 * scenes ("He can always" / "spot a winning hook" / "in three seconds."); read line by line
 * it would come out in three breaths, so a line that does not end a sentence is read on
 * with the next one. The cuts still fall between the lines: the words are timed afterwards.
 */
function asSpoken(lines: string[]): string[] {
  const paragraphs: string[] = [];
  for (const line of lines) {
    const previous = paragraphs[paragraphs.length - 1];
    if (previous !== undefined && !/[.!?…]["')\]]?$/.test(previous)) paragraphs[paragraphs.length - 1] = `${previous} ${line.trim()}`;
    else paragraphs.push(line.trim());
  }
  return paragraphs;
}

/**
 * A short recording of the narrator reading the start of the ad's own script: the sample
 * the video engine saves the voice from, so the people on camera speak with it.
 */
export async function narratorSample(lines: string[], language: string | undefined, gender: 'female' | 'male'): Promise<Buffer> {
  const sample: string[] = [];
  let words = 0;
  for (const line of lines.map((text) => text.trim()).filter(Boolean)) {
    sample.push(line);
    words += line.split(/\s+/).length;
    if (words >= 34) break;
  }
  if (words < 8) throw new Error('The script is too short for a voice sample');
  const voice = await generateVoice(asSpoken(sample), languageName(language), { gender, direction: NARRATOR_DELIVERY });
  return pcmToWav(voice.pcm, voice.rate);
}

/** Records the narrator. A take that dropped part of a line is recorded again; the best take is kept. */
async function recordNarrator(lines: string[], language: string | undefined, gender: 'female' | 'male'): Promise<{ wav: Buffer; words: SpokenWord[] }> {
  let best: { wav: Buffer; words: SpokenWord[]; worst: number } | null = null;
  for (let take = 1; take <= VOICE_TAKES; take++) {
    const voice = await generateVoice(asSpoken(lines), languageName(language), { gender, direction: NARRATOR_DELIVERY });
    const wav = pcmToWav(voice.pcm, voice.rate);
    const { words } = await hear(wav, language);
    const worst = Math.min(...alignScript(lines, words).sceneCoverage);
    if (!best || worst > best.worst) best = { wav, words, worst };
    if (worst >= MIN_LINE_COVERAGE) break;
    console.warn(`⚠️ Clone Studio: narrator take ${take} dropped part of a line (${Math.round(worst * 100)}% heard)`);
  }
  if (!best) throw new Error('The narrator could not be recorded');
  return best;
}

/** What a scene really shows: a choice that needs a clip or a picture falls back when there is none. */
function shownAs(scene: CloneScene): 'clip' | 'still' | 'card' | 'skip' {
  const finish = scene.finish;
  if (!finish || finish.picture === 'skip') return 'skip';
  if (finish.picture === 'card') return finish.text.trim() || finish.line.trim() ? 'card' : 'skip';
  if (finish.picture === 'clip' && sceneClip(scene)) return 'clip';
  return scene.edited_image_url ? 'still' : 'skip';
}

export interface FinishInput {
  project: CloneProject;
  settings: FinishSettings;
  /** The language heard in the clips; the narrator speaks it. */
  language?: string;
  /** Saves a file where the render server can load it and returns its address. */
  store: StoreFile;
  onStage: (stage: FinishStage) => void;
}

/** The paid run up to the render: clips prepared, narrator recorded, music made, everything on a timeline. */
export async function buildCloneFinish({ project, settings, language, store, onStage }: FinishInput): Promise<CloneTimeline> {
  const shown = project.scenes.filter((scene) => shownAs(scene) !== 'skip');
  if (!shown.some((scene) => shownAs(scene) !== 'card')) throw new Error('No scene has a clip or a picture to show yet');
  const horizontal = project.aspect_ratio === '16:9';
  const dir = await makeWorkDir('clone-finish-');
  const file = (name: string) => path.join(dir, name);
  try {
    onStage('clips');
    const assets: Record<string, { url: string; kind: 'image' | 'video'; portrait?: boolean }> = {};
    const scenes: CutScene[] = [];
    const speech: { file: string; words: SpokenWord[]; narrators: boolean }[] = [];
    // The narrator's voice as the video engine saved it: clips ordered with it speak in the narrator's own voice.
    const saved = project.analysis_summary?.auto?.voice;
    const narrators = (scene: CloneScene) => Boolean(saved && saved.gender === settings.voice && scene.anim_voice === saved.id);
    for (const scene of shown) {
      const finish = scene.finish as SceneFinish;
      const text = finish.text.split('\n').map((item) => item.trim()).filter(Boolean);
      const cutSeconds = Math.max(0, scene.end - scene.start);
      const picture = shownAs(scene);
      const clip = picture === 'clip' ? sceneClip(scene) : null;
      if (!clip) {
        // A picture with a slow zoom, or a typed card.
        const still = picture === 'still' ? scene.edited_image_url : null;
        if (still) assets[`p${scene.n}`] = { url: ownFile(still), kind: 'image', portrait: !horizontal };
        scenes.push({ asset: still ? `p${scene.n}` : '', picture: still ? 'still' : 'card', sound: finish.sound === 'narrator' && finish.line.trim() ? 'narrator' : 'none', line: finish.line, text, cutSeconds, over: scene.plan?.over });
        continue;
      }

      const raw = file(`raw-${scene.n}.mp4`);
      await downloadToFile(ownFile(clip), raw);
      const info = await probe(raw);
      // Who talks in the clip is heard here again, on the file the renderer will play.
      let heard: SpokenWord[] = [];
      let gain = 0;
      // A person who talks slowly is brought up to an ad's pace: picture and sound together, so the lips stay on the words.
      let speed = 1;
      if (finish.sound === 'clip' && info.sound) {
        heard = (await hear(await soundOf(raw), language)).words;
        if (heard.length) {
          gain = levelGain(await measureLoudness(raw));
          speed = clipPaceFactor(heard);
          if (speed < 1.02) speed = 1;
          else heard = heard.map((word) => ({ ...word, start: word.start / speed, end: word.end / speed }));
        }
      }
      // The video engine delivers one keyframe per clip: the renderer would then decode from the first frame
      // for every frame it needs, and fall over. Each clip gets a keyframe every half second.
      const ready = file(`c${scene.n}.mp4`);
      await run(
        'ffmpeg',
        [
          '-v', 'error', '-y', '-i', raw,
          ...(speed > 1 ? ['-vf', `setpts=PTS/${speed.toFixed(4)}`] : []),
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-g', '12', '-keyint_min', '12', '-sc_threshold', '0',
          ...(info.sound ? ['-af', `${speed > 1 ? `atempo=${speed.toFixed(4)},` : ''}${levelFilter(gain)}`, '-c:a', 'aac', '-b:a', '192k'] : ['-an']),
          '-movflags', '+faststart', ready,
        ],
        { ...BIG, timeout: 5 * 60 * 1000 }
      );
      assets[`c${scene.n}`] = { url: await store(await fs.readFile(ready), `c${scene.n}.mp4`, 'video/mp4'), kind: 'video', portrait: info.portrait };
      if (heard.length) speech.push({ file: ready, words: heard, narrators: narrators(scene) });
      scenes.push({
        asset: `c${scene.n}`,
        picture: 'clip',
        clipSeconds: info.seconds / speed,
        sound: finish.sound === 'narrator' && !finish.line.trim() ? 'none' : finish.sound === 'clip' && !info.sound ? 'none' : finish.sound,
        // A person on camera with no line written for them is captioned as heard.
        line: finish.line.trim() || (finish.sound === 'clip' ? heard.map((word) => word.text).join(' ') : ''),
        heard,
        text,
        cutSeconds,
        over: scene.plan?.over,
      });
      await fs.rm(raw, { force: true });
    }

    onStage('voice');
    const lines = scenes.filter((scene) => scene.sound === 'narrator').map((scene) => scene.line.trim());
    const spoken = scenes.filter((scene) => scene.sound !== 'none' && scene.line.trim()).map((scene) => scene.line);
    const [voice, musicUrl, digits] = await Promise.all([
      lines.length ? narrator(lines, speech, settings, language, file, store) : null,
      settings.music ? soundtrack(project, scenes, settings, file, store) : null,
      settings.captions ? captionDigits(spoken, languageName(language)) : {},
    ]);

    return buildCloneTimeline({
      format: horizontal ? 'horizontal' : 'vertical',
      look: settings.look,
      accent: settings.accent || null,
      captions: settings.captions,
      scenes,
      assets,
      voice,
      musicUrl,
      digits,
      oneVoice: speech.length > 0 && speech.every((clip) => clip.narrators),
    });
  } finally {
    await cleanupWorkDir(dir);
  }
}

/** The narrator's recording: at the pace of the person on camera, in that person's voice when asked, levelled, timed. */
async function narrator(
  lines: string[],
  speech: { file: string; words: SpokenWord[]; narrators: boolean }[],
  settings: FinishSettings,
  language: string | undefined,
  file: (name: string) => string,
  store: StoreFile
) {
  const take = await recordNarrator(lines, language, settings.voice);
  await fs.writeFile(file('voice-take.wav'), take.wav);
  let current = file('voice-take.wav');

  const onCameraRate = Math.max(0, ...speech.map((s) => speakingRate(s.words)));
  const factor = paceFactor(take.words, Math.max(NARRATOR_WORDS_PER_SECOND, Math.min(3.2, onCameraRate)));
  if (factor > 1.02) {
    await run('ffmpeg', ['-v', 'error', '-y', '-i', current, '-af', `atempo=${factor.toFixed(3)}`, file('voice-paced.wav')], BIG);
    current = file('voice-paced.wav');
  }

  // The person who says the most on camera lends the narrator their voice. When that person
  // already speaks with the narrator's own voice (their clips were ordered with it), nothing is converted.
  const model = [...speech].sort((a, b) => b.words.length - a.words.length)[0];
  const modelSeconds = model ? model.words[model.words.length - 1].end - model.words[0].start : 0;
  if (settings.match_voice && model && !model.narrators && modelSeconds >= MIN_VOICE_SAMPLE_SECONDS) {
    try {
      const sample = await soundOf(model.file);
      const narration = await fs.readFile(current);
      const converted = await convertVoiceWithChatterbox({
        source_audio_url: `data:audio/wav;base64,${narration.toString('base64')}`,
        target_voice_audio_url: `data:audio/wav;base64,${sample.toString('base64')}`,
        high_quality_audio: true,
      });
      if (!converted.success || !converted.audioUrl) throw new Error(converted.error || 'no audio');
      usage.voiceMatch(narration.length / 48000);
      await fs.writeFile(file('voice-matched.bin'), Buffer.from(await (await fetch(converted.audioUrl)).arrayBuffer()));
      await run('ffmpeg', ['-v', 'error', '-y', '-i', file('voice-matched.bin'), '-vn', '-ac', '1', '-ar', '24000', file('voice-matched.wav')], BIG);
      current = file('voice-matched.wav');
    } catch (error) {
      // The ad is still finished, with the narrator's own voice.
      console.warn('⚠️ Clone Studio: the narrator kept its own voice:', String(error).slice(0, 160));
    }
  }

  const wav = await fs.readFile(await levelled(current, file('voice.wav')));
  const { words } = await hear(wav, language);
  return { url: await store(wav, 'voice.wav', 'audio/wav'), words, durationSeconds: (wav.length - 44) / 48000 };
}

/** The music bed, from the soundtrack text on the board. No music is no reason to fail the ad. */
async function soundtrack(project: CloneProject, scenes: CutScene[], settings: FinishSettings, file: (name: string) => string, store: StoreFile): Promise<string | null> {
  try {
    const summary = project.analysis_summary;
    const written =
      summary?.music_prompt?.trim() ||
      (summary?.music_brief?.trim() ? `${summary.music_brief.trim()}${summary.music_bpm ? ` Tempo around ${summary.music_bpm} BPM.` : ''} Instrumental only, no vocals.` : 'Upbeat, modern, positive instrumental ad track. No vocals.');
    // A rough length is enough: the renderer loops and fades the bed.
    const seconds = Math.ceil(scenes.reduce((sum, scene) => sum + Math.max(scene.cutSeconds, scene.line.split(/\s+/).filter(Boolean).length / NARRATOR_WORDS_PER_SECOND), 0));
    await fs.writeFile(file('music-raw.mp3'), await generateMusic(`${written} About ${seconds + 5} seconds.`, settings.look));
    return store(await fs.readFile(await levelled(file('music-raw.mp3'), file('music.mp3'))), 'music.mp3', 'audio/mpeg');
  } catch (error) {
    console.warn('⚠️ Clone Studio: music failed, finishing without it:', String(error).slice(0, 160));
    return null;
  }
}
