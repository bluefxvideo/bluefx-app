'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Upload, Video } from 'lucide-react';
import { CinematographerRequest } from '@/actions/tools/ai-cinematographer';
import { PromptSection } from '../input-panel/prompt-section';
import { TabContentWrapper, TabHeader, TabBody, TabError } from '@/components/tools/tab-content-wrapper';

interface GeneratorTabProps {
  onGenerate: (request: CinematographerRequest) => void;
  isGenerating: boolean;
  credits: number;
  error?: string;
}

/**
 * Video Generation Tab - Professional cinematic video creation
 * Following exact Thumbnail Machine pattern
 */
export function GeneratorTab({
  onGenerate,
  isGenerating,
  credits,
  error
}: GeneratorTabProps) {
  const [formData, setFormData] = useState({
    prompt: '',
    reference_image: null as File | null,
    duration: 4,
    aspect_ratio: '16:9' as '16:9' | '9:16' | '1:1',
    motion_scale: 1.0
  });
  // const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = () => {
    if (!formData.prompt?.trim()) return;
    
    onGenerate({
      prompt: formData.prompt,
      reference_image: formData.reference_image || undefined,
      duration: formData.duration,
      aspect_ratio: formData.aspect_ratio,
      motion_scale: formData.motion_scale,
      workflow_intent: 'generate',
      user_id: 'demo-user'
    });
  };

  const handleImageUpload = (file: File | null) => {
    setFormData(prev => ({ ...prev, reference_image: file }));
  };

  const estimatedCredits = 8 + (formData.reference_image ? 2 : 0) + (formData.duration > 4 ? (formData.duration - 4) * 4 : 0);

  return (
    <TabContentWrapper>
      {/* Error Display */}
      {error && <TabError error={error} />}
      
      {/* Header */}
      <TabHeader
        icon={Video}
        title="Video Generator"
        description="Create professional cinematic videos"
      />

      {/* Form Sections */}
      <TabBody>
      <div className="flex-1 space-y-4 overflow-visible scrollbar-hover">
        {/* Prompt Section */}
        <PromptSection
          prompt={formData.prompt}
          onPromptChange={(prompt) => setFormData(prev => ({ ...prev, prompt }))}
          placeholder="Describe the cinematic video you want to create..."
          disabled={isGenerating}
          error={error}
        />

        {/* Reference Image Upload */}
        <div className="space-y-2">
          <Label>Reference Image (Optional)</Label>
          <Card className="p-4 border-2 border-dashed rounded-lg border-muted-foreground/40 bg-secondary hover:bg-secondary/80 cursor-pointer transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e.target.files?.[0] || null)}
              className="hidden"
              id="reference-upload"
              disabled={isGenerating}
            />
            <label htmlFor="reference-upload" className="cursor-pointer space-y-2 block">
              {formData.reference_image ? (
                <div className="space-y-1">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg mx-auto flex items-center justify-center">
                    <Upload className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-blue-600">
                    {formData.reference_image.name}
                  </p>
                  <p className="text-xs text-muted-foreground">Click to change</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="w-8 h-8 bg-muted rounded-lg mx-auto flex items-center justify-center">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm">Drop image or click to upload</p>
                  <p className="text-xs text-muted-foreground">Style reference for generation</p>
                </div>
              )}
            </label>
          </Card>
        </div>

        {/* Generation Options */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Duration */}
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select 
                value={formData.duration.toString()} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, duration: parseInt(value) }))}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 seconds</SelectItem>
                  <SelectItem value="4">4 seconds</SelectItem>
                  <SelectItem value="6">6 seconds</SelectItem>
                  <SelectItem value="8">8 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <Select 
                value={formData.aspect_ratio} 
                onValueChange={(value: '16:9' | '9:16' | '1:1') => setFormData(prev => ({ ...prev, aspect_ratio: value }))}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (YouTube)</SelectItem>
                  <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Motion Scale */}
          <div className="space-y-2">
            <Label>Motion Scale: {formData.motion_scale.toFixed(1)}</Label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={formData.motion_scale}
              onChange={(e) => setFormData(prev => ({ ...prev, motion_scale: parseFloat(e.target.value) }))}
              disabled={isGenerating}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.0 (Minimal)</span>
              <span>2.0 (Dynamic)</span>
            </div>
          </div>
        </div>
      </div>
      </TabBody>

      {/* Generate Button - Outside scrollable area */}
      <div className="mt-6">
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || credits < estimatedCredits || !formData.prompt?.trim()}
          className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating Video...
            </>
          ) : (
            <>
              <Video className="w-4 h-4 mr-2" />
              Generate Video
            </>
          )}
        </Button>

        {credits < estimatedCredits && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {estimatedCredits} credits.
          </p>
        )}
      </div>
    </TabContentWrapper>
  );
}