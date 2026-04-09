'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Check, Volume2, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MUSIC_LIBRARY,
  MUSIC_GENRES,
  GENRE_LABELS,
  getTracksByGenre,
  type MusicTrack,
  type MusicGenre,
} from '@/lib/reelestate-music-library';

interface MusicSelectorProps {
  selectedTrackId: string | null;
  volume: number;
  onSelectTrack: (trackId: string, url: string) => void;
  onVolumeChange: (volume: number) => void;
  disabled?: boolean;
}

export function MusicSelector({
  selectedTrackId,
  volume,
  onSelectTrack,
  onVolumeChange,
  disabled = false,
}: MusicSelectorProps) {
  const [activeGenre, setActiveGenre] = useState<MusicGenre>('upbeat');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const tracks = getTracksByGenre(activeGenre);

  const togglePlay = (track: MusicTrack) => {
    let audio = audioRef.current;
    // Fallback: create audio element if ref didn't connect
    if (!audio) {
      console.warn('audioRef is null, creating element');
      audio = document.createElement('audio');
      (audioRef as any).current = audio;
    }

    if (playingId === track.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.src = track.url;
      audio.volume = volume;
      audio.load();
      setPlayingId(track.id);
      audio.play().catch((err) => {
        console.error('Audio play failed:', err.message);
        setPlayingId(null);
      });
    }
  };

  const selectTrack = useCallback((track: MusicTrack) => {
    onSelectTrack(track.id, track.url);
  }, [onSelectTrack]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {/* Audio element for track preview — must be in DOM for Chrome autoplay policy */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => setPlayingId(null)}
        onError={(e) => {
          console.error('Audio element error:', e);
          setPlayingId(null);
        }}
        className="sr-only"
      />

      {/* Genre tabs */}
      <div className="flex flex-wrap gap-1.5">
        {MUSIC_GENRES.map(genre => (
          <Button
            key={genre}
            variant={activeGenre === genre ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setActiveGenre(genre)}
            disabled={disabled}
          >
            {GENRE_LABELS[genre]}
          </Button>
        ))}
      </div>

      {/* Track list */}
      <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
        {tracks.map(track => {
          const isSelected = selectedTrackId === track.id;
          const isPlaying = playingId === track.id;

          return (
            <div
              key={track.id}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent hover:bg-muted/50',
                disabled && 'opacity-50 pointer-events-none'
              )}
              onClick={() => {
                selectTrack(track);
                if (playingId !== track.id) togglePlay(track);
              }}
            >
              {/* Play/pause button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay(track);
                }}
                disabled={disabled}
              >
                {isPlaying
                  ? <Pause className="h-3.5 w-3.5" />
                  : <Play className="h-3.5 w-3.5" />}
              </Button>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{track.title}</p>
              </div>

              {/* Duration */}
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDuration(track.duration)}
              </span>

              {/* Selected indicator */}
              {isSelected && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Volume slider */}
      {selectedTrackId && (
        <div className="flex items-center gap-3 pt-2 border-t border-border/30">
          <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <Slider
            value={[volume * 100]}
            onValueChange={([v]) => onVolumeChange(v / 100)}
            max={100}
            step={5}
            className="flex-1"
            disabled={disabled}
          />
          <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(volume * 100)}%</span>
        </div>
      )}
    </div>
  );
}
