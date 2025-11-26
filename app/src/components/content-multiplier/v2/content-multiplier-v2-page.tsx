'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { toast } from 'sonner';
import {
  PenSquare,
  Calendar,
  History,
  Settings,
  Zap,
} from 'lucide-react';
import {
  useContentMultiplierV2Store,
  useActiveMainTab,
  useWizardStep,
  type MainTab,
} from '../store/content-multiplier-v2-store';
import { CreateStep1Upload } from './create-step-1-upload';
import { CreateStep2Review } from './create-step-2-review';
import { CreateStep3Schedule } from './create-step-3-schedule';
import { ScheduledTab } from './scheduled-tab';
import { PostedTab } from './posted-tab';
import { AccountsTab } from './accounts-tab';

// Step indicator component
function StepIndicator() {
  const wizardStep = useWizardStep();

  const steps = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Review' },
    { num: 3, label: 'Schedule' },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center">
          {/* Step circle */}
          <div
            className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              transition-colors duration-200
              ${wizardStep === step.num
                ? 'bg-primary text-primary-foreground'
                : wizardStep > step.num
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }
            `}
          >
            {wizardStep > step.num ? '✓' : step.num}
          </div>

          {/* Step label */}
          <span
            className={`
              ml-2 text-sm hidden sm:inline
              ${wizardStep === step.num ? 'font-medium' : 'text-muted-foreground'}
            `}
          >
            {step.label}
          </span>

          {/* Connector line */}
          {idx < steps.length - 1 && (
            <div
              className={`
                w-8 h-0.5 mx-3
                ${wizardStep > step.num ? 'bg-green-500' : 'bg-muted'}
              `}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Create Post tab with wizard
function CreatePostTab() {
  const wizardStep = useWizardStep();

  return (
    <div className="h-full flex flex-col">
      <StepIndicator />

      <div className="flex-1 overflow-hidden">
        {wizardStep === 1 && <CreateStep1Upload />}
        {wizardStep === 2 && <CreateStep2Review />}
        {wizardStep === 3 && <CreateStep3Schedule />}
      </div>
    </div>
  );
}

export function ContentMultiplierV2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Store state
  const activeMainTab = useActiveMainTab();

  // Store actions
  const setActiveMainTab = useContentMultiplierV2Store((s) => s.setActiveMainTab);
  const loadConnectedAccounts = useContentMultiplierV2Store((s) => s.loadConnectedAccounts);

  // Handle OAuth callback results
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const platform = searchParams.get('platform');

    if (success === 'connected' && platform) {
      toast.success(`Successfully connected to ${platform}!`);
      loadConnectedAccounts();
      router.replace('/dashboard/content-multiplier');
    } else if (error && platform) {
      const errorMessages: Record<string, string> = {
        'missing_parameters': 'OAuth callback missing required parameters',
        'oauth_failed': 'Failed to connect to platform',
        'callback_error': 'OAuth callback error occurred',
        'unauthorized': 'Please log in to continue',
      };

      toast.error(errorMessages[error] || `Failed to connect to ${platform}`);
      router.replace('/dashboard/content-multiplier');
    }
  }, [searchParams, router, loadConnectedAccounts]);

  // Load connected accounts on mount
  useEffect(() => {
    loadConnectedAccounts();
  }, [loadConnectedAccounts]);

  // Main tabs configuration
  const mainTabs = [
    { id: 'create' as MainTab, label: 'Create Post', icon: PenSquare },
    { id: 'scheduled' as MainTab, label: 'Scheduled', icon: Calendar },
    { id: 'posted' as MainTab, label: 'Posted', icon: History },
    { id: 'accounts' as MainTab, label: 'Accounts', icon: Settings },
  ];

  // Custom tabs component for StandardToolPage
  const tabsComponent = (
    <Tabs
      value={activeMainTab}
      onValueChange={(value) => setActiveMainTab(value as MainTab)}
      className="w-full"
    >
      <TabsList className="grid grid-cols-4 w-full max-w-md">
        {mainTabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="flex items-center gap-2"
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  return (
    <StandardToolPage
      icon={Zap}
      title="Content Multiplier"
      iconGradient="bg-primary"
      toolName="Content Multiplier"
      tabs={tabsComponent}
    >
      <div className="h-full p-6">
        <Card className="h-full p-6 shadow-lg dark:bg-gray-800/30">
          {activeMainTab === 'create' && <CreatePostTab />}
          {activeMainTab === 'scheduled' && <ScheduledTab />}
          {activeMainTab === 'posted' && <PostedTab />}
          {activeMainTab === 'accounts' && <AccountsTab />}
        </Card>
      </div>
    </StandardToolPage>
  );
}
