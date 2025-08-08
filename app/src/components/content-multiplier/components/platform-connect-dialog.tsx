'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ExternalLink,
  Shield,
  Info,
  CheckCircle,
} from 'lucide-react';
import { XIcon, InstagramIcon, TikTokIcon, LinkedInIcon, FacebookIcon } from './brand-icons';
import type { SocialPlatform } from '../store/content-multiplier-store';
import { useContentMultiplierStore } from '../store/content-multiplier-store';
import { createClient } from '@/app/supabase/client';
import { toast } from 'sonner';

interface PlatformConnectDialogProps {
  platform: SocialPlatform | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Platform Connection Dialog
 * Handles OAuth connection flow with clear user guidance
 */
export function PlatformConnectDialog({ platform, open, onOpenChange }: PlatformConnectDialogProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const connections = useContentMultiplierStore((state) => state.oauth_connections);

  const platformInfo = {
    twitter: {
      icon: XIcon,
      name: 'Twitter/X',
      color: 'bg-black',
      supported: true,
      permissions: ['Post tweets', 'Create threads', 'Read profile info'],
      features: ['Auto-posting', 'Thread creation', 'Hashtag optimization'],
    },
    instagram: {
      icon: InstagramIcon,
      name: 'Instagram',
      color: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500',
      supported: false,
      permissions: ['Post photos and videos', 'Access basic profile info'],
      features: ['Story posting', 'Feed posts', 'Hashtag suggestions'],
    },
    tiktok: {
      icon: TikTokIcon,
      name: 'TikTok',
      color: 'bg-black',
      supported: false,
      permissions: ['Upload videos', 'Access profile information'],
      features: ['Video posting', 'Trending hashtags', 'Viral optimization'],
    },
    linkedin: {
      icon: LinkedInIcon,
      name: 'LinkedIn',
      color: 'bg-blue-600',
      supported: true,
      permissions: ['Create posts', 'Access profile info', 'Company page access'],
      features: ['Professional posting', 'Network sharing', 'Industry hashtags'],
    },
    facebook: {
      icon: FacebookIcon,
      name: 'Facebook',
      color: 'bg-blue-500',
      supported: true,
      permissions: ['Post to timeline', 'Access basic info', 'Page management'],
      features: ['Timeline posting', 'Page posting', 'Community engagement'],
    },
  };

  if (!platform) return null;

  const info = platformInfo[platform];
  const isConnected = connections[platform]?.connected || false;

  const handleConnect = async () => {
    if (isConnected) return;
    
    setIsConnecting(true);
    
    try {
      const supabase = createClient();
      
      // Map our platform IDs to Supabase provider names
      const providerMap = {
        twitter: 'twitter',
        facebook: 'facebook', 
        linkedin: 'linkedin_oidc',
        instagram: null, // Not supported by Supabase Auth
        tiktok: null, // Not supported by Supabase Auth
      } as const;
      
      const supabaseProvider = providerMap[platform];
      
      if (!supabaseProvider) {
        toast.error(`${info.name} integration coming soon!`, {
          description: 'This platform will be available in a future update',
        });
        return;
      }
      
      toast.info(`Connecting to ${info.name}...`, {
        description: 'You will be redirected to authorize the connection',
      });
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      
      if (error) {
        throw error;
      }
      
      if (data.url) {
        // Store the platform we're connecting for use in callback
        localStorage.setItem('connecting_platform', platform);
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast.error(`Failed to connect to ${info.name}`, {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    // Handle disconnection logic
    const { disconnectPlatform } = useContentMultiplierStore.getState();
    
    try {
      await disconnectPlatform(platform);
      toast.success(`Disconnected from ${info.name}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to disconnect from ${info.name}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${info.color} flex items-center justify-center`}>
              <info.icon className="h-5 w-5 text-white" size={20} />
            </div>
            <div>
              <div className="font-semibold">{info.name}</div>
              {isConnected && (
                <Badge variant="secondary" className="text-xs mt-1">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            {!info.supported
              ? `${info.name} integration is coming soon! We're working on adding support for this platform.`
              : isConnected 
                ? `Manage your ${info.name} connection and posting preferences.`
                : `Connect your ${info.name} account to enable direct posting and scheduling.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!info.supported ? (
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <info.icon className="h-8 w-8 text-muted-foreground" size={32} />
              </div>
              <h3 className="font-medium mb-2">Coming Soon</h3>
              <p className="text-sm text-muted-foreground mb-4">
                We're actively working on {info.name} integration. Stay tuned for updates!
              </p>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Good news:</strong> You can still generate optimized {info.name} content! 
                  Just copy and paste from the content preview tabs.
                </p>
              </div>
            </div>
          ) : !isConnected ? (
            <>
              {/* Permissions */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  Required Permissions
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {info.permissions.map((permission, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                      {permission}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Features */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  Enabled Features
                </h4>
                <div className="flex flex-wrap gap-1">
                  {info.features.map((feature, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Security Notice */}
              <div className="p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-emerald-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium">Secure Connection</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Powered by Supabase Auth. Your credentials are never stored - only secure access tokens that you can revoke anytime.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {isConnected && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 dark:bg-green-950/20 rounded-lg border border-blue-200 dark:border-green-800">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-600">
                    Successfully Connected
                  </span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-600 mt-1">
                  You can now publish content directly to {info.name}
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>Connected as: <span className="font-medium">@{connections[platform]?.username || 'username'}</span></p>
                <p className="text-xs mt-1">
                  Last connected: {new Date(connections[platform]?.last_connected || '').toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              {!info.supported ? 'Got it' : 'Cancel'}
            </Button>
            
            {info.supported && (
              isConnected ? (
                <Button 
                  variant="destructive" 
                  onClick={handleDisconnect}
                  className="flex-1"
                >
                  Disconnect
                </Button>
              ) : (
                <Button 
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className={`flex-1 ${info.color} hover:opacity-90 text-white`}
                >
                  {isConnecting ? (
                    'Connecting...'
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connect {info.name}
                    </>
                  )}
                </Button>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}