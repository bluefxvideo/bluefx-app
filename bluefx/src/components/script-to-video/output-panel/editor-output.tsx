'use client';

import { Card } from '@/components/ui/card';
import { Edit3, Sparkles } from 'lucide-react';

interface EditorOutputProps {
  result?: any;
  isEditing: boolean;
  error?: string;
}

export function EditorOutput({ result, isEditing, error }: EditorOutputProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto">
          <Edit3 className="w-8 h-8 text-white" />
        </div>
        
        <div>
          <h3 className="font-medium mb-2 flex items-center justify-center gap-2">
            Intelligent Video Editor
            <Sparkles className="w-4 h-4 text-yellow-500" />
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Make smart edits with minimal regeneration. Real-time preview will appear here during editing.
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">⚡ AI Editor Features:</p>
            <ul className="text-left space-y-1">
              <li>• Smart impact analysis</li>
              <li>• Minimal regeneration</li>
              <li>• Real-time preview</li>
              <li>• Lip-sync preservation</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}