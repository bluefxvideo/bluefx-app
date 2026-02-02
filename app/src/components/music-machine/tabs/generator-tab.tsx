'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Music, Guitar, Mic2, FileText, Repeat, ArrowRight, Eye } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { UseMusicMachineReturn } from '../hooks/use-music-machine';
import { MUSIC_CREDITS, INSTRUMENTAL_SUFFIX, LYRICS_TEMPLATES } from '@/types/music-machine';
import { LyricsAssistant } from '../lyrics-assistant';
import { cn } from '@/lib/utils';

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
    setMode,
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

  // Build final prompt for preview (instrumental mode adds suffix)
  const finalPrompt = state.mode === 'instrumental'
    ? `${localPrompt.trim()}. ${INSTRUMENTAL_SUFFIX}`
    : localPrompt.trim();

  // Insert lyrics template at cursor position
  const insertTemplate = (template: keyof typeof LYRICS_TEMPLATES) => {
    const newLyrics = localLyrics + LYRICS_TEMPLATES[template];
    setLocalLyrics(newLyrics);
  };

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Mode Toggle */}
        <div className="mb-6">
          <Label className="text-sm font-medium mb-3 block">What type of music?</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('instrumental')}
              disabled={state.isGenerating}
              className={cn(
                "flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                state.mode === 'instrumental'
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <Guitar className="w-5 h-5" />
              <span className="font-medium">Instrumental</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('vocals')}
              disabled={state.isGenerating}
              className={cn(
                "flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                state.mode === 'vocals'
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <Mic2 className="w-5 h-5" />
              <span className="font-medium">With Vocals</span>
            </button>
          </div>
        </div>

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

        {/* Step 2: Lyrics - Different UI based on mode */}
        <StandardStep
          stepNumber={2}
          title={state.mode === 'instrumental' ? "Instrumental Formula" : "Write Lyrics"}
          description={
            state.mode === 'instrumental'
              ? "Auto-filled for best results. You can customize if needed."
              : "Write your lyrics or use AI to help"
          }
        >
          {state.mode === 'vocals' ? (
            // Vocals mode: Two-column layout with lyrics editor + AI assistant
            <div className="space-y-3">
              {/* Template buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertTemplate('intro')}
                  disabled={state.isGenerating}
                  className="text-xs"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Intro
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertTemplate('verse')}
                  disabled={state.isGenerating}
                  className="text-xs"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Verse
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertTemplate('chorus')}
                  disabled={state.isGenerating}
                  className="text-xs"
                >
                  <Repeat className="w-3 h-3 mr-1" />
                  Chorus
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertTemplate('bridge')}
                  disabled={state.isGenerating}
                  className="text-xs"
                >
                  <ArrowRight className="w-3 h-3 mr-1" />
                  Bridge
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertTemplate('outro')}
                  disabled={state.isGenerating}
                  className="text-xs"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Outro
                </Button>
              </div>

              {/* Two-column: Lyrics Editor + AI Assistant */}
              <div className="grid grid-cols-2 gap-3">
                {/* Lyrics Editor */}
                <div className="space-y-2">
                  <Textarea
                    value={localLyrics}
                    onChange={(e) => setLocalLyrics(e.target.value)}
                    placeholder={`[Verse]
Walking down the street today
Feeling like I found my way

[Chorus]
We can make it through
Together me and you`}
                    className="min-h-[280px] resize-y font-mono text-sm"
                    disabled={state.isGenerating}
                    maxLength={3000}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{localLyrics.length}/3000 characters</span>
                    <span>Supports: [Verse], [Chorus], [Bridge], [Outro], [Intro]</span>
                  </div>
                </div>

                {/* AI Lyrics Assistant */}
                <div className="h-[320px]">
                  <LyricsAssistant
                    onInsertLyrics={(lyrics) => {
                      // Append AI-generated lyrics to existing lyrics
                      const newLyrics = localLyrics.trim()
                        ? `${localLyrics}\n\n${lyrics}`
                        : lyrics;
                      setLocalLyrics(newLyrics);
                    }}
                    currentLyrics={localLyrics}
                    musicStyle={localPrompt}
                  />
                </div>
              </div>
            </div>
          ) : (
            // Instrumental mode: Simple textarea
            <div className="space-y-3">
              <Textarea
                value={localLyrics}
                onChange={(e) => setLocalLyrics(e.target.value)}
                placeholder="Instrumental formula is auto-filled..."
                className="min-h-[180px] resize-y font-mono text-sm"
                disabled={state.isGenerating}
                maxLength={3000}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{localLyrics.length}/3000 characters</span>
              </div>
            </div>
          )}
        </StandardStep>

        {/* Final Prompt Preview */}
        <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Final Prompt Preview</Label>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Style: </span>
              <span className={cn(!localPrompt.trim() && "text-muted-foreground italic")}>
                {finalPrompt || "Enter a style description above..."}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Lyrics: </span>
              <span className={cn(!localLyrics.trim() && "text-muted-foreground italic")}>
                {localLyrics.trim()
                  ? localLyrics.trim().substring(0, 100) + (localLyrics.length > 100 ? "..." : "")
                  : "No lyrics"}
              </span>
            </div>
          </div>
        </div>
      </TabBody>

      <TabFooter>
        <Button
          onClick={generateMusic}
          disabled={!canGenerate}
          className="w-full h-12 bg-primary hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {state.isGenerating ? (
            <>Generating {state.mode === 'instrumental' ? 'Instrumental' : 'Song'}...</>
          ) : (
            <>
              <Music className="w-4 h-4 mr-2" />
              Generate {state.mode === 'instrumental' ? 'Instrumental' : 'Song'} ({MUSIC_CREDITS} credits)
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
