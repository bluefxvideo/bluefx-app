'use client';

import Link from 'next/link';
import { Wand2, RotateCcw, History } from 'lucide-react';

interface LogoMachineTabsProps {
  activeTab: string;
  layout?: 'vertical' | 'horizontal' | 'auto';
}

/**
 * Compact inline tab navigation for Logo Machine
 * Designed for header integration matching Thumbnail Machine exactly
 */
export function LogoMachineTabs({ activeTab, layout: _layout = 'horizontal' }: LogoMachineTabsProps) {
  const tabs = [
    {
      id: 'generate',
      label: 'Generate',
      icon: Wand2,
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