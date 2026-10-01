'use client';

import { Repeat } from 'lucide-react';
import { ExampleChip, ExampleFile, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
import { cn } from '@/lib/utils';
import { VIDEO_SWAP_CREDITS_PER_SECOND } from '@/lib/video-swap/pricing';
import { VIDEO_SWAP_EXAMPLES, type VideoSwapExample } from './examples';

const LABEL = 'pointer-events-none absolute rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white';

/** The video that went in and the result, playing together so the matching motion shows. */
function SwapComparison({ example }: { example: VideoSwapExample }) {
  const stacked = example.layout === 'stacked';
  return (
    <div
      className={cn(
        'relative mx-auto overflow-hidden rounded-lg bg-black',
        stacked ? 'aspect-[8/9] max-h-[560px]' : 'aspect-[9/8] w-full max-w-[640px]',
      )}
    >
      <video
        src={example.compareUrl}
        poster={example.posterUrl}
        controls
        playsInline
        autoPlay
        muted
        loop
        preload="metadata"
        className="h-full w-full"
      />
      <span className={cn(LABEL, 'left-2 top-2')}>Video that went in</span>
      <span className={cn(LABEL, stacked ? 'left-2 top-[calc(50%+0.5rem)]' : 'left-[calc(50%+0.5rem)] top-2')}>Result</span>
    </div>
  );
}

/**
 * Shown where the swapped video appears while nothing is being made: real swaps
 * from this tool next to the videos that went in, the photo and settings behind
 * each, and a button that puts them into the form.
 */
export function VideoSwapExamples({
  onTry,
  loadingId,
  busy,
}: {
  onTry: (example: VideoSwapExample) => void;
  loadingId: string | null;
  busy: boolean;
}) {
  return (
    <ToolExamples
      heading="What Video Swap makes"
      intro="Two swaps made with this tool, each playing next to the video that went in. The people are made up. Under each: exactly what went in."
      icon={Repeat}
      examples={VIDEO_SWAP_EXAMPLES}
      media={(example) => <SwapComparison example={example} />}
      cost={(example) =>
        `Cost: ${example.credits} credits · ${example.seconds} seconds at ${VIDEO_SWAP_CREDITS_PER_SECOND} credits a second`
      }
      renderInputs={(example) => (
        <div className="flex flex-wrap items-center gap-2">
          <ExampleFile name={example.sourceVideo.name} url={example.sourceVideo.url} kind="clip" caption="Video" />
          <ExampleFile name={example.personPhoto.name} url={example.personPhoto.url} kind="photo" caption="Person" />
          <ExampleChip>{example.orientation === 'video' ? 'Follow the video' : 'Follow the image'}</ExampleChip>
          <ExampleChip>Keep original sound: {example.keepSound ? 'on' : 'off'}</ExampleChip>
          <ExampleChip>Prompt: left empty</ExampleChip>
        </div>
      )}
      onTry={onTry}
      loadingId={loadingId}
      busy={busy}
      tryNote="Puts this video and this photo into the form. Nothing is charged until you click Swap."
    />
  );
}

/** Short rules for a strong result, above the form. */
export function VideoSwapTips() {
  return (
    <ToolTips
      storageKey="videoSwap.tips.closed"
      tips={[
        'The video gives the motion and the sound. The photo gives the person and the place: the result looks like the photo and moves like the video.',
        'Video: one real person, upper body or whole body, head in frame, nothing covering the person. Up to 30 seconds.',
        'Photo: one person, framed like the start of the video (an upper-body photo for an upper-body video), nothing in front of the person.',
        'Keep original sound keeps the voice of the video. Pick a photo of a person that voice fits.',
        'Follow the video suits talking and complex motion. Follow the image keeps the pose and angle of the photo and suits clips where the camera moves (up to 10 seconds).',
        `The price is ${VIDEO_SWAP_CREDITS_PER_SECOND} credits per second of video, so cut the clip to the part you need before you upload. A short clip is ready in 3 to 6 minutes.`,
      ]}
    />
  );
}
