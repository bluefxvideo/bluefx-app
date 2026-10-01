'use client';

import { ExampleChip, ExampleFile, ExampleText, ExampleVideo, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
import { tierLabel } from '@/types/talking-avatar-tiers';
import { AVATAR_EXAMPLES, type AvatarExample } from './examples';

/**
 * Shown where the result appears before an avatar is picked: real AI Avatar
 * videos, what went into each one, and a button that puts that input into the wizard.
 */
export function AvatarExamples({ onTry }: { onTry: (example: AvatarExample) => void }) {
  return (
    <ToolExamples
      heading="What AI Avatar makes"
      intro="Real AI Avatar videos with library avatars and made-up businesses. Under each one: exactly what went in. Your video appears here once you generate it."
      examples={AVATAR_EXAMPLES}
      media={(example) => (
        <ExampleVideo src={example.videoUrl} poster={example.posterUrl} landscape={example.resolution === 'landscape'} />
      )}
      cost={(example) => {
        const rate = example.credits / example.seconds;
        return `Cost: ${example.credits} credits · ${example.seconds} seconds at ${rate} ${rate === 1 ? 'credit' : 'credits'} a second`;
      }}
      renderInputs={(example) => (
        <>
          <ExampleText>{example.script}</ExampleText>
          <div className="flex flex-wrap items-center gap-2">
            <ExampleFile name={example.photo.name} url={example.photo.url} kind="photo" caption="Avatar" />
            <ExampleChip>{tierLabel(example.tier)}</ExampleChip>
            <ExampleChip>{example.voice ? `Voice: ${example.voice.name}` : 'Voice chosen by the avatar'}</ExampleChip>
            <ExampleChip>{example.resolution === 'landscape' ? 'Landscape' : 'Portrait'}</ExampleChip>
          </div>
          {example.action && <ExampleText>Movement: {example.action}</ExampleText>}
        </>
      )}
      onTry={onTry}
      loadingId={null}
      busy={false}
      tryNote="Fills in the avatar, script and settings. Nothing is charged until you generate."
    />
  );
}

/** Short rules for a strong result, above the wizard. */
export function AvatarTips() {
  return (
    <ToolTips
      storageKey="avatar.tips.closed"
      tips={[
        'Start with a clear photo, face toward the camera: a library avatar, your own photo, or one made with AI.',
        'Write the way people talk: short sentences, one idea each, and a clear next step (call, text, visit).',
        'Watch the counter under the script: it shows how long the video will be and what it costs.',
        'Basic: you pick the voice or upload your own recording. Up to 19 seconds, 1 credit a second.',
        'Fast and Ultra speak the script with a voice they choose: Fast 2 credits a second, Ultra 8 with the most realistic lip sync. Want your own voice? Use Switch voice on the finished video.',
        'Optional: say how the avatar should move ("smiles warmly and nods"). Left empty, the avatar simply talks to the camera.',
      ]}
    />
  );
}
