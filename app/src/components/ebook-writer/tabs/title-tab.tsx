'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Type, ArrowRight, ArrowLeft } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { useEbookWriterStore } from '../store/ebook-writer-store';
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
          <div className="h-full flex items-center justify-center">
            <Card className="max-w-md text-center bg-gray-50 dark:bg-gray-800/30">
              <CardContent className="pt-6">
                <Type className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No Topic Selected</h3>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('topic')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Topic
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabBody>
      </TabContentWrapper>
    );
  }

  return (
    <TabContentWrapper>
      <TabBody>
        <div className="space-y-6">
          {/* Selected Topic Display - This is ALL we want in the left panel */}
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Type className="h-5 w-5 text-blue-500" />
                Selected Topic
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {topic}
              </p>
            </CardContent>
          </Card>
        </div>
      </TabBody>
      
      <TabFooter>
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