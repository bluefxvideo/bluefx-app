'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Music, 
  Download, 
  Play,
  Pause,
  Square,
  Clock, 
  FileAudio, 
  Zap,
  CheckCircle,
  AlertCircle,
  History,
  Trash2,
  X,
  Loader2
} from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { MusicHistoryOutput } from './music-history-output';
import { MusicExample } from './music-example';
import type { UseMusicMachineReturn } from '../hooks/use-music-machine';
import type { MusicHistoryFilters } from '../tabs/music-history-filters';

interface MusicMachineOutputProps {
  musicMachineState: UseMusicMachineReturn;
  historyFilters?: MusicHistoryFilters;
}

/**
 * Music Machine Output Panel - Contextual display based on active tab
 * Following exact voice-over pattern
 */
export function MusicMachineOutput({ musicMachineState, historyFilters }: MusicMachineOutputProps) {
  const { activeTab, state, playingMusicId, handleMusicPlayback, deleteMusic } = musicMachineState;
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startTimeTracking = useCallback(() => {
    let durationSet = false;
    const update = () => {
      if (currentAudioRef.current) {
        setCurrentTime(currentAudioRef.current.currentTime);
        // Pick up duration as soon as it's available (fallback for loadedmetadata)
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
    return () => {
      stopTimeTracking();
    };
  }, [stopTimeTracking]);

  const handleAudioPlayback = (musicId: string, audioUrl: string) => {
    const audioMap = new Map(audioElements);

    // Stop time tracking
    stopTimeTracking();

    // Stop currently playing audio
    if (playingMusicId && audioMap.has(playingMusicId)) {
      const currentAudio = audioMap.get(playingMusicId)!;
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    // If clicking same audio, just stop
    if (playingMusicId === musicId) {
      currentAudioRef.current = null;
      setCurrentTime(0);
      setAudioDuration(0);
      handleMusicPlayback(musicId, audioUrl);
      return;
    }

    // Create or get audio element
    let audio = audioMap.get(musicId);
    if (!audio) {
      audio = new Audio(audioUrl);
      audioMap.set(musicId, audio);
      setAudioElements(audioMap);

      const onDuration = () => {
        if (audio && audio.duration && isFinite(audio.duration)) {
          const actualDuration = Math.round(audio.duration);
          setAudioDuration(audio.duration);
          musicMachineState.updateMusicDuration?.(musicId, actualDuration);
        }
      };
      audio.addEventListener('loadedmetadata', onDuration);
      audio.addEventListener('durationchange', onDuration);

      audio.addEventListener('ended', () => {
        stopTimeTracking();
        currentAudioRef.current = null;
        setCurrentTime(0);
        setAudioDuration(0);
      });

      audio.addEventListener('error', () => {
        stopTimeTracking();
        currentAudioRef.current = null;
        setCurrentTime(0);
        setAudioDuration(0);
      });
    } else {
      // Existing audio element - set duration
      if (audio.duration && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    }

    // Play new audio
    currentAudioRef.current = audio;
    setCurrentTime(0);
    audio.play();
    startTimeTracking();
    handleMusicPlayback(musicId, audioUrl);
  };

  const handleSeek = (musicId: string, ratio: number) => {
    if (playingMusicId !== musicId || !currentAudioRef.current) return;
    currentAudioRef.current.currentTime = ratio * currentAudioRef.current.duration;
    setCurrentTime(currentAudioRef.current.currentTime);
  };

  const audioProgress = playingMusicId && currentAudioRef.current && audioDuration > 0
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

  const formatFileSize = (mb: number) => {
    return mb < 1 ? `${Math.round(mb * 1000)}KB` : `${mb.toFixed(1)}MB`;
  };

  // Generate Tab Output
  if (activeTab === 'generate') {
    // Check if we're generating or have a current generation in progress
    const isProcessing = state.isGenerating || (state.currentGeneration && state.currentGeneration.status !== 'completed' && state.currentGeneration.status !== 'failed');
    
    return (
      <OutputPanelShell
        title="Music Results"
        status={isProcessing ? 'loading' : state.generatedMusic.length > 0 ? 'ready' : 'idle'}
        loading={
          <div className="h-full flex items-center justify-center">
            {/* Music-specific Processing Card with thumbnail machine visual principles */}
            <Card className="relative p-6 w-full max-w-2xl mx-auto border border-zinc-700/50 shadow-xl bg-transparent dark:bg-card-content/50">
              {/* Cancel Button - Top Right */}
              <Button
                variant="ghost"
                size="sm" 
                onClick={musicMachineState.cancelGeneration}
                className="absolute top-3 right-3 h-8 w-8 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                title="Cancel Generation"
              >
                <X className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                  <Music className="w-6 h-6 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="font-medium">Generating Music...</h3>
                  <p className="text-sm text-muted-foreground">Processing your audio</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="bg-muted/30 border border-zinc-700/30 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    "{state.prompt || 'Creating your music...'}"
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {state.duration}s duration
                  </Badge>
                  <div className="flex-1" />
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              </div>
            </Card>
          </div>
        }
        empty={
          <div className="h-full overflow-y-auto scrollbar-hover p-4">
            <MusicExample />
          </div>
        }
      >
        <div className="h-full space-y-6 overflow-y-auto scrollbar-hover flex flex-col items-center justify-center">
          {/* Show placeholder immediately when generation starts - following voice-over pattern */}
          {(isProcessing || state.generatedMusic.length > 0) && (
            <Card className="p-6 w-full mx-auto bg-transparent dark:bg-card-content/50">
              {isProcessing && (
                <div className="flex items-center gap-2 mb-4">
                  <Music className="w-5 h-5 text-primary animate-pulse" />
                  <h3 className="font-semibold">Generating Music...</h3>
                </div>
              )}
              
              {!isProcessing && state.generatedMusic.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Generated Successfully!</h3>
                </div>
              )}
              
              <div className="space-y-4">
                {/* Error card if generation failed */}
                {state.error && !state.isGenerating && (
                  <Card className="relative p-6 w-full mx-auto border border-destructive/50 shadow-xl bg-destructive/5">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-destructive">
                          <AlertCircle className="w-5 h-5" />
                          <span className="font-medium">Generation Failed</span>
                        </div>
                      </div>

                      {/* Error message */}
                      <div className="bg-destructive/10 rounded-lg p-3">
                        <p className="text-sm text-destructive">
                          {state.error}
                        </p>
                      </div>

                      {/* Retry button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.reload()}
                        className="w-full border-destructive/50 hover:bg-destructive/10"
                      >
                        Try Again
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Show placeholder card immediately when generation starts */}
                {isProcessing && !state.generatedMusic.length && state.currentGeneration && !state.error && (
                  <Card key="generating" className="p-4 bg-card border-border">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            AI Generated
                          </Badge>
                          <Badge variant="secondary" className="text-xs animate-pulse">
                            Processing...
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled>
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" disabled>
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>~30s</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileAudio className="w-4 h-4 text-muted-foreground" />
                          <span>Processing...</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-4 h-4 text-muted-foreground" />
                          <span>{state.estimatedCredits} credits</span>
                        </div>
                      </div>

                      {/* Script Preview */}
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {state.currentGeneration.prompt}
                        </p>
                      </div>

                      {/* Audio Player Placeholder */}
                      <div className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <button
                            disabled
                            className="flex-shrink-0 w-10 h-10 bg-muted/50 text-muted-foreground rounded-full flex items-center justify-center"
                          >
                            <Play className="w-4 h-4 ml-0.5" />
                          </button>
                          <div className="flex-1">
                            <div className="relative h-1.5 rounded-full bg-muted/30">
                              <div className="absolute inset-y-0 left-0 rounded-full bg-primary/30 animate-pulse" style={{ width: '30%' }} />
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-xs text-muted-foreground font-mono">
                            ~30s
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Show actual generated music results */}
                {state.generatedMusic.map((music: any) => (
                  <Card key={music.id} className="p-4 bg-card border-border">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            AI Generated
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {music.output_format?.toUpperCase() || 'AUDIO'}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAudioPlayback(music.id, music.audio_url || '')}
                          >
                            {playingMusicId === music.id ? (
                              <Square className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = music.audio_url || '';
                              link.download = `${music.track_title || music.prompt || 'music'}.mp3`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{music.duration ? formatDuration(music.duration) : 'Variable'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileAudio className="w-4 h-4 text-muted-foreground" />
                          <span>{music.model_version || music.output_format || 'Audio'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-4 h-4 text-muted-foreground" />
                          <span>{music.credits_used || state.estimatedCredits} credits</span>
                        </div>
                      </div>

                      {/* Script Preview */}
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {music.prompt || state.prompt}
                        </p>
                      </div>

                      {/* Seekable Audio Player */}
                      <div className="bg-gradient-to-br from-muted/40 to-muted/20 rounded-lg p-3 border border-border/50">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleAudioPlayback(music.id, music.audio_url || '')}
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
                          <div className="flex-1 space-y-1">
                            {/* Progress bar */}
                            <div
                              className={`relative h-1.5 rounded-full ${
                                playingMusicId === music.id ? 'cursor-pointer bg-muted/60' : 'bg-muted/30'
                              }`}
                              onClick={(e) => {
                                if (playingMusicId !== music.id) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                handleSeek(music.id, ratio);
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
                              : music.duration ? formatDuration(music.duration) : '~30s'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {/* Tips Card - only show when generating */}
          {isProcessing && (
            <Card className="p-4 bg-muted/30 w-full max-w-2xl mx-auto">
              <div className="flex gap-3">
                <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>💡 Pro tip: Our AI excels at creating unique, high-quality music from your descriptions</p>
                  <p>🎵 Your music will be saved to history automatically when complete</p>
                </div>
              </div>
            </Card>
          )}

        </div>

        {/* Summary Footer - Always visible as separate element */}
        <Card className="mt-4 p-3 bg-secondary">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-primary">
                {state.generatedMusic.length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Tracks</p>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {state.generatedMusic.length > 0 
                  ? state.generatedMusic.reduce((acc: number, m: any) => acc + (m.credits_used || state.estimatedCredits || 3), 0)
                  : 0
                }
              </p>
              <p className="text-sm text-muted-foreground">Credits Used</p>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {state.generatedMusic.length > 0 
                  ? formatDuration(state.generatedMusic.reduce((acc: number, m: any) => acc + (m.duration || 30), 0))
                  : '0s'
                }
              </p>
              <p className="text-sm text-muted-foreground">Total Duration</p>
            </div>
          </div>
        </Card>
      </OutputPanelShell>
    );
  }

  // History Tab Output - Use the new grid-based component
  if (activeTab === 'history') {
    return (
      <MusicHistoryOutput
        musicHistory={state.musicHistory}
        filters={historyFilters}
        isLoading={state.isLoading}
        error={state.error}
        playingMusicId={playingMusicId}
        onPlayMusic={handleAudioPlayback}
        onDeleteMusic={deleteMusic}
        currentTime={currentTime}
        audioDuration={audioDuration}
        audioProgress={audioProgress}
        onSeek={handleSeek}
      />
    );
  }

  return null;
}

export default MusicMachineOutput;