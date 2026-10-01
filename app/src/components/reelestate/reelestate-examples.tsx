'use client';

import { Home, ImageIcon } from 'lucide-react';
import { ExampleChip, ExampleFile, ExampleText, ExampleVideo, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
import { CLEANUP_PRESET_CONFIG } from '@/types/reelestate';
import { BeforeAfterView } from './components/before-after-view';
import {
  LISTING_VIDEO_EXAMPLES,
  PHOTO_CLEANUP_EXAMPLES,
  type ListingVideoExample,
  type PhotoCleanupExample,
} from './examples';

/**
 * Shown where the listing video appears while no project is open: a real video
 * from this tool, the photos and settings behind it, and a button that starts a
 * project with them.
 */
export function ListingVideoExamples({
  onTry,
  loadingId,
  busy,
}: {
  onTry: (example: ListingVideoExample) => void;
  loadingId: string | null;
  busy: boolean;
}) {
  return (
    <ToolExamples
      heading="What ReelEstate makes"
      intro="A real listing video made with this tool from the 8 photos below. The house is made up. Under it: exactly what went in."
      icon={Home}
      examples={LISTING_VIDEO_EXAMPLES}
      media={(example) => (
        <ExampleVideo src={example.videoUrl} poster={example.posterUrl} landscape={example.aspectRatio === '16:9'} />
      )}
      cost={(example) => {
        const { photoCheck, script, voice } = example.credits;
        return `Cost: ${photoCheck + script + voice} credits in total · ${photoCheck} for the photo check, ${script} for the script, ${voice} for the voice. The export is free.`;
      }}
      renderInputs={(example) => (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {example.photos.map((photo) => (
              <ExampleFile key={photo.name} name={photo.name} url={photo.url} kind="photo" />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExampleChip>{example.aspectRatio === '16:9' ? 'Landscape' : 'Portrait'}</ExampleChip>
            <ExampleChip>{example.targetDuration} seconds</ExampleChip>
            <ExampleChip>Intro Text: {example.introText}</ExampleChip>
            <ExampleChip>Voice: {example.voice.name}</ExampleChip>
            <ExampleChip>Music: {example.music.name}</ExampleChip>
          </div>
          <ExampleText>
            Script, written by the tool. The first line was edited to name the address: {example.script.join(' ')}
          </ExampleText>
        </>
      )}
      onTry={onTry}
      loadingId={loadingId}
      busy={busy}
      tryNote="Starts a project with these photos and settings, free. Nothing is charged until you click Analyze Photos."
    />
  );
}

/** Short rules for a strong listing video, above the form. */
export function ListingVideoTips() {
  return (
    <ToolTips
      storageKey="reelestate.video.tips.closed"
      tips={[
        'Use 6 to 12 photos, one per room, in the order a visitor walks the house: front, entry, living room, kitchen, bedrooms, bathroom, backyard.',
        'Paste a Zillow or Realtor.com link and the photos come in with the address (1 credit). Or upload your own photos.',
        'Analyze Photos reads every photo and leaves out the unusable ones. 1 credit per 5 photos.',
        'Choose the duration and the voice before the script. The script is written to fit that length with that voice, and the line above the script shows how long the voice needs.',
        'Edit any line before the voiceover. Name the address in the first line and say what to do next in the last one.',
        'Open in Studio is the editor: change the timing, the captions or the music there, then click Export. The export is free. Animate All turns the photos into moving clips for 6 credits a photo.',
      ]}
    />
  );
}

/**
 * Shown where cleaned photos appear while nothing is being cleaned: real
 * before and after pairs from this tool, and a button that puts the photo and
 * its cleanup type into the form.
 */
export function PhotoCleanupExamples({
  onTry,
  busy,
}: {
  onTry: (example: PhotoCleanupExample) => void;
  busy: boolean;
}) {
  return (
    <ToolExamples
      heading="What Photo Cleanup makes"
      intro="Three photos cleaned with this tool. The houses are made up. Drag the line to compare before and after."
      icon={ImageIcon}
      examples={PHOTO_CLEANUP_EXAMPLES}
      media={(example) => (
        <BeforeAfterView beforeUrl={example.beforeUrl} afterUrl={example.afterUrl} className="aspect-video" />
      )}
      cost={(example) => `Cost: ${example.credits} credits for one photo`}
      renderInputs={(example) => (
        <div className="flex flex-wrap items-center gap-2">
          <ExampleFile name={example.fileName} url={example.beforeUrl} kind="photo" caption="Photo" />
          <ExampleChip>Cleanup Type: {CLEANUP_PRESET_CONFIG[example.preset].label}</ExampleChip>
        </div>
      )}
      onTry={onTry}
      loadingId={null}
      busy={busy}
      tryNote="Puts this photo and its cleanup type into the form. Nothing is charged until you click Clean Up."
    />
  );
}

/** Short rules for a clean result, above the form. */
export function PhotoCleanupTips() {
  return (
    <ToolTips
      storageKey="reelestate.cleanup.tips.closed"
      tips={[
        'Pick the cleanup type that names the problem. Remove Clutter clears floors and furniture. Declutter Counters clears kitchen and bathroom counters. Remove Personal Items takes family photos and children\'s drawings.',
        'One cleanup type per run. A photo that needs two fixes goes through twice: download the first result and upload that file again.',
        'Custom Instructions: say what to remove and what must stay, in one or two sentences. "Remove the car from the driveway. Keep the garage door and the lawn the same."',
        'Each photo costs 2 credits. Add several photos to the queue and clean them in one go.',
        'Drag the line on a result to compare before and after. Download each cleaned photo right away: cleaned photos are not saved in History.',
      ]}
    />
  );
}
