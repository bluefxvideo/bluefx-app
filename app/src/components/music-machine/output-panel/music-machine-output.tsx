'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Music, 
  Download, 
  Play, 
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
import { useState } from 'react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import type { UseMusicMachineReturn } from '../hooks/use-music-machine';

interface MusicMachineOutputProps {
  musicMachineState: UseMusicMachineReturn;
}

/**
 * Music Machine Output Panel - Contextual display based on active tab
 * Following exact voice-over pattern
 */
export function MusicMachineOutput({ musicMachineState }: MusicMachineOutputProps) {
  const { activeTab, state, playingMusicId, handleMusicPlayback, deleteMusic } = musicMachineState;
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());

  const handleAudioPlayback = (musicId: string, audioUrl: string) => {
    const audioMap = new Map(audioElements);
    
    // Stop currently playing audio
    if (playingMusicId && audioMap.has(playingMusicId)) {
      const currentAudio = audioMap.get(playingMusicId)!;
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    // If clicking same audio, just stop
    if (playingMusicId === musicId) {
      handleMusicPlayback(musicId, audioUrl); // This will trigger the stop logic
      return;
    }

    // Create or get audio element
    let audio = audioMap.get(musicId);
    if (!audio) {
      audio = new Audio(audioUrl);
      audioMap.set(musicId, audio);
      setAudioElements(audioMap);
      
      console.log(`🎵 Creating audio element for ${musicId}:`, audioUrl);
      
      audio.addEventListener('loadedmetadata', () => {
        console.log(`🎵 Metadata loaded for ${musicId}:`, audio?.duration);
        if (audio && audio.duration && isFinite(audio.duration)) {
          const actualDuration = Math.round(audio.duration);
          console.log(`🎵 Actual audio duration for ${musicId}:`, actualDuration, 'seconds');
          
          // Update the music record with correct duration
          musicMachineState.updateMusicDuration?.(musicId, actualDuration);
        }
      });
      
      audio.addEventListener('loadeddata', () => {
        console.log(`🎵 Data loaded for ${musicId}:`, audio?.duration);
      });
      
      audio.addEventListener('canplay', () => {
        console.log(`🎵 Can play ${musicId}:`, audio?.duration);
      });
      
      audio.addEventListener('ended', () => {
        // Audio ended - the music machine hook will handle clearing the state
        // We don't need to call handleMusicPlayback here since it's already handled
      });
      
      audio.addEventListener('error', () => {
        // Handle audio error
      });
    }

    // Play new audio
    audio.play();
    handleMusicPlayback(musicId, audioUrl);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
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
                  <Badge variant="outline" className="text-xs">
                    {state.model_provider === 'lyria-2' ? 'Lyria-2' : 'MusicGen'}
                  </Badge>
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
          <div className="flex items-center justify-center h-full">
            <UnifiedEmptyState
              icon={Music}
              title="Ready to Create Music ✨"
              description="Describe the music you want to create and let AI generate professional audio tracks for you."
            />
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
                      <div className="relative w-full">
                        <div className="bg-muted/30 rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            <button
                              disabled
                              className="flex-shrink-0 w-10 h-10 bg-muted/50 text-muted-foreground rounded-full flex items-center justify-center"
                            >
                              <Play className="w-5 h-5" />
                            </button>
                            <div className="flex-1 h-12 bg-muted/50 rounded-md flex items-center px-3">
                              {/* Animated placeholder waveform */}
                              <div className="flex items-center justify-center w-full gap-1">
                                {[...Array(120)].map((_, i) => (
                                  <div
                                    key={i}
                                    className="bg-primary/40 rounded-full animate-pulse"
                                    style={{
                                      width: '2px',
                                      height: `${Math.random() * 20 + 8}px`,
                                      animationDelay: `${i * 30}ms`
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-sm text-muted-foreground font-mono">
                              ~30s
                            </div>
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
                            onClick={() => window.open(music.audio_url, '_blank')}
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

                      {/* Audio Player */}
                      <div className="relative w-full">
                        <div className="bg-muted/30 rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleAudioPlayback(music.id, music.audio_url || '')}
                              className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                            >
                              {playingMusicId === music.id ? (
                                <Square className="w-5 h-5" />
                              ) : (
                                <Play className="w-5 h-5" />
                              )}
                            </button>
                            <div className="flex-1 h-12 bg-muted/50 rounded-md flex items-center px-3">
                              {/* Waveform visualization */}
                              <div className="flex items-center justify-center w-full gap-1">
                                {[...Array(120)].map((_, i) => (
                                  <div
                                    key={i}
                                    className={`bg-primary/40 rounded-full transition-all duration-75 ${
                                      playingMusicId === music.id 
                                        ? 'animate-pulse bg-primary/70' 
                                        : ''
                                    }`}
                                    style={{
                                      width: '2px',
                                      height: `${Math.random() * 30 + 8}px`,
                                      animationDelay: `${i * 30}ms`
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-sm text-muted-foreground font-mono">
                              {music.duration ? formatDuration(music.duration) : '~30s'}
                            </div>
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
      </OutputPanelShell>
    );
  }

  // History Tab Output
  if (activeTab === 'history') {
    return (
      <OutputPanelShell
        title="Music History"
        status={state.isLoading ? 'loading' : state.musicHistory.length > 0 ? 'ready' : 'idle'}
        empty={
          <div className="flex items-center justify-center h-full">
            <UnifiedEmptyState
              icon={History}
              title="No Music History"
              description="Your generated music tracks will appear here. Create your first AI music to see it in your history."
            />
          </div>
        }
      >
        <div className="h-full overflow-y-auto scrollbar-hover p-4">
          {state.musicHistory.length > 0 ? (
            <div className="space-y-4">
              {state.musicHistory.map((music: any) => (
                <Card key={music.id} className="p-4 bg-card border-border">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          AI Generated
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {music.generation_settings?.output_format?.toUpperCase() || 'WAV'}
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
                          onClick={() => window.open(music.audio_url, '_blank')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMusic(music.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{music.duration_seconds ? formatDuration(music.duration_seconds) : 'Variable'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileAudio className="w-4 h-4 text-muted-foreground" />
                        <span>{music.generation_settings?.model_version || music.generation_settings?.output_format || 'Audio'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4 text-muted-foreground" />
                        <span>{music.credits_used || music.generation_settings?.credits_used || 3} credits</span>
                      </div>
                    </div>

                    {/* Script Preview */}
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {music.track_title || music.prompt || music.description}
                      </p>
                    </div>

                    {/* Audio Player */}
                    <div className="relative w-full">
                      <div className="bg-muted/30 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleAudioPlayback(music.id, music.audio_url || '')}
                            className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                          >
                            {playingMusicId === music.id ? (
                              <Square className="w-5 h-5" />
                            ) : (
                              <Play className="w-5 h-5" />
                            )}
                          </button>
                          <div className="flex-1 h-12 bg-muted/50 rounded-md flex items-center px-3">
                            {/* Waveform visualization */}
                            <div className="flex items-center justify-center w-full gap-1">
                              {[...Array(120)].map((_, i) => (
                                <div
                                  key={i}
                                  className={`bg-primary/40 rounded-full transition-all duration-75 ${
                                    playingMusicId === music.id 
                                      ? 'animate-pulse bg-primary/70' 
                                      : ''
                                  }`}
                                  style={{
                                    width: '2px',
                                    height: `${Math.random() * 30 + 8}px`,
                                    animationDelay: `${i * 30}ms`
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-sm text-muted-foreground font-mono">
                            {music.duration_seconds ? formatDuration(music.duration_seconds) : '~30s'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileAudio className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No music in history yet</p>
              </div>
            </div>
          )}
        </div>
      </OutputPanelShell>
    );
  }

  return null;
}

export default MusicMachineOutput;