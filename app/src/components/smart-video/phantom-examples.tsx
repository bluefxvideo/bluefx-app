'use client';

import { ExampleChip, ExampleFile, ExampleText, ExampleVideo, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
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
  return (
    <ToolExamples
      heading="What the Phantom makes"
      intro="Real Phantom videos for made-up businesses. Under each one: exactly what went in. Your video appears here once you summon the Phantom."
      examples={PHANTOM_EXAMPLES}
      media={(example) => <ExampleVideo src={example.videoUrl} poster={example.posterUrl} landscape={example.format === 'horizontal'} />}
      renderInputs={(example) => (
        <>
          <ExampleText>{example.brief}</ExampleText>
          <div className="flex flex-wrap items-center gap-2">
            {example.files.map((file) => (
              <ExampleFile key={file.name} name={file.name} url={file.url} kind={file.kind} />
            ))}
            <ExampleChip>{formatLabel(example.format)}</ExampleChip>
            <ExampleChip>{lookLabel(example.look)}</ExampleChip>
          </div>
        </>
      )}
      onTry={onTry}
      loadingId={loadingId}
      busy={busy}
      tryNote="Fills in the form. Nothing is charged until you summon the Phantom."
    />
  );
}

/** Short rules for a strong result, above the form. */
export function PhantomTips() {
  return (
    <ToolTips
      storageKey="phantom.tips.closed"
      tips={[
        'Give the Phantom the facts, not a script: what you sell, who it is for, the offer or price, and how people reach you. Messy notes are fine.',
        'Have a link? Paste it. A listing, a product page, your website or your Google Maps page brings its own photos and details.',
        'Add your own photos or a short phone clip. Real photos of your work beat stock, and a clip of you talking keeps your own voice.',
        'Vertical for TikTok, Reels and Shorts. Horizontal for YouTube and websites.',
        'Leave "Say exactly what I wrote" off unless the words must be exact. The Phantom writes the stronger ad.',
        `Not quite right? Edit the finished video with a note for ${PHANTOM_REVISION_CREDITS} credits instead of starting over.`,
      ]}
    />
  );
}
