'use client';

import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContentMultiplierStore, usePlatformConnections, useCurrentVariant, useSelectedPlatforms } from '../store/content-multiplier-store';
import { 
  Upload,
  CheckCircle,
  History,
  Settings,
} from 'lucide-react';
import { XIcon, InstagramIcon, TikTokIcon, LinkedInIcon, FacebookIcon } from '../components/brand-icons';

interface ContentMultiplierTabsProps {
  activeTab: string;
}

/**
 * Platform-Specific Tab Navigation
 * Only shows platform tabs (Twitter, Instagram, etc.) after content generation
 * Second tier of tab navigation below workflow tabs
 */
export function ContentMultiplierTabs({ activeTab }: ContentMultiplierTabsProps) {
  const router = useRouter();
  const current_variant = useCurrentVariant();
  const selected_platforms = useSelectedPlatforms();
  const connections = usePlatformConnections();
  const setActiveTab = useContentMultiplierStore((state) => state.setActiveTab);

  // Determine which platform tabs should be enabled
  const isTabEnabled = (tabId: string) => {
    return selected_platforms.includes(tabId as any);
  };

  const isConnected = (platform: string) => {
    return connections[platform as keyof typeof connections]?.connected || false;
  };

  // Only show platform tabs if content has been generated
  if (!current_variant || selected_platforms.length === 0) {
    return null;
  }

  const tabs = [
    {
      id: 'twitter',
      label: 'Twitter/X',
      icon: XIcon,
      path: '/dashboard/content-multiplier/twitter',
      description: 'Twitter/X content preview',
      isPlatform: true,
    },
    {
      id: 'instagram',
      label: 'Instagram',
      icon: InstagramIcon,
      path: '/dashboard/content-multiplier/instagram',
      description: 'Instagram content preview',
      isPlatform: true,
    },
    {
      id: 'tiktok',
      label: 'TikTok',
      icon: TikTokIcon,
      path: '/dashboard/content-multiplier/tiktok',
      description: 'TikTok content preview',
      isPlatform: true,
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      icon: LinkedInIcon,
      path: '/dashboard/content-multiplier/linkedin',
      description: 'LinkedIn content preview',
      isPlatform: true,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: FacebookIcon,
      path: '/dashboard/content-multiplier/facebook',
      description: 'Facebook content preview',
      isPlatform: true,
    }
  ];

  const handleTabChange = (tabId: string) => {
    // Prevent navigation to disabled tabs
    if (!isTabEnabled(tabId)) {
      return;
    }
    
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setActiveTab(tabId as any);
      router.push(tab.path);
    }
  };

  // Filter tabs to only show selected platforms
  const availableTabs = tabs.filter(tab => selected_platforms.includes(tab.id as any));
  
  if (availableTabs.length === 0) {
    return null;
  }

  return (
    <div className="border-b bg-muted/30 py-3 mb-4">
      <div className="text-xs text-muted-foreground mb-2 font-medium">Platform Content</div>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className={`grid w-full h-auto bg-transparent p-0 gap-1 ${availableTabs.length <= 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {availableTabs.slice(0, 4).map((tab) => {
            const enabled = isTabEnabled(tab.id);
            const connected = tab.isPlatform ? isConnected(tab.id) : true;
            const isActive = activeTab === tab.id;
            
            // Get gradient for each platform
            const getActiveGradient = (tabId: string) => {
              switch (tabId) {
                case 'twitter': return 'from-gray-900 to-black';
                case 'instagram': return 'from-purple-500 via-pink-500 to-orange-500';
                case 'tiktok': return 'from-gray-900 to-black';
                case 'linkedin': return 'from-blue-600 to-blue-700';
                case 'facebook': return 'from-blue-500 to-blue-600';
                default: return 'from-blue-500 to-cyan-500';
              }
            };
            
            return (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                disabled={!enabled}
                className={`
                  group relative flex flex-col items-center gap-1 px-2 py-2 text-xs font-medium 
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
                <div className="relative">
                  <tab.icon className={`w-4 h-4 transition-all duration-300 ${
                    isActive ? 'drop-shadow-sm' : 'group-hover:scale-110'
                  }`} size={16} />
                  {tab.isPlatform && (
                    <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                      connected ? 'bg-blue-100' : 'bg-gray-400'
                    }`} />
                  )}
                </div>
                <span className={`transition-all duration-300 text-[10px] ${
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
        
        {/* Second row if more than 4 platforms */}
        {availableTabs.length > 4 && (
          <TabsList className="grid w-full grid-cols-4 h-auto bg-transparent p-0 gap-1 mt-1">
            {availableTabs.slice(4, 8).map((tab) => {
              const enabled = isTabEnabled(tab.id);
              const connected = tab.isPlatform ? isConnected(tab.id) : true;
              const isActive = activeTab === tab.id;
              
              // Get gradient for each platform
              const getActiveGradient = (tabId: string) => {
                switch (tabId) {
                  case 'twitter': return 'from-gray-900 to-black';
                  case 'instagram': return 'from-purple-500 via-pink-500 to-orange-500';
                  case 'tiktok': return 'from-gray-900 to-black';
                  case 'linkedin': return 'from-blue-600 to-blue-700';
                  case 'facebook': return 'from-blue-500 to-blue-600';
                  default: return 'from-blue-500 to-cyan-500';
                }
              };
              
              return (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  disabled={!enabled}
                  className={`
                    group relative flex flex-col items-center gap-1 px-2 py-2 text-xs font-medium 
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
                  <div className="relative">
                    <tab.icon className={`w-4 h-4 transition-all duration-300 ${
                      isActive ? 'drop-shadow-sm' : 'group-hover:scale-110'
                    }`} size={16} />
                    {tab.isPlatform && (
                      <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                        connected ? 'bg-blue-100' : 'bg-gray-400'
                      }`} />
                    )}
                  </div>
                  <span className={`transition-all duration-300 text-[10px] ${
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
        )}
      </Tabs>
    </div>
  );
}