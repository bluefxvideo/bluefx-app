'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Upload, Video } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { CinematographerRequest } from '@/actions/tools/ai-cinematographer';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

interface GeneratorTabProps {
  onGenerate: (request: CinematographerRequest) => void;
  isGenerating: boolean;
  credits: number;
}

/**
 * Video Generation Tab - Professional cinematic video creation
 * Following exact Thumbnail Machine pattern
 */
export function GeneratorTab({
  onGenerate,
  isGenerating,
  credits
}: GeneratorTabProps) {
  const [formData, setFormData] = useState({
    prompt: '',
    reference_image: null as File | null,
    duration: 5, // Kling default: 5 seconds
    aspect_ratio: '16:9' as '16:9' | '9:16' | '1:1'
  });
  // const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = () => {
    if (!formData.prompt?.trim()) return;
    
    onGenerate({
      prompt: formData.prompt,
      reference_image: formData.reference_image || undefined,
      duration: formData.duration,
      aspect_ratio: formData.aspect_ratio,
      workflow_intent: 'generate',
      user_id: '' // Will be set by the hook with real user ID
    });
  };

  const handleImageUpload = (file: File | null) => {
    setFormData(prev => ({ ...prev, reference_image: file }));
  };

  // Calculate credits based on new Kling v1.6 pricing
  const baseCost = formData.duration === 10 ? 15 : 8; // 15 credits for 10s, 8 credits for 5s
  const imageCost = formData.reference_image ? 2 : 0;
  const estimatedCredits = baseCost + imageCost;

  return (
    <TabContentWrapper>
      {/* Form Sections */}
      <TabBody>
        {/* Step 1: Describe Your Video */}
        <StandardStep
          stepNumber={1}
          title="Describe Your Video"
          description="Tell AI what cinematic video to create"
        >
          <Textarea
            placeholder="Describe the cinematic video you want to create..."
            value={formData.prompt}
            onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
            className="min-h-[120px] resize-y"
            disabled={isGenerating}
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>Be specific for better results</span>
            <span>{formData.prompt.length}/500</span>
          </div>
        </StandardStep>

        {/* Step 2: Reference Image */}
        <StandardStep
          stepNumber={2}
          title="Reference Image"
          description="Upload an optional style reference (optional)"
        >
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
        </StandardStep>

        {/* Step 3: Video Settings */}
        <StandardStep
          stepNumber={3}
          title="Video Settings"
          description="Configure your video generation preferences"
        >
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
                  <SelectItem value="5">5 seconds (8 credits)</SelectItem>
                  <SelectItem value="10">10 seconds (15 credits)</SelectItem>
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

          </div>
        </StandardStep>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || credits < estimatedCredits || !formData.prompt?.trim()}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
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
      </TabFooter>
    </TabContentWrapper>
  );
}