'use client';

import { Film, Edit3, History } from 'lucide-react';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';

interface TabEmptyStatesProps {
  activeTab: string;
}

export function TabEmptyStates({ activeTab }: TabEmptyStatesProps) {
  const emptyStateConfig = {
    generate: {
      icon: Film,
      title: 'Ready to Generate',
      description: 'Enter your script to generate professional TikTok-style videos with AI orchestration.'
    },
    editor: {
      icon: Edit3,
      title: 'Ready to Edit',
      description: 'Generate a video first, then make intelligent edits with minimal regeneration.'
    },
    history: {
      icon: History,
      title: 'History',
      description: 'View and manage your previous script-to-video generations.'
    }
  };

  const config = emptyStateConfig[activeTab as keyof typeof emptyStateConfig] || emptyStateConfig.generate;

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <UnifiedEmptyState
        icon={config.icon}
        title={config.title}
        description={config.description}
      />
    </div>
  );
}