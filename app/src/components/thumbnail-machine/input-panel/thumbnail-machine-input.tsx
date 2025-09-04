'use client';

import { useState } from 'react';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Card } from '@/components/ui/card';
import { Wand2 } from 'lucide-react';
import { ThumbnailMachineRequest } from '@/actions/tools/thumbnail-machine';
import { PromptSection } from './prompt-section';
import { UploadSection } from './upload-section';
import { OptionsSection } from './options-section';
import { GenerateButton } from './generate-button';

interface ThumbnailMachineInputProps {
  onGenerate: (request: ThumbnailMachineRequest) => void;
  isGenerating: boolean;
  credits: number;
  error?: string;
}

/**
 * Input Panel - Left side of two-column layout
 * Handles all user inputs for thumbnail generation
 */
export function ThumbnailMachineInput({
  onGenerate,
  isGenerating,
  credits,
  error
}: ThumbnailMachineInputProps) {
  const [formData, setFormData] = useState<Partial<ThumbnailMachineRequest>>({
    prompt: '',
    num_outputs: 4,
    aspect_ratio: '16:9',
    generate_titles: false,
  });

  const handleSubmit = () => {
    if (!formData.prompt?.trim()) return;
    
    onGenerate({
      ...formData,
      prompt: formData.prompt,
      user_id: 'current-user', // Will be set by hook
    } as ThumbnailMachineRequest);
  };

  const estimatedCredits = (
    (formData.num_outputs || 4) * 2 + // Thumbnail credits
    (formData.face_swap ? 3 : 0) + // Face swap credits
    (formData.generate_titles ? 1 : 0) // Title credits
  );

  return (
    <div className="h-full flex flex-col space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 sm:gap-2 mb-2">
          <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
            <Wand2 className="w-5 h-5 sm:w-4 sm:h-4 text-white" />
          </div>
          <h2 className="text-xl sm:text-xl font-semibold">Thumbnail Machine</h2>
        </div>
        <p className="text-sm sm:text-sm text-muted-foreground leading-relaxed">
          Generate AI-powered YouTube thumbnails with advanced customization
        </p>
      </div>


      {/* Error Display */}
      {error && (
        <div className="p-4 sm:p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Form Sections */}
      <div className="flex-1 space-y-4 sm:space-y-6 overflow-visible scrollbar-hover">
        <PromptSection
          value={formData.prompt || ''}
          onChange={(prompt) => setFormData(prev => ({ ...prev, prompt }))}
        />
        
        <UploadSection
          referenceImage={formData.reference_image}
          onReferenceImageChange={(reference_image) => 
            setFormData(prev => ({ ...prev, reference_image }))
          }
          faceSwap={formData.face_swap}
          onFaceSwapChange={(face_swap) => 
            setFormData(prev => ({ ...prev, face_swap }))
          }
        />
        
        <OptionsSection
          options={{
            num_outputs: formData.num_outputs,
            aspect_ratio: formData.aspect_ratio,
            generate_titles: formData.generate_titles,
            title_style: formData.title_style,
            guidance_scale: formData.guidance_scale,
            num_inference_steps: formData.num_inference_steps,
            output_quality: formData.output_quality,
          }}
          onChange={(options) => setFormData(prev => ({ 
            ...prev, 
            ...options,
            aspect_ratio: options.aspect_ratio as "16:9" | "1:1" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3" | undefined,
            title_style: options.title_style as "emotional" | "professional" | "shocking" | "educational" | "engaging" | undefined
          }))}
        />
      </div>

      {/* Generate Button */}
      <GenerateButton
        onClick={handleSubmit}
        disabled={!formData.prompt?.trim() || isGenerating || credits < estimatedCredits}
        isGenerating={isGenerating}
        estimatedCredits={estimatedCredits}
        availableCredits={credits}
      />
    </div>
  );
}