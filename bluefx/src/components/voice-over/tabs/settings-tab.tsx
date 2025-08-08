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
        description="Configure voice generation parameters"
        iconGradient="from-slate-500 to-slate-600"
      />

      {/* Form Content */}
      <TabBody>
        {/* Voice Parameters */}
        <div className="space-y-4">
          <Label>Voice Parameters</Label>
          
          {/* Speed */}
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

          {/* Pitch */}
          <div className="space-y-2">
            <Label className="text-xs">Pitch: {state.voiceSettings.pitch > 0 ? '+' : ''}{state.voiceSettings.pitch}st</Label>
            <input
              type="range"
              min={-20}
              max={20}
              step={1}
              value={state.voiceSettings.pitch}
              onChange={(e) => updateVoiceSettings({ pitch: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>-20st (Lower)</span>
              <span>+20st (Higher)</span>
            </div>
          </div>

          {/* Volume */}
          <div className="space-y-2">
            <Label className="text-xs">Volume: {Math.round(state.voiceSettings.volume * 100)}%</Label>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={state.voiceSettings.volume}
              onChange={(e) => updateVoiceSettings({ volume: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10% (Quiet)</span>
              <span>100% (Loud)</span>
            </div>
          </div>

          {/* Emphasis */}
          <div className="space-y-2">
            <Label className="text-xs">Emphasis</Label>
            <Select
              value={state.voiceSettings.emphasis}
              onValueChange={(emphasis: 'strong' | 'moderate' | 'none') => updateVoiceSettings({ emphasis })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="strong">Strong</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls the overall expressiveness in speech
            </p>
          </div>
        </div>

        {/* Export Settings */}
        <div className="space-y-4">
          <Label>Export Settings</Label>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Format */}
            <div className="space-y-2">
              <Label className="text-xs">Audio Format</Label>
              <Select
                value={state.exportFormat}
                onValueChange={(format: 'mp3' | 'wav' | 'ogg') => setState((prev: VoiceOverState) => ({ ...prev, exportFormat: format }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp3">MP3 (Compressed)</SelectItem>
                  <SelectItem value="wav">WAV (Uncompressed)</SelectItem>
                  <SelectItem value="ogg">OGG (Open Source)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quality */}
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
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="hd">HD (+50% cost)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>MP3:</strong> Best for most use cases, smaller file size</p>
            <p><strong>WAV:</strong> Highest quality, larger file size (+20% cost)</p>
            <p><strong>OGG:</strong> Good quality, open source format</p>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="space-y-4">
          <Label>Advanced Options</Label>
          
          {/* SSML */}
          <div className="flex items-start gap-3">
            <Checkbox
              checked={state.useSSML}
              onCheckedChange={(useSSML) => setState((prev: VoiceOverState) => ({ ...prev, useSSML: Boolean(useSSML) }))}
              id="ssml-advanced"
            />
            <div className="space-y-1">
              <Label htmlFor="ssml-advanced" className="text-xs cursor-pointer">
                Enable SSML Support
              </Label>
              <p className="text-xs text-muted-foreground">
                Speech Synthesis Markup Language for fine-grained control
              </p>
            </div>
          </div>

          {/* SSML Examples */}
          {state.useSSML && (
            <Card className="p-3 bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium">SSML Examples</span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <code>&lt;speak&gt;Hello &lt;break time=&quot;1s&quot;/&gt; world!&lt;/speak&gt;</code>
                  <p className="text-muted-foreground mt-1">Add pauses</p>
                </div>
                <div>
                  <code>&lt;emphasis level=&quot;strong&quot;&gt;Important!&lt;/emphasis&gt;</code>
                  <p className="text-muted-foreground mt-1">Emphasize words</p>
                </div>
                <div>
                  <code>&lt;prosody rate=&quot;slow&quot;&gt;Speak slowly&lt;/prosody&gt;</code>
                  <p className="text-muted-foreground mt-1">Control speed</p>
                </div>
              </div>
            </Card>
          )}
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
              <span>WAV format multiplier:</span>
              <span>+20%</span>
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