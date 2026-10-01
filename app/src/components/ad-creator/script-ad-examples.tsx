'use client';

import { ExampleChip, ExampleFile, ExampleText, ExampleVideo, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
import { SCRIPT_AD_EXAMPLES, type ScriptAdExample } from './examples';

/**
 * Shown under "Break Down Script" while nothing is planned: a finished ad, the
 * script and photos behind it, and a button that puts them into the form.
 */
export function ScriptAdExamples({
  onTry,
  loadingId,
}: {
  onTry: (example: ScriptAdExample) => void;
  loadingId: string | null;
}) {
  return (
    <ToolExamples
      heading="What Video Ad From Script makes"
      intro="A real ad made with this tool from the script and photo below. The business is made up. Under it: exactly what went in."
      examples={SCRIPT_AD_EXAMPLES}
      media={(example) => (
        <ExampleVideo src={example.videoUrl} poster={example.posterUrl} landscape={example.aspectRatio === '16:9'} />
      )}
      cost={(example) => `Cost: ${example.credits} credits in total · ${example.scenes} pictures, ${example.scenes} clips and the voice`}
      renderInputs={(example) => (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {example.photos.map((photo) => (
              <ExampleFile key={photo.name} name={photo.name} url={photo.url} kind="photo" caption="Photo" />
            ))}
            <ExampleChip>{example.aspectRatio}</ExampleChip>
            <ExampleChip>{example.scenes} scenes</ExampleChip>
            <ExampleChip>Voice: {example.voice.name}</ExampleChip>
          </div>
          <ExampleText>Script: {example.script}</ExampleText>
        </>
      )}
      onTry={onTry}
      loadingId={loadingId}
      busy={false}
      tryNote="Puts the script, the photo and the voice into the form, free. Then click Break Down Script."
    />
  );
}

/** Short rules for a strong result, above the script box. */
export function ScriptAdTips() {
  return (
    <ToolTips
      storageKey="scriptAd.tips.closed"
      tips={[
        'Write for the ear: short sentences, one picture per sentence. About 60 words make a 25-second ad.',
        'Open with the product or the problem, and end with what to do next ("Order two jars today").',
        'Add photos of your product. Every scene is drawn with them, so the product and the words on its label stay the same.',
        'Break Down Script is free. Read each scene before you make pictures and change the ones that miss. The AI Assistant changes all scenes at once.',
        'Clips keep a still camera, and the things in the picture move. A camera move can make a clip jump to a different shot, so add a camera move only where the scene needs it.',
        'A picture costs 2 credits, a 6-second clip 12, the voice 2. In the last step, open it all in the editor to put the clips under the voice.',
      ]}
    />
  );
}
