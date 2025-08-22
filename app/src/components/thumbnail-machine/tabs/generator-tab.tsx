'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Wand2, Image as ImageIcon } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter, TabError } from '@/components/tools/tab-content-wrapper';
import { ThumbnailMachineRequest } from '@/actions/tools/thumbnail-machine';
import { PromptSection } from '../input-panel/prompt-section';
import { StandardStep } from '@/components/tools/standard-step';

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
    selectedStyle: 'clickbait' as 'clickbait' | 'professional' | 'minimal',
    num_outputs: 1,
    aspect_ratio: '16:9' as '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '16:10' | '10:16' | '3:1' | '1:3',
    reference_image: null as File | null,
    // Ideogram V2a parameters (replacing old Flux parameters)
    style_type: 'Auto' as 'None' | 'Auto' | 'General' | 'Realistic' | 'Design' | 'Render 3D' | 'Anime',
    magic_prompt_option: 'On' as 'Auto' | 'On' | 'Off',
    seed: undefined as number | undefined,
  });

  // Thumbnail styles from legacy implementation
  const thumbnailStyles = {
    clickbait: {
      name: "Clickbait",
      description: "Eye-catching and attention-grabbing design",
      subtitle: "Perfect for viral content • Average CTR: 8-15%",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      gradient: "from-red-500 to-orange-500",
      systemPrompt: `Create an attention-grabbing, clickbait-style thumbnail that demands attention. Focus on:
- Bold, vibrant colors (reds, oranges, yellows)
- Dramatic lighting and high contrast
- Exaggerated expressions or reactions
- High energy and dynamic composition
- Large, bold text overlay potential`,
    },
    professional: {
      name: "Professional",
      description: "Clean, corporate, and trustworthy design",
      subtitle: "Builds authority and trust • Average CTR: 5-8%",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      gradient: "from-blue-500 to-indigo-500",
      systemPrompt: `Create a professional and polished thumbnail that exudes credibility and expertise. Focus on:
- Clean, minimalist composition
- Professional color schemes (blues, grays, whites)
- High-quality, corporate-friendly imagery
- Clear typography space
- Balanced and structured layout`,
    },
    minimal: {
      name: "Minimal",
      description: "Simple, elegant, and modern design",
      subtitle: "Clean and focused • Average CTR: 4-7%",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      gradient: "from-gray-500 to-slate-500",
      systemPrompt: `Create a minimalist and elegant thumbnail that emphasizes simplicity. Focus on:
- Generous white space
- Limited color palette (2-3 colors max)
- Simple geometric shapes
- Essential elements only
- Subtle typography space`,
    },
  };

  const handleSubmit = () => {
    if (!formData.prompt?.trim()) return;
    
    // Enhance prompt with selected style
    const selectedStyleConfig = thumbnailStyles[formData.selectedStyle];
    const enhancedPrompt = `${selectedStyleConfig.systemPrompt}\n\nUser's request: ${formData.prompt}`;
    
    onGenerate({
      prompt: enhancedPrompt,
      num_outputs: formData.num_outputs,
      aspect_ratio: formData.aspect_ratio,
      reference_image: formData.reference_image || undefined,
      // Ideogram V2a parameters (replacing old Flux parameters)
      style_type: formData.style_type,
      magic_prompt_option: formData.magic_prompt_option,
      seed: formData.seed,
      user_id: 'current-user',
    });
  };

  const handleStyleSelect = (style: 'clickbait' | 'professional' | 'minimal') => {
    setFormData(prev => ({ ...prev, selectedStyle: style }));
  };

  const estimatedCredits = formData.num_outputs * 2;

  return (
    <TabContentWrapper>
      {/* Form Content */}
      <TabBody>
        {/* Step 1: Choose Your Style */}
        <StandardStep
          stepNumber={1}
          title="Choose Your Style"
          description="Select the visual approach for your thumbnails"
        >
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(thumbnailStyles).map(([key, style]) => (
              <button
                key={key}
                onClick={() => handleStyleSelect(key as 'clickbait' | 'professional' | 'minimal')}
                className={`relative flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-200 ${
                  formData.selectedStyle === key
                    ? "border-primary bg-primary/10"
                    : "border-border/50 hover:border-border"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${style.gradient} flex items-center justify-center text-white mb-2`}>
                  {style.icon}
                </div>
                <div className="text-sm font-medium text-center">
                  {style.name}
                </div>
                {formData.selectedStyle === key && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </StandardStep>

        {/* Step 2: Describe Your Thumbnail */}
        <StandardStep
          stepNumber={2}
          title="Describe Your Thumbnail"
          description="Tell AI what kind of thumbnail you want"
        >
          <PromptSection
            value={formData.prompt}
            onChange={(prompt) => setFormData((prev) => ({ ...prev, prompt }))}
            ref={promptInputRef}
          />
        </StandardStep>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || !formData.prompt?.trim() || (credits?.available_credits || 0) < estimatedCredits}
          className="w-full h-12 bg-primary hover:bg-primary/90 transition-all duration-300 font-medium"
          size="lg"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          {isGenerating ? 'Generating...' : `Generate Thumbnails (${estimatedCredits} credits)`}
        </Button>
      </TabFooter>
    </TabContentWrapper>
  );
}