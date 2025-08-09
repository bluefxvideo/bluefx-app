'use client';

// import { Card } from '@/components/ui/card';
import { Video, History } from 'lucide-react';

/**
 * Tab-specific empty states for different cinematographer tools
 */

export function GenerateEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
        <Video className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground max-w-md">
        Enter a detailed prompt and customize your settings to generate amazing 
        cinematic videos powered by AI.
      </p>
    </div>
  );
}

export function HistoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-center mb-4">
        <History className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground max-w-md">
        Your generated videos will appear here with playback controls and download options.
      </p>
    </div>
  );
}