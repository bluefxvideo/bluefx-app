'use client';

import { BatchAnimationQueue } from '@/components/ai-cinematographer/batch-animation-queue';
import { Button } from '@/components/ui/button';
import { Loader2, Play, VideoIcon } from 'lucide-react';
import type { AnimationQueueItem } from '@/components/ai-cinematographer/batch-animation-queue';
import type { AnalyzerShot } from '@/lib/scene-breakdown/types';

interface VideoGenerationStepProps {
  queue: AnimationQueueItem[];
  isProcessing: boolean;
  progress: { current: number; total: number };
  onProcessQueue: () => void;
  onUpdateItem: (id: string, updates: Partial<AnimationQueueItem>) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onRetryItem: (id: string) => void;
  credits: number;
  analyzerShots: AnalyzerShot[];
}

export function VideoGenerationStep({
  queue,
  isProcessing,
  progress,
  onProcessQueue,
  onUpdateItem,
  onRemoveItem,
  onClearQueue,
  onRetryItem,
  credits,
  analyzerShots,
}: VideoGenerationStepProps) {
  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const completedCount = queue.filter(q => q.status === 'completed').length;
  const totalCount = queue.length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Generate Videos</h2>
          <p className="text-sm text-muted-foreground">
            {completedCount > 0
              ? `${completedCount}/${totalCount} clips generated`
              : `${totalCount} clips ready to animate`}
          </p>
        </div>

        {pendingCount > 0 && !isProcessing && (
          <Button onClick={onProcessQueue} className="bg-primary">
            <Play className="w-4 h-4 mr-2" />
            Generate All Videos ({pendingCount})
          </Button>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating {progress.current}/{progress.total}...
          </div>
        )}
      </div>

      {/* Queue */}
      {queue.length > 0 ? (
        <BatchAnimationQueue
          queue={queue}
          isProcessing={isProcessing}
          progress={progress}
          onUpdateItem={onUpdateItem}
          onRemoveItem={onRemoveItem}
          onClearQueue={onClearQueue}
          onProcessQueue={onProcessQueue}
          onRetryItem={onRetryItem}
          credits={credits}
          analyzerShots={analyzerShots}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <VideoIcon className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm">No clips in the queue</p>
          <p className="text-xs mt-1">Go back to Step 3 and generate images first</p>
        </div>
      )}
    </div>
  );
}
