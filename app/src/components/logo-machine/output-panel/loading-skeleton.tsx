'use client';

import { Card } from '@/components/ui/card';

/**
 * Loading skeleton for thumbnail generation
 * Shows animated placeholders during generation
 */
export function LoadingSkeleton() {
  return (
    <div className="flex-1 space-y-6">
      {/* Generation Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-muted animate-pulse rounded w-32" />
          <div className="h-4 bg-muted animate-pulse rounded w-16" />
        </div>
        <div className="w-full bg-muted/30 rounded-full h-2">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          AI is generating your thumbnails... This usually takes 30-60 seconds
        </p>
      </div>

      {/* Thumbnail Placeholders */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="overflow-hidden">
            <div className="aspect-video bg-muted animate-pulse" />
            <div className="p-2">
              <div className="h-3 bg-muted animate-pulse rounded w-16" />
            </div>
          </Card>
        ))}
      </div>

      {/* Status Messages */}
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
        <p className="text-sm text-muted-foreground">
          Processing with AI models...
        </p>
      </div>
    </div>
  );
}