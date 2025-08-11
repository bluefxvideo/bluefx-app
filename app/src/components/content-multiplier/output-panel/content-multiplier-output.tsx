'use client';

import { ContentInputOutput } from './content-input-output';
import { PlatformPreviewOutput } from './platform-preview-output';
import { ReviewOutput } from './review-output';
import { HistoryOutput } from './history-output';
import { TabEmptyStates } from './tab-empty-states';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';

interface ContentMultiplierOutputProps {
  activeTab: string;
}

/**
 * Content Multiplier Output Panel
 * Displays contextual output based on the active tab
 * Following exact thumbnail machine output panel pattern
 */
export function ContentMultiplierOutput({ activeTab }: ContentMultiplierOutputProps) {
  const renderOutput = () => {
    switch (activeTab) {
      case 'input':
        return <ContentInputOutput />;
      case 'twitter':
      case 'instagram':
      case 'tiktok':
      case 'linkedin':
      case 'facebook':
        return <PlatformPreviewOutput platform={activeTab} />;
      case 'review':
        return <ReviewOutput />;
      case 'history':
        return <HistoryOutput />;
      default:
        return <TabEmptyStates activeTab={activeTab} />;
    }
  };

  return (
    <OutputPanelShell status="idle">
      {renderOutput()}
    </OutputPanelShell>
  );
}