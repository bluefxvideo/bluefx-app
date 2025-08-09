'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Settings, Type, Sliders } from 'lucide-react';

interface LogoOptions {
  num_outputs?: number;
  aspect_ratio?: string;
  generate_titles?: boolean;
  title_style?: string;
  guidance_scale?: number;
  num_inference_steps?: number;
  output_quality?: number;
}

interface OptionsSectionProps {
  options: LogoOptions;
  onChange: (options: Partial<LogoOptions>) => void;
}

export function OptionsSection({ options, onChange }: OptionsSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateOption = (key: keyof LogoOptions, value: LogoOptions[keyof LogoOptions]) => {
    onChange({ [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* Basic Options */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Generation Options</Label>
        </div>
        
        {/* Number of Outputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="num-outputs" className="text-xs text-muted-foreground">Variations</Label>
            <Select
              value={options.num_outputs?.toString() || '4'}
              onValueChange={(value) => updateOption('num_outputs', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 variation</SelectItem>
                <SelectItem value="2">2 variations</SelectItem>
                <SelectItem value="3">3 variations</SelectItem>
                <SelectItem value="4">4 variations</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Aspect Ratio */}
          <div>
            <Label htmlFor="aspect-ratio" className="text-xs text-muted-foreground">Aspect Ratio</Label>
            <Select
              value={options.aspect_ratio || '16:9'}
              onValueChange={(value) => updateOption('aspect_ratio', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (YouTube)</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
                <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                <SelectItem value="4:3">4:3 (Classic)</SelectItem>
                <SelectItem value="3:2">3:2 (Photo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Title Generation */}
      <Card className="p-3 bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">YouTube Titles</Label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateOption('generate_titles', !options.generate_titles)}
            className={options.generate_titles ? 'bg-primary/10 text-primary' : ''}
          >
            {options.generate_titles ? 'Enabled' : 'Disabled'}
          </Button>
        </div>
        
        {options.generate_titles && (
          <div>
            <Label htmlFor="title-style" className="text-xs text-muted-foreground">Style</Label>
            <Select
              value={options.title_style || 'engaging'}
              onValueChange={(value) => updateOption('title_style', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engaging">Engaging</SelectItem>
                <SelectItem value="emotional">Emotional</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="shocking">Shocking</SelectItem>
                <SelectItem value="educational">Educational</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </Card>

      {/* Advanced Options Toggle */}
      <Button
        variant="ghost"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full justify-between h-8 px-0 text-xs bg-secondary hover:bg-secondary/80 hover:text-foreground"
      >
        <div className="flex items-center gap-1">
          <Sliders className="w-3 h-3" />
          <span>Advanced Settings</span>
        </div>
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </Button>

      {/* Advanced Options */}
      {showAdvanced && (
        <Card className="p-3 space-y-3 bg-secondary border-dashed">
          <div className="text-xs text-muted-foreground mb-2">
            Fine-tune generation parameters (optional)
          </div>
          
          {/* Guidance Scale */}
          <div>
            <div className="flex justify-between mb-1">
              <Label className="text-xs">Guidance Scale</Label>
              <span className="text-xs text-muted-foreground">{options.guidance_scale || 3}</span>
            </div>
            <Input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={options.guidance_scale || 3}
              onChange={(e) => updateOption('guidance_scale', parseFloat(e.target.value))}
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Creative</span>
              <span>Precise</span>
            </div>
          </div>
          
          {/* Inference Steps */}
          <div>
            <div className="flex justify-between mb-1">
              <Label className="text-xs">Quality Steps</Label>
              <span className="text-xs text-muted-foreground">{options.num_inference_steps || 28}</span>
            </div>
            <Input
              type="range"
              min="10"
              max="50"
              step="1"
              value={options.num_inference_steps || 28}
              onChange={(e) => updateOption('num_inference_steps', parseInt(e.target.value))}
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Fast</span>
              <span>High Quality</span>
            </div>
          </div>
          
          {/* Output Quality */}
          <div>
            <div className="flex justify-between mb-1">
              <Label className="text-xs">Output Quality</Label>
              <span className="text-xs text-muted-foreground">{options.output_quality || 85}%</span>
            </div>
            <Input
              type="range"
              min="60"
              max="100"
              step="5"
              value={options.output_quality || 85}
              onChange={(e) => updateOption('output_quality', parseInt(e.target.value))}
              className="h-2"
            />
          </div>
        </Card>
      )}
    </div>
  );
}