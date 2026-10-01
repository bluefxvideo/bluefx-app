import sharp from 'sharp';

/**
 * Smart Video — where the lines of a whiteboard drawing are, in the order a hand could draw them.
 *
 * The renderer used to reveal a drawing in eight straight rows, so the hand spent most of its time over
 * empty board. Here the drawing's ink is reduced to a grid of cells, and the cells are put in a walking
 * order: always on to the nearest cell not yet drawn. That keeps the hand on a line until the line ends,
 * then moves it to the nearest other line. The renderer moves the marker along this path and lets the ink
 * appear under its tip.
 *
 * Returned as a flat list x0, y0, x1, y1, ... of cell centres, each 0 to 1 across the image.
 */
const GRID = 46; // cells along the longer side
const MAX_POINTS = 900;

export function tracePath(alpha: Uint8Array | Buffer, width: number, height: number): number[] {
  const cell = Math.max(1, Math.ceil(Math.max(width, height) / GRID));
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const ink = new Uint16Array(cols * rows);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / cell) * cols;
    for (let x = 0; x < width; x++) if (alpha[y * width + x] > 90) ink[row + Math.floor(x / cell)]++;
  }
  // A cell counts when a real piece of line crosses it, not a stray pixel.
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (ink[y * cols + x] >= Math.max(3, cell * 0.4)) cells.push({ x, y });
  if (!cells.length) return [];

  // Start at the top left, then always the nearest cell not yet drawn.
  let current = cells.reduce((best, c) => (c.x + c.y < best.x + best.y ? c : best));
  const left = new Set(cells);
  const order: { x: number; y: number }[] = [];
  while (left.size && order.length < MAX_POINTS) {
    order.push(current);
    left.delete(current);
    let next: { x: number; y: number } | null = null;
    let nearest = Infinity;
    for (const c of left) {
      const d = (c.x - current.x) ** 2 + (c.y - current.y) ** 2;
      if (d < nearest) {
        nearest = d;
        next = c;
        if (d <= 1) break; // a direct neighbour: the line goes on
      }
    }
    if (!next) break;
    current = next;
  }
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return order.flatMap((c) => [round(Math.min(1, ((c.x + 0.5) * cell) / width)), round(Math.min(1, ((c.y + 0.5) * cell) / height))]);
}

/** The path of a finished drawing file (ink on a transparent background). */
export async function tracePng(png: Buffer): Promise<number[]> {
  const { data, info } = await sharp(png).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  return tracePath(data, info.width, info.height);
}
