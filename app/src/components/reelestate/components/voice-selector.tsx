'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Search, Mic, Volume2 } from 'lucide-react';
import { MINIMAX_VOICE_OPTIONS, type VoiceOption } from '@/components/shared/voice-constants';
import { getUserClonedVoices, type ClonedVoice } from '@/actions/database/cloned-voices-database';
import { cn } from '@/lib/utils';

interface VoiceSelectorProps {
  voiceId: string;
  onVoiceChange: (voiceId: string) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  disabled?: boolean;
  userId?: string;
}

type CategoryTab = 'all' | 'male' | 'female' | 'cloned';

const CATEGORY_TABS: { value: CategoryTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'cloned', label: 'My Voices' },
];

const SPEED_PRESETS = [
  { value: 0.75, label: '0.75x' },
  { value: 1.0, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
];

export function VoiceSelector({
  voiceId,
  onVoiceChange,
  speed,
  onSpeedChange,
  disabled,
  userId,
}: VoiceSelectorProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [loadingCloned, setLoadingCloned] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load cloned voices on mount
  useEffect(() => {
    if (!userId) return;
    setLoadingCloned(true);
    getUserClonedVoices(userId).then((result) => {
      if (result.success && result.data) {
        setClonedVoices(result.data);
      }
      setLoadingCloned(false);
    });
  }, [userId]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayPreview = useCallback((id: string, previewUrl: string) => {
    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // If same voice was playing, just stop
    if (playingVoiceId === id) {
      setPlayingVoiceId(null);
      return;
    }

    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    setPlayingVoiceId(id);

    audio.addEventListener('ended', () => {
      setPlayingVoiceId(null);
      audioRef.current = null;
    });
    audio.addEventListener('error', () => {
      setPlayingVoiceId(null);
      audioRef.current = null;
    });
    audio.play().catch(() => {
      setPlayingVoiceId(null);
      audioRef.current = null;
    });
  }, [playingVoiceId]);

  // Filter system voices
  const filteredVoices = MINIMAX_VOICE_OPTIONS.filter((v) => {
    if (activeTab !== 'all' && activeTab !== 'cloned' && v.gender !== activeTab) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Filter cloned voices by search
  const filteredCloned = clonedVoices.filter((v) => {
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedVoice = MINIMAX_VOICE_OPTIONS.find((v) => v.id === voiceId);
  const selectedCloned = clonedVoices.find((v) => v.minimax_voice_id === voiceId);
  const selectedName = selectedVoice?.name || selectedCloned?.name || voiceId;

  return (
    <div className="space-y-3">
      {/* Voice Selection */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">
          <Volume2 className="w-3 h-3 inline mr-1" />
          Voice: {selectedName}
        </Label>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Search voices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-xs"
            disabled={disabled}
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 mb-2 flex-wrap">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              disabled={disabled}
              className={cn(
                'px-2 py-0.5 text-[10px] rounded-full border transition-colors',
                activeTab === tab.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {tab.label}
              {tab.value === 'cloned' && clonedVoices.length > 0 && (
                <span className="ml-1">({clonedVoices.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Voice List */}
        <ScrollArea className="h-[200px] rounded-md border">
          <div className="p-1 space-y-0.5">
            {/* Cloned voices (show in "cloned" tab or "all" tab) */}
            {(activeTab === 'cloned' || activeTab === 'all') && filteredCloned.length > 0 && (
              <>
                {activeTab === 'all' && (
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    My Voices
                  </div>
                )}
                {filteredCloned.map((voice) => (
                  <VoiceRow
                    key={`cloned-${voice.id}`}
                    id={voice.minimax_voice_id}
                    name={voice.name}
                    gender={null}
                    description="Cloned voice"
                    previewUrl={voice.preview_url}
                    isSelected={voiceId === voice.minimax_voice_id}
                    isPlaying={playingVoiceId === voice.minimax_voice_id}
                    isCloned
                    onSelect={() => onVoiceChange(voice.minimax_voice_id)}
                    onPlay={handlePlayPreview}
                    disabled={disabled}
                  />
                ))}
              </>
            )}

            {/* Cloned tab empty state */}
            {activeTab === 'cloned' && filteredCloned.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <Mic className="w-5 h-5 mx-auto mb-2 opacity-40" />
                {loadingCloned ? 'Loading...' : 'No cloned voices yet'}
              </div>
            )}

            {/* System voices (hide in "cloned" tab) */}
            {activeTab !== 'cloned' && filteredVoices.map((voice) => (
              <VoiceRow
                key={voice.id}
                id={voice.id}
                name={voice.name}
                gender={voice.gender}
                description={voice.description}
                previewUrl={voice.preview_url}
                isSelected={voiceId === voice.id}
                isPlaying={playingVoiceId === voice.id}
                onSelect={() => onVoiceChange(voice.id)}
                onPlay={handlePlayPreview}
                disabled={disabled}
              />
            ))}

            {activeTab !== 'cloned' && filteredVoices.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No voices found
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Speed Control */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">
          Speed: {speed.toFixed(2)}x
        </Label>
        <div className="flex items-center gap-2">
          <Slider
            value={[speed]}
            min={0.5}
            max={2.0}
            step={0.05}
            onValueChange={([v]) => onSpeedChange(v)}
            disabled={disabled}
            className="flex-1"
          />
        </div>
        <div className="flex gap-1 mt-1.5">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onSpeedChange(preset.value)}
              disabled={disabled}
              className={cn(
                'flex-1 px-1 py-0.5 text-[10px] rounded border transition-colors',
                Math.abs(speed - preset.value) < 0.01
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Voice Row ──────────────────────────────────────────────────────

interface VoiceRowProps {
  id: string;
  name: string;
  gender: string | null;
  description: string;
  previewUrl: string | null;
  isSelected: boolean;
  isPlaying: boolean;
  isCloned?: boolean;
  onSelect: () => void;
  onPlay: (id: string, url: string) => void;
  disabled?: boolean;
}

function VoiceRow({
  id,
  name,
  gender,
  description,
  previewUrl,
  isSelected,
  isPlaying,
  isCloned,
  onSelect,
  onPlay,
  disabled,
}: VoiceRowProps) {
  return (
    <div
      onClick={() => !disabled && onSelect()}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors group',
        isSelected
          ? 'bg-primary/10 border border-primary/30'
          : 'hover:bg-muted/60 border border-transparent'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{name}</span>
          {gender && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
              {gender}
            </Badge>
          )}
          {isCloned && (
            <Badge className="text-[9px] px-1 py-0 h-4 bg-purple-500/20 text-purple-400 border-purple-500/30 shrink-0">
              cloned
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{description}</p>
      </div>

      {/* Play/Stop preview */}
      {previewUrl && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(id, previewUrl);
          }}
          disabled={disabled}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          {isPlaying ? (
            <Square className="w-3 h-3 text-primary fill-primary" />
          ) : (
            <Play className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
          )}
        </button>
      )}
    </div>
  );
}
