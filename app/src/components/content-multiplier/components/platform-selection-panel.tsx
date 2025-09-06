'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge'; 
import { Separator } from '@/components/ui/separator';
import { 
  X,
  Check,
  Wifi,
  WifiOff,
  Users,
} from 'lucide-react';
import { XIcon, InstagramIcon, TikTokIcon, LinkedInIcon, FacebookIcon } from './brand-icons';
import { useContentMultiplierStore, usePlatformConnections } from '../store/content-multiplier-store';
import type { SocialPlatform } from '../store/content-multiplier-store';
import { PlatformConnectDialog } from './platform-connect-dialog';
import { cn } from '@/lib/utils';

interface PlatformSelectionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Right-sliding Platform Selection Panel
 * Clean management interface for platform selection and connections
 */
export function PlatformSelectionPanel({ open, onOpenChange }: PlatformSelectionPanelProps) {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedPlatformToConnect, setSelectedPlatformToConnect] = useState<SocialPlatform | null>(null);
  
  const {
    selected_platforms,
    togglePlatform,
  } = useContentMultiplierStore();

  const connections = usePlatformConnections();

  const platforms: { id: SocialPlatform; name: string; icon: React.ComponentType<{ className?: string; size?: number }>; color: string; description: string }[] = [
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
      color: '
      description: 'Community engagement, longer posts, diverse demographics'
    },
  ];

  const handleConnectPlatform = (platformId: SocialPlatform) => {
    setSelectedPlatformToConnect(platformId);
    setConnectDialogOpen(true);
  };

  const selectedCount = selected_platforms.length;
  const connectedCount = platforms.filter(p => connections[p.id]?.connected).length;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-96 bg-background border-l shadow-xl z-50 transform transition-transform">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Platform Settings</h2>
              <p className="text-sm text-muted-foreground">Manage your social media platforms</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">{selectedCount}</div>
              <div className="text-xs text-muted-foreground">Selected</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">{connectedCount}</div>
              <div className="text-xs text-muted-foreground">Connected</div>
            </div>
          </div>
        </div>

        {/* Platform List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-3">
            {platforms.map((platform) => {
              const isSelected = selected_platforms.includes(platform.id);
              const connection = connections[platform.id];
              const isConnected = connection?.connected || false;
              
              return (
                <div
                  key={platform.id}
                  className={cn(
                    "p-4 border rounded-lg transition-all cursor-pointer hover:bg-muted/50",
                    isSelected 
                      ? 'border-emerald-500 
                      : 'border-border'
                  )}
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
                          <div className="w-5 h-5 rounded-full ">
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
                            className="text-xs cursor-pointer hover:"
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

          <Separator />

          {/* Platform Tips */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Platform Tips
            </h3>
            
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="p-3 ">
                <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">✨ Content Optimization</p>
                <p className="text-blue-600 dark:text-blue-400">
                  Each platform gets custom-tailored content with optimal formatting, hashtags, and tone.
                </p>
              </div>
              
              <div className="p-3 ">
                <p className="font-medium text-emerald-700 dark:text-emerald-300 mb-1">🚀 Auto-Publishing</p>
                <p className="text-blue-600 dark:text-emerald-400">
                  Connect your accounts to publish directly or schedule posts for later.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t">
          <Button 
            onClick={() => onOpenChange(false)}
            className="w-full"
            disabled={selectedCount === 0}
          >
            {selectedCount > 0 
              ? `Continue with ${selectedCount} Platform${selectedCount > 1 ? 's' : ''}`
              : 'Select at least one platform'
            }
          </Button>
        </div>
      </div>

      {/* Platform Connection Dialog */}
      <PlatformConnectDialog
        platform={selectedPlatformToConnect}
        open={connectDialogOpen}
        onOpenChange={(open) => {
          setConnectDialogOpen(open);
          if (!open) setSelectedPlatformToConnect(null);
        }}
      />
    </>
  );
}