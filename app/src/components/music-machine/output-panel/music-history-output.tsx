'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Music,
  Loader2,
  Download,
  Trash2,
  AlertCircle,
  Play,
  Pause
} from 'lucide-react';
import type { MusicHistoryFilters } from '../tabs/music-history-filters';
import type { GeneratedMusic } from '@/actions/database/music-database';

interface MusicHistoryOutputProps {
  musicHistory: GeneratedMusic[];
  filters?: MusicHistoryFilters;
  isLoading?: boolean;
  error?: string | null;
  playingMusicId: string | null;
  onPlayMusic: (musicId: string, audioUrl: string) => void;
  onDeleteMusic: (musicId: string) => void;
  onLoadHistory?: () => void;
  currentTime?: number;
  audioDuration?: number;
  audioProgress?: number;
  onSeek?: (musicId: string, ratio: number) => void;
}

export function MusicHistoryOutput({
  musicHistory,
  filters,
  isLoading = false,
  error = null,
  playingMusicId,
  onPlayMusic,
  onDeleteMusic,
  onLoadHistory,
  currentTime = 0,
  audioDuration = 0,
  audioProgress = 0,
  onSeek
}: MusicHistoryOutputProps) {
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [filteredMusic, setFilteredMusic] = useState<GeneratedMusic[]>(musicHistory);

  // Apply filters
  useEffect(() => {
    if (!filters) {
      setFilteredMusic(musicHistory);
      return;
    }

    let filtered = [...musicHistory];

    // Apply search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        (item.description || '').toLowerCase().includes(searchLower) ||
        item.track_title.toLowerCase().includes(searchLower) ||
        item.genre.toLowerCase().includes(searchLower) ||
        item.mood.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (filters.filterStatus && filters.filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === filters.filterStatus);
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
      
      filtered = filtered.filter(item => 
        new Date(item.created_at || 0) >= cutoffDate
      );
    }

    // Apply sort order
    if (filters.sortOrder) {
      switch (filters.sortOrder) {
        case 'oldest':
          filtered.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
          break;
        case 'newest':
          filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
          break;
        case 'name':
          filtered.sort((a, b) => a.track_title.localeCompare(b.track_title));
          break;
        case 'name_desc':
          filtered.sort((a, b) => b.track_title.localeCompare(a.track_title));
          break;
        case 'duration':
          filtered.sort((a, b) => (b.duration_seconds || 0) - (a.duration_seconds || 0));
          break;
        case 'credits':
          filtered.sort((a, b) => (b.generation_settings?.credits_used || 0) - (a.generation_settings?.credits_used || 0));
          break;
      }
    }

    setFilteredMusic(filtered);
  }, [musicHistory, filters]);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
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

  const handleDelete = async (musicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingItems(new Set([...deletingItems, musicId]));
    try {
      await onDeleteMusic(musicId);
    } finally {
      setDeletingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(musicId);
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
          <p className="text-muted-foreground">Loading music history...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-6 max-w-sm text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-destructive font-medium">Failed to load history</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          {onLoadHistory && (
            <Button onClick={onLoadHistory} variant="outline" size="sm">
              Try Again
            </Button>
          )}
        </Card>
      </div>
    );
  }

  // Empty state
  if (musicHistory.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
          <Music className="w-12 h-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-medium mb-2">No Music Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your generated music tracks will appear here
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // No results after filtering
  if (filteredMusic.length === 0 && musicHistory.length > 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
          <Music className="w-12 h-12 text-muted-foreground mx-auto" />
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
      <div className="space-y-2">
        {filteredMusic.map((music) => {
          const isActive = playingMusicId === music.id;

          return (
            <Card
              key={music.id}
              className={`p-3 border-border/50 transition-colors ${
                isActive
                  ? 'bg-primary/5 border-primary/30'
                  : 'bg-secondary/50'
              }`}
            >
              <div className="space-y-2">
                {/* Top row: play + info + actions */}
                <div className="flex items-center gap-2">
                  {/* Play button */}
                  {music.audio_url ? (
                    <button
                      onClick={() => onPlayMusic(music.id, music.audio_url!)}
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground'
                      }`}
                    >
                      {isActive ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      )}
                    </button>
                  ) : (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted/50 text-muted-foreground">
                      <Music className="w-3.5 h-3.5" />
                    </div>
                  )}

                  {/* Track info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {music.track_title || 'Untitled Track'}
                      </span>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">
                        {music.genre || 'Audio'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {music.description || music.mood || 'Generated track'}
                    </p>
                  </div>

                  {/* Date */}
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 hidden sm:block">
                    {formatDate(music.created_at)}
                  </span>

                  {/* Time display */}
                  <span className="text-[11px] text-muted-foreground font-mono flex-shrink-0">
                    {isActive && audioDuration > 0
                      ? `${formatTime(currentTime)} / ${formatTime(audioDuration)}`
                      : ''}
                  </span>

                  {/* Download */}
                  {music.audio_url && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.href = music.audio_url!;
                        link.download = `${music.track_title || 'music'}.mp3`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                      title="Download"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={(e) => handleDelete(music.id, e)}
                    disabled={deletingItems.has(music.id)}
                    className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    {deletingItems.has(music.id) ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {/* Seekable progress bar */}
                <div
                  className={`relative h-1.5 rounded-full ${
                    isActive ? 'cursor-pointer bg-muted/60' : 'bg-muted/30'
                  }`}
                  onClick={(e) => {
                    if (!isActive || !onSeek) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    onSeek(music.id, ratio);
                  }}
                >
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${
                      isActive ? 'bg-primary' : ''
                    }`}
                    style={{ width: `${isActive ? audioProgress : 0}%` }}
                  />
                  {isActive && audioProgress > 0 && (
                    <div
                      className="absolute top-1/2 w-3 h-3 bg-primary rounded-full shadow-md border-2 border-primary-foreground"
                      style={{ left: `${audioProgress}%`, transform: 'translate(-50%, -50%)' }}
                    />
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}