'use client';

import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { Image as ImageIcon, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThumbnailMachineLayout } from './thumbnail-machine-layout';
import { ThumbnailMachineTabs } from './tabs/thumbnail-machine-tabs';
import { ContextualOutput } from './output-panel/contextual-output';
import { useThumbnailMachine } from './hooks/use-thumbnail-machine';

// Tab content components
import { GeneratorTab } from './tabs/generator-tab';
import { FaceSwapTab } from './tabs/face-swap-tab';
import { RecreateTab } from './tabs/recreate-tab';
import { TitleGeneratorTab } from './tabs/title-generator-tab';
import { HistoryTab } from './tabs/history-tab';

/**
 * Thumbnail Machine - Complete AI-Orchestrated Tool with Tabs
 * Follows standardized Phase 4 two-column Replicate-style layout
 */
export function ThumbnailMachinePage() {
  const pathname = usePathname();
  const promptInputRef = useRef<HTMLTextAreaElement>(null!);
  const {
    generate,
    isGenerating,
    result,
    error,
    credits,
    clearResults
  } = useThumbnailMachine();

  // Display name is not required in this header; remove profile query for performance

  const handleFocusPrompt = () => {
    promptInputRef.current?.focus();
  };

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.includes('/face-swap')) return 'face-swap';
    if (pathname.includes('/recreate')) return 'recreate';
    if (pathname.includes('/titles')) return 'titles';
    if (pathname.includes('/history')) return 'history';
    return 'generate'; // default
  };

  const activeTab = getActiveTab();

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'face-swap':
        return (
          <FaceSwapTab
            onGenerate={generate}
            isGenerating={isGenerating}
            credits={credits?.available_credits ?? 0}
            error={error}
          />
        );
      case 'recreate':
        return (
          <RecreateTab
            onGenerate={generate}
            isGenerating={isGenerating}
            credits={credits?.available_credits ?? 0}
            error={error}
          />
        );
      case 'titles':
        return (
          <TitleGeneratorTab
            onGenerate={generate}
            isGenerating={isGenerating}
            credits={credits?.available_credits ?? 0}
            error={error}
          />
        );
      case 'history':
        return <HistoryTab />;
      default:
        return (
          <GeneratorTab
            onGenerate={generate}
            isGenerating={isGenerating}
            credits={credits ?? null}
            error={error}
            promptInputRef={promptInputRef}
          />
        );
    }
  };

  return (
    <div className="h-full bg-background p-6">
      {/* Main Content Area */}
      <div className="h-full flex flex-col min-h-0">
        {/* Tool Header Card */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <ImageIcon aria-hidden className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Thumbnail Machine
                </h2>
                <p className="text-sm text-zinc-400">
                  Create engaging thumbnails with AI
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-border text-zinc-300 hover:bg-secondary gap-1.5"
              onClick={() => {
                console.log("Open tutorial");
              }}
            >
              <BookOpen className="w-4 h-4" />
              Tutorial
            </Button>
          </div>

          {/* Tool-specific Tab Navigation */}
          <div className="bg-secondary/30 rounded-lg p-1">
            <ThumbnailMachineTabs activeTab={activeTab} layout="horizontal" />
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <ThumbnailMachineLayout>
          {/* Left Panel - Tab Content */}
          <div className="h-full">{renderTabContent()}</div>

          {/* Right Panel - Contextual Output */}
          <ContextualOutput
            activeTab={activeTab}
            result={result}
            isGenerating={isGenerating}
            error={error}
            onClearResults={clearResults}
            onFocusPrompt={handleFocusPrompt}
          />
        </ThumbnailMachineLayout>
      </div>
    </div>
  );
}

export default ThumbnailMachinePage;