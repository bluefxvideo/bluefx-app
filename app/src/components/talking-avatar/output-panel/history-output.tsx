'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, ArrowLeft } from 'lucide-react';

export function HistoryOutput() {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <Card className="p-8 text-center max-w-md mx-auto">
        <History className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold mb-2">Video History</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Your talking avatar video history and management tools are displayed in the left panel.
        </p>
        <div className="space-y-3 text-xs text-left">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-100 rounded-full" />
            <span>Completed videos can be previewed and downloaded</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span>Processing videos show live progress updates</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span>Pending videos are queued for processing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span>Failed videos can be regenerated</span>
          </div>
        </div>
      </Card>
    </div>
  );
}