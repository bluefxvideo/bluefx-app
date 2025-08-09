'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Download, Trash2, Music, Clock, Volume2 } from 'lucide-react';
import { GeneratedMusic } from '@/actions/database/music-database';
import { TabContentWrapper, TabHeader, TabBody } from '@/components/tools/tab-content-wrapper';

interface HistoryTabProps {
  musicMachineState: any;
}

/**
 * History Tab - Music generation history with playback
 * Following exact BlueFX style guide patterns
 */
export function HistoryTab({ musicMachineState }: HistoryTabProps) {
  const {
    state,
    playingMusicId,
    loadMusicHistory,
    deleteMusic,
    handleMusicPlayback,
  } = musicMachineState;

  // Load history when component mounts
  useEffect(() => {
    loadMusicHistory();
  }, [loadMusicHistory]);

  const handleDownload = async (music: GeneratedMusic) => {
    if (!music.audio_url) return;
    
    try {
      const response = await fetch(music.audio_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `music_${music.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-blue-100';
      case 'processing': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Complete';
      case 'processing': return 'Processing';
      case 'pending': return 'Pending';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  if (state.isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 py-4 mb-4 border-b">
          <div className="w-8 h-8 bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
            <Music className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">Music History</h2>
            <p className="text-xs text-muted-foreground">Your generated music tracks</p>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading music history...</p>
          </div>
        </div>
      </div>
    );
  }

  if (state.musicHistory.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 py-4 mb-4 border-b">
          <div className="w-8 h-8 bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
            <Music className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">Music History</h2>
            <p className="text-xs text-muted-foreground">Your generated music tracks</p>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Music className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm font-medium mb-2">No music generated yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Generate your first AI music track to see it here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TabContentWrapper>
      {/* Header */}
      <TabHeader
        icon={Music}
        title="Music History"
        description={`${state.musicHistory.length} generated track${state.musicHistory.length !== 1 ? 's' : ''}`}
      />

      {/* Form Content */}
      <TabBody>
        {state.musicHistory.map((music: GeneratedMusic) => (
          <Card key={music.id} className="p-4 hover:shadow-md transition-all duration-200">
            <div className="flex items-start gap-3">
              {/* Play/Pause Button */}
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 w-10 h-10 p-0"
                onClick={() => music.audio_url && handleMusicPlayback(music.id, music.audio_url)}
                disabled={!music.audio_url || music.status !== 'completed'}
              >
                {playingMusicId === music.id ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>

              {/* Music Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={music.track_title || music.description || undefined}>
                      {music.track_title || music.description || 'Untitled Track'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {music.genre && (
                        <Badge variant="secondary" className="text-xs">
                          {music.genre}
                        </Badge>
                      )}
                      {music.mood && (
                        <Badge variant="outline" className="text-xs">
                          {music.mood}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Status Indicator */}
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(music.status)}`} />
                    <span className="text-xs text-muted-foreground">
                      {getStatusLabel(music.status)}
                    </span>
                  </div>
                </div>

                {/* Music Details */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(music.duration_seconds)}
                  </div>
                  {music.download_count !== null && (
                    <div className="flex items-center gap-1">
                      <Volume2 className="w-3 h-3" />
                      {music.download_count || 0} downloads
                    </div>
                  )}
                  <div>
                    {new Date(music.created_at || Date.now()).toLocaleDateString()}
                  </div>
                </div>

                {/* Error Message */}
                {music.status === 'failed' && (
                  <p className="text-xs text-destructive mb-3">
                    Error: Failed to generate music
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {music.audio_url && music.status === 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(music)}
                      className="text-xs h-7"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMusic(music.id)}
                    className="text-xs h-7 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </TabBody>
    </TabContentWrapper>
  );
}