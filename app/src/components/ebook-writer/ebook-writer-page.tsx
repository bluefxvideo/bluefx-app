'use client';

import { usePathname } from 'next/navigation';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { BookOpen, FileText, Type, Image as ImageIcon, Download, History } from 'lucide-react';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { ContextualOutput } from './output-panel/contextual-output';
import { useEbookWriterStore } from './store/ebook-writer-store';

// Tab content components
import { TopicTab } from './tabs/topic-tab';
import { TitleTab } from './tabs/title-tab';
import { OutlineTab } from './tabs/outline-tab';
import { ContentTab } from './tabs/content-tab';
import { CoverTab } from './tabs/cover-tab';
import { ExportTab } from './tabs/export-tab';
import { HistoryTab } from './tabs/history-tab';

/**
 * Ebook Writer - Complete AI-Orchestrated Tool with Tabs
 * Follows standardized Phase 4 two-column Replicate-style layout
 * Mirrors thumbnail machine pattern with ebook-specific workflow
 */
export function EbookWriterPage() {
  const pathname = usePathname();
  const {
    current_ebook,
    title_options,
    generation_progress,
    active_tab,
    setActiveTab,
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

  // Update store if URL tab differs from store tab
  if (currentTab !== active_tab) {
    setActiveTab(currentTab);
  }

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (currentTab) {
      case 'title':
        return (
          <TitleTab
            topic={current_ebook?.topic || ''}
            titleOptions={title_options}
            isGenerating={generation_progress.is_generating && generation_progress.current_step === 'title'}
            error={generation_progress.error_message}
          />
        );
      case 'outline':
        return (
          <OutlineTab
            ebook={current_ebook}
            isGenerating={generation_progress.is_generating && generation_progress.current_step === 'outline'}
            error={generation_progress.error_message}
          />
        );
      case 'content':
        return (
          <ContentTab
            ebook={current_ebook}
            isGenerating={generation_progress.is_generating && generation_progress.current_step === 'content'}
            error={generation_progress.error_message}
          />
        );
      case 'cover':
        return (
          <CoverTab
            ebook={current_ebook}
            isGenerating={generation_progress.is_generating && generation_progress.current_step === 'cover'}
            error={generation_progress.error_message}
          />
        );
      case 'export':
        return (
          <ExportTab
            ebook={current_ebook}
            isGenerating={generation_progress.is_generating && generation_progress.current_step === 'export'}
            error={generation_progress.error_message}
          />
        );
      case 'history':
        return <HistoryTab />;
      default:
        return (
          <TopicTab
            currentTopic={current_ebook?.topic || ''}
            isGenerating={generation_progress.is_generating}
            error={generation_progress.error_message}
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

  return (
    <StandardToolPage
      icon={BookOpen}
      title="Ebook Writer"
      iconGradient="bg-primary"
      tabs={tabsComponent}
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
            activeTab={currentTab}
            ebook={current_ebook}
            titleOptions={title_options}
            isGenerating={generation_progress.is_generating}
            error={generation_progress.error_message}
            progress={generation_progress}
          />
        ]}
      </StandardToolLayout>
    </StandardToolPage>
  );
}

export default EbookWriterPage;