'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Music } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { UseMusicMachineReturn } from '../hooks/use-music-machine';

interface DurationOption {
  label: string;
  value: number;
}

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

  const canGenerate = localPrompt.trim().length > 0 && credits >= state.estimatedCredits;

  // Default genres and moods (model info doesn't contain these UI constants)
  const genres = [
    'pop', 'rock', 'electronic', 'ambient', 'jazz', 'classical'
  ];
  
  const moods = [
    'happy', 'sad', 'energetic', 'calm', 'dramatic', 'mysterious'
  ];

  const durations = [
    { label: 'Short (30s)', value: 30 },
    { label: 'Medium (60s)', value: 60 },
    { label: 'Long (120s)', value: 120 },
    { label: 'Extended (180s)', value: 180 }
  ];

  return (
    <TabContentWrapper>
      <TabBody>
        <StandardStep
          stepNumber={1}
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
          stepNumber={2}
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
              Generate Music ({state.estimatedCredits} credits)
            </>
          )}
        </Button>
        {credits < state.estimatedCredits && localPrompt.trim().length > 0 && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {state.estimatedCredits} credits.
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}