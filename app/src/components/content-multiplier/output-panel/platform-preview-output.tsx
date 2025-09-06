'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp,
  Hash,
  Users,
} from 'lucide-react';
import { XIcon, InstagramIcon, TikTokIcon, LinkedInIcon, FacebookIcon } from '../components/brand-icons';
import { useContentMultiplierStore } from '../store/content-multiplier-store';

interface PlatformPreviewOutputProps {
  platform: string;
}

/**
 * Platform Preview Output Component
 * Shows platform-specific content analysis and insights
 */
export function PlatformPreviewOutput({ platform }: PlatformPreviewOutputProps) {
  const { current_variant } = useContentMultiplierStore();
  
  const platformContent = current_variant?.platform_adaptations.find(p => p.platform === platform);

  const platformInfo = {
    twitter: {
      icon: XIcon,
      name: 'Twitter/X',
      color: 'text-black dark:text-white',
      bgColor: 'dark:bg-gray-950/20',
      borderColor: 'border-gray-200 dark:border-gray-800',
    },
    instagram: {
      icon: InstagramIcon,
      name: 'Instagram',
      color: 'text-pink-500',
      bgColor: 'bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:to-orange-950/20',
      borderColor: 'border-pink-200 dark:border-pink-800',
    },
    tiktok: {
      icon: TikTokIcon,
      name: 'TikTok',
      color: 'text-black dark:text-white',
      bgColor: 'dark:bg-gray-950/20',
      borderColor: 'border-gray-200 dark:border-gray-800',
    },
    linkedin: {
      icon: LinkedInIcon,
      name: 'LinkedIn',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    facebook: {
      icon: FacebookIcon,
      name: 'Facebook',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
  };

  const info = platformInfo[platform as keyof typeof platformInfo];
  
  if (!info) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <h3 className="font-medium mb-2">Platform Not Found</h3>
          <p className="text-sm text-muted-foreground">
            The selected platform is not supported.
          </p>
        </div>
      </div>
    );
  }

  if (!platformContent) {
    return (
      <div className="h-full overflow-y-auto scrollbar-hover p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <info.icon className={`h-12 w-12 mx-auto ${info.color}`} size={48} />
          <h2 className="text-2xl font-bold">{info.name}</h2>
          <p className="text-muted-foreground">
            No content generated for this platform yet
          </p>
        </div>

        {/* Platform Info */}
        <Card className={`${info.borderColor}`}>
          <CardHeader>
            <CardTitle className="text-lg">Platform Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">Optimized for {info.name} algorithm</span>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Platform-specific hashtags</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm">Audience-targeted content</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hover p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <info.icon className={`h-12 w-12 mx-auto ${info.color}`} size={48} />
        <h2 className="text-2xl font-bold">{info.name} Content</h2>
        <p className="text-muted-foreground">
          Optimized content for maximum engagement
        </p>
      </div>

      {/* Content Analysis */}
      <Card >
        <CardHeader>
          <CardTitle className="text-lg">Content Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-blue-500">
                {platformContent.character_count}
              </div>
              <div className="text-xs text-muted-foreground">Characters</div>
            </div>
            
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-emerald-500">
                {platformContent.engagement_score || 75}
              </div>
              <div className="text-xs text-muted-foreground">Engagement Score</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Hashtags</h4>
            <div className="flex flex-wrap gap-1">
              {platformContent.hashtags.map((hashtag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {hashtag}
                </Badge>
              ))}
            </div>
          </div>

          {platformContent.thread_parts && (
            <div className="space-y-2">
              <h4 className="font-medium">Thread Structure</h4>
              <div className="text-sm text-muted-foreground">
                {platformContent.thread_parts.length} connected parts
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optimization Notes */}
      {platformContent.optimization_notes && platformContent.optimization_notes.length > 0 && (
        <Card >
          <CardHeader>
            <CardTitle className="text-lg">Optimization Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {platformContent.optimization_notes?.map((note: string, index: number) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                <span className="text-sm">{note}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Content Preview */}
      <Card >
        <CardHeader>
          <CardTitle className="text-lg">Full Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {platformContent.content}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}