'use client';

import Link from 'next/link';
import { Wand2, UserRound, RotateCcw, Type, History } from 'lucide-react';

interface ThumbnailMachineTabsProps {
  activeTab: string;
  layout?: 'vertical' | 'horizontal' | 'auto';
}

/**
 * Compact inline tab navigation for Thumbnail Machine
 * Designed for header integration with logo and branding
 */
export function ThumbnailMachineTabs({ activeTab, layout = 'horizontal' }: ThumbnailMachineTabsProps) {
  const tabs = [
    {
      id: 'generate',
      label: 'Generate',
      icon: Wand2,
      path: '/dashboard/thumbnail-machine'
    },
    {
      id: 'face-swap',
      label: 'Face Swap',
      icon: UserRound,
      path: '/dashboard/thumbnail-machine/face-swap'
    },
    {
      id: 'recreate',
      label: 'Recreate',
      icon: RotateCcw,
      path: '/dashboard/thumbnail-machine/recreate'
    },
    {
      id: 'titles',
      label: 'Titles',
      icon: Type,
      path: '/dashboard/thumbnail-machine/titles'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/thumbnail-machine/history'
    }
  ];


  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <Link
            key={tab.id}
            href={tab.path}
            className={`
              inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
              transition-all duration-200 relative
              ${isActive 
                ? 'bg-secondary text-white' 
                : 'text-zinc-400 hover:text-white hover:bg-secondary/50'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}