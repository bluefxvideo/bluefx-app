'use client';

import { useState, useEffect, useRef } from 'react';
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
  editor_metadata?: any;
  remotion_composition?: any;
}

export function HistoryOutput() {
  const [videos, setVideos] = useState<ScriptVideoHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
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

  const handleReEdit = async (video: ScriptVideoHistoryItem) => {
    // Every video should be editable - the editor can load from the video ID
    console.log('Opening editor for video:', video.id);

    try {
      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        console.error('No user found');
        return;
      }

      // Determine the editor URL based on environment
      // Check for environment variable first, then fallback to detection
      let editorBaseUrl = process.env.NEXT_PUBLIC_VIDEO_EDITOR_URL;

      if (!editorBaseUrl) {
        const hostname = window.location.hostname;

        // Check different environments
        if (hostname === 'ai.bluefx.net' || hostname === 'app.bluefx.net') {
          // Production
          editorBaseUrl = 'https://editor.bluefx.net';
        } else if (hostname.includes('github.dev') || hostname.includes('app.github.dev')) {
          // GitHub Codespaces - use port forwarding
          const codespacePrefix = hostname.split('-')[0];
          editorBaseUrl = `https://${codespacePrefix}-5173.app.github.dev`;
        } else {
          // Local development
          editorBaseUrl = 'http://localhost:5173';
        }

        console.log('Detected editor URL:', editorBaseUrl, 'from hostname:', hostname);
      }

      // Get the current app URL for API calls
      const apiUrl = window.location.origin;

      // Build the editor URL with parameters
      const editorUrl = new URL('/', editorBaseUrl);
      editorUrl.searchParams.set('videoId', video.id);
      editorUrl.searchParams.set('userId', userData.user.id);
      editorUrl.searchParams.set('apiUrl', apiUrl);

      console.log('Opening editor:', editorUrl.toString());

      // Navigate to the editor
      window.location.href = editorUrl.toString();
    } catch (error) {
      console.error('Error opening editor:', error);
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

  // Video hover handlers
  const handleVideoHover = async (videoId: string, shouldPlay: boolean) => {
    const videoElement = videoRefs.current[videoId];
    if (!videoElement) return;

    if (shouldPlay) {
      setHoveredVideo(videoId);
      try {
        videoElement.currentTime = 0;
        await videoElement.play();
      } catch (error) {
        // Video autoplay prevented - silent failure
      }
    } else {
      setHoveredVideo(null);
      videoElement.pause();
      videoElement.currentTime = 0;
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
    <div className="h-full overflow-y-auto scrollbar-hover p-4">
      {/* Videos Grid - Full width with 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <Card 
              key={video.id}
              className={`p-4 space-y-3 cursor-pointer hover:shadow-lg transition-all ${
                selectedVideo === video.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedVideo(selectedVideo === video.id ? null : video.id)}
            >
              {/* Video Preview */}
              <div 
                className="aspect-video bg-muted rounded overflow-hidden relative group"
                onMouseEnter={() => video.video_url && handleVideoHover(video.id, true)}
                onMouseLeave={() => video.video_url && handleVideoHover(video.id, false)}
              >
                {video.video_url ? (
                  <video
                    ref={(el) => videoRefs.current[video.id] = el}
                    src={video.video_url}
                    className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                    poster={video.video_url}
                    preload="metadata"
                    controls={hoveredVideo === video.id}
                    muted
                    loop
                  />
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
                  <div className="flex gap-1 ml-2">
                    <Badge variant={video.video_url ? "default" : "secondary"}>
                      {video.video_url ? 'Exported' : 'Draft'}
                    </Badge>
                    {video.resolution && (
                      <Badge variant="outline">
                        {video.resolution}
                      </Badge>
                    )}
                  </div>
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
                          onClick={async (e) => {
                            e.stopPropagation();
                            
                            if (!video.video_url) return;
                            
                            try {
                              // Fetch the video blob
                              const response = await fetch(video.video_url);
                              
                              if (!response.ok) {
                                throw new Error(`Failed to fetch video: ${response.status}`);
                              }
                              
                              const blob = await response.blob();
                              
                              // Create blob URL and download
                              const blobUrl = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = blobUrl;
                              a.download = `${video.script_title || 'video'}-${Date.now()}.mp4`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              
                              // Clean up blob URL
                              URL.revokeObjectURL(blobUrl);
                            } catch (error) {
                              console.error('Download failed:', error);
                              // Fallback to opening in new tab
                              window.open(video.video_url, '_blank');
                            }
                          }}
                          className="flex-1"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                      </>
                    )}
                    {/* Always show editing button - every video should be editable */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Edit clicked for video:', {
                          id: video.id,
                          hasEditorData: !!video.editor_data,
                          hasEditorMetadata: !!video.editor_metadata,
                          hasRemotionComposition: !!video.remotion_composition,
                          hasVideoUrl: !!video.video_url
                        });
                        handleReEdit(video);
                      }}
                      className="flex-1"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      {video.video_url ? 'Re-edit' : 'Continue Editing'}
                    </Button>
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
  );
}