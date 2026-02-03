'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Music,
  Clock,
  FileAudio,
  Loader2,
  Download,
  Trash2,
  AlertCircle,
  Play,
  Pause,
  Zap
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
  const [selectedMusic, setSelectedMusic] = useState<string | null>(null);
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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '~30s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-600';
      case 'processing':
        return 'bg-blue-600';
      case 'failed':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
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
      {/* History Grid - Full width with 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMusic.map((music) => (
            <Card 
              key={music.id} 
              className={`p-4 bg-secondary/50 transition-all duration-200 hover:shadow-md cursor-pointer min-w-0 ${
                selectedMusic === music.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedMusic(selectedMusic === music.id ? null : music.id)}
            >
              <div className="space-y-3 min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-sm ${getStatusColor(music.status)}`}>
                      {music.status}
                    </Badge>
                    <Badge variant="secondary" className="text-sm">
                      {music.genre.toUpperCase() || 'AUDIO'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(music.created_at)}</span>
                  </div>
                </div>
                
                {/* Title */}
                <p className="font-medium text-base leading-tight line-clamp-2">
                  {music.track_title || 'Untitled Track'}
                </p>
                
                {/* Stats Row */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FileAudio className="w-3 h-3" />
                    <span>{formatDuration(music.duration_seconds)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span>{(music.generation_settings as any)?.credits_used || 3} credits</span>
                  </div>
                  {music.generation_settings?.model_version && (
                    <span className="text-xs">{music.generation_settings.model_version}</span>
                  )}
                </div>

                {/* Seekable Audio Player */}
                {music.audio_url && (
                  <div className="bg-gradient-to-br from-muted/40 to-muted/20 rounded-lg p-3 border border-border/50 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayMusic(music.id, music.audio_url!);
                        }}
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 transition-transform ${
                          playingMusicId === music.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground'
                        }`}
                      >
                        {playingMusicId === music.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        {/* Progress bar */}
                        <div
                          className={`relative h-1.5 rounded-full ${
                            playingMusicId === music.id ? 'cursor-pointer bg-muted/60' : 'bg-muted/30'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (playingMusicId !== music.id || !onSeek) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                            onSeek(music.id, ratio);
                          }}
                        >
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full ${
                              playingMusicId === music.id ? 'bg-primary' : ''
                            }`}
                            style={{ width: `${playingMusicId === music.id ? audioProgress : 0}%` }}
                          />
                          {playingMusicId === music.id && audioProgress > 0 && (
                            <div
                              className="absolute top-1/2 w-3 h-3 bg-primary rounded-full shadow-md border-2 border-primary-foreground"
                              style={{ left: `${audioProgress}%`, transform: 'translate(-50%, -50%)' }}
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-xs text-muted-foreground font-mono">
                        {playingMusicId === music.id && audioDuration > 0
                          ? `${formatTime(currentTime)} / ${formatTime(audioDuration)}`
                          : formatDuration(music.duration_seconds)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Expanded Actions */}
                {selectedMusic === music.id && (
                  <div className="pt-2 border-t space-y-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (music.audio_url) {
                            const link = document.createElement('a');
                            link.href = music.audio_url;
                            link.download = `${music.track_title || 'music'}.mp3`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                        disabled={!music.audio_url}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDelete(music.id, e)}
                        disabled={deletingItems.has(music.id)}
                      >
                        {deletingItems.has(music.id) ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3 mr-1" />
                        )}
                        Delete
                      </Button>
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