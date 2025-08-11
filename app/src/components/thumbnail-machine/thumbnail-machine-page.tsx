'use client';

import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { Image as ImageIcon, Wand2, RotateCcw, FileText, History, UserCheck } from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
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
 * Now uses fully standardized layout pattern
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
      id: 'titles',
      label: 'Titles',
      icon: FileText,
      path: '/dashboard/thumbnail-machine/titles'
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
    <StandardToolPage
      icon={ImageIcon}
      title="Thumbnail Machine"
      description=""
      iconGradient="bg-primary"
      tabs={<StandardToolTabs tabs={thumbnailTabs} activeTab={activeTab} basePath="/dashboard/thumbnail-machine" />}
    >
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
          onFocusPrompt={handleFocusPrompt}
        />
      </StandardToolLayout>
    </StandardToolPage>
  );
}

export default ThumbnailMachinePage;