'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Play, Pause, Download, Volume2, Mic } from 'lucide-react';
import { MINIMAX_VOICE_OPTIONS } from '@/components/shared/voice-constants';
import { generateMinimaxVoice } from '@/actions/services/minimax-voice-service';
import { createClient } from '@/app/supabase/client';
import { toast } from 'sonner';

interface VoiceOverStepProps {
  narrationScript: string;
  onVoiceGenerated: (audioUrl: string, duration?: number) => void;
  onSettingsChange: (voice?: string, speed?: number) => void;
  selectedVoice?: string;
  voiceSpeed?: number;
  voiceAudioUrl?: string;
}

export function VoiceOverStep({
  narrationScript,
  onVoiceGenerated,
  onSettingsChange,
  selectedVoice,
  voiceSpeed,
  voiceAudioUrl,
}: VoiceOverStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voice, setVoice] = useState(selectedVoice || 'Calm_Woman');
  const [speed, setSpeed] = useState(voiceSpeed || 1.0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleGenerate = async () => {
    if (!narrationScript.trim()) {
      toast.error('No narration script to generate');
      return;
    }

    setIsGenerating(true);

    try {
      // Get user id
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

  const handleDownload = async () => {
    if (!voiceAudioUrl) return;
    try {
      const response = await fetch(voiceAudioUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'voiceover.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(voiceAudioUrl, '_blank');
    }
  };

  // Group voices by category
  const voicesByCategory = MINIMAX_VOICE_OPTIONS.reduce((acc, v) => {
    const cat = v.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {} as Record<string, typeof MINIMAX_VOICE_OPTIONS>);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Voice Over</h2>
        <p className="text-sm text-muted-foreground">
          Generate narration for your video
        </p>
      </div>

      {/* Script preview */}
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-2">Narration Script</h3>
        <div className="text-sm text-muted-foreground bg-secondary/20 rounded-md p-3 max-h-40 overflow-y-auto font-mono">
          {narrationScript || 'No narration script available'}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {narrationScript.split(/\s+/).filter(Boolean).length} words
        </p>
      </Card>

      {/* Voice selection */}
      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          Voice Settings
        </h3>

        {/* Voice selector */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Voice</label>
          <select
            value={voice}
            onChange={e => { setVoice(e.target.value); onSettingsChange(e.target.value); }}
            className="w-full bg-secondary/30 border border-border/30 rounded-md px-3 py-2 text-sm"
          >
            {Object.entries(voicesByCategory).map(([category, voices]) => (
              <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
                {voices.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.gender}) — {v.description}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Speed */}
        <div>
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
          disabled={isGenerating || !narrationScript.trim()}
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
          <h3 className="text-sm font-medium mb-3">Preview</h3>
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
              onClick={handleDownload}
              className="shrink-0"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
