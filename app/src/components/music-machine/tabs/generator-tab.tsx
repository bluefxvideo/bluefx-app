'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Music, Sparkles, Crown, Zap, Mic } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { UseMusicMachineReturn } from '../hooks/use-music-machine';
import { MUSIC_MODEL_CONFIG, MUSIC_MODELS_ORDERED, type MusicModel } from '@/types/music-machine';
import { cn } from '@/lib/utils';

// Icon mapping for models
const MODEL_ICONS: Record<MusicModel, typeof Zap> = {
  unlimited: Zap,
  hd: Sparkles,
  vocals: Mic,
  pro: Crown,
};

interface GeneratorTabProps {
  musicMachineState: UseMusicMachineReturn;
  credits: number;
}

/**
 * Generator Tab - Main music generation interface
 * Config-driven UI based on selected model's capabilities
 */
export function GeneratorTab({ musicMachineState, credits }: GeneratorTabProps) {
  const {
    state,
    generateMusic,
    updatePrompt,
    updateSettings,
  } = musicMachineState;

  const [localPrompt, setLocalPrompt] = useState(state.prompt);
  const [localLyrics, setLocalLyrics] = useState(state.lyrics);

  // Get current model config
  const config = MUSIC_MODEL_CONFIG[state.model];

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
    }, 500);
    return () => clearTimeout(timer);
  }, [localPrompt, updatePrompt]);

  // Update lyrics with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localLyrics !== state.lyrics) {
        updateSettings({ lyrics: localLyrics });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localLyrics, state.lyrics, updateSettings]);

  const canGenerate = localPrompt.trim().length > 0 &&
    (state.model === 'unlimited' || credits >= state.estimatedCredits) &&
    // For vocals model, require lyrics
    (!config.features.lyrics || localLyrics.trim().length >= 10);

  // Calculate step numbers dynamically based on visible features
  let stepNumber = 1;

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Model Selection */}
        <StandardStep
          stepNumber={stepNumber++}
          title="Select Model"
          description="Choose the model for your music generation"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MUSIC_MODELS_ORDERED.map((modelId) => {
              const modelConfig = MUSIC_MODEL_CONFIG[modelId];
              const Icon = MODEL_ICONS[modelId];
              const isSelected = state.model === modelId;
              const canAfford = modelConfig.credits === 0 || credits >= modelConfig.credits;

              return (
                <button
                  key={modelId}
                  onClick={() => updateSettings({ model: modelId })}
                  disabled={state.isGenerating || !canAfford}
                  className={cn(
                    "relative p-4 rounded-lg border-2 text-left transition-all duration-200",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50",
                    !canAfford && "opacity-50 cursor-not-allowed",
                    state.isGenerating && "cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn(
                      "w-4 h-4",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="font-semibold text-sm">{modelConfig.name}</span>
                  </div>
                  <p className={cn(
                    "text-sm font-medium mb-1",
                    modelConfig.credits === 0 ? "text-green-600 dark:text-green-400" : "text-primary"
                  )}>
                    {modelConfig.credits === 0 ? 'Free' : `${modelConfig.credits} credits`}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{modelConfig.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max: {modelConfig.maxDuration >= 60 ? `${Math.floor(modelConfig.maxDuration / 60)}min` : `${modelConfig.maxDuration}s`}
                  </p>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </StandardStep>

        {/* Step 2: Music Description */}
        <StandardStep
          stepNumber={stepNumber++}
          title="Describe Your Music"
          description={config.features.vocals
            ? "Describe the musical style (genre, mood, tempo, instruments)"
            : "Tell us what kind of music you want to create"
          }
        >
          <div className="space-y-2">
            <Label>Music Description</Label>
            <Textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              placeholder={config.features.vocals
                ? "Describe the style: upbeat pop with catchy hooks, energetic rock with electric guitar..."
                : "Describe the music you want to create... (e.g., 'upbeat acoustic guitar melody with drums')"
              }
              className="min-h-[100px] resize-y"
              disabled={state.isGenerating}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Words: {localPrompt.trim().split(/\s+/).filter(Boolean).length}</span>
              {config.features.durationControl && (
                <span>Duration: {state.duration}s</span>
              )}
            </div>
          </div>
        </StandardStep>

        {/* Step 3: Lyrics (Vocals model only) */}
        {config.features.lyrics && (
          <StandardStep
            stepNumber={stepNumber++}
            title="Lyrics"
            description="Write the lyrics for your song (10-600 characters)"
          >
            <div className="space-y-2">
              <Label>Song Lyrics</Label>
              <Textarea
                value={localLyrics}
                onChange={(e) => setLocalLyrics(e.target.value)}
                placeholder={`[verse]
Walking down the street today
Feeling like I found my way

[chorus]
We can make it through
Together me and you`}
                className="min-h-[150px] resize-y font-mono text-sm"
                disabled={state.isGenerating}
                maxLength={600}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Characters: {localLyrics.length}/600</span>
                <span>Supports: [verse], [chorus], [bridge], [outro]</span>
              </div>
              {localLyrics.length > 0 && localLyrics.length < 10 && (
                <p className="text-xs text-amber-600">Minimum 10 characters required</p>
              )}
            </div>
          </StandardStep>
        )}

        {/* Step 4: Duration (if model supports it) */}
        {config.features.durationControl && (
          <StandardStep
            stepNumber={stepNumber++}
            title="Duration"
            description={`Select the length of your music (max ${config.maxDuration}s)`}
          >
            <div className="flex flex-wrap gap-2">
              {config.durations.map((d) => (
                <Button
                  key={d}
                  variant={state.duration === d ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateSettings({ duration: d })}
                  disabled={state.isGenerating}
                >
                  {d >= 60 ? `${Math.floor(d / 60)}:${(d % 60).toString().padStart(2, '0')}` : `${d}s`}
                </Button>
              ))}
            </div>
          </StandardStep>
        )}

        {/* Step 5: Advanced Options (conditional per feature) */}
        {(config.features.negativePrompt || config.features.seed || config.features.referenceAudio) && (
          <StandardStep
            stepNumber={stepNumber++}
            title="Advanced Options"
            description="Optional settings to customize your music generation"
          >
            <div className="space-y-4">
              {/* Negative Prompt (Unlimited, HD) */}
              {config.features.negativePrompt && (
                <div className="space-y-2">
                  <Label>Negative Prompt (Optional)</Label>
                  <Textarea
                    value={state.negative_prompt}
                    onChange={(e) => updateSettings({ negative_prompt: e.target.value })}
                    placeholder="What to exclude from the music (e.g., 'no drums, no vocals')"
                    className="min-h-[80px] resize-y"
                    disabled={state.isGenerating}
                  />
                  <p className="text-xs text-muted-foreground">
                    Describe elements you don't want in your music
                  </p>
                </div>
              )}

              {/* Seed (Unlimited only) */}
              {config.features.seed && (
                <div className="space-y-2">
                  <Label>Seed (Optional)</Label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={state.seed || ''}
                      onChange={(e) => updateSettings({ seed: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Random seed for reproducibility"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={state.isGenerating}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateSettings({ seed: Math.floor(Math.random() * 1000000) })}
                      disabled={state.isGenerating}
                    >
                      Random
                    </Button>
                  </div>
                </div>
              )}

              {/* Reference Audio (Vocals only) */}
              {config.features.referenceAudio && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Reference Audio URL (Optional)</Label>
                    <input
                      type="url"
                      value={state.reference_audio || ''}
                      onChange={(e) => updateSettings({ reference_audio: e.target.value || null })}
                      placeholder="https://example.com/reference-track.mp3"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={state.isGenerating}
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide a URL to a reference track (5-30 seconds) for style transfer
                    </p>
                  </div>

                  {state.reference_audio && (
                    <div className="space-y-2">
                      <Label>Style Strength: {state.style_strength.toFixed(1)}</Label>
                      <Slider
                        value={[state.style_strength]}
                        onValueChange={([value]) => updateSettings({ style_strength: value })}
                        min={0}
                        max={1}
                        step={0.1}
                        disabled={state.isGenerating}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Less influence</span>
                        <span>More influence</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </StandardStep>
        )}

      </TabBody>

      <TabFooter>
        <Button
          onClick={generateMusic}
          disabled={!canGenerate || state.isGenerating}
          className="w-full h-12 bg-primary hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {state.isGenerating ? (
            <>
              Generating Music...
            </>
          ) : (
            <>
              <Music className="w-4 h-4 mr-2" />
              Generate Music {state.model === 'unlimited' ? '(Free)' : `(${state.estimatedCredits} credits)`}
            </>
          )}
        </Button>
        {state.model !== 'unlimited' && credits < state.estimatedCredits && localPrompt.trim().length > 0 && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {state.estimatedCredits} credits.
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
