import sharp from 'sharp';

/** Smart Video — brand helpers: logo cut-out and colour maths. */

/**
 * Removes a flat background colour (taken from the corners) from a logo,
 * un-mixes it from the soft edge pixels and trims to the mark.
 */
export async function cutOutLogo(image: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const at = (x: number, y: number) => (y * width + x) * 4;
  const corners = [at(2, 2), at(width - 3, 2), at(2, height - 3), at(width - 3, height - 3)];
  const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((sum, p) => sum + data[p + c], 0) / corners.length));
  const spread = Math.max(...corners.map((p) => Math.hypot(data[p] - bg[0], data[p + 1] - bg[1], data[p + 2] - bg[2])));
  if (spread > 24 || corners.some((p) => data[p + 3] < 250)) return image; // not a flat background

  const NEAR = 28;
  const FAR = 95;
  for (let p = 0; p < data.length; p += 4) {
    const distance = Math.hypot(data[p] - bg[0], data[p + 1] - bg[1], data[p + 2] - bg[2]);
    const alpha = Math.min(1, Math.max(0, (distance - NEAR) / (FAR - NEAR)));
    if (alpha > 0 && alpha < 1) {
      for (let c = 0; c < 3; c++) data[p + c] = Math.min(255, Math.max(0, (data[p + c] - (1 - alpha) * bg[c]) / alpha));
    }
    data[p + 3] = Math.round(alpha * 255);
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer();
}

/** Flat background colour (when the corners agree) and the dominant saturated colours of an image. */
export async function analyzeColors(image: Buffer): Promise<{ flatBackground?: string; palette: string[] }> {
  const { data, info } = await sharp(image).flatten({ background: '#ffffff' }).resize(64, 64, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => [0, 1, 2].map((c) => data[(y * info.width + x) * info.channels + c]);
  const corners = [px(1, 1), px(62, 1), px(1, 62), px(62, 62)];
  const flat = corners.every((c) => Math.hypot(c[0] - corners[0][0], c[1] - corners[0][1], c[2] - corners[0][2]) < 24);
  const bins = new Map<string, { count: number; sum: number[] }>();
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const rgb = px(x, y);
      const max = Math.max(...rgb);
      const min = Math.min(...rgb);
      if (max - min < 70) continue; // greys, whites, blacks
      const key = rgb.map((v) => v >> 5).join(',');
      const bin = bins.get(key) || { count: 0, sum: [0, 0, 0] };
      bin.count++;
      rgb.forEach((v, c) => (bin.sum[c] += v));
      bins.set(key, bin);
    }
  }
  const palette = [...bins.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .filter((bin) => bin.count > 40)
    .map((bin) => toHex(bin.sum.map((v) => v / bin.count)));
  return { flatBackground: flat ? toHex(corners[0]) : undefined, palette };
}

/** Crops a photo to the full video frame around its subject (`focus` is a CSS object-position like "60% 40%"). */
export async function cropToFrame(image: Buffer, focus: string | null | undefined, horizontal: boolean): Promise<Buffer> {
  const W = horizontal ? 1920 : 1080;
  const H = horizontal ? 1080 : 1920;
  const [fx, fy] = (focus || '50% 50%').split(/\s+/).map((v) => Math.min(1, Math.max(0, parseFloat(v) / 100 || 0.5)));
  const meta = await sharp(image).metadata();
  const scale = Math.max(W / (meta.width || W), H / (meta.height || H));
  const width = Math.ceil((meta.width || W) * scale);
  const height = Math.ceil((meta.height || H) * scale);
  return sharp(image)
    .resize(width, height)
    .extract({ left: Math.round((width - W) * fx), top: Math.round((height - H) * (fy ?? 0.5)), width: W, height: H })
    .jpeg({ quality: 92 })
    .toBuffer();
}

const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

const saturation = (hex: string) => {
  const rgb = parse(hex);
  return (Math.max(...rgb) - Math.min(...rgb)) / 255;
};

export const luminance = (hex: string) => {
  const [r, g, b] = parse(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const mix = (hex: string, target: number, amount: number) => toHex(parse(hex).map((v) => v + (target - v) * amount));

/**
 * The director proposes bg/accent; the rest of the palette is derived, and a
 * proposal that would break legibility for the style is dropped.
 */
export function buildTheme(style: string, proposed?: { bg?: string | null; accent?: string | null } | null) {
  const theme: Record<string, string> = {};
  const darkStyle = style === 'elegant' || style === 'bold';
  // playful lives on a bright, colourful background: a white or cream one looks empty.
  const colourful = style !== 'playful' || (isHex(proposed?.bg) && saturation(proposed.bg) > 0.4);
  if (isHex(proposed?.bg) && colourful && (darkStyle ? luminance(proposed.bg) < 0.22 : luminance(proposed.bg) > 0.45)) {
    theme.bg = proposed.bg;
    theme.bgLight = mix(proposed.bg, 255, darkStyle ? 0.1 : 0.45);
    theme.bgDeep = mix(proposed.bg, 0, darkStyle ? 0.5 : 0.1);
    if (darkStyle) theme.ink = proposed.bg;
  }
  // The accent carries white text, so it may not be too light; a bold video needs a vivid one.
  const vivid = style !== 'bold' || (isHex(proposed?.accent) && saturation(proposed.accent) > 0.55);
  if (isHex(proposed?.accent) && vivid && luminance(proposed.accent) < 0.62) {
    theme.accent = proposed.accent;
    theme.accentDark = mix(proposed.accent, 0, 0.35);
  }
  return theme;
}
