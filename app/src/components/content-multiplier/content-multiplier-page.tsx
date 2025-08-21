'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { Zap, Upload, Settings, CheckCircle, History } from 'lucide-react';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { ContentOnlyTab } from './tabs/content-only-tab';
import { PlatformsTab } from './tabs/platforms-tab';
import { TwitterTab } from './tabs/twitter-tab';
import { InstagramTab } from './tabs/instagram-tab';
import { TikTokTab } from './tabs/tiktok-tab';
import { LinkedInTab } from './tabs/linkedin-tab';
import { FacebookTab } from './tabs/facebook-tab';
import { ReviewTab } from './tabs/review-tab';
import { HistoryTab } from './tabs/history-tab';
import { ContentMultiplierOutput } from './output-panel/content-multiplier-output';
import { useActiveTab, useActiveWorkflowTab, useCurrentVariant } from './store/content-multiplier-store';
import { toast } from 'sonner';

/**
 * Content Multiplier Main Page Component
 * Handles routing between different tabs and manages page-level state
 */
export function ContentMultiplierPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = useActiveTab();
  const activeWorkflowTab = useActiveWorkflowTab();
  const _current_variant = useCurrentVariant();

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

  // Handle navigation when workflow tab changes
  // NOTE: Removed automatic navigation to prevent infinite loop
  // Individual page components (platforms, review) set their workflow tabs correctly

  // Handle navigation when platform tab changes
  useEffect(() => {
    if (activeTab && ['twitter', 'instagram', 'tiktok', 'linkedin', 'facebook', 'history'].includes(activeTab)) {
      const platformTabPaths: Record<string, string> = {
        twitter: '/dashboard/content-multiplier/twitter',
        instagram: '/dashboard/content-multiplier/instagram',
        tiktok: '/dashboard/content-multiplier/tiktok',
        linkedin: '/dashboard/content-multiplier/linkedin',
        facebook: '/dashboard/content-multiplier/facebook',
        history: '/dashboard/content-multiplier/history',
      };
      
      const currentPath = window.location.pathname;
      const targetPath = platformTabPaths[activeTab];
      
      if (targetPath && currentPath !== targetPath) {
        router.push(targetPath);
      }
    }
  }, [activeTab, router]);

  // Render appropriate tab content based on workflow tab and active tab
  const renderTabContent = () => {
    // First check workflow tabs
    switch (activeWorkflowTab) {
      case 'content':
        return <ContentOnlyTab />;
      case 'platforms':
        return <PlatformsTab />;
      case 'review':
        return <ReviewTab />;
      default:
        // If not a workflow tab, check platform tabs
        switch (activeTab) {
          case 'twitter':
            return <TwitterTab />;
          case 'instagram':
            return <InstagramTab />;
          case 'tiktok':
            return <TikTokTab />;
          case 'linkedin':
            return <LinkedInTab />;
          case 'facebook':
            return <FacebookTab />;
          case 'history':
            return <HistoryTab />;
          default:
            return <ContentOnlyTab />;
        }
    }
  };

  // Define tabs for StandardToolTabs
  const multiplierTabs = [
    {
      id: 'content',
      label: 'Content',
      icon: Upload,
      path: '/dashboard/content-multiplier'
    },
    {
      id: 'platforms',
      label: 'Platforms',
      icon: Settings,
      path: '/dashboard/content-multiplier/platforms'
    },
    {
      id: 'review',
      label: 'Review',
      icon: CheckCircle,
      path: '/dashboard/content-multiplier/review'
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
      activeTab={activeWorkflowTab || activeTab || 'content'}
      basePath="/dashboard/content-multiplier"
    />
  );

  return (
    <StandardToolPage
      icon={Zap}
      title="Content Multiplier"
      iconGradient="bg-primary"
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
            activeTab={activeWorkflowTab || activeTab || 'content'}
          />
        ]}
      </StandardToolLayout>
    </StandardToolPage>
  );
}