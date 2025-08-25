'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Type, Wand2, ArrowRight, ArrowLeft } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { TitleOptions } from '../store/ebook-writer-store';

interface TitleTabProps {
  topic: string;
  titleOptions: TitleOptions | null;
  isGenerating: boolean;
  isLoadingSession?: boolean;
}

export function TitleTab({ topic, titleOptions, isGenerating, isLoadingSession = false }: TitleTabProps) {
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

  const { 
    current_ebook,
    generateTitles, 
    selectTitle, 
    setCustomTitle: updateCustomTitle,
    setActiveTab 
  } = useEbookWriterStore();

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

  const handleGenerateTitles = async () => {
    if (!topic) return;
    await generateTitles(topic);
  };

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
        <StandardStep
          stepNumber={1}
          title="Choose Your Ebook Title"
          description={`Topic: ${topic}`}
        >
          <div className="space-y-4">
          {!titleOptions && !isLoadingSession && (
            <>
              <p className="text-sm text-muted-foreground">
                Generate AI-powered title suggestions or create your own custom title.
              </p>
              <Button 
                onClick={handleGenerateTitles}
                disabled={isGenerating}
                className="w-full bg-primary"
              >
                {isGenerating ? (
                  'Generating Titles...'
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Title Options
                  </>
                )}
              </Button>
            </>
          )}


          {titleOptions && (
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">AI-Generated Options:</Label>
                <div className="space-y-2">
                  {titleOptions.options.map((title, index) => (
                    <div 
                      key={index} 
                      className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                        !useCustom && selectedOption === index.toString() 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                          : 'border-border'
                      }`}
                      onClick={() => {
                        setSelectedOption(index.toString());
                        setUseCustom(false);
                        selectTitle(index); // Immediately update the store
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          !useCustom && selectedOption === index.toString()
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {!useCustom && selectedOption === index.toString() && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed font-medium">
                            {title}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-title" className="text-base font-medium">
                  Custom Title:
                </Label>
                <Input
                  id="custom-title"
                  value={customTitle}
                  onChange={(e) => {
                    setCustomTitle(e.target.value);
                    if (e.target.value.trim()) {
                      setUseCustom(true);
                      setSelectedOption('');
                      updateCustomTitle(e.target.value.trim()); // Immediately update the store
                    }
                  }}
                  placeholder="Enter your own title..."
                  className="text-base"
                />
              </div>

            </div>
          )}
          </div>
        </StandardStep>
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