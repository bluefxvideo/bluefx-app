'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  History,
  ExternalLink,
  RefreshCw,
  Loader2,
  Filter,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  useContentMultiplierV2Store,
  usePostedHistory,
  PLATFORM_CONFIGS,
  type SocialPlatform,
  type PostStatus,
} from '../store/content-multiplier-v2-store';
import {
  TikTokIcon,
  InstagramIcon,
  YouTubeIcon,
  XIcon,
  LinkedInIcon,
  FacebookIcon,
} from '../components/brand-icons';

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

const STATUS_STYLES: Record<PostStatus, { color: string; icon: React.ReactNode; label: string }> = {
  posted: {
    color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    icon: <Check className="w-3 h-3" />,
    label: 'Posted',
  },
  failed: {
    color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    icon: <X className="w-3 h-3" />,
    label: 'Failed',
  },
  cancelled: {
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    icon: <X className="w-3 h-3" />,
    label: 'Cancelled',
  },
  draft: {
    color: 'bg-gray-100 text-gray-700',
    icon: null,
    label: 'Draft',
  },
  scheduled: {
    color: 'bg-blue-100 text-blue-700',
    icon: null,
    label: 'Scheduled',
  },
  posting: {
    color: 'bg-yellow-100 text-yellow-700',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: 'Posting',
  },
};

// Format posted date
function formatPostedDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`;
  }
  if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function PostedTab() {
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'failed'>('all');

  // Store state
  const postedHistory = usePostedHistory();
  const isLoading = useContentMultiplierV2Store((s) => s.isLoadingHistory);

  // Store actions
  const loadPostedHistory = useContentMultiplierV2Store((s) => s.loadPostedHistory);
  const repostContent = useContentMultiplierV2Store((s) => s.repostContent);

  // Load posts on mount
  useEffect(() => {
    loadPostedHistory();
  }, [loadPostedHistory]);

  // Filter posts
  const filteredPosts = postedHistory.filter((post) => {
    if (platformFilter !== 'all' && post.platform !== platformFilter) return false;
    if (statusFilter !== 'all' && post.status !== statusFilter) return false;
    return true;
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Posted History</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadPostedHistory()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select
          value={platformFilter}
          onValueChange={(value) => setPlatformFilter(value as SocialPlatform | 'all')}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {Object.values(PLATFORM_CONFIGS).map((config) => (
              <SelectItem key={config.id} value={config.id}>
                {config.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as 'all' | 'posted' | 'failed')}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Empty State */}
      {filteredPosts.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <History className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium mb-2">No posted content yet</h3>
          <p className="text-sm text-muted-foreground">
            Your posted and scheduled content will appear here
          </p>
        </div>
      )}

      {/* Posts List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {filteredPosts.map((post) => {
          const Icon = PlatformIconMap[post.platform];
          const config = PLATFORM_CONFIGS[post.platform];
          const statusStyle = STATUS_STYLES[post.status];

          return (
            <Card key={post.id} className="p-4">
              <div className="flex gap-4">
                {/* Video Thumbnail */}
                {post.videoThumbnailUrl ? (
                  <img
                    src={post.videoThumbnailUrl}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                    <History className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-5 h-5 rounded ${PLATFORM_COLORS[post.platform]} flex items-center justify-center`}>
                      <Icon className="text-white" size={10} />
                    </div>
                    <span className="text-sm font-medium">{config.name}</span>
                    <Badge
                      variant="secondary"
                      className={`flex items-center gap-1 ${statusStyle.color}`}
                    >
                      {statusStyle.icon}
                      {statusStyle.label}
                    </Badge>
                  </div>

                  <p className="text-sm line-clamp-2 mb-2">
                    {post.generatedContent?.caption || post.originalDescription}
                  </p>

                  {/* Posted time or error */}
                  {post.postedAt && (
                    <p className="text-xs text-muted-foreground">
                      {formatPostedDate(post.postedAt)}
                    </p>
                  )}
                  {post.status === 'failed' && post.errorMessage && (
                    <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {post.errorMessage}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    {post.platformPostUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a
                          href={post.platformPostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View on {config.name}
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => repostContent(post.id)}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Repost
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
