'use client';

import { usePathname } from 'next/navigation';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { ContextualOutput } from './output-panel/contextual-output';
import { useAICinematographer } from './hooks/use-ai-cinematographer';
import { Video, History } from 'lucide-react';

// Tab content components
import { GeneratorTab } from './tabs/generator-tab';
import { HistoryTab } from './tabs/history-tab';

/**
 * AI Cinematographer - Complete AI-Orchestrated Tool with Tabs
 * Uses uniform tool layout consistent with all BlueFX tools
 */
export function AICinematographerPage() {
  const pathname = usePathname();
  const {
    generateVideo,
    isGenerating,
    result,
    error,
    videos,
    isLoadingHistory,
    clearResults,
    loadHistory,
    credits
  } = useAICinematographer();

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.includes('/history')) return 'history';
    return 'generate'; // default
  };

  const activeTab = getActiveTab();

  // Define tabs for StandardToolTabs
  const cinematographerTabs = [
    {
      id: 'generate',
      label: 'Generate',
      icon: Video,
      path: '/dashboard/ai-cinematographer'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/ai-cinematographer/history'
    }
  ];

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'history':
        return (
          <HistoryTab
            videos={videos}
            isLoading={isLoadingHistory}
            onRefresh={loadHistory}
          />
        );
      default:
        return (
          <GeneratorTab
            onGenerate={generateVideo}
            isGenerating={isGenerating}
            credits={credits} // Now using real credits!
          />
        );
    }
  };

  return (
    <StandardToolPage
      icon={Video}
      title="AI Cinematographer"
      iconGradient="bg-primary"
      tabs={<StandardToolTabs tabs={cinematographerTabs} activeTab={activeTab} basePath="/dashboard/ai-cinematographer" />}
    >
      <StandardToolLayout>
        {/* Left Panel - Content Only */}
        <div className="h-full overflow-hidden">
          {renderTabContent()}
        </div>
        
        {/* Right Panel - Contextual Output */}
        <ContextualOutput
          activeTab={activeTab}
          result={result}
          isGenerating={isGenerating}
          error={error}
          onClearResults={clearResults}
        />
      </StandardToolLayout>
    </StandardToolPage>
  );
}

export default AICinematographerPage;