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
 * lands with the voice. `style` picks one of four looks (playful, elegant,
 * bold, clean) that change fonts, title treatment, backgrounds, cards, motion,
 * transitions and sounds; `theme` carries the brand colours.
 *
 * Layout is by construction: text shrinks to fit the frame width and a stack
 * taller than the safe area is scaled down, so a plan can never produce
 * overlapping or cut-off text.
 */

const FPS = 30;
const W = 1080;
const H = 1920;
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
};
const SFX_VOLUME = { pop: 0.25, whoosh: 0.35, ding: 0.3, chaching: 0.35, whistle: 0.55 };

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
function useFonts(look) {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('SmartVideo fonts'));
  useEffect(() => {
    const wanted = [look.fonts.title, look.fonts.body].filter((f, i, all) => all.findIndex((g) => g[0] === f[0]) === i);
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
  }, [handle, look]);
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

function Stack({ top, bottom, gap, align = 'center', scrim = false, children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  const available = H - top - bottom;
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight;
    const w = ref.current?.offsetWidth;
    if (!h || !w) return;
    // Shrinks a stack that is too tall; grows a small one (up to 22%) so it fills a phone screen.
    const target = Math.min(1.22, (available * 0.94) / h, (W - 2 * 34) / w);
    if (Math.abs(target - scale) > 0.005) setScale(target);
  });
  return (
    <div
      style={{ position: 'absolute', top, left: 0, width: W, height: available, display: 'flex', alignItems: align, justifyContent: 'center' }}
    >
      <div
        ref={ref}
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: align === 'flex-end' ? 'center bottom' : align === 'flex-start' ? 'center top' : 'center' }}
      >
        {/* Over a photo, the darkness follows the text: it starts just above the stack (or ends just below it)
            and leaves the rest of the picture alone. */}
        {scrim && (
          <div
            style={{
              position: 'absolute',
              zIndex: -1,
              left: -2000,
              right: -2000,
              top: align === 'flex-start' ? -2000 : -170,
              bottom: align === 'flex-start' ? -170 : -2000,
              background:
                align === 'flex-start'
                  ? 'linear-gradient(to top, rgba(0,0,0,0) 0px, rgba(0,0,0,0.62) 190px, rgba(0,0,0,0.74) 100%)'
                  : 'linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0.62) 190px, rgba(0,0,0,0.74) 100%)',
            }}
          />
        )}
        {children}
      </div>
    </div>
  );
}

// ---------- motion ----------
const SceneTime = createContext({ start: 0, first: false });

// Scene-local frame for an absolute time. Blocks due at the very start of the
// first scene are already settled on frame 0 (it doubles as the thumbnail).
function useLocalFrame(at) {
  const { start, first } = useContext(SceneTime);
  const local = Math.round(((at ?? start) - start) * FPS);
  if (local <= 0) return first ? -40 : 0;
  return local;
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
  const move = calm ? moves.rise : moves[anim] || moves.pop;
  return <div style={{ opacity, transform: `${move} rotate(${look.rotate ? rotate : 0}deg)`, ...style }}>{children}</div>;
}

// ---------- blocks ----------
const TITLE_SIZE = { xl: 150, l: 110, m: 92, s: 72 };
const TITLE_CHARS = { xl: 11, l: 15, m: 18, s: 24 };

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
  const fill = tone === 'accent' || tone === 'brand' ? theme.accent : textColor;
  if (kind === 'serif') {
    return { outer: { color: fill, lineHeight: 1.16, letterSpacing: '0.005em', fontStyle: tone === 'accent' ? 'italic' : 'normal', textShadow: '0 6px 30px rgba(0,0,0,0.35)' } };
  }
  return { outer: { color: fill, lineHeight: 1.12, letterSpacing: '-0.02em', textShadow: textColor === LIGHT_TEXT ? '0 4px 24px rgba(0,0,0,0.55)' : 'none' } };
}

function Title({ block }) {
  const { theme, look } = usePlan();
  const textColor = useTextColor();
  const base = Math.round((TITLE_SIZE[block.size] || TITLE_SIZE.l) * look.title.scale);
  const probe = titlePaint(look, theme, block.tone, base, textColor);
  const [ref, size] = useFit(base, W - 2 * SIDE - Math.round(base * 0.22) - (probe.inset || 0));
  const paint = titlePaint(look, theme, block.tone, size, textColor);
  const chars = Math.round((TITLE_CHARS[block.size] || TITLE_CHARS.l) * look.title.chars);
  const text = autoBreak(block.text, chars);
  const line = (content) => (paint.inner ? <span style={paint.inner}>{content}</span> : content);
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
        ...paint.outer,
      }}
    >
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
  const value = p >= 1 ? block.value : Math.round((block.value * p) / step) * step;
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
  const [ref, size] = useFit(base, W - 2 * SIDE - 90);
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
  const [ref, size] = useFit(Math.round(80 * look.title.scale), W - 2 * SIDE - 130);
  const playful = look.title.kind === 'sticker';
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
  const [ref, size] = useFit(60, W - 2 * SIDE - 120);
  const pulse = 1 + 0.025 * Math.sin(Math.max(0, frame - from - 18) / 7);
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
  const [ref, size] = useFit(50, W - 2 * SIDE - 190);
  const chip = look.chip;
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
  const w = Math.min(260, Math.floor((W - 2 * SIDE - gap * (n - 1)) / n));
  const k = w / 212;
  return (
    <div style={{ display: 'flex', gap }}>
      {block.items.map((item, i) => {
        const fill = color(theme, item.color, theme.accent);
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
  const { look } = usePlan();
  const textColor = useTextColor();
  const [ref, size] = useFit(50, 820 - 80);
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
      <div style={{ fontFamily: look.fonts.body[0], fontWeight: 600, fontSize: 46, lineHeight: 1.3, color: '#1C1B22' }}>{block.text}</div>
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
      <div style={frameStyle(i)}>
        <div style={{ width: '100%', height: '100%', borderRadius: Math.max(0, look.card.radius - look.card.pad), overflow: 'hidden' }}>
          <MediaFill asset={item} block={{ zoom: [1.02, 1.1] }} duration={duration} />
        </div>
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

function MediaFill({ asset, block, duration }) {
  const frame = useCurrentFrame();
  const focus = block.focus || '50% 50%';
  if (asset.kind === 'video') {
    return (
      <OffthreadVideo
        src={src(asset.url)}
        startFrom={Math.round((block.startFrom || 0) * FPS)}
        playbackRate={block.playbackRate || 1}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: focus }}
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
  const [w, h] = CARD[block.shape] || CARD.wide;
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
      </div>
      {block.cornerTag && (
        <div style={{ position: 'absolute', top: -42, right: -10 }}>
          <PopIn at={block.cornerTag.at} rotate={8}>
            <Pill block={{ text: block.cornerTag.text, tone: 'brand', size: 'l' }} />
          </PopIn>
        </div>
      )}
      {block.footerPill && (
        <div style={{ position: 'absolute', bottom: -44, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <PopIn at={block.footerPill.at} anim="stamp" rotate={-2}>
            <Pill block={{ text: block.footerPill.text, tone: 'accent', size: 'l' }} />
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
    <div style={{ fontFamily: look.fonts.body[0], fontWeight: Math.min(look.bodyWeight, 800), fontSize: 46, color: dark ? 'rgba(247,243,234,0.7)' : '#5B5866' }}>
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
  const def = BLOCKS[block.type];
  if (!def) return null;
  const body = <def.Component block={block} duration={duration} />;
  if (def.group) return body;
  return (
    <PopIn at={block.at} anim={block.anim || def.anim} rotate={block.rotate ?? def.rotate ?? 0}>
      {body}
    </PopIn>
  );
}

// ---------- backgrounds ----------
function Confetti({ colors }) {
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

function BrandBg() {
  const { theme, styleName } = usePlan();
  const frame = useCurrentFrame();
  const base = { overflow: 'hidden', background: `radial-gradient(circle at 50% 40%, ${theme.bgLight} 0%, ${theme.bg} 42%, ${theme.bgDeep} 100%)` };
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
  const { assets, captions } = usePlan();
  const asset = assets[background.asset];
  return (
    <AbsoluteFill style={{ background: '#0d0d12', overflow: 'hidden' }}>
      {asset && <MediaFill asset={asset} block={{ zoom: [1.02, 1.1], focus: background.focus, startFrom: background.startFrom, playbackRate: background.playbackRate }} duration={duration} />}
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

function ImageTopBg({ background, duration }) {
  const { assets, theme, look } = usePlan();
  const asset = assets[background.asset];
  const panel = look.panel || theme.bg;
  return (
    <AbsoluteFill style={{ background: panel, overflow: 'hidden' }}>
      {asset && (
        <AbsoluteFill>
          <MediaFill asset={asset} block={{ zoom: [1, 1.04], focus: background.focus || '50% 20%' }} duration={duration} />
        </AbsoluteFill>
      )}
      <div
        style={{ position: 'absolute', top: PANEL_TOP - 105, left: 0, width: W, height: 110, background: `linear-gradient(to bottom, ${panel}00 0%, ${panel} 72%)` }}
      />
      <PopIn at={undefined} anim="up" style={{ position: 'absolute', top: PANEL_TOP, left: 0, width: W, height: H, background: panel }} />
    </AbsoluteFill>
  );
}

function Scene({ scene, first }) {
  const { look, captions } = usePlan();
  const duration = Math.round((scene.end - scene.start) * FPS);
  const type = scene.background?.type || 'brand';
  // Captions own the lower third, so the blocks end above them.
  const safe = { top: type === 'imageTop' ? PANEL_TOP - 75 : 190, bottom: captions ? 610 : 300, ...scene.safe };
  const surface =
    type === 'mediaBlur' || type === 'mediaFull' ? 'dark' : type === 'imageTop' ? (look.panel ? 'light' : 'dark') : look.surface;
  return (
    <SceneTime.Provider value={{ start: scene.start, first }}>
      <Surface.Provider value={surface}>
        <AbsoluteFill>
          {type === 'mediaBlur' && <MediaBlurBg background={scene.background} />}
          {type === 'mediaFull' && <MediaFullBg background={scene.background} duration={duration} />}
          {type === 'imageTop' && <ImageTopBg background={scene.background} duration={duration} />}
          {(type === 'brand' || type === 'burst') && <BrandBg />}
          {/* Over a full-frame photo the blocks sit low, on the dark end of the gradient. */}
          <Stack top={safe.top} bottom={safe.bottom} gap={scene.gap ?? 30} align={type === 'mediaFull' ? (captions ? 'flex-start' : 'flex-end') : 'center'} scrim={type === 'mediaFull'}>
            {scene.blocks.map((block, i) => (
              <Block key={i} block={block} duration={duration} />
            ))}
          </Stack>
        </AbsoluteFill>
      </Surface.Provider>
    </SceneTime.Provider>
  );
}

// The cut happens while the transition covers the frame.
function Transition({ at }) {
  const { theme, look } = usePlan();
  const frame = useCurrentFrame();
  const kind = look.transition;
  const D = kind === 'dip' ? 26 : kind === 'fade' ? 18 : 16;
  const p = (frame - (at - D / 2)) / D;
  if (p <= 0 || p >= 1) return null;
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

function Captions({ words }) {
  const { theme, look, styleName } = usePlan();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const chunks = React.useMemo(() => chunkWords(words), [words]);
  const index = chunks.findIndex((chunk, i) => {
    const end = chunks[i + 1] ? chunks[i + 1][0].start : chunk[chunk.length - 1].end + 0.5;
    return t >= chunk[0].start - 0.04 && t < Math.min(end, chunk[chunk.length - 1].end + 0.7);
  });
  if (index < 0) return null;
  const chunk = chunks[index];
  const pop = spring({ frame: frame - Math.round(chunk[0].start * FPS), fps: FPS, config: { damping: 14, stiffness: 240, mass: 0.5 } });
  const lit = styleName === 'playful' ? theme.bg : styleName === 'elegant' ? theme.accent : styleName === 'bold' ? theme.accent : '#FFD84D';
  const size = { playful: 84, bold: 98, clean: 72, elegant: 62 }[styleName];
  return (
    <div style={{ position: 'absolute', left: 0, width: W, top: 1335, height: 250, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          WebkitTextStroke: styleName === 'elegant' ? '0' : `${Math.round(size * 0.16)}px rgba(10,10,14,0.92)`,
          paintOrder: 'stroke fill',
          textShadow: '0 6px 22px rgba(0,0,0,0.55)',
          whiteSpace: 'nowrap',
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
function autoSfx(scenes) {
  const out = [];
  scenes.forEach((scene, i) => {
    if (i > 0) out.push({ name: 'whoosh', at: scene.start - 0.3 });
    scene.blocks.forEach((block) => {
      if (['chips', 'tiles', 'rows'].includes(block.type)) block.items.forEach((item) => out.push({ name: 'pop', at: item.at ?? block.at ?? scene.start }));
      if (block.type === 'number') out.push({ name: 'chaching', at: (block.at ?? scene.start) + 0.55 });
      if (block.type === 'badge' || block.type === 'highlight') out.push({ name: 'ding', at: block.at ?? scene.start });
      if (block.footerPill) out.push({ name: 'pop', at: block.footerPill.at });
    });
  });
  return out;
}

function Soundtrack({ audio = {}, scenes, duration }) {
  const { look } = usePlan();
  const { voice, music } = audio;
  const cuts = voice?.cuts || (voice ? [{ at: 0, srcStart: 0, srcEnd: duration }] : []);
  const auto = audio.autoSfx === false ? [] : autoSfx(scenes).map((s) => ({ ...s, volume: SFX_VOLUME[s.name] * (look.sfx[s.name] ?? 1) }));
  const sfx = [...auto, ...(audio.sfx || [])].filter((s) => s.volume === undefined || s.volume > 0);
  const bed = music?.volume ?? 0.14;
  const tail = music?.tailVolume ?? 0.4;
  const end = duration * FPS;
  const liftAt = Math.min((music?.liftAt ?? duration - 4) * FPS, end - 90);
  // Low under the voice, lifts after the last word, fades out over the final 2 s.
  const envelope = (frame) =>
    interpolate(frame, [0, 5, liftAt, liftAt + 24, end - 60, end], [0, bed, bed, tail, tail, 0], clamp);
  return (
    <>
      {cuts.map((cut, i) => (
        <Sequence key={`v${i}`} from={Math.round(cut.at * FPS)} durationInFrames={Math.max(1, Math.round((cut.srcEnd - cut.srcStart) * FPS))}>
          <Audio src={src(voice.url)} volume={voice.volume ?? 1.12} startFrom={Math.round(cut.srcStart * FPS)} endAt={Math.round(cut.srcEnd * FPS)} />
        </Sequence>
      ))}
      {music?.url && <Audio src={src(music.url)} volume={envelope} loop />}
      {sfx.map((s, i) => (
        <Sequence key={`s${i}`} from={Math.max(0, Math.round(s.at * FPS))} durationInFrames={60}>
          <Audio src={src(s.url || `smart-video/sfx/${s.name}.mp3`)} volume={s.volume ?? SFX_VOLUME[s.name] ?? 0.3} />
        </Sequence>
      ))}
    </>
  );
}

// ---------- composition ----------
export const SmartVideo = ({ scenes = [], style = 'playful', theme, assets = {}, audio, captions, duration }) => {
  const styleName = STYLES[style] ? style : 'playful';
  const look = STYLES[styleName];
  const ready = useFonts(look);
  const { durationInFrames } = useVideoConfig();
  const total = duration || durationInFrames / FPS;
  const merged = { ...look.theme, ...theme };
  const plan = {
    styleName,
    look,
    assets,
    captions: Boolean(captions?.words?.length),
    theme: { ...merged, wipe: merged.wipe || [merged.accent, NAMED.orange, '#FFD21F', NAMED.green, NAMED.blue, NAMED.purple] },
  };
  return (
    <Plan.Provider value={plan}>
      <AbsoluteFill style={{ background: plan.theme.bg }}>
        {ready &&
          scenes.map((scene, i) => (
            <Sequence key={i} from={Math.round(scene.start * FPS)} durationInFrames={Math.max(1, Math.round((scene.end - scene.start) * FPS))}>
              <Scene scene={scene} first={i === 0} />
            </Sequence>
          ))}
        {scenes.slice(1).map((scene, i) => (
          <Transition key={i} at={Math.round(scene.start * FPS)} />
        ))}
        {ready && captions?.words?.length > 0 && <Captions words={captions.words} />}
        <Soundtrack audio={audio} scenes={scenes} duration={total} />
      </AbsoluteFill>
    </Plan.Provider>
  );
};

export const smartVideoMetadata = ({ props }) => ({
  durationInFrames: Math.max(1, Math.ceil((props.duration || 10) * FPS)),
  fps: FPS,
  width: W,
  height: H,
});
