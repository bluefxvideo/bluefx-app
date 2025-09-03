'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Type, ArrowRight, ArrowLeft, Edit2 } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { SharedEbookEmptyState } from '../components/shared-empty-state';
import { ProgressIndicator } from '../components/progress-indicator';
import type { TitleOptions } from '../store/ebook-writer-store';

interface TitleTabProps {
  topic: string;
  titleOptions: TitleOptions | null;
  isGenerating: boolean;
  isLoadingSession?: boolean;
  credits: number;
}

export function TitleTab({ topic, titleOptions, isGenerating, isLoadingSession = false, credits }: TitleTabProps) {
  console.log('📋 TitleTab received:', { 
    topic, 
    titleOptions, 
    isGenerating, 
    titleCount: titleOptions?.options?.length,
    hasOptions: !!titleOptions?.options?.length 
  });
  
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customTitle, setCustomTitle] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [hasTriggeredGeneration, setHasTriggeredGeneration] = useState(false);

  const { 
    current_ebook,
    generateTitles, 
    selectTitle, 
    setCustomTitle: updateCustomTitle,
    setActiveTab 
  } = useEbookWriterStore();

  // Auto-generate titles when component loads if we have a topic but no titles yet
  useEffect(() => {
    if (topic && !titleOptions && !hasTriggeredGeneration && !isLoadingSession) {
      console.log('🚀 Auto-generating titles for topic:', topic);
      setHasTriggeredGeneration(true);
      generateTitles(topic);
    }
  }, [topic, titleOptions, hasTriggeredGeneration, isLoadingSession, generateTitles]);

  // Sync local state with loaded session data
  useEffect(() => {
    if (titleOptions && titleOptions.options.length > 0) {
      // If there's a selected title, try to match it
      if (current_ebook?.title) {
        const selectedIndex = titleOptions.options.findIndex(option => option === current_ebook.title);
        if (selectedIndex !== -1) {
          setSelectedOption(selectedIndex.toString());
          setUseCustom(false);
        } else {
          // It's a custom title
          setCustomTitle(current_ebook.title);
          setUseCustom(true);
        }
      }
      // If no title is selected yet, just ensure the UI shows the generated options
      // (no need to pre-select anything)
    }
  }, [titleOptions, current_ebook?.title]);

  const handleContinue = () => {
    setActiveTab('outline');
    router.push('/dashboard/ebook-writer/outline');
  };

  const handleBack = () => {
    setActiveTab('topic');
    router.push('/dashboard/ebook-writer');
  };

  const canContinue = (useCustom && customTitle.trim()) || (!useCustom && selectedOption);

  if (!topic) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={Type}
            title="No Topic Selected"
            backTo="topic"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }

  return (
    <TabContentWrapper>
      <TabBody>
        <div className="space-y-6">
          {/* Custom Title Input */}
          <StandardStep
            stepNumber={1}
            title="Create Custom Title (Optional)"
            description="Enter your own title or select from AI-generated options"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-title">Custom Title</Label>
                <Input
                  id="custom-title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Enter your own title..."
                  className="text-base"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use-custom"
                  checked={useCustom}
                  onChange={(e) => {
                    setUseCustom(e.target.checked);
                    if (e.target.checked && customTitle.trim()) {
                      updateCustomTitle(customTitle.trim());
                    }
                  }}
                  className="rounded"
                />
                <Label htmlFor="use-custom" className="text-sm">
                  Use custom title instead of AI-generated options
                </Label>
              </div>
            </div>
          </StandardStep>
        </div>
      </TabBody>
      
      <TabFooter>
        <ProgressIndicator currentStep="title" className="mb-4" />
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleBack}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button 
            onClick={handleContinue}
            disabled={!canContinue}
            className="flex-1 bg-primary"
          >
            Continue to Outline
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </TabFooter>
    </TabContentWrapper>
  );
}