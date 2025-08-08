'use client';

import { Card } from '@/components/ui/card';
import { Film, Edit3, History, Sparkles } from 'lucide-react';

interface TabEmptyStatesProps {
  activeTab: string;
}

export function TabEmptyStates({ activeTab }: TabEmptyStatesProps) {
  const emptyStateConfig = {
    generate: {
      icon: Film,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Enter your script to generate professional TikTok-style videos with AI orchestration.'
    },
    editor: {
      icon: Edit3,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Generate a video first, then make intelligent edits with minimal regeneration.'
    },
    history: {
      icon: History,
      gradient: 'from-gray-500 to-gray-600',
      description: 'View and manage your previous script-to-video generations.'
    }
  };

  const config = emptyStateConfig[activeTab as keyof typeof emptyStateConfig] || emptyStateConfig.generate;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${config.gradient} flex items-center justify-center mb-4`}>
        <config.icon className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground max-w-md">
        {config.description}
      </p>
    </div>
  );
}