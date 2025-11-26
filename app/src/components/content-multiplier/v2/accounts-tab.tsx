'use client';

import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Check, AlertCircle, ExternalLink } from 'lucide-react';
import {
  useContentMultiplierV2Store,
  useConnectedAccounts,
  PLATFORM_CONFIGS,
  type SocialPlatform,
} from '../store/content-multiplier-v2-store';
import {
  platformIcons,
  TikTokIcon,
  InstagramIcon,
  YouTubeIcon,
  XIcon,
  LinkedInIcon,
  FacebookIcon,
} from '../components/brand-icons';

const PLATFORM_ORDER: SocialPlatform[] = ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin', 'facebook'];

const PlatformIconMap: Record<SocialPlatform, React.FC<{ className?: string; size?: number }>> = {
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
  youtube: YouTubeIcon,
  twitter: XIcon,
  linkedin: LinkedInIcon,
  facebook: FacebookIcon,
};

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  tiktok: 'bg-black',
  instagram: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400',
  youtube: 'bg-red-600',
  twitter: 'bg-black',
  linkedin: 'bg-blue-700',
  facebook: 'bg-blue-600',
};

export function AccountsTab() {
  const connectedAccounts = useConnectedAccounts();
  const loadConnectedAccounts = useContentMultiplierV2Store((s) => s.loadConnectedAccounts);
  const connectAccount = useContentMultiplierV2Store((s) => s.connectAccount);
  const disconnectAccount = useContentMultiplierV2Store((s) => s.disconnectAccount);
  const isConnecting = useContentMultiplierV2Store((s) => s.isConnecting);

  useEffect(() => {
    loadConnectedAccounts();
  }, [loadConnectedAccounts]);

  const getStatusBadge = (platform: SocialPlatform) => {
    const account = connectedAccounts[platform];

    if (!account || !account.connected) {
      return (
        <span className="text-xs text-muted-foreground">Not connected</span>
      );
    }

    if (account.connectionStatus === 'expired') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
          <AlertCircle className="w-3 h-3" />
          Token expired
        </span>
      );
    }

    if (account.connectionStatus === 'active') {
      // Calculate days until expiry
      if (account.expiresAt) {
        const expiresIn = Math.floor(
          (new Date(account.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <Check className="w-3 h-3" />
            {expiresIn > 0 ? `Expires in ${expiresIn} days` : 'Connected'}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-600">
          <Check className="w-3 h-3" />
          Connected
        </span>
      );
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Connected Accounts</h2>
        <p className="text-sm text-muted-foreground">
          Connect your social media accounts to post content directly from the app.
        </p>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {PLATFORM_ORDER.map((platform) => {
          const config = PLATFORM_CONFIGS[platform];
          const account = connectedAccounts[platform];
          const Icon = PlatformIconMap[platform];
          const isCurrentlyConnecting = isConnecting === platform;
          const isConnected = account?.connected && account?.connectionStatus === 'active';

          return (
            <Card key={platform} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Platform Icon */}
                  <div className={`w-12 h-12 rounded-xl ${PLATFORM_COLORS[platform]} flex items-center justify-center`}>
                    <Icon className="text-white" size={24} />
                  </div>

                  {/* Platform Info */}
                  <div>
                    <h3 className="font-medium">{config.name}</h3>
                    {isConnected && account?.username ? (
                      <p className="text-sm text-muted-foreground">@{account.username}</p>
                    ) : (
                      getStatusBadge(platform)
                    )}
                    {isConnected && getStatusBadge(platform)}
                  </div>
                </div>

                {/* Action Button */}
                <div>
                  {isConnected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectAccount(platform)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => connectAccount(platform)}
                      disabled={isCurrentlyConnecting}
                    >
                      {isCurrentlyConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect Account'
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Additional info for connected accounts */}
              {isConnected && account?.lastConnected && (
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                  Last connected: {new Date(account.lastConnected).toLocaleDateString()}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Help text */}
      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <h4 className="text-sm font-medium mb-2">About Account Connections</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Your credentials are securely stored and encrypted</li>
          <li>• We only request permissions needed for posting</li>
          <li>• You can disconnect at any time</li>
          <li>• Instagram requires a Business or Creator account</li>
        </ul>
      </div>
    </div>
  );
}
