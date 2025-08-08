'use client';

import { useRouter } from 'next/navigation';
import { useRef, useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LucideIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface ToolTab {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  enabled?: boolean;
}

interface ToolTabsProps {
  tabs: ToolTab[];
  activeTab: string;
  onTabChange?: (tabId: string) => void;
  leftActions?: React.ReactNode; // Optional buttons/actions in top left (e.g., sidebar trigger)
}

/**
 * Enhanced unified tab component for all BlueFX tools
 * Features: Visual scroll indicators, keyboard navigation, professional overflow handling
 * Optimized for 50-60+ demographic with WCAG 2.1 compliant typography
 */
export function ToolTabs({ tabs, activeTab, onTabChange, leftActions }: ToolTabsProps) {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);

  // Check scroll position and update indicators
  const updateScrollIndicators = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
  };

  // Show scroll hint on first load if scrollable
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isScrollable = container.scrollWidth > container.clientWidth;
    if (isScrollable && tabs.length > 4) {
      setShowScrollHint(true);
      // Hide hint after 3 seconds or user interaction
      const timer = setTimeout(() => setShowScrollHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [tabs.length]);

  // Set up scroll listeners
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollIndicators();
    container.addEventListener('scroll', updateScrollIndicators);
    window.addEventListener('resize', updateScrollIndicators);

    return () => {
      container.removeEventListener('scroll', updateScrollIndicators);
      window.removeEventListener('resize', updateScrollIndicators);
    };
  }, [tabs]);

  const handleTabChange = (tabId: string) => {
    setShowScrollHint(false); // Hide hint on user interaction
    
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        router.push(tab.path);
      }
    }
    
    // Enhanced scroll-to-active behavior for horizontal overflow
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

  // Manual scroll controls
  const scrollTabs = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200; // Scroll by 200px
    const targetScroll = direction === 'left' 
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  };

  // Unified gradient logic for all tools
  const getActiveGradient = (tabId: string) => {
    switch (tabId) {
      case 'history': return 'from-gray-500 to-gray-600';
      case 'settings': return 'from-slate-500 to-slate-600';
      default: return 'from-blue-500 to-cyan-500';
    }
  };

  // Determine layout strategy based on tab count and screen size
  const shouldUseOverflow = tabs.length > 4;
  
  return (
    <div className="border-b py-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="relative flex items-center">
          {/* Left Actions */}
          {leftActions && (
            <div className="flex-shrink-0 mr-4">
              {leftActions}
            </div>
          )}

          <div className="flex-1 relative">
          {/* Left scroll indicator */}
          {shouldUseOverflow && canScrollLeft && (
            <>
              <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background via-background/95 via-background/80 to-transparent z-10 pointer-events-none rounded-tr-lg rounded-br-lg" />
              <button
                onClick={() => scrollTabs('left')}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 bg-card/95 backdrop-blur-sm border border-border/50 rounded-full flex items-center justify-center hover:bg-muted hover:scale-105 transition-all duration-200 cursor-pointer shadow-sm"
                aria-label="Scroll tabs left"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-foreground/80" />
              </button>
            </>
          )}

          {/* Scrollable tabs container */}
          <div 
            ref={scrollContainerRef}
            className={`w-full ${shouldUseOverflow ? 'overflow-x-auto overflow-y-hidden tab-scroll-container' : 'overflow-visible'} scrollbar-hide`}
          >
            <TabsList 
            className={`
              flex h-auto !bg-transparent p-0 border-0 shadow-none rounded-none
              ${shouldUseOverflow 
                ? 'w-max min-w-full gap-2 px-4' 
                : 'w-full grid gap-2'
              }
            `}
            style={{ 
              gridTemplateColumns: !shouldUseOverflow && tabs.length > 0 
                ? `repeat(${tabs.length}, 1fr)` 
                : undefined 
            }}
          >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isEnabled = tab.enabled !== false;
            
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                disabled={!isEnabled}
                className={`
                  relative flex flex-col items-center gap-2 rounded-lg transition-all duration-300 ease-out enhanced-focus
                  ${shouldUseOverflow 
                    ? 'px-3 py-3 min-w-[85px] flex-shrink-0 tab-scroll-item' 
                    : 'px-3 py-3 min-w-0'
                  }
                  ${!isEnabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : isActive 
                      ? `bg-gradient-to-r ${getActiveGradient(tab.id)} text-white shadow-lg transform scale-[1.02] cursor-pointer` 
                      : 'text-muted-foreground hover:text-foreground bg-muted/30 cursor-pointer'
                  }
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium text-center leading-tight whitespace-nowrap tab-text">
                  {tab.label}
                </span>
              </TabsTrigger>
            );
          })}
          </TabsList>
          </div>

          {/* Right scroll indicator */}
          {shouldUseOverflow && canScrollRight && (
            <>
              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background via-background/95 via-background/80 to-transparent z-10 pointer-events-none rounded-tl-lg rounded-bl-lg" />
              <button
                onClick={() => scrollTabs('right')}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 bg-card/95 backdrop-blur-sm border border-border/50 rounded-full flex items-center justify-center hover:bg-muted hover:scale-105 transition-all duration-200 cursor-pointer shadow-sm"
                aria-label="Scroll tabs right"
              >
                <ChevronRight className="w-3.5 h-3.5 text-foreground/80" />
              </button>
            </>
          )}
          </div>
        </div>

        {/* Scroll hint for first-time users */}
        {showScrollHint && shouldUseOverflow && (
          <div className="text-xs text-muted-foreground text-center mt-2 animate-pulse">
            ← Scroll or use arrows to see more tabs →
          </div>
        )}
      </Tabs>
    </div>
  );
}