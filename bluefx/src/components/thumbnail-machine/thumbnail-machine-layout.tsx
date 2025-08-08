'use client';

interface ThumbnailMachineLayoutProps {
  children: [React.ReactNode, React.ReactNode]; // [InputPanel, OutputPanel]
}

/**
 * Standardized Two-Column Layout with Dashboard Styling
 * Matches the dark theme cards from the dashboard
 */
export function ThumbnailMachineLayout({ children }: ThumbnailMachineLayoutProps) {
  const [inputPanel, outputPanel] = children;

  return (
    <div className="h-full min-h-0">
      <div className="h-full min-h-0 flex flex-col lg:flex-row gap-6">
        {/* Left Panel - Input */}
        <div className="w-full lg:w-[38.2%] min-h-0">
          <div className="h-full min-h-0 bg-card border border-border rounded-xl p-6 overflow-hidden">
            {inputPanel}
          </div>
        </div>
        
        {/* Right Panel - Output */}
        <div className="flex-1 min-h-0">
          <div className="h-full min-h-0 bg-card border border-border rounded-xl p-4 md:p-6">
            {outputPanel}
          </div>
        </div>
      </div>
    </div>
  );
}