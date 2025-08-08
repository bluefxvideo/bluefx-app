'use client';

import { Card } from '@/components/ui/card';
import { History, Sparkles } from 'lucide-react';

export function HistoryOutput() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
        <div className="w-16 h-16 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center mx-auto">
          <History className="w-8 h-8 text-white" />
        </div>
        
        <div>
          <h3 className="font-medium mb-2 flex items-center justify-center gap-2">
            Video History
            <Sparkles className="w-4 h-4 text-yellow-500" />
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your generated videos will appear here with advanced filtering and search capabilities.
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">📊 Coming Soon:</p>
            <ul className="text-left space-y-1">
              <li>• 3-column grid layout</li>
              <li>• Filter by quality & date</li>
              <li>• Search by script content</li>
              <li>• One-click re-editing</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}