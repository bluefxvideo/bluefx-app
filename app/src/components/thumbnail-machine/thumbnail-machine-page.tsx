'use client';

import { usePathname } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import { Image as ImageIcon, Wand2, History } from 'lucide-react';
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
import { ProTab } from './tabs/pro-tab';
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

  const handleEditThumbnail = (editPrompt: string, imageUrls: string[]) => {
    generate({
      operation_mode: 'generate-pro',
      prompt: editPrompt,
      image_input: imageUrls,
      aspect_ratio: '16:9',
      resolution: '1K',
      output_format: 'jpeg',
      skip_prompt_enhancement: true,
      user_id: 'current-user',
    });
  };

  // Determine active tab from URL. Only two tabs now: Generate (the former "Pro",
  // also the base route) and History. Legacy sub-routes (/pro, /face-swap, /recreate)
  // fall through to Generate.
  const getActiveTab = () => {
    if (pathname.includes('/history')) return 'history';
    return 'generate'; // default — the (formerly "Pro") generator
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
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/thumbnail-machine/history'
    }
  ];

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'history':
        return null; // No left panel content for history
      default:
        // "Generate" now uses the Pro generator
        return (
          <ProTab
            onGenerate={generate}
            isGenerating={isGenerating}
            credits={credits ? { available_credits: credits.available_credits } : null}
            error={error}
          />
        );
    }
  };

  return (
    <StandardToolPage
      icon={ImageIcon}
      title="Thumbnail Maker"
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
            onEditThumbnail={handleEditThumbnail}
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