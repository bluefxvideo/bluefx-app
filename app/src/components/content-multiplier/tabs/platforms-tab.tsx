'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Check,
  Settings,
  Wifi,
  WifiOff,
  Info,
} from 'lucide-react';
import { XIcon, InstagramIcon, TikTokIcon, LinkedInIcon, FacebookIcon } from '../components/brand-icons';
import { useContentMultiplierStore, usePlatformConnections } from '../store/content-multiplier-store';
import type { SocialPlatform } from '../store/content-multiplier-store';
import { PlatformConnectDialog } from '../components/platform-connect-dialog';

/**
 * Platforms Tab Component
 * Dedicated platform selection and connection management
 * Clean separation from content input
 */
export function PlatformsTab() {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedPlatformToConnect, setSelectedPlatformToConnect] = useState<SocialPlatform | null>(null);
  
  const {
    selected_platforms,
    togglePlatform,
  } = useContentMultiplierStore();

  const connections = usePlatformConnections();

  const handleConnectPlatform = (platformId: SocialPlatform) => {
    setSelectedPlatformToConnect(platformId);
    setConnectDialogOpen(true);
  };

  const platforms: { id: SocialPlatform; name: string; icon: any; color: string; description: string }[] = [
    { 
      id: 'twitter', 
      name: 'Twitter/X', 
      icon: XIcon, 
      color: 'bg-black',
      description: '280 characters, trending hashtags, real-time engagement'
    },
    { 
      id: 'instagram', 
      name: 'Instagram', 
      icon: InstagramIcon, 
      color: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500',
      description: 'Visual storytelling, story format, high engagement rates'
    },
    { 
      id: 'tiktok', 
      name: 'TikTok', 
      icon: TikTokIcon, 
      color: 'bg-black',
      description: 'Short-form video content, viral trends, younger audience'
    },
    { 
      id: 'linkedin', 
      name: 'LinkedIn', 
      icon: LinkedInIcon, 
      color: 'bg-blue-600',
      description: 'Professional tone, industry insights, thought leadership'
    },
    { 
      id: 'facebook', 
      name: 'Facebook', 
      icon: FacebookIcon, 
      color: 'bg-blue-500',
      description: 'Community engagement, longer posts, diverse demographics'
    },
  ];

  const selectedCount = selected_platforms.length;
  const connectedCount = platforms.filter(p => connections[p.id]?.connected).length;

  return (
    <div className="h-full overflow-y-auto scrollbar-hover space-y-6">
      {/* Platform Selection Overview */}
      <Card className="bg-white dark:bg-gray-800/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-500" />
            Platform Settings
          </CardTitle>
          <CardDescription>
            Choose which social media platforms to create content for
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 dark:bg-emerald-950/20 rounded-lg border border-blue-200 dark:border-emerald-800">
              <div className="text-2xl font-bold text-blue-600">{selectedCount}</div>
              <div className="text-xs text-emerald-700 dark:text-emerald-300">Selected</div>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600">{connectedCount}</div>
              <div className="text-xs text-blue-700 dark:text-blue-300">Connected</div>
            </div>
          </div>

          {/* Platform List */}
          <div className="space-y-3">
            {platforms.map((platform) => {
              const isSelected = selected_platforms.includes(platform.id);
              const connection = connections[platform.id];
              const isConnected = connection?.connected || false;
              
              return (
                <div
                  key={platform.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                    isSelected 
                      ? 'border-emerald-500 bg-blue-50 dark:bg-emerald-950/20' 
                      : 'border-border'
                  }`}
                  onClick={() => togglePlatform(platform.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Platform Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${platform.color} flex-shrink-0`}>
                      <platform.icon className="h-5 w-5 text-white" size={20} />
                    </div>
                    
                    {/* Platform Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{platform.name}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                        {platform.description}
                      </p>
                      
                      {/* Connection Status */}
                      <div className="flex items-center gap-2">
                        {isConnected ? (
                          <Badge variant="secondary" className="text-xs">
                            <Wifi className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge 
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConnectPlatform(platform.id);
                            }}
                          >
                            <WifiOff className="h-3 w-3 mr-1" />
                            Connect
                          </Badge>
                        )}
                        
                        {isConnected && connection?.username && (
                          <span className="text-xs text-muted-foreground">
                            @{connection.username}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selection Summary */}
          {selectedCount > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <div className="text-sm font-medium mb-2">
                Content will be generated for {selectedCount} platform{selectedCount > 1 ? 's' : ''}:
              </div>
              <div className="flex flex-wrap gap-1">
                {selected_platforms.map((platformId) => {
                  const platform = platforms.find(p => p.id === platformId);
                  if (!platform) return null;
                  
                  return (
                    <Badge key={platformId} variant="secondary" className="text-xs">
                      {platform.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Tips */}
      <Card className="bg-white dark:bg-gray-800/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-blue-500" />
            Platform Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
              ✨ Smart Optimization
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Each platform gets custom-tailored content with optimal formatting, hashtags, and tone.
            </p>
          </div>
          
          <div className="p-3 bg-blue-50 dark:bg-emerald-950/20 rounded-lg border border-blue-200 dark:border-emerald-800">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">
              🚀 Auto-Publishing
            </p>
            <p className="text-xs text-blue-600 dark:text-emerald-400">
              Connect your accounts to publish directly or schedule posts for later.
            </p>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-purple-950/20 rounded-lg border border-blue-200 dark:border-purple-800">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-600 mb-1">
              💡 Best Practices
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-600">
              Select 2-4 platforms for best results. More platforms = more content variations.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Platform Connection Dialog */}
      <PlatformConnectDialog
        platform={selectedPlatformToConnect}
        open={connectDialogOpen}
        onOpenChange={(open) => {
          setConnectDialogOpen(open);
          if (!open) setSelectedPlatformToConnect(null);
        }}
      />
    </div>
  );
}