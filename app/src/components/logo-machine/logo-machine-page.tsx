'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Wand2 } from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { ContextualOutput } from './output-panel/contextual-output';
import { useLogoMachine } from './hooks/use-logo-machine';
import { useCredits } from '@/hooks/useCredits';
import { HistoryFilters } from '@/components/tools/standard-history-filters';

// Tab content components
import { GeneratorTab } from './tabs/generator-tab';
import { RecreateTab } from './tabs/recreate-tab';
import { HistoryTab } from './tabs/history-tab';
import { Wand2 as GenerateIcon, RotateCcw, History } from 'lucide-react';

/**
 * Logo Machine - Complete AI-Orchestrated Tool with Tabs
 * Uses standardized layout matching Thumbnail Machine
 */
export function LogoMachinePage() {
  const pathname = usePathname();
  const { credits: userCredits, isLoading: _creditsLoading } = useCredits();
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters | undefined>();
  const {
    generate,
    isGenerating,
    result,
    error,
    clearResults
  } = useLogoMachine();

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.includes('/recreate')) return 'recreate';
    if (pathname.includes('/history')) return 'history';
    return 'generate'; // default
  };

  const activeTab = getActiveTab();

  // Define tabs for StandardToolTabs
  const logoTabs = [
    {
      id: 'generate',
      label: 'Generate',
      icon: GenerateIcon,
      path: '/dashboard/logo-generator'
    },
    {
      id: 'recreate',
      label: 'Recreate',
      icon: RotateCcw,
      path: '/dashboard/logo-generator/recreate'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/logo-generator/history'
    }
  ];

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'recreate':
        return (
          <RecreateTab
            onGenerate={generate}
            isGenerating={isGenerating}
            credits={userCredits?.available_credits || 0}
            error={error}
          />
        );
      case 'history':
        return <HistoryTab onFiltersChange={setHistoryFilters} />;
      case 'generate':
      default:
        return (
          <GeneratorTab
            onGenerate={generate}
            isGenerating={isGenerating}
            credits={userCredits?.available_credits || 0}
            error={error}
          />
        );
    }
  };

  return (
    <StandardToolPage
      icon={Wand2}
      title="Logo Machine"
      iconGradient="bg-primary"
      tabs={<StandardToolTabs tabs={logoTabs} activeTab={activeTab} basePath="/dashboard/logo-generator" />}
    >
      <StandardToolLayout>
        {[
          // Left Panel - Tab Content
          <div key="input" className="h-full">
            {renderTabContent()}
          </div>,
          
          // Right Panel - Contextual Output
          <ContextualOutput
            key="output"
            activeTab={activeTab}
            result={result}
            isGenerating={isGenerating}
            error={error}
            onClearResults={clearResults}
            historyFilters={historyFilters}
          />
        ]}
      </StandardToolLayout>
    </StandardToolPage>
  );
}

export default LogoMachinePage;