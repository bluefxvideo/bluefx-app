'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Check, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
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

  const tracks = getTracksByGenre(activeGenre);

  const selectTrack = useCallback((track: MusicTrack) => {
    onSelectTrack(track.id, track.url);
  }, [onSelectTrack]);

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
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

          return (
            <div
              key={track.id}
              className={cn(
                'flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent hover:bg-muted/50',
                disabled && 'opacity-50 pointer-events-none'
              )}
              onClick={() => selectTrack(track)}
            >
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

      {/* Native audio player for selected track — guaranteed to work */}
      {selectedTrack && (
        <div className="pt-2 border-t border-border/30 space-y-3">
          <div className="text-xs text-muted-foreground">Preview: {selectedTrack.title}</div>
          <audio
            key={selectedTrack.id}
            controls
            src={selectedTrack.url}
            className="w-full h-10 rounded-lg"
          />

          {/* Volume slider */}
          <div className="flex items-center gap-3">
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
        </div>
      )}
    </div>
  );
}
