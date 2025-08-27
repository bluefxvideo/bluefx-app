'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Clock, History, Loader2, AlertCircle, Trash2, Video, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import type { TalkingAvatarVideo } from '@/actions/database/talking-avatar-database';

interface HistoryOutputProps {
  videos: TalkingAvatarVideo[];
  isLoading: boolean;
  refreshTrigger?: number; // Change this value to trigger a refresh
  onRefresh?: () => void;
  onDeleteVideo?: (videoId: string) => Promise<boolean>;
  onCheckStatus?: (generationId: string) => Promise<void>;
}

/**
 * History Output - Shows talking avatar generation history in right panel
 * Displays past video generations with actions and details
 */
export function HistoryOutput({ 
  videos, 
  isLoading, 
  refreshTrigger, 
  onRefresh,
  onDeleteVideo,
  onCheckStatus
}: HistoryOutputProps) {
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [checkingItems, setCheckingItems] = useState<Set<string>>(new Set());
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true); // Start with muted videos
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'processing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pending': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'failed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

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

  // Video hover handlers
  const handleVideoHover = async (videoId: string, shouldPlay: boolean) => {
    const videoElement = videoRefs.current[videoId];
    if (!videoElement) return;

    if (shouldPlay) {
      setHoveredVideo(videoId);
      try {
        // Set mute state and reset video to start
        videoElement.muted = isMuted;
        videoElement.currentTime = 0;
        await videoElement.play();
      } catch (error) {
        // Video autoplay prevented - silent failure
      }
    } else {
      setHoveredVideo(null);
      videoElement.pause();
      videoElement.currentTime = 0; // Reset to beginning
    }
  };

  // Toggle mute for all videos
  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    // Update all video elements
    Object.values(videoRefs.current).forEach(videoElement => {
      if (videoElement) {
        videoElement.muted = newMutedState;
      }
    });
  };

  // Handle manual status check
  const handleCheckStatus = async (video: TalkingAvatarVideo) => {
    if (!onCheckStatus || !video.hedra_generation_id) return;
    
    setCheckingItems(prev => new Set(prev).add(video.id));
    
    try {
      await onCheckStatus(video.hedra_generation_id);
    } catch (error) {
      console.error('Error checking video status:', error);
    } finally {
      setCheckingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(video.id);
        return newSet;
      });
    }
  };

  // Handle video deletion
  const handleDeleteVideo = async (videoId: string) => {
    if (!onDeleteVideo) return;
    
    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    setDeletingItems(prev => new Set(prev).add(videoId));
    
    try {
      const success = await onDeleteVideo(videoId);
      if (success) {
        // Remove from selected history if it was selected
        if (selectedHistory === videoId) {
          setSelectedHistory(null);
        }
      }
    } catch (error) {
      console.error('Error deleting video:', error);
    } finally {
      setDeletingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    }
  };

  // Loading state
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

  // Empty state
  if (videos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
          <Video className="w-12 h-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-medium mb-2">No Videos Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your generated talking avatar videos will appear here
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Controls */}
      <div className="flex items-center justify-between px-1 pb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {videos.length} video{videos.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="h-7 px-2"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMute}
            className="h-7 px-2"
            title={isMuted ? 'Unmute video previews' : 'Mute video previews'}
          >
            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Videos Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-hover">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
          {videos.map((video) => (
            <Card 
              key={video.id} 
              className={`p-3 bg-secondary transition-all duration-200 hover:shadow-md cursor-pointer ${
                selectedHistory === video.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedHistory(selectedHistory === video.id ? null : video.id)}
            >
              <div className="space-y-2">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <Badge className={`text-sm ${getStatusColor(video.status)}`}>
                    {video.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">-</span>
                </div>
                
                {/* Script Text Preview */}
                <p className="font-medium text-base leading-tight line-clamp-2">
                  {video.script_text || 'No script available'}
                </p>
                
                {/* Date */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(video.created_at || '')}</span>
                </div>

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
                      poster={video.thumbnail_url || undefined}
                      preload="metadata"
                      controls={hoveredVideo === video.id}
                      loop
                      muted={isMuted}
                    />
                  ) : video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.script_text || 'Video preview'}
                      className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                      <Video className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Processing overlay */}
                  {video.status !== 'completed' && video.status !== 'failed' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>

                {/* Video Details */}
                {video.duration_seconds && (
                  <div className="text-xs text-muted-foreground">
                    Duration: {video.duration_seconds}s
                  </div>
                )}

                {/* Expanded Actions */}
                {selectedHistory === video.id && (
                  <div className="pt-2 border-t space-y-2">
                    <div className="text-sm text-muted-foreground">
                      ID: {video.id}
                    </div>
                    <div className="flex flex-col gap-1">
                      {video.video_url && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 justify-start"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(video.video_url, '_blank');
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          <span className="text-sm">View Video</span>
                        </Button>
                      )}
                      {video.video_url && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 justify-start"
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
                              a.download = `talking-avatar-${video.id}-${Date.now()}.mp4`;
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
                        >
                          <Download className="w-3 h-3 mr-1" />
                          <span className="text-sm">Download</span>
                        </Button>
                      )}
                      {(video.status === 'processing' || video.status === 'pending') && onCheckStatus && video.hedra_generation_id && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 justify-start"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckStatus(video);
                          }}
                          disabled={checkingItems.has(video.id)}
                        >
                          {checkingItems.has(video.id) ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-1" />
                          )}
                          <span className="text-sm">
                            {checkingItems.has(video.id) ? 'Checking...' : 'Check Status'}
                          </span>
                        </Button>
                      )}
                      {onRefresh && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 justify-start"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRefresh();
                          }}
                        >
                          <Loader2 className="w-3 h-3 mr-1" />
                          <span className="text-sm">Refresh</span>
                        </Button>
                      )}
                      {onDeleteVideo && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVideo(video.id);
                          }}
                          disabled={deletingItems.has(video.id)}
                        >
                          {deletingItems.has(video.id) ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3 mr-1" />
                          )}
                          <span className="text-sm">
                            {deletingItems.has(video.id) ? 'Deleting...' : 'Delete'}
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Summary Footer */}
      <Card className="mt-4 p-3 bg-secondary">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold text-primary">
              {videos.length}
            </p>
            <p className="text-sm text-muted-foreground">Videos</p>
          </div>
          <div>
            <p className="text-lg font-semibold">-</p>
            <p className="text-sm text-muted-foreground">Credits Used</p>
          </div>
          <div>
            <p className="text-lg font-semibold">
              {videos.filter(v => v.status === 'completed').length}
            </p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </div>
      </Card>
    </div>
  );
}