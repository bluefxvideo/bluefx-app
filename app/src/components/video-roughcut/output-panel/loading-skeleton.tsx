'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Film } from 'lucide-react';

/**
 * Empty state shown before any job is running.
 */
export function LoadingSkeleton() {
  return (
    <Card className="h-full flex items-center justify-center">
      <CardContent className="text-center text-muted-foreground py-12">
        <Film className="w-12 h-12 mx-auto mb-4 opacity-40" />
        <p className="font-medium">Drop a video to get started</p>
        <p className="text-sm mt-2 max-w-sm mx-auto">
          We&apos;ll cut the umms, false starts, and bad takes — then hand you an XML to open in Premiere.
        </p>
      </CardContent>
    </Card>
  );
}
