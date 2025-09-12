'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Palette, Building2, Briefcase } from 'lucide-react';
import { LogoMachineRequest } from '@/actions/tools/logo-machine';
import { TabContentWrapper, TabBody, TabError, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { PromptSection } from '../input-panel/prompt-section';

interface GeneratorTabProps {
  onGenerate: (request: LogoMachineRequest) => void;
  isGenerating: boolean;
  credits: number;
  creditsLoading: boolean;
  error?: string;
}

/**
 * Logo Generation Tab - Company-focused logo creation
 * Uses Ideogram V3 Turbo for professional logo design
 */
export function GeneratorTab({ onGenerate, isGenerating, credits, creditsLoading, error }: GeneratorTabProps) {
  const [formData, setFormData] = useState<{
    company_name: string;
    description: string;
    industry: string;
  }>({
    company_name: '',
    description: '',
    industry: ''
  });

  const handleSubmit = async () => {
    if (!formData.company_name.trim()) {
      return;
    }

    try {
      const request: LogoMachineRequest = {
        company_name: formData.company_name.trim(),
        custom_description: formData.description.trim() || undefined,
        industry: formData.industry || undefined,
        workflow_intent: 'generate',
        user_id: 'demo-user' // This will be replaced with actual user ID
      };

      await onGenerate(request);
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

  const estimatedCredits = 3; // Logo generation cost

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Company Details */}
        <div className="border-b border-border/50 py-8 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-foreground">1</span>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Company Details</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Tell us about your company</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="text-sm font-medium flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    Company Name
                    <span className="text-red-500 ml-0.5">*</span>
                  </Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Enter your company name"
                    required
                    disabled={isGenerating}
                    className="h-10 border-border/50 focus:border-primary/50 transition-colors"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="industry" className="text-sm font-medium flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                    Industry
                    <span className="text-xs text-muted-foreground ml-1">(Optional)</span>
                  </Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                    placeholder="e.g., Technology, Healthcare, Finance"
                    disabled={isGenerating}
                    className="h-10 border-border/50 focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Describe Your Logo */}
        <div className="border-b border-border/50 py-8 shadow-sm mb-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-foreground">2</span>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Describe Your Logo</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Tell AI what kind of logo you want</p>
              </div>
              
              <PromptSection
                value={formData.description}
                onChange={(description) => setFormData(prev => ({ ...prev, description }))}
                className="border-border/50 focus-within:border-primary/50"
              />
            </div>
          </div>
        </div>

      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || !formData.company_name.trim() || (!creditsLoading && credits < estimatedCredits)}
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
      </TabFooter>
    </TabContentWrapper>
  );
}