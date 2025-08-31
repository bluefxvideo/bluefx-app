'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Mic, 
  Download, 
  Play, 
  Square, 
  Clock, 
  FileAudio, 
  Zap,
  CheckCircle,
  AlertCircle,
  Users,
  Settings,
  History,
  Trash2
} from 'lucide-react';
import { useState } from 'react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';

import { VoiceOverState } from '../hooks/use-voice-over';
import { GeneratedVoice } from '@/actions/tools/voice-over';

interface ContextualOutputProps {
  voiceOverState: {
    activeTab: string;
    state: VoiceOverState;
    deleteVoice: (voiceId: string) => void;
  };
}

export function ContextualOutput({ voiceOverState }: ContextualOutputProps) {
  const { activeTab, state, deleteVoice } = voiceOverState;
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());

  const handleAudioPlayback = (audioId: string, audioUrl: string) => {
    const audioMap = new Map(audioElements);
    
    // Stop currently playing audio
    if (playingAudioId && audioMap.has(playingAudioId)) {
      const currentAudio = audioMap.get(playingAudioId)!;
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    // If clicking same audio, just stop
    if (playingAudioId === audioId) {
      setPlayingAudioId(null);
      return;
    }

    // Create or get audio element
    let audio = audioMap.get(audioId);
    if (!audio) {
      audio = new Audio(audioUrl);
      audioMap.set(audioId, audio);
      setAudioElements(audioMap);
      
      audio.addEventListener('ended', () => {
        setPlayingAudioId(null);
      });
      
      audio.addEventListener('error', () => {
        setPlayingAudioId(null);
      });
    }

    // Play new audio
    setPlayingAudioId(audioId);
    audio.play().catch(console.error);
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
    return (
      <OutputPanelShell
        title="Voice Results"
        status={state.isGenerating ? 'loading' : state.error ? 'error' : state.generatedAudios.length > 0 ? 'ready' : 'idle'}
        errorMessage={state.error}
        loading={
          <div className="h-full space-y-6 overflow-y-auto scrollbar-hover flex flex-col items-center">
            {/* Custom Voice Generation Loading */}
            <Card className="p-6 w-full max-w-2xl mx-auto">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 mx-auto bg-blue-500/10 rounded-full flex items-center justify-center">
                  <Mic className="w-6 h-6 text-blue-500 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Generating Voice...</h3>
                  <p className="text-sm text-muted-foreground">
                    Creating your voice over with {state.selectedVoice || 'AI voice'}
                  </p>
                </div>
                <Progress value={33} className="w-full" />
              </div>
            </Card>
          </div>
        }
        empty={
          <div className="flex items-center justify-center h-full">
            <UnifiedEmptyState
              icon={Mic}
              title="Ready to Generate"
              description="Enter your script text and select voice settings to create professional voice overs powered by AI."
            />
          </div>
        }
      >
      <div className="h-full space-y-6 overflow-y-auto scrollbar-hover flex flex-col items-center">

        {/* Generated Results */}
        {state.generatedAudios.length > 0 && (
          <Card className="p-6 w-full max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold">Generated Successfully!</h3>
            </div>
            
            <div className="space-y-4">
              {state.generatedAudios.map((audio: GeneratedVoice) => (
                <Card key={audio.id} className="p-4 bg-card border-border">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {audio.voice_name}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {audio.export_format?.toUpperCase() || 'MP3'}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAudioPlayback(audio.id, audio.audio_url)}
                        >
                          {playingAudioId === audio.id ? (
                            <Square className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(audio.audio_url, '_blank')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{formatDuration(audio.duration_seconds || 0)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileAudio className="w-4 h-4 text-muted-foreground" />
                        <span>{formatFileSize(audio.file_size_mb || 0)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4 text-muted-foreground" />
                        <span>{audio.credits_used || state.estimatedCredits} credits</span>
                      </div>
                    </div>

                    {/* Script Preview */}
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {audio.script_text}
                      </p>
                    </div>

                    {/* Consistent Audio Player */}
                    <div className="relative w-full">
                      <div className="bg-muted/30 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleAudioPlayback(audio.id, audio.audio_url)}
                            className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                          >
                            {playingAudioId === audio.id ? (
                              <Square className="w-5 h-5" />
                            ) : (
                              <Play className="w-5 h-5" />
                            )}
                          </button>
                          <div className="flex-1 h-12 bg-muted/50 rounded-md flex items-center px-3">
                            {/* Waveform visualization */}
                            <div className="flex items-center justify-center w-full gap-1">
                              {[...Array(60)].map((_, i) => (
                                <div
                                  key={i}
                                  className={`bg-muted-foreground/30 rounded-full transition-all duration-75 ${
                                    playingAudioId === audio.id 
                                      ? 'animate-pulse bg-primary/50' 
                                      : ''
                                  }`}
                                  style={{
                                    width: '2px',
                                    height: `${Math.random() * 30 + 8}px`,
                                    animationDelay: `${i * 50}ms`
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-sm text-muted-foreground font-mono">
                            {formatDuration(audio.duration_seconds || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Batch Summary */}
              {state.generatedAudios.length > 1 && (
                <Card className="p-4 bg-card border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-sm">Batch Generation Complete</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-medium text-blue-600">{state.generatedAudios.length}</div>
                      <div className="text-muted-foreground">Voices</div>
                    </div>
                    <div>
                      <div className="font-medium text-blue-600">
                        {state.generatedAudios.reduce((sum: number, audio: GeneratedVoice) => sum + audio.duration_seconds, 0)}s
                      </div>
                      <div className="text-muted-foreground">Total Duration</div>
                    </div>
                    <div>
                      <div className="font-medium text-blue-600">
                        {state.generatedAudios.reduce((sum: number, audio: GeneratedVoice) => sum + audio.file_size_mb, 0).toFixed(1)}MB
                      </div>
                      <div className="text-muted-foreground">Total Size</div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </Card>
        )}

        {/* Empty State handled by OutputPanelShell */}

        {/* Current Settings Preview */}
        <Card className="p-4 w-full max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4" />
            <span className="font-medium text-sm">Current Settings</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Voice:</span>
              <span className="ml-2 font-medium">{state.selectedVoice || 'None selected'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Format:</span>
              <span className="ml-2 font-medium">{state.exportFormat.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Quality:</span>
              <span className="ml-2 font-medium">{state.quality}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Speed:</span>
              <span className="ml-2 font-medium">{state.voiceSettings.speed}x</span>
            </div>
            <div>
              <span className="text-muted-foreground">Batch Mode:</span>
              <span className="ml-2 font-medium">Off</span>
            </div>
            <div>
              <span className="text-muted-foreground">Est. Cost:</span>
              <span className="ml-2 font-medium">{state.estimatedCredits} credits</span>
            </div>
          </div>
        </Card>

        {/* Error Display */}
        {state.error && (
          <Card className="p-4 border-destructive bg-destructive/5 w-full max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="font-medium text-sm">Generation Failed</span>
            </div>
            <p className="text-sm text-destructive mt-2">{state.error}</p>
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
        title="Voice History"
        status={state.isLoading ? 'loading' : state.error ? 'error' : state.voiceHistory.length > 0 ? 'ready' : 'idle'}
        errorMessage={state.error}
        empty={
          <div className="flex items-center justify-center h-full">
            <UnifiedEmptyState
              icon={History}
              title="No Voice History"
              description="Your generated voices will appear here. Create your first voice over to see it in your history."
            />
          </div>
        }
      >
        <div className="h-full overflow-y-auto scrollbar-hover p-4">
          {state.voiceHistory.length > 0 ? (
            <div className="space-y-4">
              {state.voiceHistory.map((voice: GeneratedVoice) => (
                <Card key={voice.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {voice.voice_name}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {voice.export_format?.toUpperCase() || 'MP3'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(voice.created_at || '').toLocaleDateString()} • {formatDuration(voice.duration_seconds || 0)} • {formatFileSize(voice.file_size_mb || 0)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAudioPlayback(voice.id, voice.audio_url || '')}
                        >
                          {playingAudioId === voice.id ? (
                            <Square className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(voice.audio_url, '_blank')}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteVoice(voice.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm line-clamp-2">
                        {voice.script_text || voice.text_content}
                      </p>
                    </div>
                    
                    <audio controls className="w-full">
                      <source src={voice.audio_url || ''} type={`audio/${voice.export_format || 'mp3'}`} />
                    </audio>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileAudio className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No voices in history yet</p>
              </div>
            </div>
          )}
        </div>
      </OutputPanelShell>
    );
  }

  // Settings Tab Output
  if (activeTab === 'settings') {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <UnifiedEmptyState
          icon={Settings}
          title="Ready to Create Magic ✨"
          description="Fine-tune your voice generation parameters for the perfect sound."
        />
      </div>
    );
  }

  return null;
}