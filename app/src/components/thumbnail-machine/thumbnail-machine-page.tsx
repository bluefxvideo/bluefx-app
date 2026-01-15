'use client';

import { usePathname } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import { Image as ImageIcon, Wand2, RotateCcw, History, UserCheck } from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { containerStyles } from '@/lib/container-styles';
import { ContextualOutput } from './output-panel/contextual-output';
import { HistoryOutput } from './output-panel/history-output';
// Toggle between implementations for testing
const USE_V2_HOOK = true; // Set to true to use the new simplified version
import { useThumbnailMachine as useThumbnailMachineV1 } from './hooks/use-thumbnail-machine';
import { useThumbnailMachine as useThumbnailMachineV2 } from './hooks/use-thumbnail-machine-v2';
const useThumbnailMachine = USE_V2_HOOK ? useThumbnailMachineV2 : useThumbnailMachineV1;

// Tab content components
import { GeneratorTab } from './tabs/generator-tab';
import { FaceSwapTab } from './tabs/face-swap-tab';
import { RecreateTab } from './tabs/recreate-tab';
import { HistoryTab } from './tabs/history-tab';
import { HistoryFilters } from '@/components/tools/standard-history-filters';

/**
 * Thumbnail Machine - Complete AI-Orchestrated Tool with Tabs
 * Now uses fully standardized layout pattern
 */
export function ThumbnailMachinePage() {
  const pathname = usePathname();
  const promptInputRef = useRef<HTMLTextAreaElement>(null!);
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters | undefined>();
  const [hasReferenceImage, setHasReferenceImage] = useState(false);
  
  
  const {
    generate,
    isGenerating,
    result,
    error,
    credits,
    clearResults,
    cancelGeneration
  } = useThumbnailMachine();


  const handleFocusPrompt = () => {
    promptInputRef.current?.focus();
  };

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.includes('/face-swap')) return 'face-swap';
    if (pathname.includes('/recreate')) return 'recreate';
    if (pathname.includes('/history')) return 'history';
    return 'generate'; // default
  };

  const activeTab = getActiveTab();

  // Define tabs for StandardToolTabs
  const thumbnailTabs = [
    {
      id: 'generate',
      label: 'Generate',
      icon: Wand2,
      path: '/dashboard/thumbnail-machine'
    },
    {
      id: 'face-swap',
      label: 'Face Swap',
      icon: UserCheck,
      path: '/dashboard/thumbnail-machine/face-swap'
    },
    {
      id: 'recreate',
      label: 'Recreate',
      icon: RotateCcw,
      path: '/dashboard/thumbnail-machine/recreate'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/thumbnail-machine/history'
    }
  ];

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'face-swap':
        return (
          <FaceSwapTab
            onGenerate={generate}
            isGenerating={isGenerating}
            credits={credits ? { available_credits: credits.available_credits } : null}
            error={error}
          />
        );
      case 'recreate':
        return (
          <RecreateTab
            onGenerate={generate}
            isGenerating={isGenerating}
            credits={credits ? { available_credits: credits.available_credits } : null}
            error={error}
            onReferenceImageChange={setHasReferenceImage}
          />
        );
      case 'history':
        return null; // No left panel content for history
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
    <StandardToolPage
      icon={ImageIcon}
      title="Thumbnail Machine"
      description=""
      iconGradient="bg-primary"
      toolName="Thumbnail Machine"
      tabs={<StandardToolTabs tabs={thumbnailTabs} activeTab={activeTab} basePath="/dashboard/thumbnail-machine" />}
    >
      {activeTab === 'history' ? (
        <div className={`h-full ${containerStyles.panel} p-4`}>
          <HistoryOutput filters={historyFilters} />
        </div>
      ) : (
        <StandardToolLayout>
          {/* Left Panel - Tab Content */}
          <div className="h-full">{renderTabContent()}</div>

          {/* Right Panel - Contextual Output */}
          <ContextualOutput
            activeTab={activeTab}
            result={result}
            isGenerating={isGenerating}
            error={error}
            onClearResults={clearResults}
            onCancelGeneration={cancelGeneration}
            onFocusPrompt={handleFocusPrompt}
            historyFilters={historyFilters}
            prompt={result?.prompt || ''}
            hasReferenceImage={hasReferenceImage}
          />
        </StandardToolLayout>
      )}
    </StandardToolPage>
  );
}

export default ThumbnailMachinePage;