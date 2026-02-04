'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { HorizontalScroll } from '@/components/ui/horizontal-scroll';
import { cn } from '@/lib/utils';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

// ── Showcase Data ─────────────────────────────────────────────────

type VideoOrientation = 'horizontal' | 'vertical';

interface ShowcaseVideo {
  id: string;
  title: string;
  orientation: VideoOrientation;
}

const SHOWCASE_VIDEOS: ShowcaseVideo[] = [
  { id: 'HqMZZnXBe7Y', title: 'AI Lawyer Video Ad', orientation: 'horizontal' },
  { id: 'RkA-dugHLKw', title: 'Biscoff Cheesecake', orientation: 'vertical' },
  { id: 'jPNyyDoj0FY', title: 'UGC Ad Copy', orientation: 'vertical' },
  { id: 'bMD6pUBTawg', title: 'Product Ad Copy', orientation: 'vertical' },
  { id: 'jUW92QMgxt0', title: 'AI Cooking Video', orientation: 'vertical' },
  { id: 'SMG7bhMePoo', title: 'AI Fruits Showcase', orientation: 'vertical' },
  { id: 'xv3PeqtD3uc', title: 'Cinematic Product Shot', orientation: 'vertical' },
  { id: 'jAOFrOsdc7M', title: 'Clear Skin Ad', orientation: 'vertical' },
  { id: 'kYtZ1L5_e6Q', title: 'Real-Looking Imperfect Ads', orientation: 'vertical' },
  { id: 'ZbiAEYLnofU', title: 'Supplement Ad', orientation: 'horizontal' },
];

// ── Component ─────────────────────────────────────────────────────

export function VideoShowcase() {
  const [selectedVideo, setSelectedVideo] = useState<ShowcaseVideo | null>(null);

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Made with AI Media Machine</h2>
          <p className="text-sm text-muted-foreground">See what you can create</p>
        </div>
        <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
          Showcase
        </span>
      </div>

      {/* Row 1 */}
      <HorizontalScroll showArrows scrollAmount={400}>
        <div className="flex gap-3 pb-3 justify-center">
          {SHOWCASE_VIDEOS.slice(0, 5).map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onClick={() => setSelectedVideo(video)}
            />
          ))}
        </div>
      </HorizontalScroll>

      {/* Row 2 */}
      <HorizontalScroll showArrows scrollAmount={400}>
        <div className="flex gap-3 pb-2 justify-center">
          {SHOWCASE_VIDEOS.slice(5).map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onClick={() => setSelectedVideo(video)}
            />
          ))}
        </div>
      </HorizontalScroll>

      {/* Video playback modal */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent
          className={cn(
            'p-0 overflow-hidden gap-0 border-white/5',
            selectedVideo?.orientation === 'vertical'
              ? 'sm:max-w-[min(540px,90vw)]'
              : 'sm:max-w-[min(1100px,90vw)]'
          )}
          showCloseButton
        >
          <VisuallyHidden.Root>
            <DialogTitle>{selectedVideo?.title}</DialogTitle>
          </VisuallyHidden.Root>
          {selectedVideo && (
            <div
              className={cn(
                'w-full bg-black max-h-[85vh]',
                selectedVideo.orientation === 'vertical' ? 'aspect-[9/16]' : 'aspect-video'
              )}
            >
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1&rel=0`}
                title={selectedVideo.title}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Video Card ────────────────────────────────────────────────────

function VideoCard({ video, onClick }: { video: ShowcaseVideo; onClick: () => void }) {
  const isVertical = video.orientation === 'vertical';

  return (
    <div
      className={cn(
        'flex-shrink-0 group relative rounded-lg overflow-hidden bg-muted cursor-pointer',
        'transition-transform hover:scale-[1.02] hover:shadow-lg duration-200',
        'w-[240px] h-[427px]'
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <img
        src={`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`}
        alt={video.title}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 group-hover:scale-110 transition-all duration-200">
          <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
        </div>
      </div>

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5 pointer-events-none">
        <p className="text-xs font-medium text-white line-clamp-2 text-left leading-tight">
          {video.title}
        </p>
      </div>

      {/* Short badge */}
      {isVertical && (
        <div className="absolute top-2 right-2 pointer-events-none">
          <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
            SHORT
          </span>
        </div>
      )}
    </div>
  );
}
