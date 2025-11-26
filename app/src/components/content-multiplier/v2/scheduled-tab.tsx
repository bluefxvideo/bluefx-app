'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Clock,
  Edit2,
  Trash2,
  Loader2,
  Plus,
  Filter,
} from 'lucide-react';
import {
  useContentMultiplierV2Store,
  useScheduledPosts,
  PLATFORM_CONFIGS,
  type SocialPlatform,
  type ScheduledPost,
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

// Group posts by date
function groupPostsByDate(posts: ScheduledPost[]): Record<string, ScheduledPost[]> {
  const groups: Record<string, ScheduledPost[]> = {};

  posts.forEach((post) => {
    if (!post.scheduledFor) return;

    const date = new Date(post.scheduledFor);
    const dateKey = date.toDateString();

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(post);
  });

  // Sort posts within each group by time
  Object.keys(groups).forEach((key) => {
    groups[key].sort((a, b) =>
      new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime()
    );
  });

  return groups;
}

// Format date header
function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === now.toDateString()) {
    return `Today, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

// Format time
function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function ScheduledTab() {
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');

  // Store state
  const scheduledPosts = useScheduledPosts();
  const isLoading = useContentMultiplierV2Store((s) => s.isLoadingScheduled);

  // Store actions
  const loadScheduledPosts = useContentMultiplierV2Store((s) => s.loadScheduledPosts);
  const cancelScheduledPost = useContentMultiplierV2Store((s) => s.cancelScheduledPost);
  const editScheduledPost = useContentMultiplierV2Store((s) => s.editScheduledPost);
  const setActiveMainTab = useContentMultiplierV2Store((s) => s.setActiveMainTab);

  // Load posts on mount
  useEffect(() => {
    loadScheduledPosts();
  }, [loadScheduledPosts]);

  // Filter posts
  const filteredPosts = platformFilter === 'all'
    ? scheduledPosts
    : scheduledPosts.filter((p) => p.platform === platformFilter);

  // Group by date
  const groupedPosts = groupPostsByDate(filteredPosts);
  const sortedDates = Object.keys(groupedPosts).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

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
        <h2 className="text-xl font-semibold">Scheduled Posts</h2>
        <Button
          size="sm"
          onClick={() => setActiveMainTab('create')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Post
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select
          value={platformFilter}
          onValueChange={(value) => setPlatformFilter(value as SocialPlatform | 'all')}
        >
          <SelectTrigger className="w-[180px]">
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
      </div>

      {/* Empty State */}
      {sortedDates.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium mb-2">No scheduled posts</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a new post to get started
          </p>
          <Button onClick={() => setActiveMainTab('create')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Post
          </Button>
        </div>
      )}

      {/* Posts List */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {sortedDates.map((dateStr) => (
          <div key={dateStr}>
            {/* Date Header */}
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium">{formatDateHeader(dateStr)}</h3>
            </div>

            {/* Posts for this date */}
            <div className="space-y-3">
              {groupedPosts[dateStr].map((post) => {
                const Icon = PlatformIconMap[post.platform];
                const config = PLATFORM_CONFIGS[post.platform];

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
                          <Calendar className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {formatTime(post.scheduledFor!)}
                          </span>
                          <div className={`w-5 h-5 rounded ${PLATFORM_COLORS[post.platform]} flex items-center justify-center`}>
                            <Icon className="text-white" size={10} />
                          </div>
                          <span className="text-sm font-medium">{config.name}</span>
                        </div>

                        <p className="text-sm line-clamp-2">
                          {post.generatedContent?.caption || post.originalDescription}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editScheduledPost(post.id)}
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => cancelScheduledPost(post.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
