'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CinematographerResponse } from '@/actions/tools/ai-cinematographer';
import { VideoPreview } from './video-preview';
import { LoadingSkeleton } from './loading-skeleton';
import { ErrorDisplay } from './error-display';
import { GenerateEmptyState, HistoryEmptyState } from './tab-empty-states';
import { Download, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface CinematographerOutputProps {
  result?: CinematographerResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
  activeTab?: string;
}

/**
 * Output Panel - Right side of two-column layout
 * Displays video generation results, loading states, and errors
 */
export function CinematographerOutput({
  result,
  isGenerating,
  error,
  onClearResults,
  activeTab = 'generate'
}: CinematographerOutputProps) {
  // Loading state
  if (isGenerating) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <h3 className="font-medium">Generating Video</h3>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="w-3 h-3 mr-1" />
            Processing
          </Badge>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <h3 className="font-medium text-destructive">Generation Failed</h3>
          </div>
        </div>
        <ErrorDisplay error={error} onRetry={() => {}} />
      </div>
    );
  }

  // Success state with results
  if (result && result.success) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600" />
            <h3 className="font-medium">Video Generated</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
              {result.video?.duration || 0}s video
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearResults}
              className="text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Generation Stats */}
        <Card className="p-3 mb-4 bg-muted/30">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-primary">{result.credits_used}</p>
              <p className="text-xs text-muted-foreground">Credits Used</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{Math.round(result.generation_time_ms / 1000)}s</p>
              <p className="text-xs text-muted-foreground">Generation Time</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{result.remaining_credits || 0}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </div>
        </Card>

        {/* Warnings */}
        {result.warnings && result.warnings.length > 0 && (
          <Card className="p-3 mb-4 bg-yellow-50 border-yellow-200">
            <div className="space-y-1">
              {result.warnings.map((warning, index) => (
                <p key={index} className="text-xs text-yellow-700 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {warning}
                </p>
              ))}
            </div>
          </Card>
        )}

        {/* Video Preview */}
        <div className="flex-1 overflow-y-auto">
          {result.video && (
            <VideoPreview
              video={result.video}
              batchId={result.batch_id}
            />
          )}
        </div>

        {/* Download Button */}
        {result.video && result.video.video_url && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download Video
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Empty state
  return (
    <div className="h-full flex flex-col">
      {activeTab === 'history' ? (
        <HistoryEmptyState />
      ) : (
        <GenerateEmptyState />
      )}
    </div>
  );
}