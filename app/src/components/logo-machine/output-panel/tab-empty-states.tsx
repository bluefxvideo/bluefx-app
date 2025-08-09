'use client';

import { Palette, RotateCcw } from 'lucide-react';

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