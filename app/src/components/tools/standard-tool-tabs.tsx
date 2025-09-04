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
    <div className="overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-1 min-w-max px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Link
              key={tab.id}
              href={tab.path}
              className={`
                inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg
                transition-all duration-200 relative whitespace-nowrap flex-shrink-0
                ${isActive 
                  ? 'bg-secondary text-white' 
                  : 'text-zinc-400 hover:text-white hover:bg-secondary/50'
                }
              `}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:inline">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}