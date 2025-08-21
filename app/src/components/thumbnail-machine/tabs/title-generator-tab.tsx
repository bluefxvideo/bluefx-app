'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Card } from '@/components/ui/card';
import { Type } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ThumbnailMachineRequest, ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { TabContentWrapper, TabBody, TabError, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

interface TitleGeneratorTabProps {
  onGenerate: (request: ThumbnailMachineRequest) => Promise<ThumbnailMachineResponse>;
  isGenerating: boolean;
  credits: { available_credits: number } | null;
  error?: string;
}

/**
 * Title Generator Tab - Dedicated interface for YouTube title generation
 * Focuses purely on creating engaging titles without thumbnail generation
 */
export function TitleGeneratorTab({
  onGenerate,
  isGenerating,
  credits,
  error
}: TitleGeneratorTabProps) {
  const [formData, setFormData] = useState({
    topic: '',
    style: 'engaging' as 'engaging' | 'emotional' | 'professional' | 'shocking' | 'educational',
    title_count: 10,
    target_keywords: '',
  });

  const handleSubmit = async () => {
    if (!formData.topic.trim()) return;
    
    // Call unified orchestrator with titles-only mode
    await onGenerate({
      operation_mode: 'titles-only',
      prompt: formData.topic,
      title_style: formData.style,
      title_count: formData.title_count,
      target_keywords: formData.target_keywords,
      user_id: 'current-user', // This will be handled by the parent component
    });
  };

  const estimatedCredits = 1; // Just title generation

  return (
    <TabContentWrapper>
      {/* Error Display */}
      {error && <TabError error={error} />}

      {/* Form Content */}
      <TabBody>
        {/* Step 1: Describe Your Video */}
        <StandardStep
          stepNumber={1}
          title="Describe Your Video"
          description="Tell us what your video is about"
        >
          <Textarea
            placeholder="Describe your video content... (e.g., 'Gaming tutorial for Minecraft beginners', 'Recipe for chocolate chip cookies', 'Tech review of iPhone 15')..."
            value={formData.topic}
            onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
            className="min-h-[100px] resize-y"
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>Be specific for better results</span>
            <span>{formData.topic.length}/500</span>
          </div>
        </StandardStep>

        {/* Step 2: Customize Settings */}
        <StandardStep
          stepNumber={2}
          title="Customize Settings"
          description="Fine-tune your title generation preferences"
        >
          {/* Target Keywords */}
          <div>
            <Label className="text-base font-medium mb-2 block">Target Keywords (Optional)</Label>
            <Input
              placeholder="e.g., tutorial, beginner, 2024, how to, best..."
              value={formData.target_keywords}
              onChange={(e) => setFormData(prev => ({ ...prev, target_keywords: e.target.value }))}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Comma-separated keywords to include in titles
            </p>
          </div>

          {/* Title Style */}
          <div>
            <Label className="text-base font-medium mb-2 block">Title Style</Label>
          <Select
            value={formData.style}
            onValueChange={(value) => setFormData(prev => ({ ...prev, style: value as 'engaging' | 'emotional' | 'professional' | 'shocking' | 'educational' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="engaging">🎯 Engaging - Balanced and clickable</SelectItem>
              <SelectItem value="emotional">❤️ Emotional - Appeals to feelings</SelectItem>
              <SelectItem value="professional">💼 Professional - Clean and authoritative</SelectItem>
              <SelectItem value="shocking">⚡ Shocking - Bold and attention-grabbing</SelectItem>
              <SelectItem value="educational">📚 Educational - Informative and clear</SelectItem>
            </SelectContent>
          </Select>
        </div>

          {/* Number of Titles */}
          <div>
            <Label className="text-base font-medium mb-2 block">Number of Titles</Label>
            <Select
              value={formData.title_count.toString()}
              onValueChange={(value) => setFormData(prev => ({ ...prev, title_count: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 titles</SelectItem>
                <SelectItem value="10">10 titles</SelectItem>
                <SelectItem value="15">15 titles</SelectItem>
                <SelectItem value="20">20 titles</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </StandardStep>

        {/* Tips Card - Hidden for now, but kept for future use */}
        {/* 
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="text-sm">
            <p className="font-medium text-yellow-800 mb-2">💡 Pro Tips for Better Titles:</p>
            <ul className="text-yellow-700 space-y-1 text-xs">
              <li>• Use numbers and specific details</li>
              <li>• Include emotional triggers</li>
              <li>• Keep under 60 characters for mobile</li>
              <li>• Test different variations</li>
            </ul>
          </div>
        </Card>
        */}
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={!formData.topic.trim() || isGenerating || (credits?.available_credits || 0) < estimatedCredits}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating Titles...
            </>
          ) : (
            <>
              <Type className="w-4 h-4 mr-2" />
              Generate {formData.title_count} Titles ({estimatedCredits} credit)
            </>
          )}
        </Button>
      </TabFooter>
    </TabContentWrapper>
  );
}