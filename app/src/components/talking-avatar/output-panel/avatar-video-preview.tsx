'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Mic, Plus, RotateCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { ElapsedTimer } from '@/components/tools/elapsed-timer';
import { AVATAR_VOICE_SWITCH_CREDITS, isScriptTier, tierLabel, waitLabelFor, type AvatarQualityTier } from '@/types/talking-avatar-tiers';

interface AvatarVideoPreviewProps {
  video: {
    id: string;
    video_url: string;
    thumbnail_url?: string;
    script_text: string;
    avatar_image_url: string;
    created_at: string;
    /** The copy with the user's own voice ("Switch voice"), when one was made. */
    voice_video_url?: string | null;
  };
  /** Downloads the version on screen (the user's voice or the original). */
  onDownload?: (url: string) => void;
  /** Back to the script with the same avatar and tier. */
  onMakeAnother?: () => void;
  /** Clears avatar, tier choice aside, and script: the wizard's own "Start Over". */
  onStartOver?: () => void;
  /** Quality tier the video was made on; shown as the card badge. */
  tier?: AvatarQualityTier;
  /** When the render began (ms), so the clock survives a remount or a reload. */
  startedAt?: number | null;
  /** The server accepted the job: from then on the video lands in History even if the page is closed. */
  accepted?: boolean;
  /** Portrait was chosen for this video (exact on Basic and Fast), so the frame does not jump after load. */
  portraitHint?: boolean;
  /** Switch voice: null file = reuse the remembered sample. Absent = feature hidden. */
  onSwitchVoice?: (file: File | null) => void;
  lastVoiceSample?: { url: string; name: string } | null;
  isSwitchingVoice?: boolean;
}

/**
 * One card for the video while it is being made and once it is ready.
 * "Switch voice" works as in Video Maker and Agent Clone: the picture stays,
 * only the audio track is replaced with the user's own voice.
 */
export function AvatarVideoPreview({
  video,
  onDownload,
  onMakeAnother,
  onStartOver,
  tier,
  startedAt,
  accepted,
  portraitHint,
  onSwitchVoice,
  lastVoiceSample,
  isSwitchingVoice,
}: AvatarVideoPreviewProps) {
  // A tall video gets a tall frame; in a 16:9 box it shrank to a narrow strip.
  // The hint sets it before the file loads; the video's own size corrects it (Ultra follows the photo).
  const [isPortrait, setIsPortrait] = useState(!!portraitHint);
  // No thumbnail is ever stored: the avatar photo stands in until the video plays
  const poster = video.thumbnail_url || video.avatar_image_url || undefined;
  const ready = !!video.video_url;

  // Switch voice UI state
  const [view, setView] = useState<'voice' | 'original'>('voice');
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [useLastSample, setUseLastSample] = useState(false);
  const [isVoiceDragging, setIsVoiceDragging] = useState(false);
  const voiceFileRef = useRef<HTMLInputElement>(null);
  const showVoice = view === 'voice' && !!video.voice_video_url;
  const shownVideoUrl = showVoice ? (video.voice_video_url as string) : video.video_url;
  const canSwitchVoice = !!voiceFile || (useLastSample && !!lastVoiceSample);

  // A new version with the user's voice: show it, and do not keep the used file armed
  // for another paid click
  useEffect(() => {
    if (!video.voice_video_url) return;
    setView('voice');
    setVoiceFile(null);
    setUseLastSample(false);
  }, [video.voice_video_url]);

  const acceptVoiceFile = (file: File | undefined) => {
    if (!file) return;
    // The upload takes these three types only, judged by the file name
    if (/\.(mp3|wav|m4a)$/i.test(file.name)) {
      setVoiceFile(file);
      setUseLastSample(false);
    } else {
      toast.error('Upload an MP3, WAV or M4A voice sample');
    }
  };

  return (
    <div className="w-full h-auto">
      <Card className="overflow-hidden h-auto">
        {ready ? (
          <div className={isPortrait ? 'relative aspect-[9/16] w-full max-w-[320px] max-h-[65vh] mx-auto bg-black' : 'relative aspect-video max-h-[60vh] w-full bg-black'}>
            {video.voice_video_url && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md border border-white/20 bg-black/60 p-0.5 text-xs backdrop-blur">
                <button
                  type="button"
                  onClick={() => setView('voice')}
                  className={`px-2.5 py-1 rounded ${showVoice ? 'bg-primary text-primary-foreground' : 'text-white/80'}`}
                >
                  <Mic className="w-3 h-3 inline mr-1" />
                  Your voice
                </button>
                <button
                  type="button"
                  onClick={() => setView('original')}
                  className={`px-2.5 py-1 rounded ${!showVoice ? 'bg-primary text-primary-foreground' : 'text-white/80'}`}
                >
                  Original
                </button>
              </div>
            )}
            <video
              key={shownVideoUrl}
              src={shownVideoUrl}
              className="w-full h-full object-contain"
              controls
              playsInline
              preload="metadata"
              poster={poster}
              onLoadedMetadata={(e) => setIsPortrait(e.currentTarget.videoHeight > e.currentTarget.videoWidth)}
            />
            {isSwitchingVoice && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <span className="text-sm text-white font-medium">Switching voice...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="relative aspect-video bg-muted flex items-center justify-center p-4 sm:p-8">
            <Card className="p-6 sm:p-8 w-full max-w-96 text-center space-y-4 border-dashed bg-transparent dark:bg-card-content border-input flex flex-col justify-center">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Making your video</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {accepted
                    ? 'You can leave this page. The finished video lands in History.'
                    : 'Starting the video. Stay on this page for a moment.'}
                </p>
                <p>
                  <ElapsedTimer typical={waitLabelFor(tier)} since={startedAt} className="text-xs text-muted-foreground tabular-nums" />
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Switch voice: the user's own voice on the finished video */}
        {ready && onSwitchVoice && (
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsVoiceDragging(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsVoiceDragging(false); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsVoiceDragging(false); acceptVoiceFile(e.dataTransfer.files[0]); }}
            className={`mx-4 mt-3 mb-1 rounded-lg border bg-muted/20 p-3 space-y-2 transition-colors ${isVoiceDragging ? 'border-primary bg-primary/5' : 'border-border/50'}`}
          >
            <div className="flex items-center gap-2">
              <Mic className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium">
                {video.voice_video_url ? 'Your voice is on this video' : 'Put your own voice on this video'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Upload or drop a clean recording of your voice (10 to 30 seconds, no music). The picture and the lip movement stay exactly as they are. Only the voice changes.
            </p>
            <input
              ref={voiceFileRef}
              type="file"
              accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (voiceFileRef.current) voiceFileRef.current.value = ''; acceptVoiceFile(f); }}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="shrink-0" disabled={isSwitchingVoice} onClick={() => voiceFileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {voiceFile || useLastSample ? 'Change sample' : 'Choose voice sample'}
              </Button>
              <span className="text-[11px] text-muted-foreground truncate">
                {voiceFile ? `Selected: ${voiceFile.name}` : useLastSample && lastVoiceSample ? `Using last sample: ${lastVoiceSample.name}` : 'MP3, WAV or M4A, or drop it here'}
              </span>
            </div>
            {lastVoiceSample && !voiceFile && !useLastSample && (
              <button type="button" onClick={() => setUseLastSample(true)} disabled={isSwitchingVoice} className="text-[11px] text-primary hover:underline text-left">
                Reuse the sample from last time ({lastVoiceSample.name})
              </button>
            )}
            <Button onClick={() => onSwitchVoice(useLastSample ? null : voiceFile)} disabled={!canSwitchVoice || isSwitchingVoice} size="sm" className="w-full">
              {isSwitchingVoice ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Switching voice...</>
              ) : (
                <><Mic className="w-3.5 h-3.5 mr-1.5" />{video.voice_video_url ? 'Switch voice again' : 'Switch voice'} ({AVATAR_VOICE_SWITCH_CREDITS} credits)</>
              )}
            </Button>
          </div>
        )}

        <div className="p-4 bg-card border-t space-y-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">{ready ? 'Your avatar video' : 'Making your video'}</h4>
              {tier && <Badge variant="outline" className="text-xs">{tierLabel(tier)}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {video.script_text || (ready ? 'Made from your uploaded recording' : '')}
            </p>
          </div>

          {ready && (
            <>
              {isScriptTier(tier) && !video.voice_video_url && (
                <p className="text-xs text-muted-foreground">
                  The voice can change from one video to the next. Put your own voice on this video above, or choose Basic for a voice you pick.
                </p>
              )}
              {onDownload && (
                <Button className="w-full" onClick={() => onDownload(shownVideoUrl)} disabled={isSwitchingVoice}>
                  <Download className="w-4 h-4 mr-2" />
                  {video.voice_video_url ? (showVoice ? 'Download video with your voice' : 'Download original video') : 'Download video'}
                </Button>
              )}
              {(onMakeAnother || onStartOver) && (
                <div className="flex flex-wrap gap-2">
                  {onMakeAnother && (
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onMakeAnother} disabled={isSwitchingVoice}>
                      <Plus className="w-4 h-4" />
                      Make another video
                    </Button>
                  )}
                  {onStartOver && (
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onStartOver} disabled={isSwitchingVoice}>
                      <RotateCcw className="w-4 h-4" />
                      Start over
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
