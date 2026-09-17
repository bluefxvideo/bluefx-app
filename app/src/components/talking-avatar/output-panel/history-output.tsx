'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Clock, Loader2, Trash2, Video, RefreshCw } from 'lucide-react';
import type { TalkingAvatarVideo } from '@/actions/database/talking-avatar-database';
import { readAvatarTier, tierLabel } from '@/types/talking-avatar-tiers';

interface HistoryOutputProps {
  videos: TalkingAvatarVideo[];
  isLoading: boolean;
  /** True when the last load failed, so an empty list is not mistaken for "no videos". */
  loadFailed?: boolean;
  refreshTrigger?: number; // Change this value to trigger a refresh
  onRefresh?: () => void;
  onDeleteVideo?: (videoId: string) => Promise<boolean>;
  onCheckStatus?: (video: TalkingAvatarVideo) => Promise<void>;
}

/** A video still "being made" after this long gets a "Check this video" button. */
const STUCK_AFTER_MS = 10 * 60 * 1000;
/** Cards shown at first and added per "Show more": 200 cards at once is a heavy page. */
const HISTORY_PAGE_SIZE = 24;

/**
 * The avatar photo stands in as the poster. Library photos are 1920 px wide and an
 * own photo can be several MB, so photos in our storage go through the image
 * optimizer at card size. Anything else is used as it is.
 */
function posterUrl(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  const ours = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (ours && src.startsWith(ours)) return `/_next/image?url=${encodeURIComponent(src)}&w=640&q=70`;
  return src;
}

function statusLabel(status: string): string {
  if (status === 'completed') return 'Ready';
  if (status === 'failed') return 'Failed';
  return 'Being made';
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'failed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  }
}

function timeAgo(dateString: string | null | undefined): string {
  const then = new Date(dateString || '').getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Why a video failed, in the words the server stored. Never promises a refund on its own. */
function failureText(video: TalkingAvatarVideo): string {
  if (video.error_message) {
    // Rows written before the wording pass joined the refund with a dash
    return video.error_message.replace(/\s+—\s+/g, '. ');
  }
  if ((video.audio_url || '').startsWith('blob:')) {
    return 'The uploaded recording did not reach the video engine. That fault is fixed. Upload the recording again to make this video.';
  }
  return 'This video could not be made.';
}

async function downloadVideo(video: TalkingAvatarVideo) {
  if (!video.video_url) return;
  try {
    const response = await fetch(video.video_url);
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `avatar-video-${video.id.slice(0, 8)}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    // Fallback: the browser's own player has a download control
    window.open(video.video_url, '_blank');
  }
}

/**
 * History: past avatar videos with a real thumbnail, the reason when one
 * failed, and Download and Delete always in view.
 */
export function HistoryOutput({
  videos,
  isLoading,
  loadFailed,
  onRefresh,
  onDeleteVideo,
  onCheckStatus,
}: HistoryOutputProps) {
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [checkingItems, setCheckingItems] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);

  // "5 minutes ago" and the "Check this video" button depend on the clock: an idle
  // History tab would otherwise never redraw them
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setClockTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const handleCheckStatus = async (video: TalkingAvatarVideo) => {
    if (!onCheckStatus) return;
    setCheckingItems(prev => new Set(prev).add(video.id));
    try {
      await onCheckStatus(video);
    } catch (error) {
      console.error('Error checking video status:', error);
    } finally {
      setCheckingItems(prev => {
        const next = new Set(prev);
        next.delete(video.id);
        return next;
      });
    }
  };

  const handleDeleteVideo = async (videoId: string, stillBeingMade: boolean) => {
    if (!onDeleteVideo) return;
    const question = stillBeingMade
      ? 'This video never finished. Press "Check this video" first to get the credits back. Delete it anyway?'
      : 'Delete this video? A deleted video cannot be brought back.';
    if (!window.confirm(question)) return;

    setDeletingItems(prev => new Set(prev).add(videoId));
    try {
      await onDeleteVideo(videoId);
    } catch (error) {
      console.error('Error deleting video:', error);
    } finally {
      setDeletingItems(prev => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
    }
  };

  const hasVideos = !!videos && videos.length > 0;

  // First load only: a refresh keeps the list on screen
  if (isLoading && !hasVideos) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your videos...</p>
        </div>
      </div>
    );
  }

  if (!hasVideos) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
          <Video className="w-12 h-12 text-muted-foreground mx-auto" />
          {loadFailed ? (
            <div className="space-y-3">
              <h3 className="font-medium">Your videos could not be loaded.</h3>
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={onRefresh}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try again
                </Button>
              )}
            </div>
          ) : (
            <div>
              <h3 className="font-medium mb-2">No videos yet</h3>
              <p className="text-sm text-muted-foreground">Finished avatar videos show up here.</p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hover p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.slice(0, visibleCount).map((video) => {
          const isFailed = video.status === 'failed';
          const isBeingMade = !isFailed && video.status !== 'completed';
          // No thumbnail is ever stored, so the avatar photo stands in until the video plays
          const poster = posterUrl(video.thumbnail_url || video.avatar_image_url);
          const isTall = !!video.resolution_width && !!video.resolution_height && video.resolution_height > video.resolution_width;
          const seconds = video.duration_seconds ?? video.audio_duration_seconds;
          const ageMs = Date.now() - new Date(video.created_at || '').getTime();
          const looksStuck = isBeingMade && Number.isFinite(ageMs) && ageMs > STUCK_AFTER_MS;
          const when = timeAgo(video.created_at);

          return (
            <Card key={video.id} className="p-3 bg-secondary">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className={`text-sm ${statusColor(video.status)}`}>{statusLabel(video.status)}</Badge>
                  <Badge variant="outline" className="text-xs">{tierLabel(readAvatarTier(video))}</Badge>
                </div>

                <p className="font-medium text-base leading-tight line-clamp-2">
                  {video.script_text || 'Uploaded recording'}
                </p>

                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>
                    {when}
                    {seconds ? `${when ? ' · ' : ''}${Math.round(Number(seconds))} seconds` : ''}
                  </span>
                </div>

                {isFailed ? (
                  <p className="text-sm text-muted-foreground bg-muted rounded p-3">{failureText(video)}</p>
                ) : (
                  <div className={`bg-black rounded overflow-hidden relative ${isTall ? 'aspect-[9/16] max-h-[420px] mx-auto' : 'aspect-video'}`}>
                    {video.video_url ? (
                      <video
                        data-avatar-history-video
                        // Without a poster, #t=0.1 makes the browser paint a first frame
                        src={poster ? video.video_url : `${video.video_url}#t=0.1`}
                        poster={poster}
                        preload={poster ? 'none' : 'metadata'}
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                        onPlay={(e) => {
                          // One video at a time: two cards talking over each other is noise
                          document.querySelectorAll<HTMLVideoElement>('video[data-avatar-history-video]').forEach((other) => {
                            if (other !== e.currentTarget) other.pause();
                          });
                        }}
                      />
                    ) : poster ? (
                      <img
                        src={poster}
                        alt={video.script_text || 'Avatar photo'}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}

                    {isBeingMade && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {video.video_url && !isFailed && (
                    <Button variant="outline" size="sm" onClick={() => downloadVideo(video)}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                  {looksStuck && onCheckStatus && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCheckStatus(video)}
                      disabled={checkingItems.has(video.id)}
                    >
                      {checkingItems.has(video.id)
                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        : <RefreshCw className="w-4 h-4 mr-2" />}
                      {checkingItems.has(video.id) ? 'Checking...' : 'Check this video'}
                    </Button>
                  )}
                  {/* No Delete on a video that is still rendering: the row is what the finished video lands in */}
                  {onDeleteVideo && (!isBeingMade || looksStuck) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => handleDeleteVideo(video.id, isBeingMade)}
                      disabled={deletingItems.has(video.id)}
                      title="Delete this video"
                      aria-label="Delete this video"
                    >
                      {deletingItems.has(video.id)
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {videos.length > visibleCount && (
        <div className="pt-4">
          <Button variant="outline" className="w-full" onClick={() => setVisibleCount((n) => n + HISTORY_PAGE_SIZE)}>
            Show more videos ({videos.length - visibleCount} more)
          </Button>
        </div>
      )}
    </div>
  );
}
