'use client';

import { Card } from '@/components/ui/card';

/**
 * Loading skeleton for video generation
 */
export function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Video Preview Skeleton */}
      <Card className="aspect-video bg-muted/50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-muted rounded-full mx-auto flex items-center justify-center">
            <div className="w-8 h-8 bg-muted-foreground/20 rounded-full animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-32 mx-auto" />
            <div className="h-3 bg-muted rounded w-24 mx-auto" />
          </div>
        </div>
      </Card>

      {/* Progress Steps */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-blue-100 rounded-full" />
          <div className="h-3 bg-muted rounded w-32" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <div className="h-3 bg-muted rounded w-40" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-muted rounded-full" />
          <div className="h-3 bg-muted rounded w-36" />
        </div>
      </div>

      {/* Metadata Placeholders */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded w-16" />
          <div className="h-4 bg-muted rounded w-12" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded w-20" />
          <div className="h-4 bg-muted rounded w-16" />
        </div>
      </div>
    </div>
  );
}