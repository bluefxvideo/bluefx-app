'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/app/supabase/client';
import { useCredits } from '@/hooks/useCredits';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { Card } from '@/components/ui/card';
import { BookOpen, FileText, Type, Image as ImageIcon, Download, History } from 'lucide-react';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { ContextualOutput } from './output-panel/contextual-output';
import { HistoryOutput } from './output-panel/history-output';
import { useEbookWriterStore } from './store/ebook-writer-store';
import { useAutoSave } from './hooks/use-auto-save';

// Tab content components
import { TopicTab } from './tabs/topic-tab';
import { TitleTab } from './tabs/title-tab';
import { OutlineTab } from './tabs/outline-tab';
import { ContentTab } from './tabs/content-tab';
import { CoverTab } from './tabs/cover-tab';
import { ExportTab } from './tabs/export-tab';
import { EbookHistoryFilters, type EbookHistoryFilters as HistoryFiltersType } from './tabs/ebook-history-filters';

/**
 * Ebook Writer - Complete AI-Orchestrated Tool with Tabs
 * Follows standardized Phase 4 two-column Replicate-style layout
 * Mirrors thumbnail machine pattern with ebook-specific workflow
 */
export function EbookWriterPage() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [historyFilters, setHistoryFilters] = useState<HistoryFiltersType | undefined>();
  const { credits: userCredits, isLoading: _creditsLoading } = useCredits();
  const {
    current_ebook,
    title_options,
    active_tab,
    setActiveTab,
    generation_progress,
    uploaded_documents,
    is_loading_session,
    loadSession,
  } = useEbookWriterStore();

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.includes('/title')) return 'title';
    if (pathname.includes('/outline')) return 'outline';
    if (pathname.includes('/content')) return 'content';
    if (pathname.includes('/cover')) return 'cover';
    if (pathname.includes('/export')) return 'export';
    if (pathname.includes('/history')) return 'history';
    return 'topic'; // default
  };

  const currentTab = getActiveTab();
  
  // Enable auto-save
  useAutoSave();

  // Get current user and load session on mount (but not if we already have fresh content)
  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Only load session if we don't already have fresh content
        // This prevents overwriting newly generated titles
        if (!current_ebook?.topic && !title_options) {
          console.log('🔄 Loading session from database (no existing content)');
          await loadSession(user.id);
        } else {
          console.log('⚠️ Skipping session load - fresh content exists');
        }
      }
    };
    getCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Update store if URL tab differs from store tab
  useEffect(() => {
    if (currentTab !== active_tab) {
      setActiveTab(currentTab);
    }
  }, [currentTab, active_tab, setActiveTab]);

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (currentTab) {
      case 'title':
        return (
          <TitleTab
            topic={current_ebook?.topic || ''}
            titleOptions={title_options}
            isGenerating={false}
            isLoadingSession={is_loading_session}
            credits={userCredits?.available_credits || 0}
          />
        );
      case 'outline':
        return (
          <OutlineTab
            ebook={current_ebook}
            isGenerating={false}
            error={undefined}
            credits={userCredits?.available_credits || 0}
          />
        );
      case 'content':
        return (
          <ContentTab
            ebook={current_ebook}
            isGenerating={false}
            error={undefined}
            credits={userCredits?.available_credits || 0}
          />
        );
      case 'cover':
        return (
          <CoverTab
            ebook={current_ebook}
            isGenerating={false}
            error={undefined}
          />
        );
      case 'export':
        return (
          <ExportTab
            ebook={current_ebook}
            isGenerating={false}
            error={undefined}
          />
        );
      case 'history':
        return null; // No left panel content for history
      default:
        return (
          <TopicTab
            currentTopic={current_ebook?.topic || ''}
            isGenerating={false}
          />
        );
    }
  };

  // Define tabs for StandardToolTabs
  const ebookTabs = [
    {
      id: 'topic',
      label: 'Topic',
      icon: FileText,
      path: '/dashboard/ebook-writer'
    },
    {
      id: 'title',
      label: 'Title',
      icon: Type,
      path: '/dashboard/ebook-writer/title'
    },
    {
      id: 'outline',
      label: 'Outline',
      icon: BookOpen,
      path: '/dashboard/ebook-writer/outline'
    },
    {
      id: 'content',
      label: 'Content',
      icon: FileText,
      path: '/dashboard/ebook-writer/content'
    },
    {
      id: 'cover',
      label: 'Cover',
      icon: ImageIcon,
      path: '/dashboard/ebook-writer/cover'
    },
    {
      id: 'export',
      label: 'Export',
      icon: Download,
      path: '/dashboard/ebook-writer/export'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/ebook-writer/history'
    }
  ];

  // Tab Navigation Component
  const tabsComponent = <StandardToolTabs tabs={ebookTabs} activeTab={currentTab} basePath="/dashboard/ebook-writer" />;

  // Determine if current tab should use single panel layout
  const isSinglePanelTab = ['topic', 'title', 'outline'].includes(currentTab);

  return (
    <StandardToolPage
      icon={BookOpen}
      title="Ebook Writer"
      iconGradient="bg-primary"
      toolName="Ebook Writer"
      tabs={tabsComponent}
    >
      {currentTab === 'history' ? (
        <Card className="h-full bg-card border-border/30 p-4">
          <HistoryOutput filters={historyFilters} />
        </Card>
      ) : isSinglePanelTab ? (
        // Single Panel Layout for Topic, Title, and Outline - Full Width with Card styling
        <Card className="h-full bg-card border-border/30 rounded-lg overflow-hidden">
          {renderTabContent()}
        </Card>
      ) : (
        // Two Panel Layout for Content, Cover, and Export
        <StandardToolLayout>
          {[
            // Left Panel - Tab Content
            <div key="input" className="h-full">
              {renderTabContent()}
            </div>,
            
            // Right Panel - Contextual Output
            <ContextualOutput
              key="output"
              activeTab={currentTab}
              ebook={current_ebook}
              titleOptions={title_options}
              isGenerating={generation_progress.is_generating && generation_progress.current_step === 'title'}
              topic={current_ebook?.topic || ''}
              uploadedDocuments={uploaded_documents}
              historyFilters={historyFilters}
            />
          ]}
        </StandardToolLayout>
      )}
    </StandardToolPage>
  );
}

export default EbookWriterPage;