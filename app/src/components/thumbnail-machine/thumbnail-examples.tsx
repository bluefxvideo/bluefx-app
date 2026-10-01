'use client';

import { Image as ImageIcon } from 'lucide-react';
import { ExampleChip, ExampleFile, ExampleImages, ExampleText, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
import { THUMBNAIL_EXAMPLES, type ThumbnailExample } from './examples';

/**
 * Shown where the thumbnail appears while nothing is being made: real thumbnails
 * from this tool, exactly what went into each, and a button that fills the form.
 */
export function ThumbnailExamples({
  onTry,
  busy,
}: {
  onTry: (example: ThumbnailExample) => void;
  busy: boolean;
}) {
  return (
    <ToolExamples
      heading="What Thumbnail Maker makes"
      intro="Three thumbnails made with this tool. The people and the products are made up. Under each: exactly what went in."
      icon={ImageIcon}
      examples={THUMBNAIL_EXAMPLES}
      media={(example) => <ExampleImages urls={[example.image]} alt={example.title} />}
      cost={(example) => `Cost: ${example.credits} credits for one thumbnail`}
      renderInputs={(example) => (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {example.references.map((ref) => (
              <ExampleFile key={ref.name} name={ref.name} url={ref.url} kind="photo" caption="Reference" />
            ))}
            {example.references.length === 0 && <ExampleChip>No reference photo</ExampleChip>}
            <ExampleChip>Text Overlay: {example.textOverlay}</ExampleChip>
          </div>
          <ExampleText>{example.prompt}</ExampleText>
        </>
      )}
      onTry={onTry}
      loadingId={null}
      busy={busy}
      tryNote="Fills the form with this input. Nothing is charged until you click Generate."
    />
  );
}

/** Short rules for a strong result, above the form. */
export function ThumbnailTips() {
  return (
    <ToolTips
      storageKey="thumbnailMaker.tips.closed"
      tips={[
        'Describe one scene: what is on the left, what is on the right, and one strong reaction or contrast.',
        'Put the words in Text Overlay, not in the description. 2 to 4 words in capitals come out cleanest.',
        'Want your own face on the thumbnail? Add one clear photo as a reference and say what the face does: "mouth open in surprise".',
        'Add a photo of your product as a reference and the product stays real, label included.',
        'Is the video already on YouTube? Paste the link in step 1 and click Get Ideas. The AI reads the video and suggests thumbnail ideas.',
        'A thumbnail costs 10 credits. Close but not right? Click Edit This on the result and say what to change.',
      ]}
    />
  );
}
