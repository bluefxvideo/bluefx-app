'use client';

import { Card } from '@/components/ui/card';
import { Wand2, Sparkles } from 'lucide-react';

/**
 * Empty state when no results are available
 */
export function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto">
          <Wand2 className="w-8 h-8 text-white" />
        </div>
        
        <div>
          <h3 className="font-medium mb-2 flex items-center justify-center gap-2">
            Ready to Create Magic
            <Sparkles className="w-4 h-4 text-yellow-500" />
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enter a detailed prompt and customize your settings to generate amazing YouTube thumbnails powered by AI.
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">💡 Pro Tips:</p>
            <ul className="text-left space-y-1">
              <li>• Be specific about emotions and colors</li>
              <li>• Mention style preferences</li>
              <li>• Include lighting and composition details</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}