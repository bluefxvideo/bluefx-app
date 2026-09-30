'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Clapperboard, Lightbulb, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PHANTOM_EXAMPLES, type PhantomExample } from '@/lib/smart-video/examples';
import { PHANTOM_REVISION_CREDITS } from '@/lib/smart-video/pricing';
import type { VideoFormat, VideoLook } from '@/lib/smart-video/types';

/**
 * Shown where the result appears while nothing is being made: real Phantom
 * videos, what went into each one, and a button that puts that input into the
 * form. A new user sees what the tool makes before spending a credit.
 */
export function PhantomExamples({
  onTry,
  loadingId,
  busy,
  formatLabel,
  lookLabel,
}: {
  onTry: (example: PhantomExample) => void;
  loadingId: string | null;
  busy: boolean;
  formatLabel: (format: VideoFormat) => string;
  lookLabel: (look: VideoLook) => string;
}) {
  const [activeId, setActiveId] = useState(PHANTOM_EXAMPLES[0].id);
  const example = PHANTOM_EXAMPLES.find((e) => e.id === activeId) ?? PHANTOM_EXAMPLES[0];
  const loading = loadingId === example.id;

  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Clapperboard className="w-4 h-4" />
          What the Phantom makes
        </h2>
        <p className="text-xs text-muted-foreground">
          Real Phantom videos for made-up businesses. Under each one: exactly what went in. Your video appears here once you summon the
          Phantom.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PHANTOM_EXAMPLES.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setActiveId(e.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              e.id === example.id ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted/50',
            )}
          >
            {e.label}
          </button>
        ))}
      </div>

      <video
        key={example.id}
        src={example.videoUrl}
        poster={example.posterUrl}
        controls
        playsInline
        preload="metadata"
        className={cn(
          'mx-auto rounded-lg bg-black',
          example.format === 'horizontal' ? 'w-full aspect-video' : 'max-h-[520px] aspect-[9/16]',
        )}
      />

      <div className="space-y-1">
        <p className="text-sm font-medium">{example.title}</p>
        <p className="text-xs text-muted-foreground">{example.shows}</p>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-medium">What went in</p>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{example.brief}</p>
        <div className="flex flex-wrap items-center gap-2">
          {example.files.map((file) =>
            file.kind === 'clip' ? (
              <div
                key={file.name}
                className="flex h-12 w-12 items-center justify-center rounded-md border bg-background text-[10px] text-muted-foreground"
                title={file.name}
              >
                clip
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- small thumbnail of an example input photo
              <img key={file.name} src={file.url} alt={file.name} title={file.name} className="h-12 w-12 rounded-md border object-cover" />
            ),
          )}
          <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{formatLabel(example.format)}</span>
          <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{lookLabel(example.look)}</span>
        </div>
      </div>

      <div className="space-y-1">
        <Button onClick={() => onTry(example)} disabled={busy || Boolean(loadingId)} className="w-full">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
          Try this example
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">Fills in the form. Nothing is charged until you summon the Phantom.</p>
      </div>
    </Card>
  );
}

const TIPS_CLOSED_KEY = 'phantom.tips.closed';

/** Short rules for a strong result, above the form. Open until the user closes it once. */
export function PhantomTips() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(TIPS_CLOSED_KEY) === '1') setOpen(false);
    } catch {
      // storage blocked: the tips simply stay open
    }
  }, []);
  const toggle = () => {
    setOpen((was) => {
      try {
        localStorage.setItem(TIPS_CLOSED_KEY, was ? '1' : '0');
      } catch {
        // storage blocked: nothing to remember
      }
      return !was;
    });
  };

  return (
    <div className="rounded-lg border bg-muted/30">
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium">
        <span className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          How to get a great result
        </span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ol className="list-decimal space-y-1.5 px-3 pb-3 pl-7 text-xs leading-relaxed text-muted-foreground">
          <li>
            Give the Phantom the facts, not a script: what you sell, who it is for, the offer or price, and how people reach you. Messy
            notes are fine.
          </li>
          <li>Have a link? Paste it. A listing, a product page, your website or your Google Maps page brings its own photos and details.</li>
          <li>Add your own photos or a short phone clip. Real photos of your work beat stock, and a clip of you talking keeps your own voice.</li>
          <li>Vertical for TikTok, Reels and Shorts. Horizontal for YouTube and websites.</li>
          <li>Leave &quot;Say exactly what I wrote&quot; off unless the words must be exact. The Phantom writes the stronger ad.</li>
          <li>Not quite right? Edit the finished video with a note for {PHANTOM_REVISION_CREDITS} credits instead of starting over.</li>
        </ol>
      )}
    </div>
  );
}
