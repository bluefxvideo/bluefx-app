'use client';

import { Card } from '@/components/ui/card';

interface MusicMachineLayoutProps {
  children: [React.ReactNode, React.ReactNode];
}

/**
 * Music Machine Layout - Following exact BlueFX style guide patterns
 * Matches ThumbnailMachineLayout structure exactly
 */
export function MusicMachineLayout({ children }: MusicMachineLayoutProps) {
  const [inputPanel, outputPanel] = children;

  return (
    <div className="h-full p-6">
      <div className="h-full flex gap-6">
        {/* Left Panel - Input */}
        <div className="w-1/2 max-w-md">
          <Card className="h-full p-6 shadow-lg bg-gray-50 dark:bg-gray-800/30">
            {inputPanel}
          </Card>
        </div>
        
        {/* Right Panel - Output */}
        <div className="flex-1">
          <Card className="h-full p-6 shadow-lg">
            {outputPanel}
          </Card>
        </div>
      </div>
    </div>
  );
}