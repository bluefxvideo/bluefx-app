'use client';

import { ExampleChip, ExampleFile, ExampleText, ExampleVideo, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
import type { VideoModel } from '@/types/cinematographer';
import { VIDEO_MAKER_EXAMPLES, type VideoMakerExample } from './examples';

const MODEL_LABEL: Record<VideoModel, string> = { fast: 'Fast', pro: 'Pro', ultra: 'Ultra' };

// 'dolly_out' → 'Dolly Out', as in the Camera Movement menu
const cameraLabel = (motion: string) =>
  motion
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/**
 * Shown where the result appears while nothing is being made: real Video Maker
 * clips, what went into each one, and a button that puts that input into the form.
 */
export function VideoMakerExamples({
  onTry,
  loadingId,
  busy,
}: {
  onTry: (example: VideoMakerExample) => void;
  loadingId: string | null;
  busy: boolean;
}) {
  return (
    <ToolExamples
      heading="What Video Maker makes"
      intro="Real Video Maker clips with made-up people and businesses. Under each one: exactly what went in. Your video appears here once you click Generate."
      examples={VIDEO_MAKER_EXAMPLES}
      media={(example) => <ExampleVideo src={example.videoUrl} poster={example.posterUrl} landscape={example.aspect_ratio === '16:9'} loop />}
      renderInputs={(example) => (
        <>
          <ExampleText>{example.prompt}</ExampleText>
          <div className="flex flex-wrap items-center gap-2">
            {example.firstFrame && <ExampleFile name={example.firstFrame.name} url={example.firstFrame.url} kind="photo" caption="First frame" />}
            {example.lastFrame && <ExampleFile name={example.lastFrame.name} url={example.lastFrame.url} kind="photo" caption="Last frame" />}
            <ExampleChip>{MODEL_LABEL[example.model]}</ExampleChip>
            <ExampleChip>{example.duration}s</ExampleChip>
            <ExampleChip>{example.aspect_ratio}</ExampleChip>
            {example.camera_motion !== 'none' && <ExampleChip>Camera: {cameraLabel(example.camera_motion)}</ExampleChip>}
            {example.generate_audio && <ExampleChip>AI audio</ExampleChip>}
          </div>
        </>
      )}
      onTry={onTry}
      loadingId={loadingId}
      busy={busy}
      tryNote="Fills in the form. Nothing is charged until you click Generate."
    />
  );
}

/** Short rules for a strong result, above the form. */
export function VideoMakerTips() {
  return (
    <ToolTips
      storageKey="videoMaker.tips.closed"
      tips={[
        'Describe one shot: who is in it, what happens, where, how the camera moves, the light and the sound. One action per clip works best.',
        'Need your real product, house or face in the video? Upload a photo as the First Frame and describe only what moves.',
        'Spoken words go in quotes: The baker says: "We open at 7." Plan about 2 words per second of video.',
        'Fast for quick drafts and clips up to 20 seconds. Pro for products and presenters at the best price. Ultra for faces, voices and the most realistic motion.',
        'Before and after: add a Last Frame, and the video moves from the first picture to the last.',
        'Want the camera to hold still? Write "static camera", or pick Static under Camera Movement on Fast.',
      ]}
    />
  );
}
