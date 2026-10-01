'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatClock, formatLength } from '@/lib/video-roughcut/format';
import type { RoughcutExample } from './examples';

type Mode = 'raw' | 'cut';

interface Piece {
  from: number;
  to: number;
  removed: boolean;
  /** For a removed piece: what was said there and why it went. */
  removal?: RoughcutExample['removals'][number];
}

/** The raw recording as alternating kept and removed pieces. */
function buildPieces(example: RoughcutExample): Piece[] {
  const pieces: Piece[] = [];
  const addRemoved = (from: number, to: number) => {
    if (to - from < 0.01) return;
    // The listed removal that overlaps this gap the most names it
    let removal: Piece['removal'];
    let most = 0;
    for (const r of example.removals) {
      const overlap = Math.min(to, r.end) - Math.max(from, r.start);
      if (overlap > most) {
        removal = r;
        most = overlap;
      }
    }
    pieces.push({ from, to, removed: true, removal });
  };
  let cursor = 0;
  for (const k of example.kept) {
    addRemoved(cursor, k.from);
    pieces.push({ from: k.from, to: k.to, removed: false });
    cursor = k.to;
  }
  addRemoved(cursor, example.rawSeconds);
  return pieces;
}

/** Where a moment of the raw recording sits in the rough cut. A moment that was cut maps to the next kept part. */
function rawToCut(example: RoughcutExample, t: number): number {
  let before = 0;
  for (const k of example.kept) {
    if (t < k.from) return before;
    if (t <= k.to) return before + (t - k.from);
    before += k.to - k.from;
  }
  return before;
}

/** Where a moment of the rough cut sits in the raw recording. */
function cutToRaw(example: RoughcutExample, t: number): number {
  let left = t;
  for (const k of example.kept) {
    const length = k.to - k.from;
    if (left <= length) return k.from + left;
    left -= length;
  }
  return example.rawSeconds;
}

/**
 * Rough Cut returns an edit list, not a video, so its example is shown as a
 * player with a timeline: the raw recording with the cut parts marked in red,
 * and the same recording with the cuts applied. Switching between the two
 * closes or opens the red parts. Until the viewer touches it, the timeline
 * flips by itself to show what the tool does.
 */
export function RoughcutDemo({ example }: { example: RoughcutExample }) {
  const rawRef = useRef<HTMLVideoElement>(null);
  const cutRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<Mode>('raw');
  /** Position in the video of the current mode. */
  const [time, setTime] = useState(0);
  const [touched, setTouched] = useState(false);
  const pieces = useMemo(() => buildPieces(example), [example]);

  useEffect(() => {
    if (touched) return;
    const id = setInterval(() => setMode((m) => (m === 'raw' ? 'cut' : 'raw')), 3500);
    return () => clearInterval(id);
  }, [touched]);

  const videoOf = (m: Mode) => (m === 'raw' ? rawRef.current : cutRef.current);
  const lengthOf = (m: Mode) => (m === 'raw' ? example.rawSeconds : example.cutSeconds);
  const duration = lengthOf(mode);

  /** Show one version at a position. Without a position, the same moment of the recording stays on screen. */
  const show = (next: Mode, at?: number, play?: boolean) => {
    setTouched(true);
    const from = videoOf(mode);
    const to = videoOf(next);
    const wasPlaying = Boolean(from && !from.paused && !from.ended);
    // Before anything has played, the other version starts at its own beginning
    const sameMoment = time < 0.1 ? 0 : next === 'cut' ? rawToCut(example, time) : cutToRaw(example, time);
    const position = Math.min(at ?? (next === mode ? time : sameMoment), lengthOf(next) - 0.05);
    if (from && next !== mode) from.pause();
    if (to) {
      to.currentTime = position;
      if (play ?? wasPlaying) void to.play().catch(() => {});
    }
    setMode(next);
    setTime(position);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
    show(mode, fraction * duration);
  };

  const underPlayhead = mode === 'raw' ? pieces.find((p) => p.removed && time >= p.from && time < p.to) : undefined;
  const caption = underPlayhead?.removal
    ? `Cut: “${underPlayhead.removal.text}”`
    : mode === 'raw'
      ? 'Red parts are cut'
      : 'The red parts are gone';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(['raw', 'cut'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => show(m)}
            aria-pressed={mode === m}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              mode === m ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50',
            )}
          >
            {m === 'raw' ? `Raw take · ${formatClock(Math.round(example.rawSeconds))}` : `Rough cut · ${formatClock(Math.round(example.cutSeconds))}`}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Scissors className="h-3.5 w-3.5" />
          {example.removals.length} cuts · {formatLength(example.removedSeconds)} removed
        </span>
      </div>

      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <video
          ref={rawRef}
          src={example.rawVideo.url}
          poster={example.posterUrl}
          controls
          playsInline
          preload="metadata"
          className={cn('h-full w-full', mode !== 'raw' && 'hidden')}
          onPlay={() => setTouched(true)}
          onTimeUpdate={(e) => mode === 'raw' && setTime(e.currentTarget.currentTime)}
        />
        <video
          ref={cutRef}
          src={example.cutVideoUrl}
          poster={example.posterUrl}
          controls
          playsInline
          preload="metadata"
          className={cn('h-full w-full', mode !== 'cut' && 'hidden')}
          onPlay={() => setTouched(true)}
          onTimeUpdate={(e) => mode === 'cut' && setTime(e.currentTarget.currentTime)}
        />
      </div>

      <div>
        {/* The recording as kept (blue) and cut (red) parts. In the rough cut the red parts close up. */}
        <div
          onClick={seek}
          className="relative flex h-9 w-full cursor-pointer gap-px overflow-hidden rounded-md bg-muted"
          title="Click to jump to this moment"
        >
          {pieces.map((piece) => (
            <div
              key={piece.from}
              title={piece.removed ? piece.removal?.reason ?? 'Pause removed' : undefined}
              style={{ flexGrow: piece.removed && mode === 'cut' ? 0 : piece.to - piece.from, flexBasis: 0 }}
              className={cn(
                'h-full min-w-0 transition-[flex-grow] duration-700 ease-in-out',
                piece.removed ? 'bg-red-500/80' : 'bg-primary/80',
              )}
            />
          ))}
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.8)] transition-[left] duration-200 ease-linear"
            style={{ left: `${Math.min(100, (time / duration) * 100)}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span className="tabular-nums">0:00</span>
          <span className="truncate">{caption}</span>
          <span className="tabular-nums">{formatClock(Math.round(duration))}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium">What was cut. Click a line to hear it in the raw take.</p>
        <ul className="space-y-1">
          {example.removals.map((removal) => (
            <li key={removal.start}>
              <button
                type="button"
                onClick={() => show('raw', removal.start, true)}
                className="w-full rounded-md border bg-card px-2.5 py-1.5 text-left text-xs hover:bg-muted/50"
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatClock(removal.start)} to {formatClock(removal.end)}
                </span>{' '}
                <span>“{removal.text}”</span>
                <span className="block text-[11px] text-muted-foreground">{removal.reason}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
