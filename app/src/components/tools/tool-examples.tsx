'use client';

import { useState, type ReactNode } from 'react';
import { Clapperboard, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ToolExample {
  id: string;
  /** Short chip label: who or what this example is for. */
  label: string;
  title: string;
  /** One line on what the example teaches about structuring the input. */
  shows: string;
  videoUrl: string;
  posterUrl: string;
}

/**
 * Shown where a tool's result appears while nothing is being made: real results
 * of the tool, exactly what went into each one, and a button that puts that input
 * into the form. A new user sees what the tool makes before spending a credit.
 */
export function ToolExamples<T extends ToolExample>({
  heading,
  intro,
  examples,
  landscape,
  loop = false,
  renderInputs,
  onTry,
  loadingId,
  busy,
  tryNote,
}: {
  heading: string;
  intro: string;
  examples: T[];
  /** Whether an example's video is wider than tall. */
  landscape: (example: T) => boolean;
  /** Short clips play muted on a loop; long ads wait for a click. */
  loop?: boolean;
  /** The "What went in" contents: the text, files and settings behind the video. */
  renderInputs: (example: T) => ReactNode;
  onTry: (example: T) => void;
  loadingId: string | null;
  busy: boolean;
  tryNote: string;
}) {
  const [activeId, setActiveId] = useState(examples[0].id);
  const example = examples.find((e) => e.id === activeId) ?? examples[0];
  const loading = loadingId === example.id;

  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Clapperboard className="w-4 h-4" />
          {heading}
        </h2>
        <p className="text-xs text-muted-foreground">{intro}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {examples.map((e) => (
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
        autoPlay={loop}
        muted={loop}
        loop={loop}
        preload="metadata"
        className={cn('mx-auto rounded-lg bg-black', landscape(example) ? 'w-full aspect-video' : 'max-h-[520px] aspect-[9/16]')}
      />

      <div className="space-y-1">
        <p className="text-sm font-medium">{example.title}</p>
        <p className="text-xs text-muted-foreground">{example.shows}</p>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-medium">What went in</p>
        {renderInputs(example)}
      </div>

      <div className="space-y-1">
        <Button onClick={() => onTry(example)} disabled={busy || Boolean(loadingId)} className="w-full">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
          Try this example
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">{tryNote}</p>
      </div>
    </Card>
  );
}

/** The exact text that went into an example. */
export function ExampleText({ children }: { children: ReactNode }) {
  return <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

/** A setting that shaped an example: shape, look, engine, length. */
export function ExampleChip({ children }: { children: ReactNode }) {
  return <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{children}</span>;
}

/** A photo or clip that went into an example, with an optional caption under it. */
export function ExampleFile({ name, url, kind, caption }: { name: string; url: string; kind: 'photo' | 'clip'; caption?: string }) {
  const tile =
    kind === 'clip' ? (
      <div
        className="flex h-12 w-12 items-center justify-center rounded-md border bg-background text-[10px] text-muted-foreground"
        title={name}
      >
        clip
      </div>
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- small thumbnail of an example input photo
      <img src={url} alt={name} title={name} className="h-12 w-12 rounded-md border object-cover" />
    );
  if (!caption) return tile;
  return (
    <div className="flex flex-col items-center gap-1">
      {tile}
      <span className="text-[10px] text-muted-foreground">{caption}</span>
    </div>
  );
}
