'use client';

import { useState } from 'react';
// Unused card components removed
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette } from 'lucide-react';
import { LogoMachineRequest } from '@/actions/tools/logo-machine';
import { TabContentWrapper, TabBody, TabError, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { PromptSection } from '../input-panel/prompt-section';

interface GeneratorTabProps {
  onGenerate: (request: LogoMachineRequest) => void;
  isGenerating: boolean;
  credits: number;
  error?: string;
}

/**
 * Logo Generation Tab - Company-focused logo creation
 * Uses Ideogram V3 Turbo for professional logo design
 */
export function GeneratorTab({ onGenerate, isGenerating, credits, error }: GeneratorTabProps) {
  const [formData, setFormData] = useState<{
    company_name: string;
    description: string;
    style: string;
    color_scheme: string;
    industry: string;
  }>({
    company_name: '',
    description: '',
    style: 'modern',
    color_scheme: '',
    industry: ''
  });

  const handleSubmit = () => {
    if (!formData.company_name.trim()) {
      return;
    }

    const request: LogoMachineRequest = {
      company_name: formData.company_name.trim(),
      custom_description: formData.description.trim() || undefined,
      style: formData.style as any,
      color_scheme: formData.color_scheme || undefined,
      industry: formData.industry || undefined,
      workflow_intent: 'generate',
      user_id: 'demo-user' // This will be replaced with actual user ID
    };

    onGenerate(request);
  };

  const estimatedCredits = 3; // Logo generation cost

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Company Details */}
        <StandardStep
          stepNumber={1}
          title="Company Details"
          description="Tell us about your company"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="Enter your company name"
                required
                disabled={isGenerating}
                className="bg-transparent dark:bg-card-content border-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="industry">Industry (Optional)</Label>
              <Input
                id="industry"
                value={formData.industry}
                onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                placeholder="e.g., Technology, Healthcare, Finance"
                disabled={isGenerating}
                className="bg-transparent dark:bg-card-content border-input"
              />
            </div>
          </div>
        </StandardStep>

        {/* Step 2: Describe Your Logo */}
        <StandardStep
          stepNumber={2}
          title="Describe Your Logo"
          description="Tell AI what kind of logo you want (optional)"
        >
          <PromptSection
            value={formData.description}
            onChange={(description) => setFormData(prev => ({ ...prev, description }))}
          />
        </StandardStep>

        {/* Step 3: Style Preferences */}
        <StandardStep
          stepNumber={3}
          title="Style Preferences"
          description="Choose your logo's visual style (optional)"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="style">Logo Style</Label>
              <Select 
                value={formData.style} 
                onValueChange={(value: string) => setFormData(prev => ({ ...prev, style: value }))}
                disabled={isGenerating}
              >
                <SelectTrigger className="bg-transparent dark:bg-card-content border-input">
                  <SelectValue placeholder="Select logo style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="minimalist">Minimalist</SelectItem>
                  <SelectItem value="vintage">Vintage</SelectItem>
                  <SelectItem value="playful">Playful</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="color_scheme">Color Scheme (Optional)</Label>
              <Input
                id="color_scheme"
                value={formData.color_scheme}
                onChange={(e) => setFormData(prev => ({ ...prev, color_scheme: e.target.value }))}
                placeholder="e.g., Blue and white, Warm colors, Monochrome"
                disabled={isGenerating}
                className="bg-transparent dark:bg-card-content border-input"
              />
            </div>
          </div>
        </StandardStep>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || credits < estimatedCredits || !formData.company_name.trim()}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              Generating Logo...
            </>
          ) : (
            <>
              <Palette className="w-4 h-4 mr-2" />
              Generate Logo ({estimatedCredits} credits)
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