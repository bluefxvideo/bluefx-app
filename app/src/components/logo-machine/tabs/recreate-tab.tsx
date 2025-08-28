'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';  
import { RotateCcw, Upload, Image as ImageIcon } from 'lucide-react';
import { LogoMachineRequest } from '@/actions/tools/logo-machine';
import { TabContentWrapper, TabBody, TabError, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

interface RecreateTabProps {
  onGenerate: (request: LogoMachineRequest) => void;
  isGenerating: boolean;
  credits: number;
  error?: string;
}

/**
 * Logo Recreate Tab - Logo recreation from reference images
 * Based on legacy logo-recreate functionality
 */
export function RecreateTab({ onGenerate, isGenerating, credits, error }: RecreateTabProps) {
  const [formData, setFormData] = useState({
    reference_image: null as File | null,
    modifications: '',
    maintain_style: true,
    maintain_concept: true
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, reference_image: file }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.reference_image) {
      return;
    }

    const request: LogoMachineRequest = {
      company_name: 'Logo Recreation', // Default name for recreated logos
      reference_image: formData.reference_image,
      workflow_intent: 'recreate',
      recreate_options: {
        modifications: formData.modifications || undefined,
        maintain_style: formData.maintain_style,
        maintain_concept: formData.maintain_concept,
      },
      user_id: 'demo-user' // This will be replaced with actual user ID
    };

    onGenerate(request);
  };

  const estimatedCredits = 4; // Logo recreation cost

  return (
    <TabContentWrapper>
      {/* Form Sections */}
      <TabBody>
        {/* Step 1: Upload Reference Image */}
        <StandardStep
          stepNumber={1}
          title="Upload Reference Image"
          description="Upload the logo you want to recreate"
        >
          <Card className="p-4 border-2 border-dashed rounded-lg border-muted-foreground/40 bg-secondary hover:bg-secondary/80 cursor-pointer transition-colors">
            <input
              type="file"
              id="reference_image"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isGenerating}
            />
            <label htmlFor="reference_image" className="cursor-pointer space-y-2 block">
              {formData.reference_image ? (
                <div className="space-y-2">
                  <ImageIcon className="w-8 h-8 mx-auto text-blue-600" />
                  <p className="text-sm font-medium text-blue-600">
                    {formData.reference_image.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click to change image
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">Upload Reference Logo</p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, or SVG up to 10MB
                  </p>
                </div>
              )}
            </label>
          </Card>
        </StandardStep>

        {/* Step 2: Modification Instructions */}
        <StandardStep
          stepNumber={2}
          title="Modification Instructions"
          description="Specify changes you want to make (optional)"
        >
          <div className="space-y-2">
            <Textarea
              id="modifications"
              value={formData.modifications}
              onChange={(e) => setFormData(prev => ({ ...prev, modifications: e.target.value }))}
              placeholder="e.g., make it more modern, change colors to blue, simplify the design..."
              rows={3}
              disabled={isGenerating}
              className="resize-y"
            />
          </div>
        </StandardStep>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || credits < estimatedCredits || !formData.reference_image}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              Recreating Logo...
            </>
          ) : (
            <>
              <RotateCcw className="w-4 h-4 mr-2" />
              Recreate Logo
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