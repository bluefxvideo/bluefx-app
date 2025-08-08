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
  Settings
} from 'lucide-react';
import { useState } from 'react';

import { VoiceOverState } from '../hooks/use-voice-over';
import { GeneratedVoice } from '@/actions/tools/voice-over';

interface ContextualOutputProps {
  voiceOverState: {
    activeTab: string;
    state: VoiceOverState;
  };
}

export function ContextualOutput({ voiceOverState }: ContextualOutputProps) {
  const { activeTab, state } = voiceOverState;
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
      <div className="h-full p-6 space-y-6 overflow-y-auto scrollbar-hover">
        {/* Generation Status */}
        {state.isGenerating && (
          <Card className="p-6">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-blue-500/10 rounded-full flex items-center justify-center">
                <Mic className="w-6 h-6 text-blue-500 animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Generating Voice...</h3>
                <p className="text-sm text-muted-foreground">
                  Creating your voice over
                </p>
              </div>
              <Progress value={33} className="w-full" />
            </div>
          </Card>
        )}

        {/* Generated Results */}
        {state.generatedAudios.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold">Generated Successfully!</h3>
            </div>
            
            <div className="space-y-4">
              {state.generatedAudios.map((audio: GeneratedVoice) => (
                <Card key={audio.id} className="p-4 border border-blue-200 bg-blue-50/50">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {audio.voice_name}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {audio.export_format.toUpperCase()}
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
                        <span>{formatDuration(audio.duration_seconds)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileAudio className="w-4 h-4 text-muted-foreground" />
                        <span>{formatFileSize(audio.file_size_mb)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4 text-muted-foreground" />
                        <span>{state.estimatedCredits} credits</span>
                      </div>
                    </div>

                    {/* Script Preview */}
                    <div className="bg-white/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {audio.script_text}
                      </p>
                    </div>

                    {/* Audio Player */}
                    <audio controls className="w-full">
                      <source src={audio.audio_url} type={`audio/${audio.export_format}`} />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                </Card>
              ))}

              {/* Batch Summary */}
              {state.generatedAudios.length > 1 && (
                <Card className="p-4 bg-blue-50/50 border-blue-200">
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

        {/* Empty State */}
        {!state.isGenerating && state.generatedAudios.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
              <Mic className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
            <p className="text-base text-muted-foreground max-w-md">
              Enter your script text and select voice settings to create professional voice overs powered by AI.
            </p>
          </div>
        )}

        {/* Current Settings Preview */}
        <Card className="p-4">
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
          <Card className="p-4 border-destructive bg-destructive/5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="font-medium text-sm">Generation Failed</span>
            </div>
            <p className="text-sm text-destructive mt-2">{state.error}</p>
          </Card>
        )}
      </div>
    );
  }

  // History Tab Output
  if (activeTab === 'history') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-center mb-4">
          <FileAudio className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
        <p className="text-base text-muted-foreground max-w-md">
          View and manage your generated voices from the History tab.
        </p>
      </div>
    );
  }

  // Settings Tab Output
  if (activeTab === 'settings') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
          <Settings className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
        <p className="text-base text-muted-foreground max-w-md">
          Fine-tune your voice generation parameters for the perfect sound.
        </p>
      </div>
    );
  }

  return null;
}