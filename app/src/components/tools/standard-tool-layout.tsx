'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StandardToolLayoutProps {
  children: [React.ReactNode, React.ReactNode]; // [InputPanel, OutputPanel]
  className?: string;
}

export function StandardToolLayout({ children, className }: StandardToolLayoutProps) {
  const [inputPanel, outputPanel] = children;

  return (
    <div className={cn("h-full", className)}>
      <div className="h-full flex flex-col lg:flex-row gap-3 md:gap-5">
        {/* Left Panel - Input (Golden Ratio: 38.2%) */}
        <div className="w-full lg:w-[38.2%]">
          <Card className="h-full p-4 md:p-8 bg-card border-border/30">
            <div className="h-full flex flex-col">
              {inputPanel}
            </div>
          </Card>
        </div>
        
        {/* Right Panel - Output (Golden Ratio: 61.8%) */}
        <div className="flex-1">
          <Card className="h-full p-4 md:p-8 bg-card border-border/30">
            <div className="h-full flex flex-col">
              {outputPanel}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}