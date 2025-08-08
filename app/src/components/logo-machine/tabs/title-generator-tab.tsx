'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Type, Wand2 } from 'lucide-react';
import { ThumbnailMachineRequest } from '@/actions/tools/thumbnail-machine';

interface TitleGeneratorTabProps {
  onGenerate: (request: ThumbnailMachineRequest) => void;
  isGenerating: boolean;
  credits: number;
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
    titleCount: 10,
    targetKeywords: '',
  });

  const handleSubmit = () => {
    if (!formData.topic.trim()) return;
    
    // For title-only generation, we use a special prompt format
    const prompt = `Generate YouTube titles for: ${formData.topic}. Keywords: ${formData.targetKeywords}`;
    
    onGenerate({
      prompt,
      generate_titles: true,
      title_style: formData.style,
      title_count: formData.titleCount,
      num_outputs: 1, // Minimal thumbnail generation for title context
      user_id: 'current-user',
    });
  };

  const estimatedCredits = 1; // Just title generation

  return (
    <div className="h-full flex flex-col space-y-8 p-6 overflow-y-auto scrollbar-overlay" style={{ scrollbarGutter: 'stable', marginRight: '-8px', paddingRight: '14px' }}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
            <Type className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-2xl font-semibold">Title Generator</h2>
        </div>
        <p className="text-base text-muted-foreground" style={{ lineHeight: '1.5' }}>
          Generate engaging YouTube titles optimized for clicks and SEO
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Form Content */}
      <div className="flex-1 space-y-4 overflow-visible scrollbar-hover">
        {/* Topic Input */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Video Topic or Content</Label>
          <textarea
            className="w-full p-3 border rounded-lg resize-none min-h-[100px] text-sm"
            placeholder="Describe your video content... (e.g., 'Gaming tutorial for Minecraft beginners', 'Recipe for chocolate chip cookies', 'Tech review of iPhone 15')..."
            value={formData.topic}
            onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Be specific for better results</span>
            <span>{formData.topic.length}/500</span>
          </div>
        </div>

        {/* Target Keywords */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Target Keywords (Optional)</Label>
          <input
            type="text"
            className="w-full p-3 border rounded-lg text-sm"
            placeholder="e.g., tutorial, beginner, 2024, how to, best..."
            value={formData.targetKeywords}
            onChange={(e) => setFormData(prev => ({ ...prev, targetKeywords: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Comma-separated keywords to include in titles
          </p>
        </div>

        {/* Title Style */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Title Style</Label>
          <Select
            value={formData.style}
            onValueChange={(value: any) => setFormData(prev => ({ ...prev, style: value }))}
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
          <Label className="text-sm font-medium mb-2 block">Number of Titles</Label>
          <Select
            value={formData.titleCount.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, titleCount: parseInt(value) }))}
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

        {/* Tips Card */}
        <Card className="p-6 space-y-6 border border-border/50">
          <div className="text-sm">
            <p className="font-medium mb-2">💡 Pro Tips for Better Titles:</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Use numbers and specific details</li>
              <li>• Include emotional triggers</li>
              <li>• Keep under 60 characters for mobile</li>
              <li>• Test different variations</li>
            </ul>
          </div>
        </Card>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleSubmit}
        disabled={!formData.topic.trim() || isGenerating || credits < estimatedCredits}
        className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-[1.02] transition-all duration-300 font-medium"
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
            Generate {formData.titleCount} Titles
          </>
        )}
      </Button>
    </div>
  );
}