'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface UniformToolLayoutProps {
  children: [React.ReactNode, React.ReactNode]; // [InputPanel, OutputPanel]
  className?: string;
}

/**
 * Uniform Two-Column Layout for ALL BlueFX Tools
 * Provides consistent spacing, styling, and responsive behavior
 */
export function UniformToolLayout({ children, className }: UniformToolLayoutProps) {
  const [inputPanel, outputPanel] = children;

  return (
    <div className={cn("h-full", className)}>
      <div className="h-full flex flex-col lg:flex-row gap-3 md:gap-5">
        {/* Left Panel - Input */}
        <div className="w-full lg:w-1/2 lg:max-w-md">
          <Card className="h-full p-4 md:p-8 shadow-md border-border/30 bg-background">
            {inputPanel}
          </Card>
        </div>
        
        {/* Right Panel - Output */}
        <div className="flex-1">
          <Card className="h-full p-4 md:p-8 shadow-md border-border/30 bg-background">
            {outputPanel}
          </Card>
        </div>
      </div>
    </div>
  );
}