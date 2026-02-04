'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Play,
  Pause,
  Clock,
  FileAudio,
  Zap,
  History,
  Trash2,
  Loader2
} from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceOverState } from '../hooks/use-voice-over';
import { GeneratedVoice } from '@/actions/tools/voice-over';

interface HistoryOutputProps {
  voiceOverState: {
    activeTab: string;
    state: VoiceOverState;
    deleteVoice: (voiceId: string) => void;
  };
}

export function HistoryOutput({ voiceOverState }: HistoryOutputProps) {
  const { state, deleteVoice } = voiceOverState;
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startTimeTracking = useCallback(() => {
    let durationSet = false;
    const update = () => {
      if (currentAudioRef.current) {
        setCurrentTime(currentAudioRef.current.currentTime);
        if (!durationSet && currentAudioRef.current.duration && isFinite(currentAudioRef.current.duration)) {
          setAudioDuration(currentAudioRef.current.duration);
          durationSet = true;
        }
      }
      animFrameRef.current = requestAnimationFrame(update);
    };
    animFrameRef.current = requestAnimationFrame(update);
  }, []);

  const stopTimeTracking = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => { stopTimeTracking(); };
  }, [stopTimeTracking]);

  const handleAudioPlayback = (audioId: string, audioUrl: string) => {
    const audioMap = new Map(audioElements);

    stopTimeTracking();

    // Stop currently playing audio
    if (playingAudioId && audioMap.has(playingAudioId)) {
      const currentAudio = audioMap.get(playingAudioId)!;
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    if (playingAudioId === audioId) {
      currentAudioRef.current = null;
      setCurrentTime(0);
      setAudioDuration(0);
      setPlayingAudioId(null);
      return;
    }

    let audio = audioMap.get(audioId);
    if (!audio) {
      audio = new Audio(audioUrl);
      audioMap.set(audioId, audio);
      setAudioElements(audioMap);

      const onDuration = () => {
        if (audio && audio.duration && isFinite(audio.duration)) {
          setAudioDuration(audio.duration);
        }
      };
      audio.addEventListener('loadedmetadata', onDuration);
      audio.addEventListener('durationchange', onDuration);

      audio.addEventListener('ended', () => {
        stopTimeTracking();
        currentAudioRef.current = null;
        setCurrentTime(0);
        setAudioDuration(0);
        setPlayingAudioId(null);
      });

      audio.addEventListener('error', () => {
        stopTimeTracking();
        currentAudioRef.current = null;
        setCurrentTime(0);
        setAudioDuration(0);
        setPlayingAudioId(null);
      });
    } else {
      if (audio.duration && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    }

    currentAudioRef.current = audio;
    setCurrentTime(0);
    setPlayingAudioId(audioId);
    audio.play();
    startTimeTracking();
  };

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, audioId: string) => {
      if (playingAudioId !== audioId || !currentAudioRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      currentAudioRef.current.currentTime = ratio * currentAudioRef.current.duration;
      setCurrentTime(currentAudioRef.current.currentTime);
    },
    [playingAudioId]
  );

  const audioProgress = playingAudioId && currentAudioRef.current && audioDuration > 0
    ? (currentTime / audioDuration) * 100
    : 0;

  const formatDuration = (seconds: number) => {
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

  const formatFileSize = (sizeInMB: number) => {
    if (sizeInMB >= 1) {
      return `${sizeInMB.toFixed(1)}MB`;
    } else {
      return `${(sizeInMB * 1024).toFixed(0)}KB`;
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

  const handleDelete = async (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingItems(new Set([...deletingItems, voiceId]));
    try {
      await deleteVoice(voiceId);
    } finally {
      setDeletingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(voiceId);
        return newSet;
      });
    }
  };

  // Loading state
  if (state.isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading voice history...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (state.voiceHistory.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
          <History className="w-12 h-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-medium mb-2">No Voice History</h3>
            <p className="text-sm text-muted-foreground">
              Your generated voices will appear here
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
          {state.voiceHistory.map((voice: GeneratedVoice) => (
            <Card 
              key={voice.id} 
              className={`p-3 bg-secondary transition-all duration-200 hover:shadow-md cursor-pointer ${
                selectedVoice === voice.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedVoice(selectedVoice === voice.id ? null : voice.id)}
            >
              <div className="space-y-2">
                {/* Voice Details Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {voice.voice_name}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {voice.export_format?.toUpperCase() || 'MP3'}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(voice.created_at || '')}
                  </span>
                </div>
                
                {/* Script Preview */}
                <p className="font-medium text-base leading-tight line-clamp-2">
                  {voice.script_text || 'Voice Over'}
                </p>
                
                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(voice.duration_seconds || 0)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileAudio className="w-3 h-3" />
                    <span>{formatFileSize(voice.file_size_mb || 0)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span>{voice.credits_used || 0} credits</span>
                  </div>
                </div>

                {/* Seekable Audio Player */}
                <div className="bg-gradient-to-br from-muted/40 to-muted/20 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAudioPlayback(voice.id, voice.audio_url || '');
                      }}
                      disabled={!voice.audio_url}
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:scale-105 transition-transform ${
                        playingAudioId === voice.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground'
                      }`}
                    >
                      {playingAudioId === voice.id ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 space-y-1">
                      <div
                        className={`relative h-1.5 rounded-full ${
                          playingAudioId === voice.id ? 'cursor-pointer bg-muted/60' : 'bg-muted/30'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSeek(e, voice.id);
                        }}
                      >
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${
                            playingAudioId === voice.id ? 'bg-primary' : ''
                          }`}
                          style={{ width: `${playingAudioId === voice.id ? audioProgress : 0}%` }}
                        />
                        {playingAudioId === voice.id && audioProgress > 0 && (
                          <div
                            className="absolute top-1/2 w-3 h-3 bg-primary rounded-full shadow-md border-2 border-primary-foreground"
                            style={{ left: `${audioProgress}%`, transform: 'translate(-50%, -50%)' }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-xs text-muted-foreground font-mono">
                      {playingAudioId === voice.id && audioDuration > 0
                        ? `${formatTime(currentTime)} / ${formatTime(audioDuration)}`
                        : formatDuration(voice.duration_seconds || 0)}
                    </div>
                  </div>
                </div>

                {/* Expanded Actions */}
                {selectedVoice === voice.id && (
                  <div className="pt-2 border-t space-y-2">
                    <div className="text-sm text-muted-foreground">
                      ID: {voice.id}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 justify-start"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (voice.audio_url) {
                            window.open(voice.audio_url, '_blank');
                          }
                        }}
                        disabled={!voice.audio_url}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        <span className="text-sm">Download</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={(e) => handleDelete(voice.id, e)}
                        disabled={deletingItems.has(voice.id)}
                      >
                        {deletingItems.has(voice.id) ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3 mr-1" />
                        )}
                        <span className="text-sm">
                          {deletingItems.has(voice.id) ? 'Deleting...' : 'Delete'}
                        </span>
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