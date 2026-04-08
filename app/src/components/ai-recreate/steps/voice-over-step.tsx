'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Play, Pause, Download, Volume2, Mic, Square, Check, ExternalLink, Video, Music } from 'lucide-react';
import { MINIMAX_VOICE_OPTIONS, type VoiceOption } from '@/components/shared/voice-constants';
import { generateMinimaxVoice } from '@/actions/services/minimax-voice-service';
import { createClient } from '@/app/supabase/client';
import { toast } from 'sonner';

interface VoiceOverStepProps {
  narrationScript: string;
  onNarrationChange?: (script: string) => void;
  onVoiceGenerated: (audioUrl: string, duration?: number) => void;
  onSettingsChange: (voice?: string, speed?: number) => void;
  selectedVoice?: string;
  voiceSpeed?: number;
  voiceAudioUrl?: string;
  // Export context
  videoClips?: { id: string; videoUrl?: string; sceneNumber?: number; prompt?: string }[];
  onOpenInEditor?: () => void;
}

export function VoiceOverStep({
  narrationScript,
  onNarrationChange,
  onVoiceGenerated,
  onSettingsChange,
  selectedVoice,
  voiceSpeed,
  voiceAudioUrl,
  videoClips,
  onOpenInEditor,
}: VoiceOverStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voice, setVoice] = useState(selectedVoice || 'Calm_Woman');
  const [speed, setSpeed] = useState(voiceSpeed || 1.0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!narrationScript?.trim()) {
      toast.error('No narration script to generate');
      return;
    }

    setIsGenerating(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to generate voice over');
        setIsGenerating(false);
        return;
      }

      const result = await generateMinimaxVoice({
        text: narrationScript,
        voice_settings: {
          voice_id: voice,
          speed,
          pitch: 0,
          volume: 1,
          emotion: 'auto',
        },
        user_id: user.id,
        batch_id: `recreate-vo-${Date.now()}`,
      });

      if (result.success && result.audio_url) {
        onVoiceGenerated(result.audio_url, result.metadata?.duration_estimate);
        onSettingsChange(voice, speed);
        toast.success('Voice over generated');
      } else {
        toast.error(result.error || 'Failed to generate voice over');
      }
    } catch (err) {
      toast.error('Failed to generate voice over');
    }
    setIsGenerating(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handlePreviewVoice = useCallback((voiceId: string, previewUrl: string) => {
    // Toggle off if same voice
    if (previewingVoiceId === voiceId && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
      setPreviewingVoiceId(null);
      return;
    }

    // Stop current preview
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('canplaythrough', () => {
      audio.play().catch(() => setPreviewingVoiceId(null));
    }, { once: true });
    audio.addEventListener('ended', () => {
      previewAudioRef.current = null;
      setPreviewingVoiceId(null);
    });
    audio.addEventListener('error', () => {
      previewAudioRef.current = null;
      setPreviewingVoiceId(null);
    });

    audio.src = previewUrl;
    previewAudioRef.current = audio;
    setPreviewingVoiceId(voiceId);
    audio.load();
  }, [previewingVoiceId]);

  const selectVoice = (voiceId: string) => {
    setVoice(voiceId);
    onSettingsChange(voiceId);
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  // Group voices by category
  const voicesByCategory = MINIMAX_VOICE_OPTIONS.reduce((acc, v) => {
    const cat = v.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {} as Record<string, VoiceOption[]>);

  const completedClips = videoClips?.filter(c => c.videoUrl) || [];
  const hasAssets = completedClips.length > 0 || voiceAudioUrl;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Voice Over</h2>
        <p className="text-sm text-muted-foreground">
          Generate narration for your video
        </p>
      </div>

      {/* Script editor */}
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-2">Narration Script</h3>
        <Textarea
          value={narrationScript || ''}
          onChange={e => onNarrationChange?.(e.target.value)}
          placeholder="Type or paste your narration script here..."
          rows={5}
          className="text-sm bg-secondary/20 border-border/30 font-mono resize-y"
        />
        <p className="text-xs text-muted-foreground mt-2">
          {(narrationScript || '').split(/\s+/).filter(Boolean).length} words
        </p>
      </Card>

      {/* Voice selection with preview */}
      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          Choose a Voice
        </h3>

        {Object.entries(voicesByCategory).map(([category, voices]) => (
          <div key={category}>
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
              {category}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {voices.map(v => {
                const isSelected = voice === v.id;
                const isPreviewing = previewingVoiceId === v.id;

                return (
                  <div
                    key={v.id}
                    className={`relative group rounded-lg border p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border/30 hover:border-border/60 hover:bg-secondary/20'
                    }`}
                    onClick={() => selectVoice(v.id)}
                  >
                    {/* Preview button */}
                    <button
                      className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-muted/80 opacity-60 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewVoice(v.id, v.preview_url);
                      }}
                    >
                      {isPreviewing ? (
                        <Square className="h-3 w-3 text-primary" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </button>

                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute top-2 left-2">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}

                    <div className="pt-3">
                      <p className="text-xs font-medium truncate">{v.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{v.gender}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Speed */}
        <div className="pt-2 border-t border-border/20">
          <label className="text-xs text-muted-foreground mb-1 block">
            Speed: {speed.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={speed}
            onChange={e => { const s = parseFloat(e.target.value); setSpeed(s); onSettingsChange(undefined, s); }}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
            <span>0.5x</span>
            <span>1.0x</span>
            <span>2.0x</span>
          </div>
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !narrationScript?.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Voice Over...</>
          ) : voiceAudioUrl ? (
            <><Volume2 className="w-4 h-4 mr-2" /> Regenerate Voice Over</>
          ) : (
            <><Volume2 className="w-4 h-4 mr-2" /> Generate Voice Over</>
          )}
        </Button>
      </Card>

      {/* Audio preview */}
      {voiceAudioUrl && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Generated Voice Over</h3>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={togglePlayback}
              className="shrink-0"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>

            <audio
              ref={audioRef}
              src={voiceAudioUrl}
              onEnded={() => setIsPlaying(false)}
              className="flex-1"
              controls
            />

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(voiceAudioUrl, 'voiceover.mp3')}
              className="shrink-0"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* ===== Review & Export ===== */}
      {hasAssets && (
        <div className="space-y-4 pt-4 border-t border-border/30">
          <div>
            <h2 className="text-lg font-semibold">Review & Export</h2>
            <p className="text-sm text-muted-foreground">
              Your generated assets are ready. Download individually or open in the editor to combine.
            </p>
          </div>

          {/* Summary stats */}
          <div className="flex gap-4">
            {completedClips.length > 0 && (
              <Card className="flex-1 p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Video className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{completedClips.length} Video Clips</p>
                  <p className="text-xs text-muted-foreground">Ready to download</p>
                </div>
              </Card>
            )}
            {voiceAudioUrl && (
              <Card className="flex-1 p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Music className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Voice Over</p>
                  <p className="text-xs text-muted-foreground">Ready to download</p>
                </div>
              </Card>
            )}
          </div>

          {/* Video clips grid */}
          {completedClips.length > 0 && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">Video Clips</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {completedClips.map((clip, i) => (
                  <div key={clip.id} className="space-y-2">
                    <div className="aspect-video bg-secondary/30 rounded-lg overflow-hidden">
                      <video
                        src={clip.videoUrl}
                        className="w-full h-full object-cover"
                        controls
                        muted
                        preload="metadata"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground truncate">
                        Scene {clip.sceneNumber || i + 1}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => clip.videoUrl && handleDownload(clip.videoUrl, `scene-${clip.sceneNumber || i + 1}.mp4`)}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {completedClips.length > 0 && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  completedClips.forEach((clip, i) => {
                    if (clip.videoUrl) {
                      setTimeout(() => handleDownload(clip.videoUrl!, `scene-${clip.sceneNumber || i + 1}.mp4`), i * 500);
                    }
                  });
                  if (voiceAudioUrl) {
                    setTimeout(() => handleDownload(voiceAudioUrl, 'voiceover.mp3'), completedClips.length * 500);
                  }
                  toast.success('Downloading all assets...');
                }}
              >
                <Download className="w-4 h-4 mr-2" /> Download All
              </Button>
            )}
            {onOpenInEditor && (
              <Button
                className="flex-1"
                onClick={onOpenInEditor}
              >
                <ExternalLink className="w-4 h-4 mr-2" /> Open in Editor
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
