'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Wand2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { TabFooter } from '@/components/tools/tab-content-wrapper';
import { Card } from '@/components/ui/card';
import { ThumbnailMachineRequest } from '@/actions/tools/thumbnail-machine';
import { PromptSection } from '../input-panel/prompt-section';
// Using custom structured layout in this tab; tab wrapper primitives not used here

interface GeneratorTabProps {
  onGenerate: (request: ThumbnailMachineRequest) => void;
  isGenerating: boolean;
  credits: { available_credits: number } | null;
  error?: string;
  promptInputRef?: React.RefObject<HTMLTextAreaElement>;
}

/**
 * Generator Tab - Premium thumbnail generation interface with Dribbble-level polish
 */
export function GeneratorTab({
  onGenerate,
  isGenerating,
  credits,
  error,
  promptInputRef
}: GeneratorTabProps) {
  const [formData, setFormData] = useState({
    prompt: '',
    num_outputs: 4,
    aspect_ratio: '16:9' as '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3',
    reference_image: null as File | null,
    guidance_scale: 3,
    num_inference_steps: 28,
    output_quality: 85,
  });

  const handleSubmit = () => {
    if (!formData.prompt?.trim()) return;
    
    onGenerate({
      prompt: formData.prompt,
      num_outputs: formData.num_outputs,
      aspect_ratio: formData.aspect_ratio,
      reference_image: formData.reference_image || undefined,
      guidance_scale: formData.guidance_scale,
      num_inference_steps: formData.num_inference_steps,
      output_quality: formData.output_quality,
      user_id: 'current-user',
    });
  };

  const estimatedCredits = formData.num_outputs * 2;

  return (
    <div className="h-full flex flex-col relative">
      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-8 pb-48 scrollbar-hover">
        {/* Error Display with enhanced styling */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm">
            <p className="text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Step 1: Describe Your Thumbnail - Enhanced */}
        <div className="group space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center transition-all duration-300">
                <span className="text-white text-sm font-bold">1</span>
              </div>
              {/* Animated ring on hover */}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1 tracking-tight">Describe Your Vision</h3>
              <p className="text-zinc-400 font-medium">Tell us what you want to create</p>
            </div>
          </div>
          
          <div className="relative">
            <PromptSection
              value={formData.prompt}
              onChange={(prompt) => setFormData((prev) => ({ ...prev, prompt }))}
              ref={promptInputRef}
            />
          </div>
        </div>

        {/* Step 2: Style Reference - Enhanced */}
        <div className="group space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center transition-all duration-300">
                <span className="text-white text-sm font-bold">2</span>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1 tracking-tight">Style Reference</h3>
              <p className="text-zinc-400 font-medium">(Optional) Add visual inspiration</p>
            </div>
          </div>
          
          <Card
            className="relative p-6 border border-border/50 cursor-pointer transition-all duration-300 
                       backdrop-blur-sm
                       hover:border-border
                       group/upload overflow-hidden"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file)
                  setFormData((prev) => ({ ...prev, reference_image: file }));
              };
              input.click();
            }}
          >
            
            {formData.reference_image ? (
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                  <ImageIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-semibold">{formData.reference_image.name}</p>
                  <p className="text-zinc-400 text-sm">Ready to use as style reference</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4 relative z-10">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-secondary/50 to-card/50 rounded-2xl flex items-center justify-center 
                                 border border-border/30 group-hover/upload:border-border/70 transition-all duration-300">
                    <Upload className="w-7 h-7 text-zinc-400 group-hover/upload:text-zinc-300 transition-colors duration-300" />
                  </div>
                  {/* Floating sparkles */}
                  <div className="absolute -top-1 -right-1 opacity-0 group-hover/upload:opacity-100 transition-opacity duration-500">
                    <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-zinc-200 font-semibold text-lg">Drop your inspiration here</p>
                  <p className="text-zinc-400">Upload an image to guide the style</p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Step 3: Generation Options - Enhanced */}
        <div className="group space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center transition-all duration-300">
                <span className="text-white text-sm font-bold">3</span>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1 tracking-tight">Fine-tune Settings</h3>
              <p className="text-zinc-400 font-medium">Customize your output</p>
            </div>
          </div>

          {/* Enhanced Options Grid */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-3">
              <Label className="text-zinc-300 font-semibold text-sm tracking-wide uppercase">Variations</Label>
              <Select
                value={formData.num_outputs.toString()}
                onValueChange={(value) => setFormData(prev => ({ ...prev, num_outputs: parseInt(value) }))}
              >
                <SelectTrigger className="h-12 bg-secondary/50 border-border/50 hover:border-border 
                                         transition-all duration-300 focus:ring-2 focus:ring-primary/40 focus:border-primary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur-xl border-border/50">
                  {[1, 2, 3, 4].map((num) => (
                    <SelectItem key={num} value={num.toString()} className="hover:bg-secondary/50">
                      {num} thumbnail{num > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-zinc-300 font-semibold text-sm tracking-wide uppercase">Aspect Ratio</Label>
              <Select
                value={formData.aspect_ratio}
                onValueChange={(value) => setFormData(prev => ({ ...prev, aspect_ratio: value as typeof formData.aspect_ratio }))}
              >
                <SelectTrigger className="h-12 bg-secondary/50 border-border/50 hover:border-border 
                                         transition-all duration-300 focus:ring-2 focus:ring-primary/40 focus:border-primary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur-xl border-border/50">
                  <SelectItem value="16:9" className="hover:bg-secondary/50">16:9 (YouTube)</SelectItem>
                  <SelectItem value="1:1" className="hover:bg-secondary/50">1:1 (Square)</SelectItem>
                  <SelectItem value="9:16" className="hover:bg-secondary/50">9:16 (Vertical)</SelectItem>
                  <SelectItem value="4:3" className="hover:bg-secondary/50">4:3 (Classic)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Standardized footer */}
      <TabFooter className="bg-card/95 backdrop-blur-xl border-t border-border/50 p-4 -mx-4 -mb-4 rounded-b-xl">
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || !formData.prompt?.trim() || (credits?.available_credits || 0) < estimatedCredits}
          className="w-full h-12 bg-primary hover:bg-primary/90 transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Thumbnails
            </>
          )}
        </Button>
      </TabFooter>
    </div>
  );
}