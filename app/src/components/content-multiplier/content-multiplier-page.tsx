'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { Zap, Upload, History } from 'lucide-react';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { ContentOnlyTab } from './tabs/content-only-tab';
import { HistoryTab } from './tabs/history-tab';
import { ContentMultiplierOutput } from './output-panel/content-multiplier-output';
import { useActiveTab } from './store/content-multiplier-store';
import { toast } from 'sonner';

/**
 * Content Multiplier Main Page Component
 * Handles routing between different tabs and manages page-level state
 */
export function ContentMultiplierPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = useActiveTab();

  // Handle OAuth callback results and navigation
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const platform = searchParams.get('platform');

    if (success === 'connected' && platform) {
      toast.success(`Successfully connected to ${platform}!`);
      // Clean up URL parameters
      router.replace('/dashboard/content-multiplier');
    } else if (error && platform) {
      const errorMessages: Record<string, string> = {
        'missing_parameters': 'OAuth callback missing required parameters',
        'oauth_failed': 'Failed to connect to platform',
        'callback_error': 'OAuth callback error occurred',
        'unauthorized': 'Please log in to continue',
      };
      
      toast.error(errorMessages[error] || `Failed to connect to ${platform}`);
      // Clean up URL parameters
      router.replace('/dashboard/content-multiplier');
    }
  }, [searchParams, router]);

  // Handle navigation for history tab
  useEffect(() => {
    if (activeTab === 'history') {
      const currentPath = window.location.pathname;
      const targetPath = '/dashboard/content-multiplier/history';
      
      if (currentPath !== targetPath) {
        router.push(targetPath);
      }
    }
  }, [activeTab, router]);

  // Render appropriate tab content - simplified
  const renderTabContent = () => {
    switch (activeTab) {
      case 'history':
        return <HistoryTab />;
      default:
        return <ContentOnlyTab />;
    }
  };

  // Define tabs for StandardToolTabs - simplified to just content and history
  const multiplierTabs = [
    {
      id: 'content',
      label: 'Content',
      icon: Upload,
      path: '/dashboard/content-multiplier'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/content-multiplier/history'
    }
  ];

  // Tab Navigation Component
  const tabsComponent = (
    <StandardToolTabs 
      tabs={multiplierTabs}
      activeTab={activeTab === 'history' ? 'history' : 'content'}
      basePath="/dashboard/content-multiplier"
    />
  );

  return (
    <StandardToolPage
      icon={Zap}
      title="Content Multiplier"
      iconGradient="bg-primary"
      toolName="Content Multiplier"
      tabs={tabsComponent}
    >
      <StandardToolLayout>
        {[
          // Left Panel - Tab Content
          <div key="input" className="h-full">
            {renderTabContent()}
          </div>,
          
          // Right Panel - Output
          <ContentMultiplierOutput
            key="output"
            activeTab={activeTab === 'history' ? 'history' : 'content'}
          />
        ]}
      </StandardToolLayout>
    </StandardToolPage>
  );
}