'use client';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings, RotateCcw, Info } from 'lucide-react';
import { TabContentWrapper, TabHeader, TabBody } from '@/components/tools/tab-content-wrapper';
import { VoiceOverState } from '../hooks/use-voice-over';

interface SettingsTabProps {
  voiceOverState: {
    state: VoiceOverState;
    updateVoiceSettings: (settings: Partial<VoiceOverState['voiceSettings']>) => void;
    setState: (updater: (prev: VoiceOverState) => VoiceOverState) => void;
  };
}

/**
 * Settings Tab - Voice over configuration and preferences
 * Following exact BlueFX style guide patterns
 */
export function SettingsTab({ voiceOverState }: SettingsTabProps) {
  const { state, updateVoiceSettings, setState } = voiceOverState;

  const resetToDefaults = () => {
    updateVoiceSettings({
      speed: 1.0,
      pitch: 0,
      volume: 1.0,
      emphasis: 'none',
    });
    setState((prev: VoiceOverState) => ({
      ...prev,
      exportFormat: 'mp3',
      quality: 'standard',
      useSSML: false,
    }));
  };

  return (
    <TabContentWrapper>
      {/* Header */}
      <TabHeader
        icon={Settings}
        title="Voice Settings"
        description="Configure your voice generation preferences"
      />

      {/* Form Content */}
      <TabBody>
        {/* Voice Parameters */}
        <div className="space-y-4">
          <Label>Voice Parameters</Label>
          
          {/* Speed - Only supported parameter */}
          <div className="space-y-2">
            <Label className="text-xs">Speed: {state.voiceSettings.speed}x</Label>
            <input
              type="range"
              min={0.25}
              max={4.0}
              step={0.25}
              value={state.voiceSettings.speed}
              onChange={(e) => updateVoiceSettings({ speed: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.25x (Slow)</span>
              <span>4.0x (Fast)</span>
            </div>
          </div>
        </div>

        {/* Export Settings */}
        <div className="space-y-4">
          <Label>Export Settings</Label>
          
          {/* Quality - Only keep this as it's supported */}
          <div className="space-y-2">
            <Label className="text-xs">Quality</Label>
            <Select
              value={state.quality}
              onValueChange={(quality: 'standard' | 'hd') => setState((prev: VoiceOverState) => ({ ...prev, quality }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (tts-1)</SelectItem>
                <SelectItem value="hd">HD (tts-1-hd) - Higher quality</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              HD quality provides better audio fidelity with higher computational cost
            </p>
          </div>
        </div>


        {/* Credit Information */}
        <Card className="p-4">
          <Label className="mb-3">Credit Usage</Label>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Base cost per voice:</span>
              <span>2 credits</span>
            </div>
            <div className="flex justify-between">
              <span>HD quality multiplier:</span>
              <span>+50%</span>
            </div>
            <div className="flex justify-between">
              <span>Long content (500+ words):</span>
              <span>Small increase</span>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between font-medium">
              <span>Current estimated cost:</span>
              <span>{state.estimatedCredits} credits</span>
            </div>
          </div>
        </Card>
      </TabBody>

      {/* Reset Button - Outside scrollable area */}
      <div className="mt-6">
        <Button
          onClick={resetToDefaults}
          className="w-full h-12 bg-gradient-to-r from-slate-500 to-slate-600 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </TabContentWrapper>
  );
}