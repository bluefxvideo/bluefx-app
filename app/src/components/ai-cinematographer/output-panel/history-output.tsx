'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Clock, History, Loader2, Trash2, Video, Image } from 'lucide-react';
import type { CinematographerVideo } from '@/actions/database/cinematographer-database';
import { HistoryFilters } from '@/components/tools/standard-history-filters';

interface HistoryOutputProps {
  videos: CinematographerVideo[];
  isLoading: boolean;
  refreshTrigger?: number; // Change this value to trigger a refresh
  filters?: HistoryFilters;
  onRefresh?: () => void;
  onDeleteVideo?: (videoId: string) => Promise<boolean>;
  onMakeVideoFromImage?: (imageUrl: string) => void;
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
  onDeleteVideo,
  onMakeVideoFromImage
}: HistoryOutputProps) {
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());

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

  // Check if item is a Starting Shot image
  const isStartingShot = (video: CinematographerVideo) => {
    const metadata = video.metadata as { type?: string } | null;
    return metadata?.type === 'starting_shot';
  };

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
            <h3 className="font-medium mb-2">No Content Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your generated videos and images will appear here
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
    <div className="h-full overflow-y-auto scrollbar-hover p-4">
      {/* Videos Grid - Full width with 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map((video) => (
            <Card 
              key={video.id} 
              className={`p-3 bg-secondary transition-all duration-200 hover:shadow-md cursor-pointer ${
                selectedHistory === video.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedHistory(selectedHistory === video.id ? null : video.id)}
            >
              <div className="space-y-2">
                {/* Type & Status Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isStartingShot(video) ? (
                      <Badge variant="outline" className="text-sm flex items-center gap-1">
                        <Image className="w-3 h-3" />
                        Image
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-sm flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        Video
                      </Badge>
                    )}
                    <Badge className={`text-sm ${getStatusColor(video.status)}`}>
                      {video.status}
                    </Badge>
                  </div>
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

                {/* Media Preview */}
                <div className="aspect-video bg-muted rounded overflow-hidden relative group">
                  {isStartingShot(video) && video.final_video_url ? (
                    // Starting Shot image display - lazy loaded
                    <img
                      src={video.final_video_url}
                      alt={video.video_concept || 'Starting shot'}
                      className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : video.final_video_url ? (
                    <video
                      src={video.final_video_url}
                      className="w-full h-full object-cover"
                      poster={video.preview_urls?.[0] || undefined}
                      preload="metadata"
                      controls
                    />
                  ) : video.preview_urls && video.preview_urls.length > 0 ? (
                    <img
                      src={video.preview_urls[0]}
                      alt={video.video_concept || 'Preview'}
                      className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                      {isStartingShot(video) ? (
                        <Image className="w-8 h-8 text-muted-foreground" />
                      ) : (
                        <Video className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                  )}

                  {/* Processing overlay */}
                  {video.status !== 'completed' && video.status !== 'failed' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>

                {/* Details */}
                {!isStartingShot(video) && video.total_duration_seconds && (
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
                          <span className="text-sm">
                            {isStartingShot(video) ? 'View Image' : 'View Video'}
                          </span>
                        </Button>
                      )}
                      {isStartingShot(video) && video.final_video_url && onMakeVideoFromImage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 justify-start text-primary hover:text-primary/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMakeVideoFromImage(video.final_video_url!);
                          }}
                        >
                          <Video className="w-3 h-3 mr-1" />
                          <span className="text-sm">Make Video From This</span>
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
                              const response = await fetch(video.final_video_url);

                              if (!response.ok) {
                                throw new Error(`Failed to fetch: ${response.status}`);
                              }

                              const blob = await response.blob();
                              const blobUrl = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = blobUrl;

                              // Use appropriate file extension
                              const extension = isStartingShot(video) ? 'png' : 'mp4';
                              const prefix = isStartingShot(video) ? 'starting-shot' : 'cinematographer';
                              a.download = `${prefix}-${video.id}-${Date.now()}.${extension}`;

                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(blobUrl);
                            } catch (error) {
                              console.error('Download failed:', error);
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
  );
}