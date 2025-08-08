'use client';

import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContentMultiplierStore, useCurrentVariant, useSelectedPlatforms } from '../store/content-multiplier-store';
import { 
  Upload,
  Settings,
  CheckCircle,
} from 'lucide-react';

interface WorkflowTabsProps {
  activeWorkflowTab: 'content' | 'platforms' | 'review';
}

/**
 * Workflow Tab Navigation
 * Top-level 3-step process: Content → Platforms → Review
 * Separate from platform-specific tabs
 */
export function WorkflowTabs({ activeWorkflowTab }: WorkflowTabsProps) {
  const router = useRouter();
  const current_variant = useCurrentVariant();
  const selected_platforms = useSelectedPlatforms();
  const setActiveWorkflowTab = useContentMultiplierStore((state) => state.setActiveWorkflowTab);

  // Determine which workflow tabs should be enabled
  const isWorkflowTabEnabled = (tabId: string) => {
    switch (tabId) {
      case 'content':
        return true; // Always available
      case 'platforms':
        return true; // Always available 
      case 'review':
        return !!current_variant && selected_platforms.length > 0; // Only after content generation
      default:
        return false;
    }
  };

  const workflowTabs = [
    {
      id: 'content' as const,
      label: 'Content',
      icon: Upload,
      path: '/dashboard/content-multiplier',
      description: 'Enter your content to multiply across platforms'
    },
    {
      id: 'platforms' as const,
      label: 'Platforms',
      icon: Settings,
      path: '/dashboard/content-multiplier/platforms',
      description: 'Select and manage social media platforms'
    },
    {
      id: 'review' as const,
      label: 'Review',
      icon: CheckCircle,
      path: '/dashboard/content-multiplier/review',
      description: 'Review and publish all content'
    }
  ];

  const handleWorkflowTabChange = (tabId: string) => {
    // Prevent navigation to disabled tabs
    if (!isWorkflowTabEnabled(tabId)) {
      return;
    }
    
    const tab = workflowTabs.find(t => t.id === tabId);
    if (tab) {
      setActiveWorkflowTab(tabId as any);
      router.push(tab.path);
    }
  };

  return (
    <div className="border-b bg-muted/30 py-3 mb-4">
      <Tabs value={activeWorkflowTab} onValueChange={handleWorkflowTabChange}>
        <TabsList className="grid grid-cols-3 w-full h-auto bg-transparent p-0 gap-1">
          {workflowTabs.map((tab) => {
            const enabled = isWorkflowTabEnabled(tab.id);
            const isActive = activeWorkflowTab === tab.id;
            
            // Get gradient for active state
            const getActiveGradient = (tabId: string) => {
              switch (tabId) {
                case 'content': return 'from-blue-500 to-cyan-500';
                case 'platforms': return 'from-blue-500 to-cyan-500';
                case 'review': return 'from-blue-500 to-cyan-500';
                default: return 'from-blue-500 to-cyan-500';
              }
            };
            
            return (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                disabled={!enabled}
                className={`
                  group relative flex flex-col items-center gap-1 px-3 py-3 text-xs font-medium 
                  transition-all duration-300 border-0 h-auto rounded-lg cursor-pointer
                  hover:scale-[1.02] hover:shadow-md
                  ${!enabled 
                    ? 'opacity-40 cursor-not-allowed' 
                    : isActive 
                      ? `bg-gradient-to-r ${getActiveGradient(tab.id)} text-white shadow-lg transform scale-[1.02]` 
                      : 'hover:bg-background hover:shadow-sm text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                <tab.icon className={`w-4 h-4 transition-all duration-300 ${
                  isActive ? 'drop-shadow-sm' : 'group-hover:scale-110'
                }`} />
                <span className={`transition-all duration-300 ${
                  isActive ? 'font-semibold drop-shadow-sm' : 'group-hover:font-medium'
                }`}>
                  {tab.label}
                </span>
                
                {/* Hover glow effect */}
                <div className={`
                  absolute inset-0 rounded-lg opacity-0 group-hover:opacity-20 
                  transition-opacity duration-300 pointer-events-none
                  bg-gradient-to-r ${getActiveGradient(tab.id)}
                  ${isActive || !enabled ? 'hidden' : ''}
                `} />
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}