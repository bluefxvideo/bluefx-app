/**
 * Color synchronization utility for V2 and React Video Editor
 * Converts between HSL and OKLCH color formats
 */

// V2 color definitions in HSL format (from your main app)
export const V2_COLORS = {
  // Dark theme colors
  background: 'hsl(220 24% 10%)',        // #1a1d29
  foreground: 'hsl(210 20% 92%)',
  card: 'hsl(220 22% 15%)',              // #252a3a
  cardContent: 'hsl(220 18% 18%)',       // #2d3348
  primary: 'hsl(214 100% 65%)',          // #4A9EFF
  secondary: 'hsl(220 18% 18%)',         // #2d3348
  muted: 'hsl(220 22% 15%)',             // #252a3a
  mutedForeground: 'hsl(220 12% 65%)',
  border: 'hsl(220 15% 25%)',            // #3a4056
  input: 'hsl(220 18% 18%)',             // #2d3348
  ring: 'hsl(210 60% 70%)',
  destructive: 'hsl(0 62.8% 30.6%)',
  
  // Light theme colors (fallback)
  lightBackground: 'hsl(0 0% 100%)',
  lightForeground: 'hsl(240 10% 3.9%)',
  lightPrimary: 'hsl(210 100% 50%)',
};

// Helper to convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4))
  ];
}

// Helper to convert RGB to linear RGB
function rgbToLinear(value: number): number {
  const normalized = value / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return Math.pow((normalized + 0.055) / 1.055, 2.4);
}

// Helper to convert linear RGB to OKLab
function linearRgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  ];
}

// Convert OKLab to OKLCH
function oklabToOklch(L: number, a: number, b: number): [number, number, number] {
  const C = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * 180 / Math.PI;
  if (h < 0) h += 360;
  
  return [L, C, h];
}

// Main conversion function: HSL string to OKLCH values
export function hslToOklch(hslString: string): string {
  // Parse HSL string like "hsl(220 24% 10%)"
  const match = hslString.match(/hsl\((\d+)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)/);
  if (!match) {
    console.warn(`Invalid HSL format: ${hslString}`);
    return 'oklch(0.5 0 0)'; // Fallback
  }
  
  const h = parseInt(match[1]);
  const s = parseFloat(match[2]);
  const l = parseFloat(match[3]);
  
  // Convert HSL to RGB
  const [r, g, b] = hslToRgb(h, s, l);
  
  // Convert RGB to linear RGB
  const linearR = rgbToLinear(r);
  const linearG = rgbToLinear(g);
  const linearB = rgbToLinear(b);
  
  // Convert to OKLab
  const [labL, labA, labB] = linearRgbToOklab(linearR, linearG, linearB);
  
  // Convert to OKLCH
  const [L, C, H] = oklabToOklch(labL, labA, labB);
  
  // Format with appropriate precision
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(0)})`;
}

// Convert hex color to OKLCH
export function hexToOklch(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse hex to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Convert RGB to linear RGB
  const linearR = rgbToLinear(r);
  const linearG = rgbToLinear(g);
  const linearB = rgbToLinear(b);
  
  // Convert to OKLab
  const [labL, labA, labB] = linearRgbToOklab(linearR, linearG, linearB);
  
  // Convert to OKLCH
  const [L, C, H] = oklabToOklch(labL, labA, labB);
  
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(0)})`;
}

// Pre-converted OKLCH values for React Video Editor
export const OKLCH_COLORS = {
  // These are the exact conversions of your V2 colors
  background: hexToOklch('1a1d29'),        // #1a1d29
  foreground: 'oklch(0.920 0.010 253)',    // Already correct in React editor
  card: hexToOklch('252a3a'),              // #252a3a  
  cardContent: hexToOklch('2d3348'),       // #2d3348
  primary: hexToOklch('4A9EFF'),           // #4A9EFF
  secondary: hexToOklch('2d3348'),         // #2d3348
  muted: hexToOklch('252a3a'),             // #252a3a
  border: hexToOklch('3a4056'),            // #3a4056
  input: hexToOklch('2d3348'),             // #2d3348
};

// Generate CSS variables for React Video Editor
export function generateOklchCssVariables(): string {
  return `
.dark {
  /* BlueFX exact colors from V2 - using precise OKLCH conversions */
  --background: ${OKLCH_COLORS.background};
  --foreground: ${OKLCH_COLORS.foreground};
  --card: ${OKLCH_COLORS.card};
  --card-foreground: ${OKLCH_COLORS.foreground};
  --popover: ${OKLCH_COLORS.card};
  --popover-foreground: ${OKLCH_COLORS.foreground};
  --primary: ${OKLCH_COLORS.primary};
  --primary-foreground: oklch(0.98 0 0);
  --secondary: ${OKLCH_COLORS.secondary};
  --secondary-foreground: ${OKLCH_COLORS.foreground};
  --muted: ${OKLCH_COLORS.muted};
  --muted-foreground: oklch(0.650 0.008 253);
  --accent: ${OKLCH_COLORS.secondary};
  --accent-foreground: ${OKLCH_COLORS.foreground};
  --destructive: oklch(0.31 0.085 30);
  --destructive-foreground: oklch(0.98 0 0);
  --border: ${OKLCH_COLORS.border};
  --input: ${OKLCH_COLORS.input};
  --ring: oklch(0.700 0.120 253);
}`;
}

// Test the conversions
if (typeof window === 'undefined') {
  console.log('Color conversions:');
  console.log('Background #1a1d29:', hexToOklch('1a1d29'));
  console.log('Card #252a3a:', hexToOklch('252a3a'));
  console.log('Secondary #2d3348:', hexToOklch('2d3348'));
  console.log('Primary #4A9EFF:', hexToOklch('4A9EFF'));
  console.log('Border #3a4056:', hexToOklch('3a4056'));
}