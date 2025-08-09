'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface TabDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

interface StandardToolTabsProps {
  tabs: TabDefinition[];
  activeTab: string;
  basePath: string; // e.g., '/dashboard/logo-generator'
}

/**
 * Standard Tool Tabs - Used by ALL BlueFX Tools
 * Ensures consistent tab styling across every tool
 * Matches Thumbnail Machine styling exactly
 */
export function StandardToolTabs({ tabs, activeTab }: StandardToolTabsProps) {
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