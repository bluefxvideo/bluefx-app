'use client';

import { ImagePlus } from 'lucide-react';
import { ExampleChip, ExampleFile, ExampleImages, ExampleText, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
import { IMAGE_MAKER_EXAMPLES, type ImageMakerExample } from './examples';
import { IMAGE_MAKER_CREDITS } from './pricing';

/**
 * Shown where the result appears while nothing is being made: real Image Maker
 * results, what went into each one, and a button that puts that input into the form.
 */
export function ImageMakerExamples({ onTry, busy }: { onTry: (example: ImageMakerExample) => void; busy: boolean }) {
  return (
    <ToolExamples
      heading="What Image Maker makes"
      intro="Real Image Maker results with made-up people and businesses. Under each one: exactly what went in. Your images appear here once you click Generate."
      icon={ImagePlus}
      examples={IMAGE_MAKER_EXAMPLES}
      media={(example) => <ExampleImages urls={example.images} alt={example.title} />}
      cost={(example) => {
        const each = IMAGE_MAKER_CREDITS[example.resolution];
        return example.count > 1
          ? `Cost: ${each * example.count} credits · ${example.count} images at ${each} credits each (${example.resolution})`
          : `Cost: ${each} credits · one ${example.resolution} image`;
      }}
      renderInputs={(example) => (
        <>
          <ExampleText>{example.prompt}</ExampleText>
          <div className="flex flex-wrap items-center gap-2">
            {example.references.map((ref) => (
              <ExampleFile key={ref.name} name={ref.name} url={ref.url} kind="photo" />
            ))}
            <ExampleChip>{example.aspect === 'auto' ? 'Auto shape' : example.aspect}</ExampleChip>
            <ExampleChip>{example.resolution}</ExampleChip>
          </div>
        </>
      )}
      onTry={onTry}
      loadingId={null}
      busy={busy}
      tryNote="Fills in the form. Nothing is charged until you click Generate."
    />
  );
}

/** Short rules for a strong result, above the form. */
export function ImageMakerTips() {
  return (
    <ToolTips
      storageKey="imageMaker.tips.closed"
      tips={[
        'Describe the picture like a photographer: the subject, where it is, the light, and the style (phone photo, studio shot, poster).',
        'Words that must appear on the image go in quotes: a headline, a price, a phone number. Short lines come out cleanest.',
        'Add your own photos as references to keep a real product, face or room exactly as it is, and say what must stay the same.',
        'Combine photos by naming each one by what it is: "the woman in the apron holds the green bottle".',
        '1:1 for feeds, 9:16 for Stories and Reels, 16:9 for YouTube and websites. Auto keeps the shape of your photo.',
        '2K is right for almost everything. 4K costs 6 credits an image and takes longer.',
      ]}
    />
  );
}
