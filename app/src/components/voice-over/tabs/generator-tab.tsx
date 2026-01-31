'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Mic } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import {
  MINIMAX_VOICE_OPTIONS,
  EMOTION_OPTIONS,
  type MinimaxEmotion
} from '@/components/shared/voice-constants';

import { VoiceOverState } from '../hooks/use-voice-over';

interface GeneratorTabProps {
  voiceOverState: {
    state: VoiceOverState;
    generateVoice: () => void;
    updateScriptText: (text: string) => void;
    updateVoiceSettings: (settings: Partial<VoiceOverState['voiceSettings']>) => void;
    handleVoicePlayback: (voiceId: string, url: string) => void;
    setState: (updater: (prev: VoiceOverState) => VoiceOverState) => void;
  };
  credits: number;
  clonedVoices?: Array<{ id: string; name: string; minimax_voice_id: string; preview_url: string | null }>;
}

/**
 * Generator Tab - Main voice over generation interface
 * Updated for Minimax Speech 2.6 HD with full settings
 */
export function GeneratorTab({ voiceOverState, credits, clonedVoices = [] }: GeneratorTabProps) {
  const {
    state,
    generateVoice,
    updateScriptText,
    updateVoiceSettings,
    handleVoicePlayback,
    setState,
  } = voiceOverState;

  const [localScriptText, setLocalScriptText] = useState(state.scriptText);

  // Check for prefilled script from Script Generator
  useEffect(() => {
    const prefillScript = localStorage.getItem('prefill_script');
    if (prefillScript) {
      setLocalScriptText(prefillScript);
      localStorage.removeItem('prefill_script');
    }
  }, []);

  // Sync local state with global state
  useEffect(() => {
    setLocalScriptText(state.scriptText);
  }, [state.scriptText]);

  // Update script text with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      updateScriptText(localScriptText);
    }, 500);
    return () => clearTimeout(timer);
  }, [localScriptText, updateScriptText]);

  const handleVoiceSelection = (voiceId: string) => {
    setState((prev) => ({ ...prev, selectedVoice: voiceId }));
  };

  const estimatedCredits = 2;
  const canGenerate = localScriptText.trim().length > 0 && state.selectedVoice && credits >= estimatedCredits;

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Script Input */}
        <StandardStep
          stepNumber={1}
          title="Enter Your Script"
          description="Write or paste the text you want to convert to speech (max 10,000 characters)"
        >
          <Textarea
            value={localScriptText}
            onChange={(e) => setLocalScriptText(e.target.value)}
            placeholder="Enter the text you want to convert to speech..."
            className="min-h-[100px] resize-y"
            disabled={state.isGenerating}
            maxLength={10000}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Words: {localScriptText.trim().split(/\s+/).filter(Boolean).length}</span>
            <span>{localScriptText.length}/10,000 characters</span>
          </div>
        </StandardStep>

        {/* Step 2: Voice Selection */}
        <StandardStep
          stepNumber={2}
          title="Choose Your Voice"
          description="Select from 17 AI voices or use your cloned voice"
        >
          <div className="grid grid-cols-1 gap-2 p-1 max-h-[300px] overflow-y-auto">
            {/* Cloned voices section */}
            {clonedVoices.length > 0 && (
              <>
                <p className="text-xs font-medium text-muted-foreground px-1">My Cloned Voices</p>
                {clonedVoices.map((voice) => (
                  <Card
                    key={voice.id}
                    className={`p-3 transition-all duration-200 hover:shadow-md cursor-pointer bg-card border-purple-200 dark:border-purple-800 ${
                      state.selectedVoice === voice.minimax_voice_id
                        ? 'ring-2 ring-purple-500'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleVoiceSelection(voice.minimax_voice_id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{voice.name}</p>
                          <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            Cloned
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Your custom cloned voice</p>
                      </div>

                      {voice.preview_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVoicePlayback(voice.minimax_voice_id, voice.preview_url!);
                          }}
                        >
                          {state.playingVoiceId === voice.minimax_voice_id ? (
                            <Square className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
                <p className="text-xs font-medium text-muted-foreground px-1 mt-2">System Voices</p>
              </>
            )}

            {/* System voices */}
            {MINIMAX_VOICE_OPTIONS.map((voice) => (
              <Card
                key={voice.id}
                className={`p-3 transition-all duration-200 hover:shadow-md cursor-pointer bg-card ${
                  state.selectedVoice === voice.id
                    ? 'ring-2 ring-blue-500'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => handleVoiceSelection(voice.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">{voice.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {voice.gender}
                      </Badge>
                      {voice.category && (
                        <Badge variant="secondary" className="text-xs">
                          {voice.category}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{voice.description}</p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVoicePlayback(voice.id, voice.preview_url);
                    }}
                  >
                    {state.playingVoiceId === voice.id ? (
                      <Square className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </StandardStep>

        {/* Step 3: Voice Settings */}
        <StandardStep
          stepNumber={3}
          title="Voice Settings"
          description="Fine-tune speed, pitch, volume, and emotion"
        >
          <div className="grid grid-cols-2 gap-4">
            {/* Speed Control */}
            <div className="space-y-2">
              <Label className="text-sm">Speed: {state.voiceSettings.speed}x</Label>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={state.voiceSettings.speed}
                onChange={(e) => updateVoiceSettings({ speed: parseFloat(e.target.value) })}
                disabled={state.isGenerating}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.5x</span>
                <span>2.0x</span>
              </div>
            </div>

            {/* Pitch Control */}
            <div className="space-y-2">
              <Label className="text-sm">Pitch: {state.voiceSettings.pitch > 0 ? '+' : ''}{state.voiceSettings.pitch}</Label>
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={state.voiceSettings.pitch}
                onChange={(e) => updateVoiceSettings({ pitch: parseInt(e.target.value) })}
                disabled={state.isGenerating}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>-12</span>
                <span>+12</span>
              </div>
            </div>

            {/* Volume Control */}
            <div className="space-y-2">
              <Label className="text-sm">Volume: {state.voiceSettings.volume}</Label>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={state.voiceSettings.volume}
                onChange={(e) => updateVoiceSettings({ volume: parseInt(e.target.value) })}
                disabled={state.isGenerating}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>10</span>
              </div>
            </div>

            {/* Emotion Control */}
            <div className="space-y-2">
              <Label className="text-sm">Emotion</Label>
              <Select
                value={state.voiceSettings.emotion}
                onValueChange={(emotion: MinimaxEmotion) => updateVoiceSettings({ emotion })}
                disabled={state.isGenerating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMOTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Set the emotional tone of the voice
              </p>
            </div>
          </div>
        </StandardStep>

        {state.error && (
          <Card className="p-4 border-destructive">
            <p className="text-sm text-destructive">{state.error}</p>
          </Card>
        )}
      </TabBody>

      <TabFooter>
        <Button
          onClick={generateVoice}
          disabled={!canGenerate || state.isGenerating}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {state.isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating Voice...
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 mr-2" />
              Generate Voice (2 credits)
            </>
          )}
        </Button>
        {credits < estimatedCredits && localScriptText.trim().length > 0 && state.selectedVoice && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {estimatedCredits} credits.
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
