'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Play, Download, Trash2, RefreshCw } from 'lucide-react';
import { getTalkingAvatarVideos, deleteTalkingAvatarVideo } from '@/actions/database/talking-avatar-database';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { TabContentWrapper, TabHeader, TabBody } from '@/components/tools/tab-content-wrapper';

interface AvatarVideo {
  id: string;
  script_text: string;
  avatar_image_url: string;
  video_url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  app_voice_id?: string;
}

export function HistoryTab() {
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<AvatarVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const supabase = createClient();

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const loadVideos = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { videos: videoList } = await getTalkingAvatarVideos(user.id);
      setVideos(videoList.map(video => ({
        id: video.id,
        script_text: video.script_text,
        avatar_image_url: video.thumbnail_url || 'default-avatar.jpg',
        video_url: video.video_url || undefined,
        status: video.status as 'pending' | 'processing' | 'completed' | 'failed',
        created_at: video.created_at || new Date().toISOString(),
        app_voice_id: undefined
      })));
    } catch (error) {
      console.error('Failed to load videos:', error);
      toast.error('Failed to load video history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, [user]);

  const handleDelete = async (videoId: string) => {
    if (!user || deletingIds.has(videoId)) return;

    setDeletingIds(prev => new Set(prev).add(videoId));
    
    try {
      await deleteTalkingAvatarVideo(videoId, user.id);
      setVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('Video deleted successfully');
    } catch (error) {
      console.error('Failed to delete video:', error);
      toast.error('Failed to delete video');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-blue-100 text-blue-600';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateText = (text: string, maxLength: number = 80) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <TabContentWrapper>
      {/* Header */}
      <TabHeader
        icon={History}
        title="Video History"
        description="Manage your talking avatar videos"
      />

      {/* Form Content */}
      <TabBody>
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={loadVideos}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              </Card>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <Card className="p-8 text-center">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No Videos Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your talking avatar videos will appear here once generated.
            </p>
            <p className="text-xs text-muted-foreground">
              Switch to the Generate tab to create your first avatar video.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {videos.map((video) => (
              <Card key={video.id} className="p-4">
                <div className="flex items-start gap-4">
                  {/* Avatar Thumbnail */}
                  <div className="w-12 h-12 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                    {video.avatar_image_url ? (
                      <img
                        src={video.avatar_image_url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <History className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Video Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge 
                        variant="secondary" 
                        className={getStatusColor(video.status)}
                      >
                        {video.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(video.created_at)}
                      </span>
                    </div>
                    
                    <p className="text-sm font-medium mb-1">
                      {truncateText(video.script_text)}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {video.app_voice_id && (
                        <span>Voice: {video.app_voice_id}</span>
                      )}
                      <span>{video.script_text.split(' ').length} words</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {video.status === 'completed' && video.video_url && (
                      <>
                        <Button variant="ghost" size="sm">
                          <Play className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(video.id)}
                      disabled={deletingIds.has(video.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Progress bar for processing videos */}
                {video.status === 'processing' && (
                  <div className="mt-3">
                    <div className="w-full bg-muted rounded-full h-1">
                      <div 
                        className="bg-blue-500 h-1 rounded-full animate-pulse"
                        style={{ width: '60%' }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Processing video... this may take a few minutes
                    </p>
                  </div>
                )}

                {/* Error message for failed videos */}
                {video.status === 'failed' && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                    Video generation failed. Please try generating again.
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </TabBody>
    </TabContentWrapper>
  );
}