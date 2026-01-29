'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  X,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Trash2,
  Zap,
  Sparkles,
} from 'lucide-react';

export interface QueueItem {
  id: string;
  frameNumber: number;
  imageUrl: string;
  prompt: string;
  dialogue?: string;
  duration: number;
  cameraStyle: 'none' | 'amateur' | 'stable' | 'cinematic';
  aspectRatio: string;
  model: 'fast' | 'pro';
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

interface BatchAnimationQueueProps {
  queue: QueueItem[];
  isProcessing: boolean;
  progress: { current: number; total: number };
  onUpdateItem: (id: string, updates: Partial<QueueItem>) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onProcessQueue: () => void;
  credits: number;
  analyzerShots?: Array<{
    shotNumber: number;
    description: string;
    duration: string;
    action?: string;
    dialogue?: string;
  }>;
}

const CAMERA_PRESETS: Record<QueueItem['cameraStyle'], string> = {
  none: 'None',
  amateur: 'Amateur',
  stable: 'Stable',
  cinematic: 'Cinematic',
};

// Duration options by model
const FAST_DURATIONS = [6, 8, 10, 12, 14, 16, 18, 20];
const PRO_DURATIONS = [5, 6, 7, 8, 9, 10];

// Aspect ratio options for Pro mode
const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '21:9', label: '21:9 (Ultrawide)' },
  { value: '9:21', label: '9:21' },
];

// Calculate credits for an item
const calculateItemCredits = (item: QueueItem): number => {
  if (item.model === 'pro') {
    return item.duration * 2;  // Pro: 2 credits/sec
  }
  return item.duration;  // Fast: 1 credit/sec (always 1080p)
};

export function BatchAnimationQueue({
  queue,
  isProcessing,
  progress,
  onUpdateItem,
  onRemoveItem,
  onClearQueue,
  onProcessQueue,
  credits,
  analyzerShots,
}: BatchAnimationQueueProps) {
  // No longer need editingPrompt state - always show textarea

  const pendingCount = queue.filter(i => i.status === 'pending').length;
  const completedCount = queue.filter(i => i.status === 'completed').length;
  const failedCount = queue.filter(i => i.status === 'failed').length;

  // Calculate total credits needed based on model
  const totalCredits = queue
    .filter(i => i.status === 'pending')
    .reduce((sum, item) => sum + calculateItemCredits(item), 0);

  const hasEnoughCredits = credits >= totalCredits;

  // Handle model change - also reset duration if needed
  const handleModelChange = (itemId: string, newModel: 'fast' | 'pro') => {
    const item = queue.find(i => i.id === itemId);
    if (!item) return;

    const validDurations = newModel === 'fast' ? FAST_DURATIONS : PRO_DURATIONS;
    const newDuration = validDurations.includes(item.duration)
      ? item.duration
      : validDurations[0];

    onUpdateItem(itemId, {
      model: newModel,
      duration: newDuration,
    });
  };

  if (queue.length === 0) {
    return null;
  }

  return (
    <div data-animation-queue className="border rounded-lg p-4 space-y-4 bg-muted/10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Animation Queue</h3>
          <p className="text-sm text-muted-foreground">
            {pendingCount} pending
            {completedCount > 0 && ` • ${completedCount} completed`}
            {failedCount > 0 && ` • ${failedCount} failed`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearQueue}
            disabled={isProcessing}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      {/* Progress bar when processing */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Generating videos...</span>
            <span>{progress.current}/{progress.total}</span>
          </div>
          <Progress value={(progress.current / progress.total) * 100} />
        </div>
      )}

      {/* Queue items */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {queue.map((item) => {
          const itemCredits = calculateItemCredits(item);
          const durations = item.model === 'fast' ? FAST_DURATIONS : PRO_DURATIONS;

          return (
            <div
              key={item.id}
              className={`border rounded-lg p-3 ${
                item.status === 'generating' ? 'border-primary bg-primary/5' :
                item.status === 'completed' ? 'border-green-500/50 bg-green-500/5' :
                item.status === 'failed' ? 'border-destructive/50 bg-destructive/5' :
                ''
              }`}
            >
              <div className="flex gap-3">
                {/* Thumbnail */}
                <div className="w-24 h-16 rounded overflow-hidden shrink-0 bg-muted">
                  <img
                    src={item.imageUrl}
                    alt={`Frame ${item.frameNumber}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Frame {item.frameNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        ({itemCredits} credits)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === 'generating' && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      )}
                      {item.status === 'completed' && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {item.status === 'failed' && (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      )}
                      {item.status === 'pending' && !isProcessing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onRemoveItem(item.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Prompt section - always visible */}
                  {item.status === 'pending' && !isProcessing ? (
                    <div className="space-y-2">
                      {/* Shot selector dropdown if analyzer shots available */}
                      {analyzerShots && analyzerShots.length > 0 && (
                        <Select
                          onValueChange={(val) => {
                            const shot = analyzerShots[parseInt(val)];
                            if (shot) {
                              const parts: string[] = [];
                              if (shot.action) parts.push(shot.action);
                              if (shot.dialogue) parts.push(`Narration: "${shot.dialogue}"`);
                              const prompt = parts.length > 0 ? parts.join('\n\n') : shot.description;
                              onUpdateItem(item.id, {
                                prompt,
                                dialogue: shot.dialogue,
                              });
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Pre-fill from analyzed shot..." />
                          </SelectTrigger>
                          <SelectContent>
                            {analyzerShots.map((shot, idx) => (
                              <SelectItem key={idx} value={idx.toString()} className="text-xs">
                                Shot {shot.shotNumber}: {(shot.action || shot.description || '').substring(0, 40)}...
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Textarea
                        value={item.prompt}
                        onChange={(e) => onUpdateItem(item.id, { prompt: e.target.value })}
                        className="text-xs min-h-[60px]"
                        placeholder="Describe the action/motion for this video..."
                      />
                      {item.dialogue && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                          Dialogue: &quot;{item.dialogue}&quot;
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.prompt || '(No prompt)'}
                      </p>
                      {item.dialogue && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          &quot;{item.dialogue}&quot;
                        </p>
                      )}
                    </div>
                  )}

                  {/* Settings row - only for pending items */}
                  {item.status === 'pending' && !isProcessing && (
                    <div className="space-y-2">
                      {/* Model selector */}
                      <div className="flex gap-1">
                        <button
                          className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${
                            item.model === 'fast'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                          onClick={() => handleModelChange(item.id, 'fast')}
                        >
                          <Zap className="w-3 h-3" />
                          Fast
                        </button>
                        <button
                          className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${
                            item.model === 'pro'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                          onClick={() => handleModelChange(item.id, 'pro')}
                        >
                          <Sparkles className="w-3 h-3" />
                          Pro
                        </button>
                        <span className="text-xs text-muted-foreground ml-2">
                          {item.model === 'fast' ? '6-20s • 1080p' : '5-10s • Better lip-sync'}
                        </span>
                      </div>

                      {/* Duration */}
                      <div className="flex gap-1 flex-wrap">
                        {durations.map((d) => (
                          <button
                            key={d}
                            className={`px-2 py-0.5 rounded text-xs transition-colors ${
                              item.duration === d
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                            }`}
                            onClick={() => onUpdateItem(item.id, { duration: d })}
                          >
                            {d}s
                          </button>
                        ))}
                      </div>

                      {/* Aspect ratio - only for Pro mode */}
                      {item.model === 'pro' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Aspect:</span>
                          <Select
                            value={item.aspectRatio}
                            onValueChange={(value) => onUpdateItem(item.id, { aspectRatio: value })}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASPECT_RATIOS.map((ratio) => (
                                <SelectItem key={ratio.value} value={ratio.value} className="text-xs">
                                  {ratio.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Camera style */}
                      <div className="flex gap-1">
                        {(Object.entries(CAMERA_PRESETS) as [QueueItem['cameraStyle'], string][]).map(([key, label]) => (
                          <button
                            key={key}
                            className={`px-2 py-0.5 rounded text-xs transition-colors ${
                              item.cameraStyle === key
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                            }`}
                            onClick={() => onUpdateItem(item.id, { cameraStyle: key })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completed: show download */}
                  {item.status === 'completed' && item.videoUrl && (
                    <a
                      href={item.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Download className="w-3 h-3" />
                      Download video
                    </a>
                  )}

                  {/* Failed: show error */}
                  {item.status === 'failed' && item.error && (
                    <p className="text-xs text-destructive">{item.error}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with generate button */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm">
            <span className={hasEnoughCredits ? 'text-muted-foreground' : 'text-destructive'}>
              Total: {totalCredits} credits
            </span>
            {!hasEnoughCredits && (
              <span className="text-destructive"> (need {totalCredits - credits} more)</span>
            )}
          </div>
          <Button
            onClick={onProcessQueue}
            disabled={isProcessing || !hasEnoughCredits}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Generate All ({pendingCount})
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
