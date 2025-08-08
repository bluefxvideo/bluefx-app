'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Music } from 'lucide-react';
import { TabContentWrapper, TabHeader, TabBody } from '@/components/tools/tab-content-wrapper';

interface GeneratorTabProps {
  musicMachineState: any;
}

/**
 * Generator Tab - Main music generation interface
 * Following exact BlueFX style guide patterns
 */
export function GeneratorTab({ musicMachineState }: GeneratorTabProps) {
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

  const canGenerate = localPrompt.trim().length > 0;

  // Get genres and moods from model info
  const genres = state.modelInfo?.genres || [
    'pop', 'rock', 'electronic', 'ambient', 'jazz', 'classical'
  ];
  
  const moods = state.modelInfo?.moods || [
    'happy', 'sad', 'energetic', 'calm', 'dramatic', 'mysterious'
  ];

  const durations = state.modelInfo?.durations || [
    { label: 'Short (30s)', value: 30 },
    { label: 'Medium (60s)', value: 60 },
    { label: 'Long (120s)', value: 120 },
    { label: 'Extended (180s)', value: 180 }
  ];

  return (
    <TabContentWrapper>
      {/* Header */}
      <TabHeader
        icon={Music}
        title="Music Maker"
        description="Generate AI music with MusicGen"
      />

      {/* Form Content */}
      <TabBody>
        {/* Music Prompt */}
        <div className="space-y-2">
          <Label>Music Description</Label>
          <Textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder="Describe the music you want to create... (e.g., 'upbeat acoustic guitar melody with drums')"
            className="min-h-[100px] resize-none"
            disabled={state.isGenerating}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Words: {localPrompt.trim().split(/\s+/).filter(Boolean).length}</span>
            <span>Est. generation time: {Math.ceil(state.duration / 15)}min</span>
          </div>
        </div>

        {/* Genre and Mood Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Genre</Label>
            <Select
              value={state.genre}
              onValueChange={(genre) => updateSettings({ genre })}
              disabled={state.isGenerating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {genres.map((genre: string) => (
                  <SelectItem key={genre} value={genre}>
                    {genre.charAt(0).toUpperCase() + genre.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mood</Label>
            <Select
              value={state.mood}
              onValueChange={(mood) => updateSettings({ mood })}
              disabled={state.isGenerating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {moods.map((mood: string) => (
                  <SelectItem key={mood} value={mood}>
                    {mood.charAt(0).toUpperCase() + mood.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Duration Selection */}
        <div className="space-y-2">
          <Label>Duration</Label>
          <div className="grid grid-cols-2 gap-2 p-1">
            {durations.map((duration: any) => (
              <Card
                key={duration.value}
                className={`p-3 transition-all duration-200 hover:shadow-md cursor-pointer bg-white dark:bg-gray-800/40 ${
                  state.duration === duration.value
                    ? 'ring-2 ring-blue-500 bg-blue-500/10 shadow-lg'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => updateSettings({ duration: duration.value })}
              >
                <div className="text-center">
                  <p className="text-sm font-medium">{duration.label}</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {duration.value}s
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Model Quality */}
        <div className="space-y-2">
          <Label>Model Quality</Label>
          <div className="space-y-2 p-1">
            {[
              {
                id: 'stereo-melody-large',
                name: 'Stereo Melody Large',
                description: 'Best quality (Recommended)',
                recommended: true
              },
              {
                id: 'stereo-large',
                name: 'Stereo Large', 
                description: 'High quality stereo',
                recommended: false
              },
              {
                id: 'large',
                name: 'Large',
                description: 'Standard mono (Fastest)',
                recommended: false
              }
            ].map((model) => (
              <Card
                key={model.id}
                className={`p-3 transition-all duration-200 hover:shadow-md cursor-pointer bg-white dark:bg-gray-800/40 ${
                  state.model_version === model.id
                    ? 'ring-2 ring-blue-500 bg-blue-500/10 shadow-lg'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => updateSettings({ model_version: model.id as 'stereo-large' | 'stereo-melody-large' | 'large' })}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{model.name}</p>
                    <p className="text-xs text-muted-foreground">{model.description}</p>
                  </div>
                  {model.recommended && (
                    <Badge variant="secondary" className="text-xs">
                      Recommended
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Current Generation Status */}
        {state.currentGeneration && (
          <Card className="p-4 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <p className="text-sm font-medium">Generating music...</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              This may take 1-2 minutes. You'll be notified when complete.
            </p>
          </Card>
        )}

        {state.error && (
          <Card className="p-4 border-destructive bg-white dark:bg-gray-800/40">
            <p className="text-sm text-destructive">{state.error}</p>
          </Card>
        )}
      </TabBody>

      {/* Generate Button - Outside scrollable area */}
      <div className="mt-6">
        <Button
          onClick={generateMusic}
          disabled={!canGenerate || state.isGenerating}
          className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {state.isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating Music...
            </>
          ) : (
            <>
              <Music className="w-4 h-4 mr-2" />
              Generate Music ({state.estimatedCredits} credits)
            </>
          )}
        </Button>
      </div>
    </TabContentWrapper>
  );
}