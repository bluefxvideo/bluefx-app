import type { SpokenWord } from '@/lib/smart-video/audio';
import { buildTheme } from '@/lib/smart-video/brand';
import { withDigits, type NumberSpan } from '@/lib/smart-video/numbers';
import { alignScript } from '@/lib/smart-video/timing';
import type { StyleName, VideoFormat } from '@/lib/smart-video/types';
import { END_HOLD, latestOverlayTime, punchCuts } from './edit';

/**
 * Clone Studio's editor: finished scenes in, a render-ready timeline out (the props of
 * the SmartVideo composition, the Phantom's renderer). Pure: no network, no files.
 *
 * A scene is carried by one of three things: a person talking in its clip (the clip's
 * own sound), the narrator (one recording of every narrator line, cut by line), or
 * nothing (a silent shot, as long as its cut in the source ad). The scenes are laid on
 * the timeline one after the other; text lands with the words; the rules in ./edit
 * (plain cuts, zoom cuts at pauses, a short end hold) keep the pace up.
 *
 * A scene whose words belong to a neighbour's phrase (`over`) takes no time of its own:
 * it is shown over the start or the end of that neighbour's voice, the cut-away the source
 * ad made. The voice plays on underneath, so nothing is said twice and nothing stands still.
 */

export interface CutScene {
  /** The picture in `assets` (empty for a typed card). */
  asset: string;
  picture: 'clip' | 'still' | 'card';
  /** Length of the clip, seconds. */
  clipSeconds?: number;
  sound: 'clip' | 'narrator' | 'none';
  /** The words of the scene as the captions spell them. */
  line: string;
  /** When each word is said in the clip (sound = clip). */
  heard?: SpokenWord[];
  /** Typed text; the first item is the headline. */
  text: string[];
  /** Length of the scene in the source ad, seconds. */
  cutSeconds: number;
  /** A scene without words of its own that is shown over the voice of the scene before or after it. */
  over?: 'previous' | 'next';
}

export interface CutInput {
  format: VideoFormat;
  look: StyleName;
  /** Colour for the accents of the typed text, e.g. "#D7261E". */
  accent?: string | null;
  captions: boolean;
  scenes: CutScene[];
  assets: Record<string, { url: string; kind: 'image' | 'video'; portrait?: boolean }>;
  /** One recording of every narrator line, in scene order, with its word timings. */
  voice: { url: string; words: SpokenWord[]; durationSeconds: number } | null;
  musicUrl: string | null;
  /** The numbers the captions show as digits ("ten eggs" → "10 eggs"), by line. */
  digits?: Record<string, NumberSpan[]>;
  /** The people on camera speak with the narrator's own voice: the voice passes between them without a beat. */
  oneVoice?: boolean;
}

const LEAD_IN = 0.2; // sound of a clip kept before its first word
const LEAD_OUT = 0.25; // and after its last
const BREATH = 0.12; // the picture changes this long before the narrator's first word of a scene
const HANDOVER = 0.25; // a beat when the voice passes between a person on camera and the narrator
const SAME_VOICE_HANDOVER = 0.08; // when both are one voice the beat would only be a hole in a sentence
const OPENING = 0.15; // before the very first word
const SILENT_MIN = 0.6; // a shot without words, shortest and longest
const SILENT_MAX = 4;
const CARD_SECONDS = 2.5; // a typed card nobody talks over
const NATURAL_SOUND = 0.6; // volume of a clip's own sound when nobody speaks in it
const FOOTAGE_HOLD = 0.8; // after the last word when the ad ends on footage instead of a card
const STAGGER = 0.35; // between the text items of one scene
const OVER_MIN = 0.5; // a scene shown over a neighbour's voice: shortest and longest
const OVER_MAX = 2.5;
const OVER_SHARE = 0.6; // the most of a voiced scene's time that such scenes may take
const HOST_MIN = 1; // what the voiced scene itself keeps on screen at least

type Token = { token: string; raw: string; time: number };
type Block = Record<string, unknown> & { type: string; at?: number };

const ONE_LINE = 19; // a headline longer than this is set on two lines

/** A long headline on two lines of about the same length: two short lines can be set big, one long line cannot. */
function onTwoLines(text: string): string {
  if (text.length <= ONE_LINE || text.includes('\n')) return text;
  const spaces = [...text.matchAll(/ /g)].map((match) => match.index as number);
  if (!spaces.length) return text;
  const middle = spaces.reduce((best, at) => (Math.abs(at - text.length / 2) < Math.abs(best - text.length / 2) ? at : best));
  return `${text.slice(0, middle)}\n${text.slice(middle + 1)}`;
}

/**
 * A headline's size follows its longest line, so short punchy lines come out big.
 * Over footage the biggest size is left out: the picture has to stay visible.
 */
function titleBlock(headline: string, tone: 'accent' | undefined, opening: boolean, overFootage: boolean): Block {
  const text = onTwoLines(headline);
  const longest = Math.max(...text.split('\n').map((line) => line.length));
  const fitted = longest <= 10 ? 'xl' : longest <= (opening ? 16 : 14) ? 'l' : longest <= ONE_LINE ? 'm' : 's';
  const size = overFootage && fitted === 'xl' ? 'l' : fitted;
  const stamp = tone === 'accent' && size === 'xl';
  return { type: 'title', text, tone, size, anim: stamp ? 'stamp' : undefined, rotate: stamp ? -4 : size === 'm' ? -2 : 0 };
}

const TEXT_LEAD = 0.12; // a tag lands just before its word

/**
 * The typed text of a scene as blocks. The headline is on screen from the first frame.
 * A tag appears when one of its words is spoken ("Garlic knots $6" on "garlic"); a tag
 * that shares no word with the line follows the one before it by a short step.
 */
function textBlocks(scene: CutScene, speaker: boolean, start: number, end: number, opening: boolean, tokens: Token[]): Block[] {
  const [headline, ...rest] = scene.text.map((item) => item.trim()).filter(Boolean);
  if (!headline) return [];
  const latest = latestOverlayTime(start, end);
  const spokenAt = (item: string) => {
    const words = item.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4);
    return tokens.find((t) => words.includes(t.token))?.time;
  };
  let previous = start;
  const landsAt = (item: string) => {
    const heard = spokenAt(item);
    previous = Math.min(latest, Math.max(start, heard !== undefined ? heard - TEXT_LEAD : previous + STAGGER));
    return previous;
  };
  // A person talking keeps their face clear: a name tag (a line above, the name below) and nothing else.
  if (speaker) {
    return [...(rest[0] ? [{ type: 'pill', text: rest[0], tone: 'accent' }] : []), { type: 'title', text: headline, size: 's', rotate: 0 }];
  }
  if (scene.picture === 'card') {
    return [
      titleBlock(headline, 'accent', opening, false),
      ...(rest[0] ? [{ type: 'highlight', text: rest[0], at: landsAt(rest[0]) }] : []),
      ...rest.slice(1).map((text) => ({ type: 'pill', text, tone: 'light', at: landsAt(text) })),
    ];
  }
  return [titleBlock(headline, undefined, opening, true), ...rest.map((text) => ({ type: 'pill', text, tone: 'light', at: landsAt(text) }))];
}

export function buildCloneTimeline(input: CutInput) {
  const { scenes, assets, voice } = input;
  const talks = (scene: CutScene) => scene.picture === 'clip' && scene.sound === 'clip' && Boolean(scene.heard?.length);
  const narrated = scenes.filter((scene) => scene.sound === 'narrator' && scene.line.trim());
  const narratorTokens = voice ? alignScript(narrated.map((scene) => scene.line), voice.words).sceneTokens : [];

  const cuts: { url?: string; at: number; srcStart: number; srcEnd: number; volume?: number }[] = [];
  const timed: { start: number; tokens: Token[]; line?: string; startFrom?: number; speaker?: boolean }[] = [];
  let cursor = 0;
  let lastWordEnd = 0;
  let lastVoice: 'clip' | 'narrator' | null = null;

  const voiced = (scene: CutScene) => talks(scene) || (Boolean(voice) && Boolean(narratorTokens[narrated.indexOf(scene)]?.length));
  /**
   * The voiced scene a wordless scene is shown over, or -1 when it stands on its own:
   * the nearest scene in its direction, with nothing but scenes of its own kind in between.
   */
  const hosts = scenes.map((scene, i) => {
    if (!scene.over || voiced(scene) || scene.picture === 'card') return -1;
    const step = scene.over === 'previous' ? -1 : 1;
    for (let j = i + step; j >= 0 && j < scenes.length; j += step) {
      if (voiced(scenes[j])) return j;
      if (scenes[j].over !== scene.over) return -1;
    }
    return -1;
  });
  const wanted = (i: number) => Math.min(OVER_MAX, Math.max(OVER_MIN, scenes[i].cutSeconds));
  /** The time a voiced scene takes at least when other scenes are shown over its voice: theirs, and enough of its own to be seen. A short line then ends in a beat of picture. */
  const room = (i: number) => {
    const guests = scenes.reduce((sum, _, j) => (hosts[j] === i ? sum + wanted(j) : sum), 0);
    return guests ? Math.min(guests + HOST_MIN, HOST_MIN / (1 - OVER_SHARE)) : 0;
  };

  for (const [i, scene] of scenes.entries()) {
    const heard = scene.heard || [];
    // Shown over a neighbour's voice: its place on the timeline is settled once every voice has one.
    if (hosts[i] >= 0) {
      timed.push({ start: Number.NaN, tokens: [] });
      continue;
    }
    if (talks(scene)) {
      const srcStart = Math.max(0, heard[0].start - LEAD_IN);
      const srcEnd = Math.min(scene.clipSeconds ?? Infinity, heard[heard.length - 1].end + LEAD_OUT);
      if (lastVoice === 'narrator') cursor += input.oneVoice ? SAME_VOICE_HANDOVER : HANDOVER;
      const start = cursor;
      cuts.push({ url: assets[scene.asset].url, at: start, srcStart, srcEnd });
      // The captions spell the words as the client wrote them; the clip only says when.
      const script = scene.line.trim() || heard.map((word) => word.text).join(' ');
      const tokens = alignScript([script], heard).sceneTokens[0].map((t) => ({ ...t, time: t.time - srcStart + start }));
      timed.push({ start, tokens, line: script, startFrom: srcStart, speaker: true });
      lastWordEnd = heard[heard.length - 1].end - srcStart + start;
      cursor = start + Math.max(srcEnd - srcStart, room(i));
      lastVoice = 'clip';
      continue;
    }

    const k = narrated.indexOf(scene);
    if (k >= 0 && voice && narratorTokens[k]?.length) {
      const first = narratorTokens[k][0].time;
      const nextFirst = narratorTokens[k + 1]?.[0]?.time ?? Infinity;
      // The line ends with its last word, not with the breath the narrator takes before the next line.
      const said = voice.words.filter((word) => word.start >= first - 0.01 && word.start < nextFirst - 0.01);
      const lastEnd = said.length ? said[said.length - 1].end : Math.min(nextFirst, voice.durationSeconds);
      const srcStart = Math.max(0, first - BREATH);
      const srcEnd = Math.max(srcStart + 0.2, Math.min(nextFirst - BREATH, lastEnd + LEAD_OUT, voice.durationSeconds));
      if (lastVoice === 'clip') cursor += input.oneVoice ? SAME_VOICE_HANDOVER : HANDOVER;
      const start = cursor;
      const at = start + (start === 0 ? OPENING : 0);
      cuts.push({ at, srcStart, srcEnd });
      timed.push({ start, tokens: narratorTokens[k].map((t) => ({ ...t, time: t.time - srcStart + at })), line: scene.line });
      lastWordEnd = lastEnd - srcStart + at;
      cursor = Math.max(at + (srcEnd - srcStart), start + room(i));
      lastVoice = 'narrator';
      continue;
    }

    // Nobody speaks: the shot runs as long as its cut in the source ad.
    const longest = scene.picture === 'clip' ? Math.min(SILENT_MAX, scene.clipSeconds ?? SILENT_MAX) : SILENT_MAX;
    const seconds = scene.picture === 'card' ? CARD_SECONDS : Math.min(longest, Math.max(SILENT_MIN, scene.cutSeconds));
    if (scene.picture === 'clip' && scene.sound === 'clip') cuts.push({ url: assets[scene.asset].url, at: cursor, srcStart: 0, srcEnd: seconds, volume: NATURAL_SOUND });
    timed.push({ start: cursor, tokens: [] });
    cursor += seconds;
  }

  const endsOnCard = scenes[scenes.length - 1]?.picture === 'card';
  const duration = Math.ceil(Math.max(cursor, lastWordEnd ? lastWordEnd + (endsOnCard ? END_HOLD : FOOTAGE_HOLD) : 0) * 10) / 10;

  // The scenes shown over a voice get their time: those that look ahead at the start of their host, those that look back at its end.
  // The time is shared out as the source ad shared it between these scenes, and the host keeps enough to be seen.
  const own = scenes.map((_, i) => i).filter((i) => hosts[i] < 0);
  for (const [k, host] of own.entries()) {
    const ahead = scenes.map((_, i) => i).filter((i) => hosts[i] === host && i < host);
    const behind = scenes.map((_, i) => i).filter((i) => hosts[i] === host && i > host);
    const guests = [...ahead, ...behind];
    if (!guests.length) continue;
    const from = timed[host].start;
    const to = k + 1 < own.length ? timed[own[k + 1]].start : duration;
    const span = to - from;
    const inSource = scenes[host].cutSeconds + guests.reduce((sum, i) => sum + scenes[i].cutSeconds, 0);
    const asked = new Map(guests.map((i) => [i, Math.max(OVER_MIN, Math.min(wanted(i), (span * scenes[i].cutSeconds) / inSource))]));
    const spare = Math.max(0, span - Math.min(HOST_MIN, span * (1 - OVER_SHARE)));
    const share = Math.min(1, spare / guests.reduce((sum, i) => sum + (asked.get(i) as number), 0));
    const time = (i: number) => (asked.get(i) as number) * share;
    const place = (i: number, at: number) => {
      timed[i].start = at;
      // A clip brings the sound of its scene (a chime, a whoosh) under the voice.
      if (scenes[i].picture === 'clip' && scenes[i].sound === 'clip') cuts.push({ url: assets[scenes[i].asset].url, at, srcStart: 0, srcEnd: time(i), volume: NATURAL_SOUND });
      return at + time(i);
    };
    let at = from;
    for (const i of ahead) at = place(i, at);
    // The host comes in late: a person talking is picked up where their words are by then.
    if (ahead.length) timed[host] = { ...timed[host], start: at, startFrom: timed[host].startFrom === undefined ? undefined : timed[host].startFrom + (at - from) };
    at = to - behind.reduce((sum, i) => sum + time(i), 0);
    for (const i of behind) at = place(i, at);
  }
  // Every scene has its place by now; one without would stop the render, so it gets no time instead.
  timed.forEach((entry, i) => {
    if (Number.isNaN(entry.start)) entry.start = i > 0 ? timed[i - 1].start : 0;
  });
  // The captions show a number as digits ("10 eggs"), however the line spells it.
  const spoken = timed.flatMap((t) => withDigits(t.tokens, input.digits?.[(t.line || '').trim()]));
  const isFootage = (scene: CutScene) => scene.picture !== 'card';

  return {
    duration,
    format: input.format,
    style: input.look,
    theme: buildTheme(input.look, { accent: input.accent }),
    assets,
    audio: {
      voice: { url: voice?.url, cuts },
      music: input.musicUrl ? { url: input.musicUrl, liftAt: (lastWordEnd || duration) + 0.6 } : undefined,
      sfx: [],
    },
    captions: input.captions && spoken.length
      ? {
          // A word ends where the next begins (or after a beat).
          words: spoken.map((word, n) => ({
            text: word.raw,
            start: word.time,
            end: Math.max(word.time + 0.12, Math.min(spoken[n + 1]?.time ?? lastWordEnd, word.time + 0.9)),
          })),
        }
      : undefined,
    scenes: scenes.map((scene, i) => {
      const { start, tokens, startFrom, speaker } = timed[i];
      const end = i + 1 < timed.length ? timed[i + 1].start : duration;
      const said = tokens.map((t) => ({ text: t.raw, start: t.time }));
      const background =
        scene.picture === 'card'
          ? { type: 'brand' }
          : {
              type: 'mediaFull',
              asset: scene.asset,
              ...(scene.picture === 'clip'
                ? {
                    startFrom: startFrom ?? 0,
                    // A clip shorter than its scene is slowed to last (down to 60%); past that its last frame holds.
                    playbackRate: speaker || !scene.clipSeconds ? 1 : Math.min(1, Math.max(0.6, (scene.clipSeconds - 0.1) / (end - start))),
                    punches: punchCuts(said, start, end),
                    // A face sits in the upper half of a talking shot; anything else is zoomed about its centre.
                    punchFocus: speaker ? '50% 32%' : '50% 50%',
                  }
                : {}),
            };
      return {
        start,
        end,
        // Footage follows footage on a plain cut; a typed card comes and goes with the look's transition.
        cut: i > 0 && isFootage(scene) && isFootage(scenes[i - 1]) ? true : undefined,
        speaker: speaker || undefined,
        // Remade footage keeps its light under typed text; a typed card has its own background.
        shade: isFootage(scene) ? ('soft' as const) : undefined,
        background,
        blocks: textBlocks(scene, Boolean(speaker), start, end, i === 0, tokens),
      };
    }),
  };
}

export type CloneTimeline = ReturnType<typeof buildCloneTimeline>;
