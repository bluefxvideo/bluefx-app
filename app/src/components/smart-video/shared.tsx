'use client';

import { useEffect, useState } from 'react';
import { FileVideo, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { SmartVideoJob } from '@/types/smart-video';

/**
 * Pieces the Phantom's page and ReelEstate's automatic listing video share:
 * both run on the same job system and offer the same sound switches.
 */

/** The soundtrack of a video in words, e.g. "music only". */
export function soundLabel(job: SmartVideoJob): string {
  const voiceOver = job.voiceOver !== false;
  const music = job.music !== false;
  if (voiceOver && music) return 'voice-over and music';
  if (voiceOver) return 'voice-over only';
  if (music) return 'music only';
  return 'no sound';
}

/** Voice-over on or off, music on or off: on the form for a new video, and under a finished one for the next version. */
export function SoundSwitches({
  id,
  voiceOver,
  music,
  onVoiceOver,
  onMusic,
  disabled,
}: {
  id: string;
  voiceOver: boolean;
  music: boolean;
  onVoiceOver: (on: boolean) => void;
  onMusic: (on: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="divide-y rounded-lg border">
      <div className="flex items-start justify-between gap-4 p-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-voice`}>Voice-over</Label>
          <p className="text-xs text-muted-foreground">
            {voiceOver ? 'A narrator reads the script.' : 'Off: nobody reads the script. The words appear as captions, in the same rhythm.'}
          </p>
        </div>
        <Switch id={`${id}-voice`} checked={voiceOver} onCheckedChange={onVoiceOver} disabled={disabled} />
      </div>
      <div className="flex items-start justify-between gap-4 p-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-music`}>Music</Label>
          <p className="text-xs text-muted-foreground">
            {music
              ? 'Music made for this video.'
              : voiceOver
                ? 'Off: the voice plays without music.'
                : 'Off: the video has no sound. Add your own track where you post it.'}
          </p>
        </div>
        <Switch id={`${id}-music`} checked={music} onCheckedChange={onMusic} disabled={disabled} />
      </div>
    </div>
  );
}

// A picked file as a picture, so a wrong upload is caught before it costs credits.
export function FileThumb({ file, disabled, onRemove }: { file: File; disabled: boolean; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const isVideo = file.type.startsWith('video');
  return (
    <div className="relative aspect-square overflow-hidden rounded-md border bg-muted" title={file.name}>
      {url && isVideo && <video src={`${url}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full object-cover" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing for next/image to optimise */}
      {url && !isVideo && <img src={url} alt={file.name} className="h-full w-full object-cover" />}
      {isVideo && (
        <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white">
          <FileVideo className="h-3 w-3" />
          clip
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${file.name}`}
        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black disabled:opacity-50"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
