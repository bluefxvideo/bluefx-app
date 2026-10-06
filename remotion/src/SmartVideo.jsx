import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

/**
 * SmartVideo — motion-graphics ad driven entirely by a plan (inputProps).
 *
 * The plan is a list of scenes; each scene is a background plus a vertical
 * stack of blocks (titles, media cards, chips, a big number, tiles, rows...).
 * Every block carries `at`: the second its spoken word starts, so the text
 * lands with the voice. `style` picks one of five looks (playful, elegant,
 * bold, clean, whiteboard) that change fonts, title treatment, backgrounds, cards,
 * motion, transitions and sounds; `theme` carries the brand colours. The
 * whiteboard look adds a `drawing` background: a hand draws the scene's line art.
 *
 * Layout is by construction: text shrinks to fit the frame width and a stack
 * taller than the safe area is scaled down, so a plan can never produce
 * overlapping or cut-off text.
 */

const FPS = 30;
const FRAMES = { vertical: { W: 1080, H: 1920, landscape: false }, horizontal: { W: 1920, H: 1080, landscape: true } };
// The BlueFX watermark and end card (the optional `watermark` prop). The colours are bluefx.svg's own gradient stops;
// the font has its own family name, so it never shadows or dedupes a look's font.
const BRAND = { blue: '#29a9e1', deep: '#0d72b9', glow: '#93d6e3', night: '#06213a' };
const BRAND_FONT = ['BlueFXBrand', 'Montserrat.ttf', '100 900'];
const BRAND_LOGO = 'brand/bluefx.svg';
// The end card fades in over the last frames of the final scene, so the dissolve starts from the picture, not a blank frame.
const END_CARD_FADE = 5;
const endCardSecondsOf = (wm) => (wm ? Math.max(0, Number(wm.endCardSeconds) || 0) : 0);
// The frame of this video, and the width of the column the current blocks sit in
// (the whole frame when vertical; one side of a split scene when horizontal).
const Frame = createContext(FRAMES.vertical);
const useFrame = () => useContext(Frame);
const Column = createContext(1080);
const useColumn = () => useContext(Column);
// How much the current stack is scaled: a hand drawn inside it divides by this to keep one size on screen.
const StackScale = createContext(1);
const SIDE = 50;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const EMOJI = '"Noto Color Emoji", "Apple Color Emoji", sans-serif';

const NAMED = {
  white: '#FFFFFF',
  grey: '#ECEBF2',
  green: '#16A34A',
  blue: '#2F7CF6',
  orange: '#FF8A00',
  purple: '#9B2FAE',
  red: '#E3262B',
};
const LIGHT_TEXT = '#F7F3EA';

// ---------- looks ----------
const STYLES = {
  playful: {
    theme: { bg: '#FFD21F', bgLight: '#FFE66B', bgDeep: '#F4B000', accent: '#E3262B', accentDark: '#A3121A', ink: '#1C1B22' },
    fonts: { title: ['Baloo', 'Baloo2.ttf', '400 800'], body: ['Nunito', 'Nunito.ttf', '200 1000'] },
    title: { kind: 'sticker', weight: 800, scale: 1, chars: 1, upper: true },
    bodyWeight: 900,
    surface: 'light',
    panel: '#FFFFFF',
    card: { radius: 44, pad: 12, padColor: '#FFFFFF', shadow: '0 14px 0 rgba(0,0,0,0.10), 0 30px 60px rgba(0,0,0,0.32)' },
    chip: { radius: 999, bg: '#FFFFFF', shadow: '0 9px 0 rgba(0,0,0,0.12), 0 18px 34px rgba(0,0,0,0.18)', icon: 'cycle', iconRadius: 999 },
    pill: { radius: 999, border: '6px solid #FFFFFF', shadow: '0 8px 0 rgba(0,0,0,0.14), 0 16px 30px rgba(0,0,0,0.22)' },
    tile: { radius: 38, border: '8px solid #FFFFFF' },
    spring: { damping: 12, stiffness: 170, mass: 0.7 },
    motion: 'bouncy',
    rotate: true,
    transition: 'bands',
    sfx: { pop: 1, whoosh: 1, ding: 1, chaching: 1 },
  },
  elegant: {
    theme: { bg: '#15171D', bgLight: '#262A35', bgDeep: '#0B0C10', accent: '#C9A45C', accentDark: '#8C6E33', ink: '#15171D' },
    fonts: { title: ['Playfair', 'PlayfairDisplay.ttf', '400 900'], body: ['Montserrat', 'Montserrat.ttf', '100 900'] },
    title: { kind: 'serif', weight: 600, scale: 0.82, chars: 1.15, upper: false },
    bodyWeight: 500,
    surface: 'dark',
    panel: null, // uses theme.bg
    card: { radius: 6, pad: 0, padColor: 'transparent', shadow: '0 30px 70px rgba(0,0,0,0.55)', outline: true },
    chip: { radius: 0, bg: 'transparent', shadow: 'none', icon: 'outline', iconRadius: 999, underline: true },
    pill: { radius: 2, border: 'none', shadow: 'none', spaced: true },
    tile: { radius: 6, border: 'none', outline: true },
    spring: { damping: 200, stiffness: 55, mass: 1 },
    motion: 'rise',
    rotate: false,
    transition: 'dip',
    sfx: { pop: 0, whoosh: 0.45, ding: 0, chaching: 0 },
  },
  bold: {
    theme: { bg: '#111318', bgLight: '#1E222B', bgDeep: '#08090C', accent: '#FF4D2E', accentDark: '#B92C14', ink: '#111318' },
    fonts: { title: ['Anton', 'Anton.ttf', '400'], body: ['Montserrat', 'Montserrat.ttf', '100 900'] },
    title: { kind: 'block', weight: 400, scale: 1.05, chars: 1.35, upper: true },
    bodyWeight: 800,
    surface: 'dark',
    panel: '#FFFFFF',
    card: { radius: 0, pad: 0, padColor: 'transparent', shadow: 'none', offset: true },
    chip: { radius: 10, bg: '#FFFFFF', shadow: '0 12px 30px rgba(0,0,0,0.35)', icon: 'accent', iconRadius: 8 },
    pill: { radius: 8, border: 'none', shadow: '0 10px 24px rgba(0,0,0,0.3)' },
    tile: { radius: 10, border: 'none' },
    spring: { damping: 18, stiffness: 260, mass: 0.6 },
    motion: 'snap',
    rotate: true,
    transition: 'block',
    sfx: { pop: 0.8, whoosh: 1, ding: 1, chaching: 1 },
  },
  clean: {
    theme: { bg: '#F4F6FA', bgLight: '#FFFFFF', bgDeep: '#E3E8F1', accent: '#2563EB', accentDark: '#1E40AF', ink: '#111827' },
    fonts: { title: ['Montserrat', 'Montserrat.ttf', '100 900'], body: ['Montserrat', 'Montserrat.ttf', '100 900'] },
    title: { kind: 'plain', weight: 800, scale: 0.86, chars: 1.05, upper: false },
    bodyWeight: 700,
    surface: 'light',
    panel: '#FFFFFF',
    card: { radius: 28, pad: 0, padColor: 'transparent', shadow: '0 30px 60px rgba(17,24,39,0.22)' },
    chip: { radius: 24, bg: '#FFFFFF', shadow: '0 14px 34px rgba(17,24,39,0.12)', icon: 'tint', iconRadius: 18 },
    pill: { radius: 999, border: 'none', shadow: '0 10px 24px rgba(17,24,39,0.15)' },
    tile: { radius: 28, border: 'none' },
    spring: { damping: 200, stiffness: 120, mass: 0.8 },
    motion: 'rise',
    rotate: false,
    transition: 'fade',
    sfx: { pop: 0.5, whoosh: 0.6, ding: 0.6, chaching: 0.6 },
  },
  // The hand-drawn explainer: a hand draws each scene's picture in marker, the words are written by hand.
  whiteboard: {
    theme: { bg: '#FAF9F5', bgLight: '#FFFFFF', bgDeep: '#ECEAE3', accent: '#2563EB', accentDark: '#1E40AF', ink: '#1F2430' },
    fonts: { title: ['Caveat', 'Caveat.ttf', '400 700'], body: ['Caveat', 'Caveat.ttf', '400 700'], extra: [['Marker', 'PermanentMarker.ttf', '400']] },
    // Short lines (about 12 letters): a headline in two big lines fills the board better than one long line.
    title: { kind: 'hand', weight: 700, scale: 1.12, chars: 0.8, upper: false },
    grow: 1.7,
    bodyWeight: 700,
    surface: 'light',
    panel: '#FAF9F5',
    card: { radius: 3, pad: 14, padColor: '#FFFFFF', shadow: '0 12px 28px rgba(0,0,0,0.18)', tape: true },
    chip: { radius: 0, bg: 'transparent', shadow: 'none', icon: 'check', iconRadius: 0 },
    pill: { radius: 20, border: 'none', shadow: 'none', marker: true },
    tile: { radius: 22, border: 'none', drawn: true },
    spring: { damping: 200, stiffness: 120, mass: 0.8 },
    motion: 'write',
    rotate: true,
    transition: 'erase',
    sfx: { pop: 0, whoosh: 0, ding: 0.35, chaching: 0.35, marker: 1, underline: 1, push: 1 },
  },
};
const MARKER = '"Marker", "Caveat", cursive';
const SFX_VOLUME = { pop: 0.25, whoosh: 0.35, ding: 0.3, chaching: 0.35, whistle: 0.55, marker: 0.26, underline: 0.26, push: 0.22 };
// Sounds that reuse another sound's file, and the ones only the whiteboard look plays.
const SFX_FILE = { underline: 'marker', push: 'whoosh' };
const WHITEBOARD_ONLY = ['marker', 'underline', 'push'];

const Plan = createContext(null);
const usePlan = () => useContext(Plan);
// 'dark' | 'light': what the blocks of the current scene sit on.
const Surface = createContext('light');

const src = (url) => (/^(https?:|data:|blob:)/.test(url) ? url : staticFile(url));
const color = (theme, name, fallback) => {
  if (!name) return fallback;
  if (name === 'accent') return theme.accent;
  if (name === 'ink') return theme.ink;
  return NAMED[name] || name;
};
const useTextColor = () => {
  const { theme } = usePlan();
  return useContext(Surface) === 'dark' ? LIGHT_TEXT : theme.ink;
};

// ---------- fonts ----------
// `brand`: also load the watermark and end-card font (only when the video carries the watermark).
function useFonts(look, brand = false) {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('SmartVideo fonts'));
  useEffect(() => {
    const wanted = [
      ...[look.fonts.title, look.fonts.body, ...(look.fonts.extra || [])].filter((f, i, all) => all.findIndex((g) => g[0] === f[0]) === i),
      ...(brand ? [BRAND_FONT] : []),
    ];
    Promise.all(
      wanted.map(([family, file, weight]) =>
        new FontFace(family, `url('${staticFile(`smart-video/fonts/${file}`)}')`, { weight }).load()
      )
    )
      .then((faces) => {
        faces.forEach((face) => document.fonts.add(face));
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle, look, brand]);
  return ready;
}

// ---------- layout by construction ----------
// Font size that makes the element's natural width fit maxW (width is linear in font size).
function useFit(base, maxW) {
  const ref = useRef(null);
  const [size, setSize] = useState(base);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.scrollWidth) return;
    const target = Math.min(base, Math.floor((size * maxW) / el.scrollWidth));
    if (Math.abs(target - size) > 1) setSize(target);
  });
  return [ref, size];
}

// Balanced line breaks for text that came without any.
function autoBreak(text, maxChars) {
  if (text.includes('\n') || text.length <= maxChars) return text;
  const words = text.split(' ');
  const lines = Math.ceil(text.length / maxChars);
  const target = text.length / lines;
  const out = [''];
  words.forEach((word) => {
    const cur = out[out.length - 1];
    if (cur && out.length < lines && cur.length + word.length / 2 > target) out.push(word);
    else out[out.length - 1] = cur ? `${cur} ${word}` : word;
  });
  return out.join('\n');
}

function Stack({ top, bottom, left = 0, width, gap, align = 'center', scrim = false, scrimFrom = 'vertical', children }) {
  const { W, H } = useFrame();
  const { look } = usePlan();
  const columnWidth = width ?? W;
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  const available = H - top - bottom;
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight;
    const w = ref.current?.offsetWidth;
    if (!h || !w) return;
    // Shrinks a stack that is too big; grows a small one so it fills its column (up to 22%; handwriting, which
    // is thin and light, up to 70%: a board with small writing in the middle looks empty).
    const target = Math.min(look.grow || 1.22, (available * 0.94) / h, (columnWidth - 2 * 34) / w);
    if (Math.abs(target - scale) > 0.005) setScale(target);
  });
  const down = align !== 'flex-start';
  // `scrim="soft"`: remade footage keeps its light; the text carries its own outline or shadow.
  const dark = scrim === 'soft' ? 0.45 : 1;
  return (
    <Column.Provider value={columnWidth}>
      <div
        // A column where the hand pushes something in or underlines stands above the others, so the arm is never under their words.
        style={{ position: 'absolute', top, left, width: columnWidth, height: available, display: 'flex', alignItems: align, justifyContent: 'center', zIndex: React.Children.toArray(children).some((child) => child?.props?.block?.push || child?.props?.block?.underlineAt !== undefined) ? 6 : 'auto' }}
      >
        <div
          ref={ref}
          style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: align === 'flex-end' ? 'center bottom' : align === 'flex-start' ? 'center top' : 'center' }}
        >
          {/* Over a photo, the darkness follows the text and leaves the rest of the picture alone:
              from just above (or below) the stack when vertical, from the side when horizontal. */}
          {scrim && scrimFrom === 'vertical' && (
            <div
              style={{
                position: 'absolute',
                zIndex: -1,
                left: -3000,
                right: -3000,
                top: down ? -170 : -3000,
                bottom: down ? -3000 : -170,
                background: `linear-gradient(to ${down ? 'bottom' : 'top'}, rgba(0,0,0,0) 0px, rgba(0,0,0,${0.62 * dark}) 190px, rgba(0,0,0,${0.74 * dark}) 100%)`,
              }}
            />
          )}
          {scrim && scrimFrom === 'side' && (
            <div
              style={{
                position: 'absolute',
                zIndex: -1,
                top: -3000,
                bottom: -3000,
                left: -3000,
                right: -260,
                background: `linear-gradient(to left, rgba(0,0,0,0) 0px, rgba(0,0,0,${0.6 * dark}) 260px, rgba(0,0,0,${0.72 * dark}) 100%)`,
              }}
            />
          )}
          <StackScale.Provider value={scale}>{children}</StackScale.Provider>
        </div>
      </div>
    </Column.Provider>
  );
}

// ---------- motion ----------
// `holdFrames`: in a tall drawing scene the words wait until the picture is drawn (the arm passes over them).
// `handBusy`: until then the hand is drawing, so it cannot push anything in or underline yet.
// `contact`: the scene shows the contact (a highlight), which must be the biggest thing on it.
const SceneTime = createContext({ start: 0, first: false, holdFrames: 0, handBusy: 0, contact: false });

// Scene-local frame for an absolute time. Blocks due at the very start of the
// first scene are already settled on frame 0 (it doubles as the thumbnail).
function useLocalFrame(at) {
  const { start, first, holdFrames = 0 } = useContext(SceneTime);
  const local = Math.round(((at ?? start) - start) * FPS);
  if (local <= 0 && first && !holdFrames) return -40;
  return Math.max(local, holdFrames, 0);
}

function PopIn({ at, anim = 'pop', rotate = 0, children, style }) {
  const { look } = usePlan();
  const frame = useCurrentFrame();
  const from = useLocalFrame(at);
  const s = spring({ frame: frame - from, fps: FPS, config: look.spring });
  const calm = look.motion === 'rise';
  const opacity = interpolate(frame - from, [0, calm ? 14 : 4], [0, 1], clamp);
  const moves = {
    pop: `scale(${interpolate(s, [0, 1], [0.3, 1])})`,
    stamp: `scale(${interpolate(s, [0, 1], [2.3, 1])})`,
    left: `translateX(${interpolate(s, [0, 1], [-140, 0])}px)`,
    up: `translateY(${interpolate(s, [0, 1], [120, 0])}px)`,
    rise: `translateY(${interpolate(s, [0, 1], [46, 0])}px)`,
  };
  if (look.motion === 'write') {
    // Photos are taped on with a little drop; everything else is written on from left to right.
    if (anim === 'up') {
      const drop = interpolate(frame - from, [0, 9], [1.07, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
      return <div style={{ opacity: interpolate(frame - from, [0, 4], [0, 1], clamp), transform: `scale(${drop}) rotate(${rotate}deg)`, ...style }}>{children}</div>;
    }
    const shown = interpolate(frame - from, [0, 12], [0, 100], clamp);
    // Once written, nothing is clipped: handwriting leans past the right edge of its own box (a cut-off last letter otherwise).
    return <div style={{ clipPath: shown >= 100 ? 'none' : `inset(-40% ${100 - shown}% -40% -40%)`, transform: `rotate(${rotate}deg)`, ...style }}>{children}</div>;
  }
  const move = calm ? moves.rise : moves[anim] || moves.pop;
  return <div style={{ opacity, transform: `${move} rotate(${look.rotate ? rotate : 0}deg)`, ...style }}>{children}</div>;
}

// The two hands. Only the photographed arm is used (an arm lengthened by repeating its skin looks stretched),
// so every hand is sized and angled to make the real arm reach an edge of the frame.
const MARKER_HAND = { file: 'smart-video/whiteboard/hand.png', w: 500, h: 1410 };
const OPEN_HAND = { file: 'smart-video/whiteboard/hand-open.png', w: 371, h: 1466 };
const HAND_W = 400; // the marker hand, on screen
const NIB = { x: 3 / 500, y: 33 / 500 }; // the marker tip in hand.png, as a share of its width
const NIB_ORIGIN = `${NIB.x * 100}% ${((NIB.y * MARKER_HAND.w) / MARKER_HAND.h) * 100}%`;
const ARM_FADE = 110; // the last rows of both images fade out

// Whiteboard: an open hand slides an element into place, lets go and withdraws. It comes up from the
// bottom edge when its arm reaches that far (it then crosses nothing else), otherwise in from the right.
const PUSH_FRAMES = 22;
const PUSH_HAND_W = 300;
function PushIn({ at, rotate = 0, zIndex = 5, children }) {
  const { W, H } = useFrame();
  const scale = useContext(StackScale) || 1;
  const { handBusy = 0 } = useContext(SceneTime);
  const frame = useCurrentFrame();
  const ref = useRef(null);
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = { bottom: Math.round(el.getBoundingClientRect().bottom), width: el.offsetWidth, height: el.offsetHeight };
    if (!box || Math.abs(next.bottom - box.bottom) > 2 || Math.abs(next.width - box.width) > 1 || Math.abs(next.height - box.height) > 1) setBox(next);
  });
  // Never during the wipe between two scenes, and not while the same hand is still drawing.
  const t = frame - Math.max(useLocalFrame(at), handBusy, 8);
  const hand = PUSH_HAND_W / scale;
  const reach = ((OPEN_HAND.h - ARM_FADE) / OPEN_HAND.w) * PUSH_HAND_W;
  // The fingers rest on a photo; on a line of text only the fingertips touch its edge.
  const overlap = Math.min(hand * 0.55, (box?.height || 0) * 0.35);
  const fromBelow = !box || H - box.bottom + overlap * scale <= reach;
  const distance = (fromBelow ? H : W) / scale;
  const travel = interpolate(t, [0, PUSH_FRAMES], [distance, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  const leave = interpolate(t, [PUSH_FRAMES + 5, PUSH_FRAMES + 21], [0, distance * 1.2], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const handStyle = fromBelow
    ? { left: '50%', top: `calc(100% - ${overlap}px)`, marginLeft: -hand * 0.35, transformOrigin: '50% 0', transform: `translateY(${leave}px) rotate(${-rotate - 6}deg)` }
    : // rotated a quarter turn: fingers to the left on the element's right edge, the arm running out to the right
      { left: `calc(100% - ${Math.min(hand * 0.55, (box?.width || 0) * 0.25)}px)`, top: '50%', transformOrigin: '0 0', transform: `translate(${leave}px, ${hand * 0.5}px) rotate(-90deg)` };
  return (
    <div ref={ref} style={{ position: 'relative', zIndex }}>
      <div style={{ visibility: t < 0 ? 'hidden' : 'visible', transform: `${fromBelow ? `translateY(${travel}px)` : `translateX(${travel}px)`} rotate(${rotate}deg)` }}>
        {children}
        {t >= 0 && leave < distance * 1.2 && <Img src={staticFile(OPEN_HAND.file)} style={{ position: 'absolute', width: hand, maxWidth: 'none', ...handStyle }} />}
      </div>
    </div>
  );
}

// ---------- blocks ----------
const TITLE_SIZE = { xl: 150, l: 110, m: 92, s: 72 };
const TITLE_CHARS = { xl: 11, l: 15, m: 18, s: 24 };
const HAND_FRAMES_PER_CHAR = 1.4;
const HAND_LIST_CHARS = 16; // a handwritten list line longer than this is written in two lines

function titlePaint(look, theme, tone, size, textColor) {
  const kind = look.title.kind;
  if (kind === 'sticker') {
    const tones = {
      light: ['#FFFFFF', theme.accent, theme.accentDark],
      brand: [theme.bg, theme.accent, theme.accentDark],
      accent: [theme.accent, '#FFFFFF', 'rgba(0,0,0,0.22)'],
    };
    const [fill, stroke, shadow] = tones[tone] || tones.light;
    return {
      outer: {
        color: fill,
        WebkitTextStroke: `${Math.round(size * 0.22)}px ${stroke}`,
        paintOrder: 'stroke fill',
        textShadow: `0 ${Math.round(size * 0.075)}px 0 ${shadow}`,
        paddingTop: Math.round(size * 0.12),
        lineHeight: 1.08,
      },
    };
  }
  if (kind === 'block') {
    const tones = {
      light: ['#FFFFFF', theme.accent],
      brand: [theme.ink, '#FFFFFF'],
      accent: [theme.accent, '#FFFFFF'],
    };
    const [fill, box] = tones[tone] || tones.light;
    return {
      outer: { color: fill, lineHeight: 1.42, letterSpacing: '0.01em' },
      // One box per line.
      inner: { background: box, padding: `${Math.round(size * 0.06)}px ${Math.round(size * 0.22)}px`, WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone' },
      inset: Math.round(size * 0.44),
    };
  }
  // Over a photo a dark or saturated accent disappears: there it is lifted toward white until it reads.
  const accent = textColor === LIGHT_TEXT ? readableOnPhoto(theme.accent) : theme.accent;
  const fill = tone === 'accent' || tone === 'brand' ? accent : textColor;
  if (kind === 'hand') {
    return { outer: { color: fill, lineHeight: 1.02, letterSpacing: '0.005em', textShadow: textColor === LIGHT_TEXT ? '0 4px 24px rgba(0,0,0,0.55)' : 'none' } };
  }
  if (kind === 'serif') {
    return { outer: { color: fill, lineHeight: 1.16, letterSpacing: '0.005em', fontStyle: tone === 'accent' ? 'italic' : 'normal', textShadow: '0 6px 30px rgba(0,0,0,0.35)' } };
  }
  return { outer: { color: fill, lineHeight: 1.12, letterSpacing: '-0.02em', textShadow: textColor === LIGHT_TEXT ? '0 4px 24px rgba(0,0,0,0.55)' : 'none' } };
}

function readableOnPhoto(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const rgb = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  if (luminance >= 0.6) return hex;
  const lift = Math.min(0.8, (0.72 - luminance) / (1 - luminance));
  return `#${rgb.map((c) => Math.round(c + (255 - c) * lift).toString(16).padStart(2, '0')).join('')}`;
}

function Title({ block }) {
  const { theme, look } = usePlan();
  const textColor = useTextColor();
  const { handBusy = 0, contact = false } = useContext(SceneTime);
  const stackScale = useContext(StackScale) || 1;
  // On the contact scene of a whiteboard the number to call leads, so the headlines step back.
  const base = Math.round((TITLE_SIZE[block.size] || TITLE_SIZE.l) * look.title.scale * (contact && look.pill.marker ? 0.86 : 1));
  const probe = titlePaint(look, theme, block.tone, base, textColor);
  const [ref, size] = useFit(base, useColumn() - 2 * SIDE - Math.round(base * 0.22) - (probe.inset || 0));
  const paint = titlePaint(look, theme, block.tone, size, textColor);
  const chars = Math.round((TITLE_CHARS[block.size] || TITLE_CHARS.l) * look.title.chars);
  const text = autoBreak(block.text, chars);
  const line = (content) => (paint.inner ? <span style={paint.inner}>{content}</span> : content);
  // Handwriting: the words appear letter by letter, at the size fitted for the whole line.
  const frame = useCurrentFrame();
  const from = useLocalFrame(block.at);
  // The hand that underlines is the hand that draws: it waits until the drawing is done.
  const underFrom = Math.max(useLocalFrame(block.underlineAt ?? block.at), block.underlineAt === undefined ? 0 : handBusy);
  const UNDERLINE_FRAMES = 14;
  const underline = block.underlineAt === undefined ? 0 : interpolate(frame - underFrom, [0, UNDERLINE_FRAMES], [0, 1], clamp);
  // On the whiteboard the marker hand draws the line: it comes in, follows the stroke and leaves.
  const penOffset =
    look.title.kind !== 'hand' || block.underlineAt === undefined
      ? null
      : interpolate(frame - underFrom, [-10, 0, UNDERLINE_FRAMES + 2, UNDERLINE_FRAMES + 14], [1100, 0, 0, 1100], { ...clamp, easing: Easing.inOut(Easing.quad) });
  if (look.title.kind === 'hand' && block.display === undefined && !block.push) {
    const written = Math.max(0, Math.floor((frame - from) / HAND_FRAMES_PER_CHAR));
    if (written < text.length) block = { ...block, display: text.slice(0, written) };
  }
  // `display` shows different text (a counting number) at the size fitted for `text`.
  return (
    <div
      style={{
        display: 'grid',
        justifyItems: 'center',
        fontFamily: `${look.fonts.title[0]}, ${EMOJI}`,
        fontWeight: look.title.weight,
        fontSize: size,
        textAlign: 'center',
        whiteSpace: 'pre',
        textTransform: look.title.upper ? 'uppercase' : 'none',
        fontVariantNumeric: 'tabular-nums',
        position: 'relative',
        ...paint.outer,
      }}
    >
      {underline > 0 && (
        // A line under the title, drawn as the narrator says it: a marker stroke on the whiteboard, a bar elsewhere.
        <svg viewBox="0 0 100 10" preserveAspectRatio="none" style={{ position: 'absolute', left: '-2%', width: '104%', bottom: '-0.16em', height: '0.24em', overflow: 'visible', clipPath: `inset(-300% ${(1 - underline) * 100}% -300% -10%)` }}>
          <path
            d={look.title.kind === 'hand' ? 'M 1 6 C 18 2, 34 9, 52 5 S 84 3, 99 6' : 'M 1 5 L 99 5'}
            fill="none"
            stroke={theme.accent}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: Math.max(6, Math.round(size * 0.07)) }}
          />
        </svg>
      )}
      {penOffset !== null && penOffset < 1100 && (
        // The arm points at the right edge of the frame (58°), which the real arm reaches from any headline.
        <Img
          src={staticFile(MARKER_HAND.file)}
          style={{
            position: 'absolute',
            left: `calc(${-2 + underline * 104}% - ${(NIB.x * HAND_W) / stackScale}px)`,
            top: `calc(100% + 0.04em - ${(NIB.y * HAND_W) / stackScale}px)`,
            width: HAND_W / stackScale,
            maxWidth: 'none',
            zIndex: 7,
            transformOrigin: NIB_ORIGIN,
            transform: `translate(${(penOffset * 0.85) / stackScale}px, ${(penOffset * 0.53) / stackScale}px) rotate(-58deg)`,
          }}
        />
      )}
      <div ref={ref} style={{ gridArea: '1 / 1', visibility: block.display === undefined ? 'visible' : 'hidden' }}>{line(text)}</div>
      {block.display !== undefined && <div style={{ gridArea: '1 / 1' }}>{line(block.display)}</div>}
    </div>
  );
}

function NumberTitle({ block }) {
  const frame = useCurrentFrame();
  const from = useLocalFrame(block.at);
  const p = interpolate(frame - from, [0, 21], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const step = Math.max(1, 5 * 10 ** (Math.floor(Math.log10(Math.max(block.value, 1))) - 2));
  // `still`: the figure stands from its first frame (a listing's asking price must never read as another price).
  const value = block.still || p >= 1 ? block.value : Math.round((block.value * p) / step) * step;
  const format = (v) => `${block.prefix || ''}${v.toLocaleString(block.locale || 'en-US')}${block.suffix || ''}`;
  // Fit against the final value so the size does not change while counting.
  const figure = <Title block={{ size: 'xl', tone: 'accent', text: format(block.value), display: format(value) }} />;
  if (block.was === undefined || block.was === null) return figure;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <WasPrice text={format(block.was)} />
      {figure}
    </div>
  );
}

function WasPrice({ text }) {
  const { look } = usePlan();
  const textColor = useTextColor();
  return (
    <div style={{ position: 'relative', fontFamily: look.fonts.body[0], fontWeight: 800, fontSize: 64, color: textColor, opacity: 0.7, padding: '0 10px' }}>
      {text}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '52%', height: 7, borderRadius: 4, background: '#E3262B', transform: 'rotate(-7deg)' }} />
    </div>
  );
}

function Pill({ block }) {
  const { theme, look } = usePlan();
  const base = block.size === 'l' ? 50 : 42;
  const [ref, size] = useFit(base, useColumn() - 2 * SIDE - 90);
  if (look.pill.marker) {
    const ink = block.tone === 'dark' ? theme.ink : theme.accent;
    return (
      // A label that sits on a photo gets the board's paper behind it: marker on a dark picture cannot be read.
      <div style={{ fontFamily: MARKER, fontSize: size, lineHeight: 1.2, color: ink, background: block.onPhoto ? theme.bg : 'transparent', boxShadow: block.onPhoto ? '0 8px 20px rgba(0,0,0,0.2)' : 'none', padding: `${Math.round(size * 0.3)}px ${Math.round(size * 0.7)}px`, border: `5px solid ${ink}`, borderRadius: '26px 14px 28px 12px / 14px 26px 12px 28px' }}>
        <div ref={ref} style={{ whiteSpace: 'nowrap' }}>{block.text}</div>
      </div>
    );
  }
  const tones = {
    accent: { background: theme.accent, color: '#FFFFFF' },
    dark: { background: look.surface === 'dark' ? '#FFFFFF' : theme.ink, color: look.surface === 'dark' ? theme.ink : '#FFFFFF' },
    brand: { background: look.surface === 'dark' ? '#FFFFFF' : theme.bg, color: theme.accent },
    light: { background: '#FFFFFF', color: theme.ink },
  };
  return (
    <div
      style={{
        ...(tones[block.tone] || tones.accent),
        fontFamily: `${look.fonts.body[0]}, ${EMOJI}`,
        fontWeight: Math.max(look.bodyWeight, 600),
        fontSize: size,
        lineHeight: 1.15,
        letterSpacing: look.pill.spaced ? '0.14em' : 'normal',
        textTransform: look.pill.spaced ? 'uppercase' : 'none',
        padding: `${Math.round(size * 0.34)}px ${Math.round(size * 0.8)}px`,
        borderRadius: look.pill.radius,
        border: block.tone === 'light' ? 'none' : look.pill.border,
        boxShadow: look.pill.shadow,
      }}
    >
      <div ref={ref} style={{ whiteSpace: 'nowrap' }}>{block.text}</div>
    </div>
  );
}

function Badge({ block }) {
  const { theme, look } = usePlan();
  const [ref, size] = useFit(Math.round(80 * look.title.scale), useColumn() - 2 * SIDE - 130);
  const playful = look.title.kind === 'sticker';
  if (look.pill.marker) {
    return (
      // Marker capitals are loud: kept well under the headline's size, so the headline leads.
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, fontFamily: MARKER, fontSize: size * 0.58, lineHeight: 1.15, color: theme.ink }}>
        <span style={{ color: theme.accent, fontSize: size * 0.8, lineHeight: 0.9 }}>✓</span>
        <div ref={ref} style={{ whiteSpace: 'pre' }}>{autoBreak(block.text, 14)}</div>
      </div>
    );
  }
  return (
    <div
      style={{
        background: playful ? NAMED.green : theme.accent,
        color: '#FFFFFF',
        fontFamily: `${look.fonts.title[0]}, ${EMOJI}`,
        fontWeight: look.title.weight,
        fontSize: size,
        lineHeight: 1,
        textTransform: look.title.upper ? 'uppercase' : 'none',
        padding: playful ? '26px 46px 14px' : '24px 46px',
        borderRadius: playful ? 36 : look.pill.radius === 999 ? 28 : look.pill.radius,
        border: playful ? '8px solid #FFFFFF' : 'none',
        boxShadow: '0 10px 0 rgba(0,0,0,0.15), 0 20px 40px rgba(0,0,0,0.25)',
      }}
    >
      <div ref={ref} style={{ whiteSpace: 'nowrap' }}>✔ {block.text}</div>
    </div>
  );
}

function Highlight({ block }) {
  const { theme, look } = usePlan();
  const frame = useCurrentFrame();
  const from = useLocalFrame(block.at);
  // A long line (a web address) needs wider side room, or the ellipse's ends cut through its first and last letters
  const sideRoom = 0.6 + 0.08 * Math.max(0, block.text.length - 8);
  const [ref, size] = useFit(look.pill.marker ? 100 : 60, useColumn() - 2 * SIDE - (look.pill.marker ? 110 + 2 * (sideRoom - 0.6) * 60 : 120));
  const pulse = 1 + 0.025 * Math.sin(Math.max(0, frame - from - 18) / 7);
  if (look.pill.marker) {
    // The ellipse is drawn round the words once they are written.
    const drawn = interpolate(frame - from, [10, 26], [0, 1], clamp);
    return (
      <div style={{ position: 'relative', padding: `${Math.round(size * 0.45)}px ${Math.round(size * sideRoom)}px`, fontFamily: MARKER, fontSize: size, color: theme.ink }}>
        <div ref={ref} style={{ whiteSpace: 'nowrap' }}>{block.text}</div>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', clipPath: `inset(-30% ${(1 - drawn) * 100 - (drawn >= 1 ? 10 : 0)}% -30% -10%)` }}>
          <path
            d="M 8 22 C 6 8, 40 3, 62 4 C 88 5, 99 13, 96 24 C 93 35, 58 39, 33 37 C 12 35, 2 28, 9 17 C 13 11, 22 8, 30 7"
            fill="none"
            stroke={theme.accent}
            strokeWidth="1.6"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: 7 }}
          />
        </svg>
      </div>
    );
  }
  return (
    <div
      style={{
        transform: `scale(${pulse})`,
        background: theme.accent,
        color: '#FFFFFF',
        fontFamily: `${look.fonts.body[0]}, ${EMOJI}`,
        fontWeight: Math.max(look.bodyWeight, 700),
        fontSize: size,
        padding: '22px 44px',
        borderRadius: look.pill.radius,
        border: look.pill.border,
        boxShadow: look.pill.shadow,
      }}
    >
      <div ref={ref} style={{ whiteSpace: 'nowrap' }}>{block.text}</div>
    </div>
  );
}

const CHIP_COLORS = ['accent', 'blue', 'green', 'orange', 'purple'];

function Chip({ item, index }) {
  const { theme, look } = usePlan();
  const textColor = useTextColor();
  const [ref, size] = useFit(look.chip.icon === 'check' ? 72 : 50, useColumn() - 2 * SIDE - (look.chip.icon === 'check' ? 90 : 190));
  const chip = look.chip;
  if (chip.icon === 'check') {
    return (
      // A long line is written in two: shorter lines let the whole list be written bigger.
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 22 }}>
        <span style={{ fontFamily: MARKER, fontSize: size * 0.95, lineHeight: 1.1, color: theme.accent, width: 60, textAlign: 'center', flexShrink: 0 }}>✓</span>
        <div ref={ref} style={{ fontFamily: look.fonts.body[0], fontWeight: 700, fontSize: size, lineHeight: 1.05, color: textColor, whiteSpace: 'pre' }}>
          {autoBreak(item.text, HAND_LIST_CHARS)}
        </div>
      </div>
    );
  }
  const iconBg = {
    cycle: color(theme, item.color, color(theme, CHIP_COLORS[index % CHIP_COLORS.length])),
    accent: theme.accent,
    tint: `${theme.accent}22`,
    outline: 'transparent',
  }[chip.icon];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        background: chip.bg,
        borderRadius: chip.radius,
        padding: chip.underline ? '10px 8px 18px' : '14px 40px 14px 14px',
        boxShadow: chip.shadow,
        borderBottom: chip.underline ? `1.5px solid ${theme.accent}88` : 'none',
        minWidth: chip.underline ? 760 : 0,
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: chip.iconRadius,
          background: iconBg,
          border: chip.icon === 'outline' ? `1.5px solid ${theme.accent}` : 'none',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          fontFamily: EMOJI,
          flexShrink: 0,
        }}
      >
        {item.icon}
      </div>
      <div
        ref={ref}
        style={{
          fontFamily: `${look.fonts.body[0]}, ${EMOJI}`,
          fontWeight: look.bodyWeight,
          fontSize: size,
          color: chip.bg === 'transparent' ? textColor : theme.ink,
          whiteSpace: 'nowrap',
        }}
      >
        {item.text}
      </div>
    </div>
  );
}

function Chips({ block }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      {block.items.map((item, i) => (
        <PopIn key={i} at={item.at ?? block.at} anim="left">
          <Chip item={item} index={i} />
        </PopIn>
      ))}
    </div>
  );
}

function Tiles({ block }) {
  const { theme, look } = usePlan();
  const n = block.items.length;
  const gap = 18;
  const w = Math.min(260, Math.floor((useColumn() - 2 * SIDE - gap * (n - 1)) / n));
  const k = w / 212;
  return (
    <div style={{ display: 'flex', gap }}>
      {block.items.map((item, i) => {
        const fill = color(theme, item.color, theme.accent);
        if (look.tile.drawn) {
          return (
            <PopIn key={i} at={item.at ?? block.at}>
              <div
                style={{
                  width: w,
                  height: Math.round(250 * k),
                  border: `5px solid ${theme.ink}`,
                  borderRadius: '22px 12px 26px 10px / 12px 24px 10px 26px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6 * k,
                  color: theme.ink,
                }}
              >
                <div style={{ fontFamily: look.fonts.body[0], fontWeight: 700, fontSize: 40 * k }}>{item.top}</div>
                <div style={{ fontFamily: MARKER, fontSize: (item.big.length > 3 ? 56 : 84) * k, lineHeight: 1.05, color: theme.accent }}>{item.big}</div>
              </div>
            </PopIn>
          );
        }
        return (
          <PopIn key={i} at={item.at ?? block.at} anim="up">
            <div
              style={{
                width: w,
                height: Math.round(280 * k),
                borderRadius: look.tile.radius * k,
                background: look.tile.outline ? 'transparent' : fill,
                border: look.tile.outline ? `1.5px solid ${theme.accent}` : look.tile.border,
                boxSizing: 'border-box',
                boxShadow: look.tile.outline ? 'none' : '0 10px 0 rgba(0,0,0,0.14), 0 18px 34px rgba(0,0,0,0.22)',
                color: look.tile.outline ? LIGHT_TEXT : '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <div style={{ fontFamily: look.fonts.body[0], fontWeight: look.bodyWeight, fontSize: 30 * k, opacity: 0.9 }}>{item.top}</div>
              <div
                style={{
                  fontFamily: look.fonts.title[0],
                  fontWeight: look.title.weight,
                  fontSize: (item.big.length > 3 ? 58 : 90) * k * Math.min(1, look.title.scale + 0.1),
                  lineHeight: 1.05,
                  paddingTop: look.title.kind === 'sticker' ? 10 * k : 0,
                }}
              >
                {item.big}
              </div>
              <div style={{ fontSize: 52 * k, fontFamily: EMOJI }}>{item.icon}</div>
            </div>
          </PopIn>
        );
      })}
    </div>
  );
}

function Row({ item }) {
  const { look, theme } = usePlan();
  const textColor = useTextColor();
  const hand = look.chip.icon === 'check';
  const [ref, size] = useFit(hand ? 64 : 50, 820 - 80);
  if (hand) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontFamily: look.fonts.body[0], fontWeight: 700, fontSize: size, color: textColor }}>
        <span style={{ fontFamily: MARKER, fontSize: size * 0.9, color: theme.accent, width: 58, textAlign: 'center', flexShrink: 0 }}>✓</span>
        <span ref={ref} style={{ whiteSpace: 'pre', lineHeight: 1.05 }}>{autoBreak(item.text, HAND_LIST_CHARS)}</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontFamily: `${look.fonts.body[0]}, ${EMOJI}`, fontWeight: look.bodyWeight, fontSize: size, color: textColor }}>
      <span style={{ fontSize: 52, width: 58, textAlign: 'center', flexShrink: 0, fontFamily: EMOJI }}>{item.icon}</span>
      <span ref={ref} style={{ whiteSpace: 'nowrap' }}>{item.text}</span>
    </div>
  );
}

function Rows({ block }) {
  return (
    <div style={{ width: 820, display: 'flex', flexDirection: 'column', gap: 36 }}>
      {block.items.map((item, i) => (
        <PopIn key={i} at={item.at ?? block.at} anim="left">
          <Row item={item} />
        </PopIn>
      ))}
    </div>
  );
}

function Stars({ block }) {
  const { look } = usePlan();
  const textColor = useTextColor();
  const frame = useCurrentFrame();
  const from = useLocalFrame(block.at);
  const rating = Math.max(0, Math.min(5, block.rating));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ fontFamily: look.fonts.title[0], fontWeight: look.title.weight, fontSize: 96, lineHeight: 1, color: textColor }}>{rating.toFixed(1)}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2, 3, 4].map((i) => {
            const fill = Math.max(0, Math.min(1, rating - i));
            const s = spring({ frame: frame - from - 4 - i * 3, fps: FPS, config: { damping: 11, stiffness: 200, mass: 0.6 } });
            return (
              <div key={i} style={{ position: 'relative', fontSize: 84, lineHeight: 1, color: 'rgba(140,140,150,0.45)', transform: `scale(${s})` }}>
                ★<div style={{ position: 'absolute', inset: 0, width: `${fill * 100}%`, overflow: 'hidden', color: '#FFB800' }}>★</div>
              </div>
            );
          })}
        </div>
      </div>
      {block.text && <div style={{ fontFamily: look.fonts.body[0], fontWeight: look.bodyWeight, fontSize: 42, color: textColor, opacity: 0.85 }}>{block.text}</div>}
    </div>
  );
}

function Quote({ block }) {
  const { theme, look } = usePlan();
  return (
    <div
      style={{
        position: 'relative',
        width: 900,
        boxSizing: 'border-box',
        background: '#FFFFFF',
        borderRadius: Math.min(look.card.radius, 36),
        padding: '54px 52px 40px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
      }}
    >
      <div style={{ position: 'absolute', top: -46, left: 40, fontFamily: 'Georgia, serif', fontSize: 200, lineHeight: 1, color: theme.accent }}>“</div>
      <div style={{ fontFamily: look.fonts.body[0], fontWeight: look.pill.marker ? 700 : 600, fontSize: look.pill.marker ? 58 : 46, lineHeight: look.pill.marker ? 1.1 : 1.3, color: '#1C1B22' }}>{block.text}</div>
      {block.author && <div style={{ marginTop: 18, fontFamily: look.fonts.body[0], fontWeight: 800, fontSize: 36, color: theme.accent }}>{block.author}</div>}
    </div>
  );
}

// 2 photos: side by side, tilted. 3 photos: one large, two small beside it.
function Gallery({ block, duration }) {
  const { assets, look } = usePlan();
  const items = block.assets.map((id) => assets[id]).filter(Boolean).slice(0, 3);
  const tilt = look.rotate ? [-2.5, 2, -1.5] : [0, 0, 0];
  const boxes = items.length === 2 ? [[480, 620], [480, 620]] : [[590, 640], [380, 310], [380, 310]];
  const frameStyle = (i) => ({
    width: boxes[i][0],
    height: boxes[i][1],
    borderRadius: look.card.radius,
    padding: look.card.pad,
    background: look.card.padColor,
    boxSizing: 'border-box',
    boxShadow: look.card.shadow === 'none' ? '0 18px 40px rgba(0,0,0,0.4)' : look.card.shadow,
    transform: `rotate(${tilt[i]}deg)`,
  });
  const photo = (item, i) => (
    <PopIn key={i} at={(block.at ?? undefined) === undefined ? undefined : block.at + i * 0.28} anim="up">
      <div style={{ ...frameStyle(i), position: 'relative' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: Math.max(0, look.card.radius - look.card.pad), overflow: 'hidden' }}>
          <MediaFill asset={item} block={{ zoom: [1.02, 1.1] }} duration={duration} />
        </div>
        {look.card.tape && <Tape />}
      </div>
    </PopIn>
  );
  if (items.length < 2) return null;
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
      {photo(items[0], 0)}
      {items.length === 2 ? photo(items[1], 1) : <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{photo(items[1], 1)}{photo(items[2], 2)}</div>}
    </div>
  );
}

// A product with its background removed: no card, it floats on the scene.
function Cutout({ asset, block }) {
  const frame = useCurrentFrame();
  const size = block.shape === 'small' ? 560 : 780;
  const bob = Math.sin(frame / 18) * 14;
  const sway = Math.sin(frame / 31) * 2.2;
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <div style={{ position: 'absolute', left: '18%', right: '18%', bottom: 6, height: 46, borderRadius: '50%', background: 'rgba(0,0,0,0.28)', filter: 'blur(22px)', transform: `scale(${1 - bob / 90})` }} />
      <Img
        src={src(asset.cutoutUrl)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `translateY(${bob - 10}px) rotate(${sway}deg)`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.35))' }}
      />
    </div>
  );
}

const CARD = { wide: [1000, 563], photo: [860, 620], square: [760, 760], small: [900, 500], tall: [720, 900] };

// Two strips of paper tape hold a photo to the board.
function Tape() {
  const strip = { position: 'absolute', top: -22, width: 150, height: 46, background: 'rgba(238,228,196,0.82)', boxShadow: '0 2px 6px rgba(0,0,0,0.12)' };
  return (
    <>
      <div style={{ ...strip, left: -38, transform: 'rotate(-32deg)' }} />
      <div style={{ ...strip, right: -38, transform: 'rotate(30deg)' }} />
    </>
  );
}
const tilt = (id = '') => ([...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 2 ? 1.8 : -1.8);

function MediaFill({ asset, block, duration }) {
  const frame = useCurrentFrame();
  const focus = block.focus || '50% 50%';
  if (asset.kind === 'video') {
    // A long shot is cut by jumping the zoom at a spoken pause: the last punch reached sets the scale.
    const scale = (block.punches || []).reduce((s, punch) => (frame >= punch.frame ? punch.scale : s), 1);
    return (
      <OffthreadVideo
        src={src(asset.url)}
        startFrom={Math.round((block.startFrom || 0) * FPS)}
        playbackRate={block.playbackRate || 1}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: focus, ...(scale === 1 ? {} : { transform: `scale(${scale})`, transformOrigin: block.punchFocus || '50% 40%' }) }}
      />
    );
  }
  const [from, to] = block.zoom || [1.03, 1.14];
  const s = interpolate(frame, [0, duration], [from, to], clamp);
  return (
    <Img
      src={src(asset.url)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: focus, transform: `scale(${s})`, transformOrigin: focus }}
    />
  );
}

function Media({ block, duration }) {
  const { assets, theme, look } = usePlan();
  const asset = assets[block.asset];
  // A square or tall photo in a wide card loses the top and bottom of the picture (a face cut at the chin).
  const ratio = asset?.width && asset?.height ? asset.width / asset.height : null;
  const shape = ratio === null ? block.shape : ratio < 0.9 ? 'tall' : ratio <= 1.2 ? 'square' : block.shape === 'tall' || block.shape === 'square' ? 'photo' : block.shape;
  const [w, h] = CARD[shape] || CARD.wide;
  const card = look.card;
  if (!asset) return null;
  if (block.cutout && asset.cutoutUrl) return <Cutout asset={asset} block={block} />;
  return (
    <div style={{ position: 'relative' }}>
      {card.offset && <div style={{ position: 'absolute', top: 22, left: 22, width: w, height: h, background: theme.accent }} />}
      <div
        style={{
          position: 'relative',
          width: w,
          height: h,
          borderRadius: card.radius,
          background: card.padColor,
          padding: card.pad,
          boxSizing: 'border-box',
          boxShadow: card.shadow,
          outline: card.outline ? `1.5px solid ${theme.accent}` : 'none',
          outlineOffset: 14,
        }}
      >
        <div style={{ width: '100%', height: '100%', borderRadius: Math.max(0, card.radius - card.pad), overflow: 'hidden' }}>
          <MediaFill asset={asset} block={block} duration={duration} />
        </div>
        {card.tape && <Tape />}
      </div>
      {block.cornerTag && (
        <div style={{ position: 'absolute', top: -42, right: -10 }}>
          <PopIn at={block.cornerTag.at} rotate={8}>
            <Pill block={{ text: block.cornerTag.text, tone: 'brand', size: 'l', onPhoto: true }} />
          </PopIn>
        </div>
      )}
      {block.footerPill && (
        <div style={{ position: 'absolute', bottom: -44, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <PopIn at={block.footerPill.at} anim="stamp" rotate={-2}>
            <Pill block={{ text: block.footerPill.text, tone: 'accent', size: 'l', onPhoto: true }} />
          </PopIn>
        </div>
      )}
    </div>
  );
}

function Logo({ block }) {
  const { assets } = usePlan();
  const asset = assets[block.asset];
  if (!asset) return null;
  return <Img src={src(asset.url)} style={{ width: block.width || 330, maxHeight: 240, objectFit: 'contain' }} />;
}

function Caption({ block }) {
  const { look } = usePlan();
  const dark = useContext(Surface) === 'dark';
  return (
    <div style={{ fontFamily: look.fonts.body[0], fontWeight: Math.min(look.bodyWeight, 800), fontSize: look.pill.marker ? 58 : 46, color: dark ? 'rgba(247,243,234,0.7)' : '#5B5866' }}>
      {block.text}
    </div>
  );
}

const BLOCKS = {
  title: { Component: Title, anim: 'pop' },
  number: { Component: NumberTitle, anim: 'stamp', rotate: -3 },
  pill: { Component: Pill, anim: 'pop' },
  badge: { Component: Badge, anim: 'stamp', rotate: -3 },
  highlight: { Component: Highlight, anim: 'stamp' },
  media: { Component: Media, anim: 'up' },
  logo: { Component: Logo, anim: 'pop' },
  caption: { Component: Caption, anim: 'pop' },
  emoji: { Component: ({ block }) => <div style={{ fontSize: 110, lineHeight: 1.1, fontFamily: EMOJI }}>{block.text}</div>, anim: 'pop' },
  stars: { Component: Stars, anim: 'pop' },
  quote: { Component: Quote, anim: 'up' },
  // Groups animate their items one by one, so the wrapper stays still.
  gallery: { Component: Gallery, group: true },
  chips: { Component: Chips, group: true },
  tiles: { Component: Tiles, group: true },
  rows: { Component: Rows, group: true },
};

function Block({ block, duration }) {
  const { look } = usePlan();
  const def = BLOCKS[block.type];
  if (!def) return null;
  const body = <def.Component block={block} duration={duration} />;
  if (def.group) return body;
  const crooked = look.card.tape && block.type === 'media' && !block.cutout ? tilt(block.asset) : 0;
  // The hand that underlines a title belongs to that title's layer: the title stands above the lines around it,
  // or the hand would pass under the text below (it is painted later).
  const above = block.underlineAt !== undefined ? 8 : undefined;
  if (look.motion === 'write' && block.push) {
    return (
      <PushIn at={block.at} rotate={block.rotate ?? crooked} zIndex={above}>
        {body}
      </PushIn>
    );
  }
  return (
    <PopIn
      at={block.at}
      anim={block.anim || def.anim}
      rotate={block.rotate ?? (crooked || def.rotate || 0)}
      style={above ? { position: 'relative', zIndex: above } : undefined}
    >
      {body}
    </PopIn>
  );
}

// ---------- backgrounds ----------
function Confetti({ colors }) {
  const { W, H } = useFrame();
  const frame = useCurrentFrame();
  const span = H + 200;
  return new Array(16).fill(0).map((_, i) => {
    const size = 14 + random(`s${i}`) * 34;
    const speed = 0.6 + random(`v${i}`) * 1.3;
    const y = ((((random(`y${i}`) * span - frame * speed) % span) + span) % span) - 100;
    const x = random(`x${i}`) * W + Math.sin(frame / 22 + i) * 18;
    return (
      <div
        key={i}
        style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: 999, background: colors[i % colors.length], opacity: 0.35 }}
      />
    );
  });
}

// A whiteboard: off-white, a paper grain, a soft vignette.
function Board({ children }) {
  const { theme } = usePlan();
  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: 'hidden' }}>
      {children}
      <AbsoluteFill style={{ backgroundImage: `url(${staticFile('smart-video/whiteboard/paper.png')})`, opacity: 0.35, mixBlendMode: 'multiply' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.10) 100%)' }} />
    </AbsoluteFill>
  );
}

// Where a scene's drawing sits: across the top when vertical, on the left when horizontal.
// The drawing keeps its own shape (ratio = width / height) and takes exactly the room it needs,
// so the words get everything that is left.
function drawingBox({ W, H, landscape }, captions, ratio = 1) {
  if (landscape) {
    const top = 70;
    const maxH = H - top - (captions ? 215 : 70);
    const w = Math.min(940, maxH * ratio);
    return { x: 90, y: top + (maxH - w / ratio) / 2, w, h: w / ratio };
  }
  const w = Math.min(940, (captions ? 780 : 900) * ratio);
  return { x: (W - w) / 2, y: 150, w, h: w / ratio };
}
const ratioOf = (asset) => (asset?.width && asset?.height ? asset.width / asset.height : 1);

// How long the hand draws. Tall frame: under half the scene, because the words wait for it. Wide frame: the
// words are written meanwhile, so the hand can take its time and be followed by the eye.
const drawSeconds = (sceneSeconds, landscape = false) =>
  landscape ? Math.min(4.6, Math.max(2, sceneSeconds * 0.55)) : Math.min(3, Math.max(1.5, sceneSeconds * 0.4));
// How loud sfx/marker.mp3 is in each of its 159 frames (5.3 s at 30 fps; 1 = its loudest frame). The hand draws in
// this rhythm: it moves while a stroke sounds and waits in the gaps, so what is heard is what is seen.
// The file is a real marker recording played at three quarters of its speed: at full speed it is a hurried,
// squeaky scribble, and anything computed instead of recorded sounds like static. Its silences are cut down to
// 4 frames: with longer ones the hand stood still in the middle of a picture.
// Regenerate this list whenever marker.mp3 is replaced (the loudness of each 1/30 s, divided by the largest).
const MARKER_ENV = [
  0.01, 0.01, 0.37, 0.44, 0.49, 0.49, 0.37, 0.08, 0.54, 0.52, 0.2, 0.14, 0.08, 0.05, 0.06, 0.23, 0.24, 0.12, 0.22, 0.45, 0.24, 0.23, 0.29, 0.16, 0.14,
  0.17, 0.48, 0.25, 0.08, 0.03, 0.02, 0.03, 0.21, 0.17, 0.1, 0.15, 0.38, 0.31, 0.1, 0.22, 0.27, 0.18, 0.13, 0.13, 0.2, 0.44, 0.25, 0.13, 0.31, 0.29,
  0.21, 0.13, 0.33, 0.3, 0.17, 0.09, 0.05, 0.03, 0.2, 0.19, 0.08, 0.19, 0.18, 0.18, 0.36, 0.35, 0.19, 0.07, 0.19, 0.95, 0.62, 0.23, 0.17, 0.59, 0.37,
  0.13, 0.1, 0.05, 0.05, 0.27, 0.24, 0.07, 0.08, 0.03, 0.04, 0.41, 0.98, 0.67, 0.43, 0.2, 0.38, 0.4, 0.12, 0.07, 0.03, 0.02, 0.26, 0.54, 0.38, 0.17,
  0.03, 0.05, 0.07, 0.11, 0.69, 0.43, 0.36, 0.35, 0.22, 0.38, 0.54, 0.31, 0.08, 0.04, 0.07, 0.41, 0.71, 0.41, 0.19, 0.1, 0.05, 0.25, 0.31, 0.22, 0.08,
  0.04, 0.02, 0.0, 0.52, 1.0, 0.87, 0.58, 0.37, 0.14, 0.06, 0.05, 0.06, 0.18, 0.35, 0.22, 0.75, 0.79, 0.51, 0.44, 0.32, 0.18, 0.5, 0.61, 0.35, 0.16,
  0.51, 0.74, 0.58, 0.3, 0.2, 0.07, 0.06, 0.0, 0.0,
];
// The share of a drawing done after `f` of `total` frames, following the marker's strokes.
function drawnShare(f, total) {
  if (f <= 0) return 0;
  if (f >= total) return 1;
  let done = 0;
  let all = 0;
  for (let k = 0; k < total; k++) {
    // Between strokes the hand slows down, it does not freeze.
    const stroke = Math.max(0.12, Math.pow(MARKER_ENV[Math.min(k, MARKER_ENV.length - 1)], 0.6));
    all += stroke;
    if (k < f) done += stroke;
  }
  return done / all;
}
const DRAW_START = 4; // frames into the scene at which the hand (and its sound) starts
const UNDERLINE_STROKE = 104; // the frame of marker.mp3 at which one long, even stroke begins
const DRAW_ROWS = 8;
const HAND_SMOOTH = 6; // cells on each side of the tip that the hand's position is averaged over

// A traced drawing: its line cells in drawing order, and how long the hand takes to reach each one.
// A step to the next cell of the same line costs 1; lifting the marker to another line costs a little more,
// but never as much as the distance (the hand must not crawl across empty board).
function usePath(asset) {
  return React.useMemo(() => {
    const flat = asset?.path;
    if (!flat || flat.length < 8) return null;
    const points = [];
    for (let i = 0; i + 1 < flat.length; i += 2) points.push([flat[i], flat[i + 1]]);
    const cell = 1 / 46;
    const cost = [0];
    for (let i = 1; i < points.length; i++) {
      const steps = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]) / cell;
      cost.push(cost[i - 1] + (steps <= 1.6 ? 1 : Math.min(4, 1 + steps * 0.25)));
    }
    return { points, cost, total: cost[cost.length - 1], cell };
  }, [asset]);
}

// Where the marker is on this frame of a drawing scene, and how much of the picture is drawn.
function useDrawing(background, duration, first) {
  const frameSize = useFrame();
  const { assets, captions } = usePlan();
  const frame = useCurrentFrame();
  const asset = assets[background.asset];
  const path = usePath(asset);
  // The box is the picture itself, so the hand never draws over empty board.
  const { x, y, w, h } = drawingBox(frameSize, captions, ratioOf(asset));
  const drawFrames = Math.round(drawSeconds(duration / FPS, frameSize.landscape) * FPS);
  // The first scene opens with part of the picture already there (it doubles as the thumbnail).
  const stroked = drawnShare(frame - DRAW_START, drawFrames);
  const share = first ? 0.35 + 0.65 * stroked : stroked;
  if (path) {
    // The hand follows the drawing's own lines.
    const at = share * path.total;
    let i = 0;
    while (i + 1 < path.cost.length && path.cost[i + 1] <= at) i++;
    const next = Math.min(i + 1, path.points.length - 1);
    const span = path.cost[next] - path.cost[i];
    const f = span > 0 ? (at - path.cost[i]) / span : 0;
    // The ink follows the path cell by cell; the hand glides along it (the mean of the cells around the tip),
    // or it would jitter through every corner faster than the eye can follow.
    const near = (centre) => {
      let sx = 0;
      let sy = 0;
      for (let k = centre - HAND_SMOOTH; k <= centre + HAND_SMOOTH; k++) {
        const q = path.points[Math.max(0, Math.min(path.points.length - 1, k))];
        sx += q[0];
        sy += q[1];
      }
      return [sx / (2 * HAND_SMOOTH + 1), sy / (2 * HAND_SMOOTH + 1)];
    };
    const a = near(i);
    const b = near(next);
    const px = a[0] + (b[0] - a[0]) * f;
    const py = a[1] + (b[1] - a[1]) * f;
    return { asset, path, drawn: i + 1, done: share >= 1, x, y, w, h, tipX: x + px * w, tipY: y + py * h, frame, drawFrames, frameSize };
  }
  // A drawing without a traced path (made before 2026-10): revealed in rows, the hand at the edge of the reveal.
  const p = share * DRAW_ROWS;
  const bandH = h / DRAW_ROWS;
  const row = Math.min(DRAW_ROWS - 1, Math.floor(p));
  const frac = p >= DRAW_ROWS ? 1 : p - row;
  const tipX = x + (row % 2 === 0 ? frac : 1 - frac) * w;
  const tipY = y + row * bandH + bandH * (0.5 + 0.28 * Math.sin(frame * 1.9));
  return { asset, path: null, x, y, w, h, bandH, row, frac, tipX, tipY, frame, drawFrames, frameSize };
}

function DrawingBg({ background, duration, first }) {
  const { asset, path, drawn, done, x, y, w, h, bandH, row, frac } = useDrawing(background, duration, first);
  const { start } = useContext(SceneTime);
  if (asset && path) {
    // The ink appears under the marker: everything within a marker's reach of the path walked so far.
    const clipId = `ink-${background.asset}-${Math.round(start * 100)}`;
    const rx = path.cell * 1.15 * (w >= h ? 1 : h / w);
    const ry = path.cell * 1.15 * (w >= h ? w / h : 1);
    return (
      <Board>
        {!done && (
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs>
              <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                {path.points.slice(0, drawn).map(([cx, cy], i) => (
                  <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} />
                ))}
              </clipPath>
            </defs>
          </svg>
        )}
        <Img src={src(asset.url)} style={{ position: 'absolute', left: x, top: y, width: w, height: h, clipPath: done ? 'none' : `url(#${clipId})` }} />
      </Board>
    );
  }
  return (
    <Board>
      {asset &&
        Array.from({ length: DRAW_ROWS }, (_, i) => {
          const shown = i < row ? 1 : i === row ? frac : 0;
          if (shown <= 0) return null;
          const fromLeft = i % 2 === 0;
          return (
            <div key={i} style={{ position: 'absolute', top: y + i * bandH, height: bandH + 1, left: x + (fromLeft ? 0 : w * (1 - shown)), width: w * shown, overflow: 'hidden' }}>
              <Img src={src(asset.url)} style={{ position: 'absolute', top: -i * bandH, left: fromLeft ? 0 : -w * (1 - shown), width: w, height: h }} />
            </div>
          );
        })}
    </Board>
  );
}

/**
 * The drawing hand, above everything in the scene (a real hand passes over the words too).
 * A right hand reaches in from the nearest edge: from the right in a tall frame, so the arm
 * leaves the picture quickly instead of hanging down the whole screen; from below in a wide
 * frame, where the words stand on the right.
 */
function DrawingHand({ background, duration, first }) {
  const { asset, tipX, tipY, frame, drawFrames, frameSize } = useDrawing(background, duration, first);
  if (!asset) return null;
  const { W, H, landscape } = frameSize;
  // Wide frame: up from the bottom edge, which the arm reaches from the top of the drawing.
  // Tall frame: in from the right edge, steeply, because the bottom is out of the arm's reach.
  const target = landscape ? { x: tipX + 260, y: H + 600 } : { x: W + 520, y: tipY + 480 };
  const angle = Math.max(5, Math.min(74, (Math.atan2(target.x - tipX, target.y - tipY) * 180) / Math.PI));
  // Once the picture is done the hand pulls back along its arm and out of the frame.
  const away = interpolate(frame, [4 + drawFrames, 4 + drawFrames + 12], [0, 1.6 * Math.max(W, H)], { ...clamp, easing: Easing.in(Easing.cubic) });
  if (away >= 1.6 * Math.max(W, H)) return null;
  const rad = (angle * Math.PI) / 180;
  const handW = HAND_W;
  return (
    <AbsoluteFill style={{ zIndex: 20, pointerEvents: 'none', overflow: 'hidden' }}>
      <Img
        src={staticFile(MARKER_HAND.file)}
        style={{
          position: 'absolute',
          left: tipX - NIB.x * handW + Math.sin(rad) * away,
          top: tipY - NIB.y * handW + Math.cos(rad) * away,
          width: handW,
          transformOrigin: NIB_ORIGIN,
          transform: `rotate(${-angle}deg)`,
        }}
      />
    </AbsoluteFill>
  );
}

function BrandBg() {
  const { W, H } = useFrame();
  const { theme, styleName } = usePlan();
  const frame = useCurrentFrame();
  const base = { overflow: 'hidden', background: `radial-gradient(circle at 50% 40%, ${theme.bgLight} 0%, ${theme.bg} 42%, ${theme.bgDeep} 100%)` };
  if (styleName === 'whiteboard') return <Board />;
  if (styleName === 'playful') {
    return (
      <AbsoluteFill style={base}>
        <div
          style={{
            position: 'absolute',
            left: W / 2 - 1500,
            top: H * 0.4 - 1500,
            width: 3000,
            height: 3000,
            transform: `rotate(${frame * 0.12}deg)`,
            background: 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.17) 0deg 7.5deg, rgba(255,255,255,0) 7.5deg 15deg)',
          }}
        />
        <Confetti colors={theme.wipe} />
        <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.16) 100%)' }} />
      </AbsoluteFill>
    );
  }
  if (styleName === 'elegant') {
    const x = 50 + 22 * Math.sin(frame / 140);
    return (
      <AbsoluteFill style={base}>
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 40% at ${x}% 22%, ${theme.accent}30 0%, transparent 70%)` }} />
        <div style={{ position: 'absolute', inset: 34, border: `1.5px solid ${theme.accent}66` }} />
        <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.45) 100%)' }} />
      </AbsoluteFill>
    );
  }
  if (styleName === 'bold') {
    return (
      <AbsoluteFill style={base}>
        <div
          style={{
            position: 'absolute',
            inset: -400,
            transform: `translateX(${(frame * 0.6) % 170}px)`,
            background: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.045) 0px 60px, rgba(255,255,255,0) 60px 170px)',
          }}
        />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 18, height: H, background: theme.accent }} />
      </AbsoluteFill>
    );
  }
  const drift = Math.sin(frame / 90) * 40;
  return (
    <AbsoluteFill style={{ ...base, background: `linear-gradient(160deg, ${theme.bgLight} 0%, ${theme.bg} 55%, ${theme.bgDeep} 100%)` }}>
      <div style={{ position: 'absolute', left: -260 + drift, top: 120, width: 820, height: 820, borderRadius: 999, background: `${theme.accent}14` }} />
      <div style={{ position: 'absolute', right: -320 - drift, bottom: 80, width: 980, height: 980, borderRadius: 999, background: `${theme.accent}0F` }} />
    </AbsoluteFill>
  );
}

function MediaBlurBg({ background }) {
  const { assets } = usePlan();
  const asset = assets[background.asset];
  return (
    <AbsoluteFill style={{ background: '#0d0d12', overflow: 'hidden' }}>
      {asset && (
        <AbsoluteFill style={{ transform: 'scale(1.25)', filter: 'blur(30px) brightness(0.42) saturate(1.5)' }}>
          <MediaFill asset={asset} block={{ zoom: [1, 1] }} duration={1} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

// Full-frame photo or clip under a dark gradient; blocks sit on top.
function MediaFullBg({ background, duration }) {
  const { landscape } = useFrame();
  const { assets, captions } = usePlan();
  const { start } = useContext(SceneTime);
  const asset = assets[background.asset];
  const block = {
    zoom: [1.02, 1.1],
    focus: background.focus,
    startFrom: background.startFrom,
    playbackRate: background.playbackRate,
    // `punches` come in video time; the clip counts frames from the start of its scene.
    punches: background.punches?.map((punch) => ({ frame: Math.round((punch.at - start) * FPS), scale: punch.scale })),
    punchFocus: background.punchFocus,
  };
  // A tall photo or clip cannot fill a wide frame without losing the subject:
  // it stands whole on the right, over a blurred copy of itself.
  if (landscape && asset?.portrait) {
    return (
      <AbsoluteFill style={{ background: '#0d0d12', overflow: 'hidden' }}>
        <AbsoluteFill style={{ transform: 'scale(1.2)', filter: 'blur(36px) brightness(0.4)' }}>
          <MediaFill asset={asset} block={{ ...block, zoom: [1, 1] }} duration={duration} />
        </AbsoluteFill>
        <div style={{ position: 'absolute', top: 50, bottom: captions ? 225 : 50, right: 150, aspectRatio: '9 / 16', borderRadius: 28, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
          <MediaFill asset={asset} block={{ ...block, zoom: [1, 1.04] }} duration={duration} />
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: '#0d0d12', overflow: 'hidden' }}>
      {asset && <MediaFill asset={asset} block={block} duration={duration} />}
      {/* With captions the headline sits at the top and the subject stays clear in the middle. */}
      <AbsoluteFill
        style={{
          background: captions
            ? 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.6) 78%, rgba(0,0,0,0.8) 100%)'
            : 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 100%)',
        }}
      />
    </AbsoluteFill>
  );
}

// Artwork across the top, fading into a panel that carries the blocks.
const PANEL_TOP = 705;
const SIDE_ART = 860; // horizontal: the artwork's share of the width

function ImageTopBg({ background, duration }) {
  const { W, H, landscape } = useFrame();
  const { assets, theme, look } = usePlan();
  const asset = assets[background.asset];
  const panel = look.panel || theme.bg;
  const art = asset && <MediaFill asset={asset} block={{ zoom: [1, 1.04], focus: background.focus || '50% 20%' }} duration={duration} />;
  if (landscape) {
    return (
      <AbsoluteFill style={{ background: panel, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: SIDE_ART, height: H, overflow: 'hidden' }}>{art}</div>
        <div style={{ position: 'absolute', top: 0, left: SIDE_ART - 140, width: 150, height: H, background: `linear-gradient(to right, ${panel}00 0%, ${panel} 80%)` }} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: panel, overflow: 'hidden' }}>
      {asset && <AbsoluteFill>{art}</AbsoluteFill>}
      <div
        style={{ position: 'absolute', top: PANEL_TOP - 105, left: 0, width: W, height: 110, background: `linear-gradient(to bottom, ${panel}00 0%, ${panel} 72%)` }}
      />
      <PopIn at={undefined} anim="up" style={{ position: 'absolute', top: PANEL_TOP, left: 0, width: W, height: H, background: panel }} />
    </AbsoluteFill>
  );
}

function Scene({ scene, index, first }) {
  const frameSize = useFrame();
  const { W, landscape } = frameSize;
  const { look, captions, assets } = usePlan();
  const duration = Math.round((scene.end - scene.start) * FPS);
  const type = scene.background?.type || 'brand';
  const surface =
    type === 'mediaBlur' || type === 'mediaFull' ? 'dark' : type === 'imageTop' ? (look.panel ? 'light' : 'dark') : type === 'drawing' ? 'light' : look.surface;
  // Until then the hand is drawing. In a tall frame the words stand under the drawing and the arm passes over
  // them, so they wait for it (except on the opening frame); in a wide frame they stand beside the drawing and
  // are written while the hand draws: half an empty board for three seconds looks unfinished.
  const handBusy = type === 'drawing' ? Math.round(drawSeconds(duration / FPS, landscape) * FPS) + 10 : 0;
  const holdFrames = type === 'drawing' && !first && !landscape ? handBusy : 0;
  const contact = scene.blocks.some((block) => block.type === 'highlight');
  const gap = scene.gap ?? 30;
  // A full-frame picture is darkened behind its text only: a shot without text stays as it is.
  const hasText = scene.blocks.length > 0;
  const render = (blocks) => blocks.map((block, i) => <Block key={i} block={block} duration={duration} />);

  let layout;
  if (type === 'drawing') {
    const box = drawingBox(frameSize, captions, ratioOf(assets[scene.background.asset]));
    layout = landscape ? (
      <Stack top={70} bottom={captions ? 215 : 70} left={box.x + box.w + 60} width={W - box.x - box.w - 60 - 70} gap={gap}>
        {render(scene.blocks)}
      </Stack>
    ) : (
      <Stack top={box.y + box.h + 40} bottom={captions ? 610 : 250} gap={gap}>
        {render(scene.blocks)}
      </Stack>
    );
  } else if (!landscape) {
    // Captions own the lower third, so the blocks end above them.
    const safe = { top: type === 'imageTop' ? PANEL_TOP - 75 : 190, bottom: captions ? 610 : 300, ...scene.safe };
    // A person talking keeps their face clear: the name tag and line sit as low as the captions allow.
    if (scene.speaker) safe.bottom = captions ? 600 : 330;
    layout = (
      // Over a full-frame photo the blocks sit low, on the dark end of the gradient.
      <Stack top={safe.top} bottom={safe.bottom} gap={gap} align={type === 'mediaFull' ? (captions && !scene.speaker ? 'flex-start' : 'flex-end') : 'center'} scrim={type === 'mediaFull' && !scene.speaker && hasText && (scene.shade || true)}>
        {render(scene.blocks)}
      </Stack>
    );
  } else {
    // Horizontal: no social buttons to avoid, only the caption strip at the bottom.
    const top = 70;
    const bottom = captions ? 215 : 70;
    const pictures = scene.blocks.filter((b) => b.type === 'media' || b.type === 'gallery');
    const words = scene.blocks.filter((b) => b.type !== 'media' && b.type !== 'gallery');
    if (type === 'mediaFull') {
      // The text stands in the lower left; a tall clip shown on the right leaves the left half free.
      const tall = assets[scene.background.asset]?.portrait;
      layout = (
        <Stack top={top} bottom={bottom + 20} left={tall ? 120 : 90} width={tall ? 1000 : 900} gap={gap} align={tall ? 'center' : 'flex-end'} scrim={!tall && hasText && (scene.shade || true)} scrimFrom="side">
          {render(scene.blocks)}
        </Stack>
      );
    } else if (type === 'imageTop') {
      layout = (
        <Stack top={top} bottom={bottom} left={SIDE_ART} width={W - SIDE_ART - 40} gap={gap}>
          {render(scene.blocks)}
        </Stack>
      );
    } else if (pictures.length && words.length) {
      // Picture on one side, words on the other; the sides alternate from scene to scene.
      const pictureLeft = index % 2 === 0;
      const half = W / 2;
      layout = (
        <>
          <Stack top={top} bottom={bottom} left={pictureLeft ? 30 : half} width={half - 30} gap={gap}>
            {render(pictures)}
          </Stack>
          <Stack top={top} bottom={bottom} left={pictureLeft ? half : 30} width={half - 30} gap={gap}>
            {render(words)}
          </Stack>
        </>
      );
    } else {
      layout = (
        <Stack top={top} bottom={bottom} left={(W - 1300) / 2} width={1300} gap={gap}>
          {render(scene.blocks)}
        </Stack>
      );
    }
  }

  return (
    <SceneTime.Provider value={{ start: scene.start, first, holdFrames, handBusy, contact }}>
      <Surface.Provider value={surface}>
        <AbsoluteFill>
          {type === 'mediaBlur' && <MediaBlurBg background={scene.background} />}
          {type === 'mediaFull' && <MediaFullBg background={scene.background} duration={duration} />}
          {type === 'imageTop' && <ImageTopBg background={scene.background} duration={duration} />}
          {type === 'drawing' && <DrawingBg background={scene.background} duration={duration} first={first} />}
          {(type === 'brand' || type === 'burst') && <BrandBg />}
          {layout}
          {type === 'drawing' && <DrawingHand background={scene.background} duration={duration} first={first} />}
        </AbsoluteFill>
      </Surface.Provider>
    </SceneTime.Provider>
  );
}

// The cut happens while the transition covers the frame.
function Transition({ at }) {
  const { W, H } = useFrame();
  const { theme, look } = usePlan();
  const frame = useCurrentFrame();
  const kind = look.transition;
  const D = kind === 'dip' ? 26 : kind === 'fade' ? 18 : kind === 'erase' ? 20 : 16;
  const p = (frame - (at - D / 2)) / D;
  if (p <= 0 || p >= 1) return null;
  if (kind === 'erase') {
    // A clean board sweeps in from the left, then the next scene is uncovered the same way.
    const left = interpolate(Easing.inOut(Easing.quad)(p), [0, 0.5, 1], [-W - 120, 0, W + 120]);
    return (
      <AbsoluteFill style={{ zIndex: 100, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left, width: W, height: H, background: theme.bg, boxShadow: `0 0 90px 70px ${theme.bg}` }} />
      </AbsoluteFill>
    );
  }
  if (kind === 'dip' || kind === 'fade') {
    const opacity = interpolate(p, [0, 0.5, 1], [0, 1, 0]);
    return <AbsoluteFill style={{ zIndex: 100, background: kind === 'dip' ? theme.bgDeep : '#FFFFFF', opacity }} />;
  }
  const bands = kind === 'block' ? [theme.accent, '#FFFFFF', theme.accent] : theme.wipe;
  const panelW = W * 2.4;
  const x = interpolate(Easing.inOut(Easing.quad)(p), [0, 1], [W + 200, -panelW - 200]);
  return (
    <AbsoluteFill style={{ zIndex: 100, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -200, left: x, width: panelW, height: H + 400, display: 'flex', transform: 'skewX(-14deg)' }}>
        {bands.map((c, i) => (
          <div key={i} style={{ flex: kind === 'block' && i === 1 ? 0.08 : 1, background: c }} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

// ---------- captions ----------
// Word-by-word captions in the lower third, two or three words at a time,
// with the spoken word lit up. `words` are already on the video timeline.
function chunkWords(words) {
  const chunks = [];
  let current = [];
  words.forEach((word, i) => {
    current.push(word);
    const chars = current.reduce((n, w) => n + w.text.length + 1, 0);
    const next = words[i + 1];
    const pause = next ? next.start - word.end > 0.45 : true;
    if (current.length >= 3 || chars > 15 || /[.,!?;:]$/.test(word.text) || pause) {
      chunks.push(current);
      current = [];
    }
  });
  if (current.length) chunks.push(current);
  return chunks;
}

function Captions({ words, cuts = [] }) {
  const { W, H, landscape } = useFrame();
  const { theme, look, styleName } = usePlan();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const chunks = React.useMemo(() => chunkWords(words), [words]);
  const index = chunks.findIndex((chunk, i) => {
    const last = chunk[chunk.length - 1];
    const end = chunks[i + 1] ? chunks[i + 1][0].start : last.end + 0.5;
    // On a plain cut the words of the old shot leave with it instead of hanging on over the new one.
    const cut = cuts.find((at) => at > last.start + 0.25) ?? Infinity;
    return t >= chunk[0].start - 0.04 && t < Math.min(end, last.end + 0.7, cut);
  });
  if (index < 0) return null;
  const chunk = chunks[index];
  const pop = spring({ frame: frame - Math.round(chunk[0].start * FPS), fps: FPS, config: { damping: 14, stiffness: 240, mass: 0.5 } });
  const lit = styleName === 'playful' ? theme.bg : styleName === 'elegant' ? theme.accent : styleName === 'bold' ? theme.accent : '#FFD84D';
  const size = { playful: 84, bold: 98, clean: 72, elegant: 62, whiteboard: 76 }[styleName];
  const strip = styleName === 'whiteboard';
  return (
    <div style={{ position: 'absolute', left: 0, width: W, top: landscape ? H - 200 : 1335, height: landscape ? 160 : 250, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          display: 'flex',
          gap: size * 0.26,
          transform: `scale(${interpolate(pop, [0, 1], [0.86, 1])})`,
          fontFamily: `${look.fonts.title[0]}, ${EMOJI}`,
          fontWeight: styleName === 'elegant' ? 600 : look.title.weight,
          fontStyle: styleName === 'elegant' ? 'italic' : 'normal',
          fontSize: size,
          lineHeight: 1.1,
          textTransform: look.title.upper ? 'uppercase' : 'none',
          WebkitTextStroke: styleName === 'elegant' || strip ? '0' : `${Math.round(size * 0.16)}px rgba(10,10,14,0.92)`,
          paintOrder: 'stroke fill',
          textShadow: strip ? 'none' : '0 6px 22px rgba(0,0,0,0.55)',
          whiteSpace: 'nowrap',
          ...(strip ? { background: 'rgba(31,36,48,0.92)', padding: '6px 30px 10px', borderRadius: 18 } : {}),
        }}
      >
        {chunk.map((word, i) => (
          <span key={i} style={{ color: t >= word.start - 0.03 && t < word.end + 0.12 ? lit : '#FFFFFF' }}>
            {word.text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- audio ----------
// Sound effects follow the visuals by construction: a pop per list item, a
// whoosh per transition, a cha-ching when a number lands, a ding on badges
// and highlights. The plan only adds the one-off sounds (e.g. a whistle).
function autoSfx(scenes, landscape) {
  const out = [];
  scenes.forEach((scene, i) => {
    if (i > 0 && !scene.cut) out.push({ name: 'whoosh', at: scene.start - 0.3 });
    if (scene.background?.type === 'drawing') {
      const seconds = drawSeconds(scene.end - scene.start, landscape);
      // The marker's strokes, for as long as the hand draws; the hand moves in their rhythm (see MARKER_ENV).
      out.push({ name: 'marker', at: scene.start + DRAW_START / FPS, frames: Math.round(seconds * FPS) });
    }
    // What the hand does after drawing (a push, an underline) waits until the drawing is done, and so does its sound.
    const held = scene.background?.type === 'drawing' ? scene.start + drawSeconds(scene.end - scene.start, landscape) + 10 / FPS : scene.start;
    scene.blocks.forEach((block) => {
      if (block.underlineAt !== undefined) out.push({ name: 'underline', at: Math.max(block.underlineAt, held), frames: 10, startFrom: UNDERLINE_STROKE });
      if (block.push) out.push({ name: 'push', at: Math.max(block.at ?? scene.start, held) });
      if (['chips', 'tiles', 'rows'].includes(block.type)) block.items.forEach((item) => out.push({ name: 'pop', at: item.at ?? block.at ?? scene.start }));
      if (block.type === 'number') out.push({ name: 'chaching', at: (block.at ?? scene.start) + 0.55 });
      if (block.type === 'badge' || block.type === 'highlight') out.push({ name: 'ding', at: block.at ?? scene.start });
      if (block.footerPill) out.push({ name: 'pop', at: block.footerPill.at ?? block.at ?? scene.start });
    });
  });
  return out;
}

// `fadeEnd` (seconds): where the music finishes fading out when an end card follows the video; the looping music
// carries over the card. Without it the music fades out at `duration`, as always.
function Soundtrack({ audio = {}, scenes, duration, fadeEnd }) {
  const { look } = usePlan();
  const { landscape } = useFrame();
  const { voice, music } = audio;
  const cuts = voice?.cuts || (voice ? [{ at: 0, srcStart: 0, srcEnd: duration }] : []);
  const auto = audio.autoSfx === false ? [] : autoSfx(scenes, landscape).map((s) => ({ ...s, volume: SFX_VOLUME[s.name] * (look.sfx[s.name] ?? (WHITEBOARD_ONLY.includes(s.name) ? 0 : 1)) }));
  const sfx = [...auto, ...(audio.sfx || [])].filter((s) => Number.isFinite(s.at) && (s.volume === undefined || s.volume > 0));
  const bed = music?.volume ?? 0.14;
  const tail = music?.tailVolume ?? 0.4;
  const end = duration * FPS;
  const liftAt = Math.min((music?.liftAt ?? duration - 4) * FPS, end - 90);
  const fade = (fadeEnd ?? duration) * FPS;
  // Low under the voice, lifts after the last word, fades out over the final 2 s.
  const envelope = (frame) =>
    interpolate(frame, [0, 5, liftAt, liftAt + 24, fade - 60, fade], [0, bed, bed, tail, tail, 0], clamp);
  return (
    <>
      {cuts.map((cut, i) => (
        <Sequence key={`v${i}`} from={Math.round(cut.at * FPS)} durationInFrames={Math.max(1, Math.round((cut.srcEnd - cut.srcStart) * FPS))}>
          {/* A cut can come from the narrator's recording or from a clip in which a person talks. */}
          <Audio
            src={src(cut.url || voice.url)}
            volume={cut.volume ?? voice.volume ?? 1.12}
            startFrom={Math.round(cut.srcStart * FPS)}
            endAt={Math.round(cut.srcEnd * FPS)}
          />
        </Sequence>
      ))}
      {music?.url && <Audio src={src(music.url)} volume={envelope} loop />}
      {sfx.map((s, i) => (
        <Sequence key={`s${i}`} from={Math.max(0, Math.round(s.at * FPS))} durationInFrames={s.frames || 60}>
          <Audio
            src={src(s.url || `smart-video/sfx/${SFX_FILE[s.name] || s.name}.mp3`)}
            startFrom={s.startFrom || 0}
            // A sound with a set length (the marker while the hand draws) comes in and goes out softly.
            volume={s.frames ? (f) => interpolate(f, [0, Math.min(4, s.frames / 4), s.frames - Math.min(8, s.frames / 3), s.frames], [0, 1, 1, 0], clamp) * (s.volume ?? SFX_VOLUME[s.name] ?? 0.3) : (s.volume ?? SFX_VOLUME[s.name] ?? 0.3)}
          />
        </Sequence>
      ))}
    </>
  );
}

// ---------- watermark ----------
// The free video ad's watermark: the BlueFX mark and name, big and see-through in the middle of the frame for the
// whole video (it stops where the end card starts). It sits above the drawing hand (20), the captions (50) and the
// transitions (100), so no full-frame photo or crop can hide it, and stays transparent enough that the video ad
// underneath still reads. The soft dark shadow keeps the white name visible on the whiteboard's light paper too.
function CenterWatermark({ until, label }) {
  const frame = useCurrentFrame();
  const { W, landscape } = useFrame();
  if (frame >= until) return null;
  const width = Math.round(W * (landscape ? 0.34 : 0.58));
  const logo = Math.round(width * 0.34);
  return (
    <AbsoluteFill style={{ zIndex: 110, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          width,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: Math.round(width * 0.035),
          opacity: 0.42,
          filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.55))',
        }}
      >
        <Img src={staticFile(BRAND_LOGO)} style={{ width: logo, height: logo }} />
        <span style={{ fontFamily: `${BRAND_FONT[0]}, sans-serif`, fontWeight: 800, fontSize: Math.round(width * 0.25), lineHeight: 1, color: '#FFFFFF', whiteSpace: 'nowrap', letterSpacing: 2 }}>
          {label}
        </span>
      </div>
    </AbsoluteFill>
  );
}

// The closing card in BlueFX's own colours. No transition and no sound: the music carries over it and fades out.
function EndCard() {
  const frame = useCurrentFrame();
  const { landscape } = useFrame();
  const logo = landscape ? 160 : 220;
  const grow = interpolate(frame, [0, 8], [0.85, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill
      style={{
        zIndex: 120,
        opacity: interpolate(frame, [0, END_CARD_FADE], [0, 1], clamp),
        // Night blue with a soft deep-blue glow behind the logo: on a mostly deep-blue card the blue logo and name sank in.
        background: `radial-gradient(circle at 50% 43%, ${BRAND.deep}A6 0%, ${BRAND.deep}00 58%), ${BRAND.night}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: `${BRAND_FONT[0]}, sans-serif`,
      }}
    >
      <Img src={staticFile(BRAND_LOGO)} style={{ width: logo, height: logo, transform: `scale(${grow})` }} />
      <div style={{ marginTop: landscape ? 22 : 34, fontWeight: 600, fontSize: 52, lineHeight: 1.1, color: LIGHT_TEXT }}>Made with</div>
      <div style={{ fontWeight: 800, fontSize: 112, lineHeight: 1.05, color: BRAND.blue }}>BlueFX</div>
    </AbsoluteFill>
  );
}

// ---------- composition ----------
/**
 * Props: the plan (scenes, format, style, theme, assets, audio, captions, duration) plus
 * @param {{ label?: string; endCardSeconds?: number }} [watermark] Optional BlueFX branding: a big see-through mark in the middle and,
 *   when endCardSeconds > 0, an end card that adds endCardSeconds to the video. Left out (the default), the render
 *   is exactly what it was before the prop existed.
 */
export const SmartVideo = ({ scenes = [], format = 'vertical', style = 'playful', theme, assets = {}, audio, captions, duration, watermark }) => {
  const frameSize = FRAMES[format] || FRAMES.vertical;
  const styleName = STYLES[style] ? style : 'playful';
  const look = STYLES[styleName];
  const endSeconds = endCardSecondsOf(watermark);
  const ready = useFonts(look, Boolean(watermark));
  const { durationInFrames } = useVideoConfig();
  // The video itself; the end card (if any) comes after it.
  const total = duration || durationInFrames / FPS - endSeconds;
  const endAt = Math.round(total * FPS);
  const cardFrom = Math.max(0, endAt - END_CARD_FADE);
  const merged = { ...look.theme, ...theme };
  const plan = {
    styleName,
    look,
    assets,
    captions: Boolean(captions?.words?.length),
    theme: { ...merged, wipe: merged.wipe || [merged.accent, NAMED.orange, '#FFD21F', NAMED.green, NAMED.blue, NAMED.purple] },
  };
  return (
    <Frame.Provider value={frameSize}>
    <Plan.Provider value={plan}>
      <AbsoluteFill style={{ background: plan.theme.bg }}>
        {ready &&
          scenes.map((scene, i) => (
            <Sequence key={i} from={Math.round(scene.start * FPS)} durationInFrames={Math.max(1, Math.round((scene.end - scene.start) * FPS))}>
              <Scene scene={scene} index={i} first={i === 0} />
            </Sequence>
          ))}
        {/* `cut`: the scene starts on a plain cut, as footage does; every other scene change is covered by the look's transition. */}
        {scenes.slice(1).map((scene, i) => (scene.cut ? null : <Transition key={i} at={Math.round(scene.start * FPS)} />))}
        {ready && captions?.words?.length > 0 && <Captions words={captions.words} cuts={scenes.filter((scene) => scene.cut).map((scene) => scene.start)} />}
        {ready && watermark && <CenterWatermark until={endSeconds > 0 ? endAt : Infinity} label={watermark.label || 'BlueFX'} />}
        {/* The card runs to the composition's last frame, so rounding can never leave a blank frame after it. */}
        {ready && endSeconds > 0 && (
          <Sequence from={cardFrom} durationInFrames={Math.max(1, durationInFrames - cardFrom)}>
            <EndCard />
          </Sequence>
        )}
        <Soundtrack audio={audio} scenes={scenes} duration={total} fadeEnd={endSeconds > 0 ? total + endSeconds : undefined} />
      </AbsoluteFill>
    </Plan.Provider>
    </Frame.Provider>
  );
};

export const smartVideoMetadata = ({ props }) => ({
  durationInFrames: Math.max(1, Math.ceil(((props.duration || 10) + endCardSecondsOf(props.watermark)) * FPS)),
  fps: FPS,
  width: (FRAMES[props.format] || FRAMES.vertical).W,
  height: (FRAMES[props.format] || FRAMES.vertical).H,
});
