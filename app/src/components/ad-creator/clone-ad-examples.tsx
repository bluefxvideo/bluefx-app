'use client';

import { ExampleChip, ExampleFile, ExampleText, ExampleVideo, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
import { CLONE_AD_EXAMPLES, type CloneAdExample } from './examples';

/**
 * Shown under the analyze form while nothing is loaded: the ad that was cloned
 * next to the finished version, what went in, and a button that loads it all.
 */
export function CloneAdExamples({
  onTry,
  loadingId,
}: {
  onTry: (example: CloneAdExample) => void;
  loadingId: string | null;
}) {
  return (
    <ToolExamples
      heading="What Clone Video Ad makes"
      intro="A real clone made with this tool, next to the ad it copied. Both businesses are made up. Under it: exactly what went in."
      examples={CLONE_AD_EXAMPLES}
      media={(example) => (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-center text-[11px] text-muted-foreground">The ad you clone</p>
            <ExampleVideo src={example.source.videoUrl} poster={example.source.posterUrl} landscape={example.aspectRatio === '16:9'} />
          </div>
          <div className="space-y-1">
            <p className="text-center text-[11px] text-muted-foreground">Your version</p>
            <ExampleVideo src={example.videoUrl} poster={example.posterUrl} landscape={example.aspectRatio === '16:9'} />
          </div>
        </div>
      )}
      renderInputs={(example) => (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ExampleFile name={example.source.name} url={example.source.videoUrl} kind="clip" caption="Source ad" />
            {example.photos.map((photo) => (
              <ExampleFile key={photo.name} name={photo.name} url={photo.url} kind="photo" caption="Photo" />
            ))}
            <ExampleChip>{example.aspectRatio}</ExampleChip>
            <ExampleChip>Voice: {example.voice.name}</ExampleChip>
            <ExampleChip>{example.credits} credits in total</ExampleChip>
          </div>
          <ExampleText>AI Assistant: {example.instruction}</ExampleText>
        </>
      )}
      onTry={onTry}
      loadingId={loadingId}
      busy={false}
      tryNote="Loads the analysis, the photos and the instruction, free. You then make the shot plan and send the instruction."
    />
  );
}

/** Short rules for a strong result, above the analyze form. */
export function CloneAdTips() {
  return (
    <ToolTips
      storageKey="cloneAd.tips.closed"
      tips={[
        'Clone an ad that already works: one that has run for weeks or keeps showing up in your feed. Paste its link, or upload it (up to 3 minutes).',
        'Add 2 to 6 photos of your own business or product. Every scene is drawn with them, so real photos beat stock.',
        'Make the shot plan, then tell the AI Assistant who you are and what the narration should say. It rewrites every scene at once.',
        'Check each picture before you make clips: a new picture costs 2 credits, a clip 12 or more.',
        'Pick a voice that fits the person on screen, then open it all in the editor to put the clips and the voice together.',
        'A 4-scene ad costs about 60 credits: analysis 3 to 6, pictures 2 each, clips 12 each, voice 2.',
      ]}
    />
  );
}
