'use client';

import { Card } from '@/components/ui/card';

interface VoiceOverLayoutProps {
  children: [React.ReactNode, React.ReactNode]; // [InputPanel, OutputPanel]
}

/**
 * Standardized Two-Column Layout following BlueFX style guide
 * Exactly matches ThumbnailMachineLayout structure
 */
export function VoiceOverLayout({ children }: VoiceOverLayoutProps) {
  const [inputPanel, outputPanel] = children;

  return (
    <div className="h-full p-6">
      <div className="h-full flex gap-6">
        {/* Left Panel - Input */}
        <div className="w-1/2 max-w-2xl">
          <Card className="h-full p-6 shadow-lg">
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