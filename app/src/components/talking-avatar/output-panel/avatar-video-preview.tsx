'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Plus, RotateCcw } from 'lucide-react';
import { ElapsedTimer } from '@/components/tools/elapsed-timer';
import { isScriptTier, tierLabel, waitLabelFor, type AvatarQualityTier } from '@/types/talking-avatar-tiers';

interface AvatarVideoPreviewProps {
  video: {
    id: string;
    video_url: string;
    thumbnail_url?: string;
    script_text: string;
    avatar_image_url: string;
    created_at: string;
  };
  onDownload?: () => void;
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
}

/**
 * One card for the video while it is being made and once it is ready.
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
}: AvatarVideoPreviewProps) {
  // A tall video gets a tall frame; in a 16:9 box it shrank to a narrow strip.
  // The hint sets it before the file loads; the video's own size corrects it (Ultra follows the photo).
  const [isPortrait, setIsPortrait] = useState(!!portraitHint);
  // No thumbnail is ever stored: the avatar photo stands in until the video plays
  const poster = video.thumbnail_url || video.avatar_image_url || undefined;
  const ready = !!video.video_url;

  return (
    <div className="w-full h-auto">
      <Card className="overflow-hidden h-auto">
        {ready ? (
          <div className={isPortrait ? 'relative aspect-[9/16] w-full max-w-[320px] max-h-[65vh] mx-auto bg-black' : 'relative aspect-video max-h-[60vh] w-full bg-black'}>
            <video
              src={video.video_url}
              className="w-full h-full object-contain"
              controls
              playsInline
              preload="metadata"
              poster={poster}
              onLoadedMetadata={(e) => setIsPortrait(e.currentTarget.videoHeight > e.currentTarget.videoWidth)}
            />
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
              {isScriptTier(tier) && (
                <p className="text-xs text-muted-foreground">
                  The voice can change from one video to the next. For the same voice every time, choose Basic.
                </p>
              )}
              {onDownload && (
                <Button className="w-full" onClick={onDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download video
                </Button>
              )}
              {(onMakeAnother || onStartOver) && (
                <div className="flex flex-wrap gap-2">
                  {onMakeAnother && (
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onMakeAnother}>
                      <Plus className="w-4 h-4" />
                      Make another video
                    </Button>
                  )}
                  {onStartOver && (
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onStartOver}>
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
