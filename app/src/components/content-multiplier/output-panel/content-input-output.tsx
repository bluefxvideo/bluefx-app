'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Target, 
  Zap, 
  TrendingUp,
  CheckCircle,
} from 'lucide-react';
import { XIcon, InstagramIcon, TikTokIcon, LinkedInIcon, FacebookIcon } from '../components/brand-icons';
import { useContentMultiplierStore } from '../store/content-multiplier-store';

/**
 * Content Input Output Component
 * Shows helpful tips and information when user is on the input tab
 */
export function ContentInputOutput() {
  const { selected_platforms, original_input, uploaded_files } = useContentMultiplierStore();

  const platformFeatures = {
    twitter: {
      icon: XIcon,
      name: 'Twitter/X',
      color: 'text-black dark:text-white',
      features: ['280 character limit', 'Thread support', 'Trending hashtags', 'Real-time engagement'],
    },
    instagram: {
      icon: InstagramIcon,
      name: 'Instagram', 
      color: 'text-pink-500',
      features: ['Visual storytelling', 'Story format', 'Niche hashtags', 'High engagement rates'],
    },
    tiktok: {
      icon: TikTokIcon,
      name: 'TikTok',
      color: 'text-black dark:text-white',
      features: ['Short-form content', 'Viral potential', 'Youth audience', 'Creative formats'],
    },
    linkedin: {
      icon: LinkedInIcon,
      name: 'LinkedIn',
      color: 'text-blue-600',
      features: ['Professional tone', 'Industry insights', 'B2B focus', 'Thought leadership'],
    },
    facebook: {
      icon: FacebookIcon,
      name: 'Facebook',
      color: 'text-blue-500',
      features: ['Community focus', 'Longer content', 'Diverse audience', 'Group sharing'],
    },
  };

  const _contentTips = [
    {
      icon: Target,
      title: 'Define Your Audience',
      description: 'Know who you&apos;re creating content for to optimize platform adaptations.',
    },
    {
      icon: Zap,
      title: 'Hook First',
      description: 'Start with attention-grabbing opening lines that work across all platforms.',
    },
    {
      icon: TrendingUp,
      title: 'Include Trending Topics',
      description: 'Reference current events or trending hashtags to increase visibility.',
    },
    {
      icon: CheckCircle,
      title: 'Clear Call-to-Action',
      description: 'End with a specific action you want your audience to take.',
    },
  ];

  return (
    <div className="h-full overflow-y-auto scrollbar-hover p-6 space-y-6">
      {/* Progress Indicator */}
      <Card >
        <CardHeader>
          <CardTitle className="text-lg">Getting Started</CardTitle>
          <CardDescription>Follow these steps to multiply your content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={`flex items-center gap-3 p-2 rounded-lg ${
            original_input.trim() || uploaded_files.length > 0 
              ? '
              : 'bg-muted/50'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              original_input.trim() || uploaded_files.length > 0 
                ? '
                : 'bg-gray-200 dark:bg-gray-700 text-muted-foreground'
            }`}>
              {original_input.trim() || uploaded_files.length > 0 ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <span className="text-xs font-bold">1</span>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Add Content</div>
              <div className="text-xs text-muted-foreground">
                {original_input.trim() 
                  ? `${original_input.length} characters entered` 
                  : uploaded_files.length > 0 
                    ? `${uploaded_files.length} file(s) uploaded`
                    : 'Enter text or upload files'}
              </div>
            </div>
          </div>

          <div className={`flex items-center gap-3 p-2 rounded-lg ${
            selected_platforms.length > 0 
              ? '
              : 'bg-muted/50'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              selected_platforms.length > 0 
                ? '
                : 'bg-gray-200 dark:bg-gray-700 text-muted-foreground'
            }`}>
              {selected_platforms.length > 0 ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <span className="text-xs font-bold">2</span>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Select Platforms</div>
              <div className="text-xs text-muted-foreground">
                {selected_platforms.length > 0 
                  ? `${selected_platforms.length} platform(s) selected`
                  : 'Choose social media platforms'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-muted-foreground flex items-center justify-center">
              <span className="text-xs font-bold">3</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Generate & Review</div>
              <div className="text-xs text-muted-foreground">
                Generate platform-specific content and review
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Platforms Overview */}
      {selected_platforms.length > 0 && (
        <Card >
          <CardHeader>
            <CardTitle className="text-lg">Selected Platforms</CardTitle>
            <CardDescription>
              Your content will be optimized for these platforms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected_platforms.map((platformId) => {
              const platform = platformFeatures[platformId as keyof typeof platformFeatures];
              if (!platform) return null;

              return (
                <div key={platformId} className="flex items-start gap-3 p-3 border rounded-lg">
                  <platform.icon className={`h-5 w-5 mt-0.5 ${platform.color}`} size={20} />
                  <div className="flex-1">
                    <div className="font-medium">{platform.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {platform.features.map((feature) => (
                        <Badge key={feature} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Content Tips */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Content Tips
          </CardTitle>
          <CardDescription>
            Best practices for creating engaging multi-platform content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {contentTips.map((tip) => (
            <div key={tip.title} className="flex items-start gap-3">
              <tip.icon className="h-4 w-4 mt-1 text-emerald-500 flex-shrink-0" />
              <div>
                <div className="font-medium text-sm">{tip.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {tip.description}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card> */}

      {/* Features Overview */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI-Powered Features</CardTitle>
          <CardDescription>
            What makes Content Multiplier special
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-100 rounded-full" />
            <span className="text-sm">Platform-specific tone adaptation</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-100 rounded-full" />
            <span className="text-sm">Automatic hashtag generation</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-100 rounded-full" />
            <span className="text-sm">Character limit optimization</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-100 rounded-full" />
            <span className="text-sm">Thread creation for long content</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-100 rounded-full" />
            <span className="text-sm">Engagement optimization</span>
          </div>
        </CardContent>
      </Card> */}
    </div>
  );
}