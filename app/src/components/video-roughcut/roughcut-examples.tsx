'use client';

import { Scissors } from 'lucide-react';
import { ExampleChip, ExampleFile, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
import { formatLength } from '@/lib/video-roughcut/format';
import {
  ROUGHCUT_CREDITS_PER_MINUTE,
  ROUGHCUT_MIN_CREDITS,
} from '@/lib/video-roughcut/pricing';
import { ROUGHCUT_EXAMPLES, type RoughcutExample } from './examples';
import { RoughcutDemo } from './roughcut-demo';

/**
 * Shown where the result appears while no job is open: a real rough cut from
 * this tool, played against the raw recording, and a button that loads the
 * recording into the form.
 */
export function RoughcutExamples({
  onTry,
  loadingId,
  busy,
}: {
  onTry: (example: RoughcutExample) => void;
  loadingId: string | null;
  busy: boolean;
}) {
  return (
    <ToolExamples
      heading="What Rough Cut makes"
      intro="A real rough cut made with this tool. The mechanic and his shop are made up. Play the raw take, then the rough cut: the red parts of the timeline are what the tool removed."
      icon={Scissors}
      examples={ROUGHCUT_EXAMPLES}
      media={(example) => <RoughcutDemo example={example} />}
      cost={(example) =>
        `Cost: ${example.credits} credits · the minimum. Longer videos cost ${ROUGHCUT_CREDITS_PER_MINUTE} credits per minute.`
      }
      renderInputs={(example) => (
        <div className="flex flex-wrap items-center gap-2">
          <ExampleFile name={example.rawVideo.name} url={example.rawVideo.url} kind="clip" caption="Video" />
          <ExampleChip>{formatLength(example.rawSeconds)}</ExampleChip>
          <ExampleChip>One take, stumbles included</ExampleChip>
        </div>
      )}
      onTry={onTry}
      loadingId={loadingId}
      busy={busy}
      tryNote="Loads this recording and shows the price: half, because this recording was transcribed before. Nothing is charged until you click Create rough cut."
    />
  );
}

/** Short rules for a clean rough cut, above the upload box. */
export function RoughcutTips() {
  return (
    <ToolTips
      storageKey="roughcut.tips.closed"
      tips={[
        'Record the whole video in one go. When you stumble, pause and say the whole line again. The last complete take of each line stays.',
        'Only the audio is uploaded. The video file stays on your computer, so a large recording works too.',
        `You see the price before anything is charged: ${ROUGHCUT_CREDITS_PER_MINUTE} credits per minute, ${ROUGHCUT_MIN_CREDITS} credits minimum.`,
        'The result is an XML file, not a video. Open the XML in Premiere Pro or DaVinci Resolve and point the editor at your original video: the timeline opens with the cuts made.',
        '"What was cut" lists every removed part with the reason. In the editor you can pull any cut back out.',
        'Running the same recording again costs half, because the transcript is already there.',
      ]}
    />
  );
}
