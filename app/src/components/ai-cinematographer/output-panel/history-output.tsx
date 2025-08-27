'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Clock, History, Loader2, AlertCircle, Trash2, Video } from 'lucide-react';
import type { CinematographerVideo } from '@/actions/database/cinematographer-database';
import { HistoryFilters } from '@/components/tools/standard-history-filters';

interface HistoryOutputProps {
  videos: CinematographerVideo[];
  isLoading: boolean;
  refreshTrigger?: number; // Change this value to trigger a refresh
  filters?: HistoryFilters;
  onRefresh?: () => void;
  onDeleteVideo?: (videoId: string) => Promise<boolean>;
}

/**
 * History Output - Shows cinematographer generation history in right panel
 * Displays past video generations with actions and details
 */
export function HistoryOutput({ 
  videos, 
  isLoading, 
  refreshTrigger, 
  filters,
  onRefresh,
  onDeleteVideo
}: HistoryOutputProps) {
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  // Apply filters when videos or filters change
  const filteredVideos = videos.filter(video => {
    if (!filters) return true;

    // Apply search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      if (!video.video_concept?.toLowerCase().includes(searchLower)) return false;
    }

    // Apply type filter (status filter)
    if (filters.filterType && filters.filterType !== 'all') {
      if (video.status !== filters.filterType) return false;
    }

    // Apply date range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          cutoffDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      if (new Date(video.created_at || '') < cutoffDate) return false;
    }

    return true;
  }).sort((a, b) => {
    // Apply sort order
    const aDate = new Date(a.created_at || '').getTime();
    const bDate = new Date(b.created_at || '').getTime();
    
    switch (filters?.sortOrder) {
      case 'oldest':
        return aDate - bDate;
      case 'name':
        return (a.video_concept || '').localeCompare(b.video_concept || '');
      case 'name_desc':
        return (b.video_concept || '').localeCompare(a.video_concept || '');
      case 'newest':
      default:
        return bDate - aDate;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'processing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'planning': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'shooting': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'editing': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
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
        // Reset video to start and play
        videoElement.currentTime = 0;
        await videoElement.play();
      } catch (error) {
        console.log('Video autoplay prevented:', error);
      }
    } else {
      setHoveredVideo(null);
      videoElement.pause();
      videoElement.currentTime = 0; // Reset to beginning
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
              Your generated videos will appear here
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // No results after filtering
  if (filteredVideos.length === 0 && videos.length > 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
          <History className="w-12 h-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-medium mb-2">No Results Found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters to see more results
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Videos Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-hover">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
          {filteredVideos.map((video) => (
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
                
                {/* Video Concept Preview */}
                <p className="font-medium text-base leading-tight line-clamp-2">
                  {video.video_concept || 'No concept available'}
                </p>
                
                {/* Date */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(video.created_at || '')}</span>
                </div>

                {/* Video Preview */}
                <div 
                  className="aspect-video bg-muted rounded overflow-hidden relative group"
                  onMouseEnter={() => video.final_video_url && handleVideoHover(video.id, true)}
                  onMouseLeave={() => video.final_video_url && handleVideoHover(video.id, false)}
                >
                  {video.final_video_url ? (
                    <video
                      ref={(el) => videoRefs.current[video.id] = el}
                      src={video.final_video_url}
                      className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                      poster={video.preview_urls?.[0] || undefined}
                      preload="metadata"
                      controls={false}
                      muted
                      loop
                    />
                  ) : video.preview_urls && video.preview_urls.length > 0 ? (
                    <img
                      src={video.preview_urls[0]}
                      alt={video.video_concept || 'Video preview'}
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
                {video.total_duration_seconds && (
                  <div className="text-xs text-muted-foreground">
                    Duration: {video.total_duration_seconds}s
                  </div>
                )}

                {/* Expanded Actions */}
                {selectedHistory === video.id && (
                  <div className="pt-2 border-t space-y-2">
                    <div className="text-sm text-muted-foreground">
                      ID: {video.id}
                    </div>
                    <div className="flex flex-col gap-1">
                      {video.final_video_url && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 justify-start"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(video.final_video_url, '_blank');
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          <span className="text-sm">View Video</span>
                        </Button>
                      )}
                      {video.final_video_url && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 justify-start"
                          onClick={async (e) => {
                            e.stopPropagation();
                            
                            if (!video.final_video_url) return;
                            
                            try {
                              // Fetch the video blob
                              const response = await fetch(video.final_video_url);
                              
                              if (!response.ok) {
                                throw new Error(`Failed to fetch video: ${response.status}`);
                              }
                              
                              const blob = await response.blob();
                              
                              // Create blob URL and download
                              const blobUrl = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = blobUrl;
                              a.download = `cinematographer-${video.id}-${Date.now()}.mp4`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              
                              // Clean up blob URL
                              URL.revokeObjectURL(blobUrl);
                            } catch (error) {
                              console.error('Download failed:', error);
                              // Fallback to opening in new tab
                              window.open(video.final_video_url, '_blank');
                            }
                          }}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          <span className="text-sm">Download</span>
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
              {filteredVideos.length}{videos.length !== filteredVideos.length && <span className="text-sm text-muted-foreground">/{videos.length}</span>}
            </p>
            <p className="text-sm text-muted-foreground">Videos</p>
          </div>
          <div>
            <p className="text-lg font-semibold">-</p>
            <p className="text-sm text-muted-foreground">Credits Used</p>
          </div>
          <div>
            <p className="text-lg font-semibold">
              {filteredVideos.filter(v => v.status === 'completed').length}
            </p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </div>
      </Card>
    </div>
  );
}