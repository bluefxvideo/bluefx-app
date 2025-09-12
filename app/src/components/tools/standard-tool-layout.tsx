'use client';

import { cn } from '@/lib/utils';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

interface StandardToolLayoutProps {
  children: [React.ReactNode, React.ReactNode]; // [InputPanel, OutputPanel]
  className?: string;
}

export function StandardToolLayout({ children, className }: StandardToolLayoutProps) {
  const [inputPanel, outputPanel] = children;

  return (
    <div className={cn("h-full", className)}>
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full max-w-full"
      >
        {/* Left Panel - Input (Default: 38.2%) */}
        <ResizablePanel defaultSize={38.2} minSize={25} maxSize={60}>
          <div className="h-full p-2 md:p-4 lg:p-8 bg-background">
            <div className="h-full flex flex-col min-w-0">
              {inputPanel}
            </div>
          </div>
        </ResizablePanel>
        
        <ResizableHandle withHandle className="bg-border/30" />
        
        {/* Right Panel - Output (Default: 61.8%) */}
        <ResizablePanel defaultSize={61.8} minSize={40}>
          <div className="h-full p-2 md:p-4 lg:p-8 bg-background">
            <div className="h-full flex flex-col min-w-0">
              {outputPanel}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}