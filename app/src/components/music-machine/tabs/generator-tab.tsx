'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Music, Sparkles, Crown, Zap } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { UseMusicMachineReturn } from '../hooks/use-music-machine';
import { cn } from '@/lib/utils';

interface GeneratorTabProps {
  musicMachineState: UseMusicMachineReturn;
  credits: number;
}

/**
 * Generator Tab - Main music generation interface
 * Following exact BlueFX style guide patterns
 */
export function GeneratorTab({ musicMachineState, credits }: GeneratorTabProps) {
  const {
    state,
    generateMusic,
    updatePrompt,
    updateSettings,
  } = musicMachineState;

  const [localPrompt, setLocalPrompt] = useState(state.prompt);

  // Sync local state with global state
  useEffect(() => {
    setLocalPrompt(state.prompt);
  }, [state.prompt]);

  // Update prompt with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      updatePrompt(localPrompt);
    }, 500);
    return () => clearTimeout(timer);
  }, [localPrompt, updatePrompt]);

  const canGenerate = localPrompt.trim().length > 0 &&
    (state.tier === 'unlimited' || credits >= state.estimatedCredits);

  // Tier configuration
  const tiers = [
    {
      id: 'unlimited' as const,
      name: 'Unlimited',
      credits: 0,
      icon: Zap,
      description: 'Basic quality, included free',
      maxDuration: '~30s'
    },
    {
      id: 'hd' as const,
      name: 'HD',
      credits: 8,
      icon: Sparkles,
      description: 'High-quality instrumentals',
      maxDuration: 'up to 47s'
    },
    {
      id: 'pro' as const,
      name: 'Pro',
      credits: 15,
      icon: Crown,
      description: 'Premium studio quality',
      maxDuration: 'up to 5min'
    },
  ];

  return (
    <TabContentWrapper>
      <TabBody>
        <StandardStep
          stepNumber={1}
          title="Select Quality Tier"
          description="Choose the quality level for your music generation"
        >
          <div className="grid grid-cols-3 gap-3">
            {tiers.map((tier) => {
              const Icon = tier.icon;
              const isSelected = state.tier === tier.id;
              const canAfford = tier.credits === 0 || credits >= tier.credits;

              return (
                <button
                  key={tier.id}
                  onClick={() => updateSettings({ tier: tier.id })}
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
                    <span className="font-semibold text-sm">{tier.name}</span>
                  </div>
                  <p className={cn(
                    "text-sm font-medium mb-1",
                    tier.credits === 0 ? "text-green-600 dark:text-green-400" : "text-primary"
                  )}>
                    {tier.credits === 0 ? 'Free' : `${tier.credits} credits`}
                  </p>
                  <p className="text-xs text-muted-foreground">{tier.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">Max: {tier.maxDuration}</p>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </StandardStep>

        <StandardStep
          stepNumber={2}
          title="Describe Your Music"
          description="Tell us what kind of music you want to create"
        >
          <div className="space-y-2">
            <Label>Music Description</Label>
            <Textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              placeholder="Describe the music you want to create... (e.g., 'upbeat acoustic guitar melody with drums')"
              className="min-h-[100px] resize-y"
              disabled={state.isGenerating}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Words: {localPrompt.trim().split(/\s+/).filter(Boolean).length}</span>
              <span>Est. generation time: {Math.ceil(state.duration / 15)}min</span>
            </div>
          </div>
        </StandardStep>


        <StandardStep
          stepNumber={3}
          title="Advanced Options"
          description="Optional settings to customize your music generation"
        >
          <div className="space-y-4">
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
            
            <div className="space-y-2">
              <Label>Seed (Optional)</Label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={state.seed || ''}
                  onChange={(e) => updateSettings({ seed: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Random seed for reproducibility"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
        </StandardStep>

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
              Generate Music {state.tier === 'unlimited' ? '(Free)' : `(${state.estimatedCredits} credits)`}
            </>
          )}
        </Button>
        {state.tier !== 'unlimited' && credits < state.estimatedCredits && localPrompt.trim().length > 0 && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {state.estimatedCredits} credits.
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}