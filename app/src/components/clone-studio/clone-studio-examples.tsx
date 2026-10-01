'use client';

import { ExampleFile, ExampleText, ExampleVideo, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
import { CLONE_STUDIO_EXAMPLES, type CloneStudioExample } from '@/lib/clone-studio/examples';

/**
 * Shown under "Clone an ad" while no project is open: the ad that was cloned
 * next to the finished version, what went in, and a button that copies the
 * example's board into the user's projects.
 */
export function CloneStudioExamples({
  onTry,
  loadingId,
}: {
  onTry: (example: CloneStudioExample) => void;
  loadingId: string | null;
}) {
  return (
    <ToolExamples
      heading="What Clone Studio makes"
      intro="A real scene-by-scene clone made with this tool, next to the ad it copied. Both businesses are made up. Under it: exactly what went in."
      examples={CLONE_STUDIO_EXAMPLES}
      media={(example) => (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-center text-[11px] text-muted-foreground">The ad you clone</p>
            <ExampleVideo src={example.source.videoUrl} poster={example.source.posterUrl} landscape={false} />
          </div>
          <div className="space-y-1">
            <p className="text-center text-[11px] text-muted-foreground">Your version</p>
            <ExampleVideo src={example.videoUrl} poster={example.posterUrl} landscape={false} />
          </div>
        </div>
      )}
      cost={(example) => `Cost: ${example.credits} credits in total · the breakdown, the pictures, the clips and the music`}
      renderInputs={(example) => (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ExampleFile name={example.source.name} url={example.source.videoUrl} kind="clip" caption="Source ad" />
            {example.photos.map((photo) => (
              <ExampleFile key={photo.name} name={photo.name} url={photo.url} kind="photo" caption="Photo" />
            ))}
          </div>
          <ExampleText>Apply to all scenes: {example.instruction}</ExampleText>
          <ExampleText>Then, card by card: {example.edits}</ExampleText>
        </>
      )}
      onTry={onTry}
      loadingId={loadingId}
      busy={false}
      tryNote="Copies the example's board into your projects, free: scenes, photos and prompts, ready to generate."
    />
  );
}

/** Short rules for a strong result, above "Clone an ad". */
export function CloneStudioTips() {
  return (
    <ToolTips
      storageKey="cloneStudio.tips.closed"
      tips={[
        'Clone an ad that already works, and keep it short: under a minute means fewer scenes to pay for.',
        'Add photos of your person and your product once. They go into every scene, so faces and packaging stay the same.',
        'Write the swap once ("Replace Bella with the owner in photo 1, the bread with the pizza in photo 2") and click Apply to all scenes. Each scene gets only the part that applies to it.',
        'Check every new picture before you animate: a picture costs 4 credits, a clip 8 credits a second.',
        'Read each motion prompt, it is sent exactly as written. Let one person do the talking so the whole ad keeps one voice.',
        'Assemble joins the clips in the original timing. The music bed adds 5 credits.',
      ]}
    />
  );
}
