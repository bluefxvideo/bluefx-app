'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, MoreHorizontal, LucideIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PriorityToolTab {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  enabled?: boolean;
  priority?: 'primary' | 'secondary'; // New priority system
}

interface PriorityToolTabsProps {
  tabs: PriorityToolTab[];
  activeTab: string;
  onTabChange?: (tabId: string) => void;
  maxPrimaryTabs?: number; // How many primary tabs to show before overflow
}

/**
 * Enhanced tab component with priority system for tools with many tabs
 * Primary tabs always visible, secondary tabs in overflow/dropdown
 * Optimized for 50-60+ demographic with WCAG 2.1 compliance
 */
export function PriorityToolTabs({ 
  tabs, 
  activeTab, 
  onTabChange, 
  maxPrimaryTabs = 4 
}: PriorityToolTabsProps) {
  const router = useRouter();
  const [showAllTabs, setShowAllTabs] = useState(false);

  const handleTabChange = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        router.push(tab.path);
      }
    }
    
    // Enhanced scroll-to-active behavior
    setTimeout(() => {
      const activeTabElement = document.querySelector(`[data-state="active"]`);
      if (activeTabElement) {
        activeTabElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'center'
        });
      }
    }, 100);
  };

  // Unified gradient logic
  const getActiveGradient = (tabId: string) => {
    switch (tabId) {
      case 'history': return 'from-gray-500 to-gray-600';
      case 'settings': return 'from-slate-500 to-slate-600';
      default: return 'from-blue-500 to-cyan-500';
    }
  };

  // Separate tabs by priority
  const primaryTabs = tabs.filter(tab => tab.priority !== 'secondary').slice(0, maxPrimaryTabs);
  const secondaryTabs = tabs.filter(tab => tab.priority === 'secondary' || tabs.indexOf(tab) >= maxPrimaryTabs);
  const hasSecondaryTabs = secondaryTabs.length > 0;
  const activeTabInSecondary = secondaryTabs.some(tab => tab.id === activeTab);

  const renderTabTrigger = (tab: PriorityToolTab, isCompact = false) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    const isEnabled = tab.enabled !== false;
    
    return (
      <TabsTrigger
        key={tab.id}
        value={tab.id}
        disabled={!isEnabled}
        className={`
          relative flex flex-col items-center gap-2 rounded-lg transition-all duration-300 ease-out
          ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} min-w-[85px] flex-shrink-0
          ${!isEnabled 
            ? 'opacity-50 cursor-not-allowed' 
            : isActive 
              ? `bg-gradient-to-r ${getActiveGradient(tab.id)} text-white shadow-lg transform scale-[1.02] cursor-pointer` 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 cursor-pointer'
          }
        `}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium text-center leading-tight whitespace-nowrap">
          {tab.label}
        </span>
      </TabsTrigger>
    );
  };

  return (
    <div className="border-b py-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="w-full">
          {/* Primary tabs - always visible */}
          <div className="overflow-x-auto overflow-y-hidden scrollbar-hover">
            <TabsList className="flex h-auto !bg-transparent p-0 border-0 shadow-none rounded-none w-max min-w-full gap-3 px-2">
              {primaryTabs.map((tab, index) => renderTabTrigger(tab, false))}
              
              {/* More tabs indicator/dropdown */}
              {hasSecondaryTabs && (
                <div className="flex items-center">
                  {activeTabInSecondary && (
                    <>
                      {/* Show active secondary tab */}
                      {renderTabTrigger(secondaryTabs.find(tab => tab.id === activeTab)!)}
                      <div className="w-px h-8 bg-border mx-2" />
                    </>
                  )}
                  
                  {/* More tabs dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex flex-col items-center gap-1 px-3 py-2 min-w-[70px] text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                        <span className="text-xs font-medium">More</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {secondaryTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isEnabled = tab.enabled !== false;
                        return (
                          <DropdownMenuItem
                            key={tab.id}
                            disabled={!isEnabled}
                            onClick={() => isEnabled && handleTabChange(tab.id)}
                            className="flex items-center gap-3 px-3 py-2"
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm font-medium">{tab.label}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </TabsList>
          </div>

          {/* Expandable secondary tabs (alternative to dropdown) */}
          {hasSecondaryTabs && showAllTabs && (
            <div className="mt-3 pt-3 border-t border-border/30">
              <div className="overflow-x-auto overflow-y-hidden scrollbar-hover">
                <TabsList className="flex h-auto !bg-transparent p-0 border-0 shadow-none rounded-none w-max min-w-full gap-2 px-2">
                  {secondaryTabs.map(tab => renderTabTrigger(tab, true))}
                </TabsList>
              </div>
            </div>
          )}

          {/* Show/hide secondary tabs toggle */}
          {hasSecondaryTabs && (
            <div className="flex justify-center mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllTabs(!showAllTabs)}
                className="text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                {showAllTabs ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show All ({secondaryTabs.length} more)
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}