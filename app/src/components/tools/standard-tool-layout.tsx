'use client';

import { cn } from '@/lib/utils';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { useIsSmallScreen } from '@/hooks/use-media-query';

interface StandardToolLayoutProps {
  children: [React.ReactNode, React.ReactNode]; // [InputPanel, OutputPanel]
  className?: string;
}

export function StandardToolLayout({ children, className }: StandardToolLayoutProps) {
  const [inputPanel, outputPanel] = children;
  const isSmallScreen = useIsSmallScreen();

  // Phones: the side-by-side resizable split is unusable (~150px input panel),
  // so stack the panels vertically — input first, results below.
  if (isSmallScreen) {
    return (
      <div className={cn('h-full overflow-y-auto', className)}>
        <div className="flex flex-col gap-4 p-3">
          <div className="min-w-0">{inputPanel}</div>
          <div className="min-w-0 min-h-[50vh]">{outputPanel}</div>
        </div>
      </div>
    );
  }

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

        <ResizableHandle
          withHandle
          className="bg-border/30 hover:bg-primary/30 transition-colors"
        />

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
