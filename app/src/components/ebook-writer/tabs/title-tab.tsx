'use client';

import { useState } from 'react';
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
}

export function TitleTab({ topic, titleOptions, isGenerating }: TitleTabProps) {
  console.log('📋 TitleTab received:', { topic, titleOptions, isGenerating, titleCount: titleOptions?.options?.length });
  
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customTitle, setCustomTitle] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  
  const { 
    generateTitles, 
    selectTitle, 
    setCustomTitle: updateCustomTitle,
    setActiveTab 
  } = useEbookWriterStore();

  const handleGenerateTitles = async () => {
    if (!topic) return;
    await generateTitles(topic);
  };

  const handleContinue = () => {
    if (useCustom && customTitle.trim()) {
      updateCustomTitle(customTitle.trim());
    } else if (selectedOption) {
      const index = parseInt(selectedOption);
      selectTitle(index);
    }
    setActiveTab('outline');
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
          <Card className="bg-gray-50 dark:bg-gray-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5 text-blue-500" />
            Choose Your Ebook Title
          </CardTitle>
          <CardDescription>
            Topic: <span className="font-medium">{topic}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!titleOptions && (
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
                    }
                  }}
                  placeholder="Enter your own title..."
                  className="text-base"
                />
              </div>

            </div>
          )}
        </CardContent>
          </Card>
        </StandardStep>
      </TabBody>
      
      <TabFooter>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setActiveTab('topic')}
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