'use client';

import { Home, ImageIcon, UserCircle } from 'lucide-react';
import { ExampleChip, ExampleFile, ExampleText, ExampleVideo, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
import { CLEANUP_PRESET_CONFIG } from '@/types/reelestate';
import { BeforeAfterView } from './components/before-after-view';
import {
  AGENT_CLONE_EXAMPLES,
  LISTING_VIDEO_EXAMPLES,
  PHOTO_CLEANUP_EXAMPLES,
  type AgentCloneExample,
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
      intro="A real listing video made with this tool from the 8 photos below, each photo animated in the Studio. The house is made up. Under it: exactly what went in."
      icon={Home}
      examples={LISTING_VIDEO_EXAMPLES}
      media={(example) => (
        <ExampleVideo src={example.videoUrl} poster={example.posterUrl} landscape={example.aspectRatio === '16:9'} />
      )}
      cost={(example) => {
        const { photoCheck, script, voice, animation } = example.credits;
        return `Cost: ${photoCheck + script + voice + animation} credits in total · ${photoCheck} for the photo check, ${script} for the script, ${voice} for the voice, ${animation} to animate the ${example.photos.length} photos. The export is free. With still photos the same video costs ${photoCheck + script + voice} credits.`;
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
            <ExampleChip>Studio: Animate All</ExampleChip>
          </div>
          <ExampleText>
            Script, written by the tool. The first line was edited to name the address: {example.script.join(' ')}
          </ExampleText>
        </>
      )}
      onTry={onTry}
      loadingId={loadingId}
      busy={busy}
      tryNote="Starts a project with these photos and settings, free. Nothing is charged until you click Analyze Photos. The animation is one click in the Studio."
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
        'Paste a Zillow or Realtor.com link and the photos come in with the address (1 credit). Or upload your own photos. Analyze Photos reads every photo and leaves out the unusable ones, 1 credit per 5 photos.',
        'Choose the duration and the voice before the script. The script is written to fit that length with that voice, and the line above the script shows how long the voice needs.',
        'Edit any line before the voiceover. Name the address in the first line and say what to do next in the last one.',
        'Open in Studio is the editor. Click Animate All there and every photo becomes a moving clip. The button shows the price first: 6 credits for most photos, more for a photo that stays on screen longer than 6 seconds. The example was made this way.',
        'In the Studio you also change the timing, the captions and the music. Then click Export. The export is free.',
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

/**
 * Shown where the agent clip appears while no shot is open: real Agent Clone
 * clips, the two photos and the settings behind each, and a button that puts
 * them into the form.
 */
export function AgentCloneExamples({
  onTry,
  busy,
}: {
  onTry: (example: AgentCloneExample) => void;
  busy: boolean;
}) {
  return (
    <ToolExamples
      heading="What Agent Clone makes"
      intro="Two clips made with this tool from one photo of an agent and one listing photo each. The agent and the house are made up. Under each: exactly what went in."
      icon={UserCircle}
      examples={AGENT_CLONE_EXAMPLES}
      media={(example) => (
        <ExampleVideo src={example.videoUrl} poster={example.posterUrl} landscape={example.aspectRatio === '16:9'} />
      )}
      cost={(example) => {
        const { composite, animation } = example.credits;
        return `Cost: ${composite + animation} credits in total · ${composite} for the composite picture, ${animation} for ${example.duration} seconds of video`;
      }}
      renderInputs={(example) => (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ExampleFile name={example.agentPhoto.name} url={example.agentPhoto.url} kind="photo" caption="Your photo" />
            <ExampleFile name={example.background.name} url={example.background.url} kind="photo" caption="Background" />
            <ExampleChip>{example.aspectRatio === '16:9' ? 'Landscape' : 'Portrait'}</ExampleChip>
            <ExampleChip>{example.duration}s</ExampleChip>
            {example.actionPreset && <ExampleChip>Action: {example.actionPreset}</ExampleChip>}
          </div>
          <ExampleText>Prompt: {example.prompt}</ExampleText>
          {!example.actionPreset && <ExampleText>Action: {example.action}</ExampleText>}
          <ExampleText>Dialogue: {example.dialogue}</ExampleText>
        </>
      )}
      onTry={onTry}
      loadingId={null}
      busy={busy}
      tryNote="Puts the two photos and the prompt into the form. Nothing is charged until you click Generate Composite."
    />
  );
}

/** Short rules for a strong agent clip, above the form. */
export function AgentCloneTips() {
  return (
    <ToolTips
      storageKey="reelestate.agentClone.tips.closed"
      tips={[
        'Use a clear photo of yourself from the knees or the waist up, on a plain background. The same photo works for every room.',
        'Add one listing photo as the background. The composite puts you into that room with matching light for 2 credits. Not right? Click Regenerate Composite.',
        'The prompt says where you stand: "standing next to the kitchen island", "on the front path, the whole house visible behind her".',
        'Then choose the length, an action and your line. About 2 words per second fit: 20 words for a 10-second clip.',
        'The video costs 1 credit per second, and the AI makes the voice. Want your own voice? Click Switch voice on the finished clip and upload a 10 to 30 second recording (4 credits).',
        'Landscape is for YouTube and listing sites, Portrait for Reels and TikTok. Finished clips are in History.',
      ]}
    />
  );
}
