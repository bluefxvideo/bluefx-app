'use client';

import { Card } from '@/components/ui/card';
import { Palette, Sparkles, RotateCcw, User } from 'lucide-react';

/**
 * Tab-specific empty states for different logo machine tools
 */

export function GenerateEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
        <Palette className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground max-w-md">
        Enter your company name and style preferences to generate professional logos powered by AI.
      </p>
    </div>
  );
}

// Removed FaceSwapEmptyState - not needed for logo machine
function FaceSwapEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto">
          <User className="w-8 h-8 text-white" />
        </div>
        
        <div>
          <h3 className="font-medium mb-2 flex items-center justify-center gap-2">
            Ready for Face Swap Magic
            <Sparkles className="w-4 h-4 text-yellow-500" />
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Upload your face image and describe your thumbnail concept to generate personalized YouTube thumbnails.
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">🎭 Face Swap Tips:</p>
            <ul className="text-left space-y-1">
              <li>• Use clear, well-lit face photos</li>
              <li>• Face should be facing forward</li>
              <li>• Higher resolution = better results</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function RecreateEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
        <RotateCcw className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground max-w-md">
        Upload a reference logo to recreate or modify it with your specifications.
      </p>
    </div>
  );
}