'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Music } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { UseMusicMachineReturn } from '../hooks/use-music-machine';
import { MUSIC_CREDITS } from '@/types/music-machine';

interface GeneratorTabProps {
  musicMachineState: UseMusicMachineReturn;
  credits: number;
}

/**
 * Generator Tab - Simplified MiniMax v2 music generation interface
 * Two-step process: describe music style + optional lyrics
 */
export function GeneratorTab({ musicMachineState, credits }: GeneratorTabProps) {
  const {
    state,
    generateMusic,
    updatePrompt,
    updateLyrics,
  } = musicMachineState;

  const [localPrompt, setLocalPrompt] = useState(state.prompt);
  const [localLyrics, setLocalLyrics] = useState(state.lyrics);

  // Sync local state with global state
  useEffect(() => {
    setLocalPrompt(state.prompt);
  }, [state.prompt]);

  useEffect(() => {
    setLocalLyrics(state.lyrics);
  }, [state.lyrics]);

  // Update prompt with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      updatePrompt(localPrompt);
    }, 300);
    return () => clearTimeout(timer);
  }, [localPrompt, updatePrompt]);

  // Update lyrics with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localLyrics !== state.lyrics) {
        updateLyrics(localLyrics);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localLyrics, state.lyrics, updateLyrics]);

  // Can generate if prompt is valid and user has enough credits
  const promptValid = localPrompt.trim().length >= 10 && localPrompt.trim().length <= 300;
  const hasEnoughCredits = credits >= MUSIC_CREDITS;
  const canGenerate = promptValid && hasEnoughCredits && !state.isGenerating;

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Music Description */}
        <StandardStep
          stepNumber={1}
          title="Describe Your Music"
          description="Describe the style, mood, genre, and instruments (10-300 characters)"
        >
          <div className="space-y-2">
            <Label>Style Description</Label>
            <Textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              placeholder="e.g., Upbeat electronic dance track with synth leads and energetic drops, festival vibes, 128 BPM"
              className="min-h-[100px] resize-y"
              disabled={state.isGenerating}
              maxLength={300}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{localPrompt.length}/300 characters</span>
              {localPrompt.length > 0 && localPrompt.length < 10 && (
                <span className="text-amber-600">Minimum 10 characters required</span>
              )}
            </div>
          </div>
        </StandardStep>

        {/* Step 2: Lyrics (Optional) */}
        <StandardStep
          stepNumber={2}
          title="Lyrics (Optional)"
          description="Add lyrics for a song with vocals, or leave empty for instrumental"
        >
          <div className="space-y-2">
            <Label>Song Lyrics</Label>
            <Textarea
              value={localLyrics}
              onChange={(e) => setLocalLyrics(e.target.value)}
              placeholder={`Leave empty for instrumental music, or add lyrics:

[Verse]
Walking down the street today
Feeling like I found my way

[Chorus]
We can make it through
Together me and you`}
              className="min-h-[180px] resize-y font-mono text-sm"
              disabled={state.isGenerating}
              maxLength={3000}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{localLyrics.length}/3000 characters</span>
              <span>Supports: [Verse], [Chorus], [Bridge], [Outro], [Intro]</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tip: Leave lyrics empty for instrumental-only music
            </p>
          </div>
        </StandardStep>
      </TabBody>

      <TabFooter>
        <Button
          onClick={generateMusic}
          disabled={!canGenerate}
          className="w-full h-12 bg-primary hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {state.isGenerating ? (
            <>Generating Music...</>
          ) : (
            <>
              <Music className="w-4 h-4 mr-2" />
              Generate Music ({MUSIC_CREDITS} credits)
            </>
          )}
        </Button>

        {!hasEnoughCredits && localPrompt.trim().length >= 10 && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {MUSIC_CREDITS} credits.
          </p>
        )}

        {localPrompt.trim().length > 0 && localPrompt.trim().length < 10 && (
          <p className="text-xs text-amber-600 text-center mt-2">
            Prompt must be at least 10 characters.
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
