'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Play, Download, Edit, Trash2, Video, Clock, Loader2, RefreshCw } from 'lucide-react';
import { createClient } from '@/app/supabase/client';

interface ScriptVideoHistoryItem {
  id: string;
  script_title: string;
  script_content: string;
  video_url?: string;
  status: string;
  created_at: string;
  credits_used?: number;
  resolution?: string;
  processing_logs?: any;
  editor_data?: any;
}

export function HistoryOutput() {
  const [videos, setVideos] = useState<ScriptVideoHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const supabase = createClient();

  // Fetch video history
  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        console.error('No user found');
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('script_to_video_history')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching history:', error);
      } else {
        setVideos(data || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const handleReEdit = (video: ScriptVideoHistoryItem) => {
    if (video.editor_data) {
      // TODO: Load editor state and navigate to editor
      console.log('Re-edit video:', video.id);
      console.log('Editor data available:', video.editor_data);
    }
  };

  const handleDelete = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('script_to_video_history')
        .delete()
        .eq('id', videoId);

      if (!error) {
        setVideos(videos.filter(v => v.id !== videoId));
      }
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading video history...</p>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
          <div className="w-16 h-16 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center mx-auto">
            <History className="w-8 h-8 text-white" />
          </div>
          
          <div>
            <h3 className="font-medium mb-2">No Videos Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your exported videos will appear here. Generate and export a video to see it in your history.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {videos.length} video{videos.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchHistory}
          className="h-7 px-2"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {/* Videos Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-hover">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
          {videos.map((video) => (
            <Card 
              key={video.id}
              className={`p-4 space-y-3 cursor-pointer hover:shadow-lg transition-all ${
                selectedVideo === video.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedVideo(selectedVideo === video.id ? null : video.id)}
            >
              {/* Video Preview */}
              <div className="aspect-video bg-muted rounded overflow-hidden">
                {video.video_url ? (
                  <div className="relative w-full h-full group">
                    <video
                      src={video.video_url}
                      className="w-full h-full object-cover"
                      poster={video.video_url}
                      muted
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-12 h-12 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {video.script_title || 'Untitled Video'}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {video.script_content || 'No description'}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {video.resolution || '1080p'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(video.created_at)}</span>
                  {video.credits_used && (
                    <>
                      <span>•</span>
                      <span>{video.credits_used} credits</span>
                    </>
                  )}
                </div>

                {/* Actions (shown when selected) */}
                {selectedVideo === video.id && (
                  <div className="flex gap-2 pt-2 border-t">
                    {video.video_url && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(video.video_url, '_blank');
                          }}
                          className="flex-1"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Play
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const a = document.createElement('a');
                            a.href = video.video_url;
                            a.download = `${video.script_title || 'video'}.mp4`;
                            a.click();
                          }}
                          className="flex-1"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                      </>
                    )}
                    {video.editor_data && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReEdit(video);
                        }}
                        className="flex-1"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Re-edit
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(video.id);
                      }}
                      className="flex-1"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}