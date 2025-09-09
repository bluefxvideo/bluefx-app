'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Type, ArrowRight, ArrowLeft, Edit2, Sparkles, RefreshCw, Loader2, Check } from 'lucide-react';
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
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customTitle, setCustomTitle] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const { 
    current_ebook,
    has_triggered_title_generation,
    generateTitles, 
    selectTitle, 
    setCustomTitle: updateCustomTitle,
    setActiveTab 
  } = useEbookWriterStore();

  // Auto-generate titles when component loads
  useEffect(() => {
    if (topic && !titleOptions && !has_triggered_title_generation && !isLoadingSession && !isGenerating) {
      generateTitles(topic);
    }
  }, [topic, titleOptions, has_triggered_title_generation, isLoadingSession, isGenerating]);

  // Sync local state with loaded session data
  useEffect(() => {
    if (titleOptions && titleOptions.options.length > 0) {
      if (current_ebook?.title) {
        const selectedIndex = titleOptions.options.findIndex(option => option === current_ebook.title);
        if (selectedIndex !== -1) {
          setSelectedOption(selectedIndex.toString());
          setUseCustom(false);
        } else {
          setCustomTitle(current_ebook.title);
          setUseCustom(true);
        }
      }
    }
  }, [titleOptions, current_ebook?.title]);

  const handleContinue = () => {
    const finalTitle = useCustom ? customTitle.trim() : titleOptions?.options[parseInt(selectedOption)];
    if (finalTitle) {
      if (useCustom) {
        updateCustomTitle(finalTitle);
      } else {
        // selectTitle expects an index, not the title string
        selectTitle(parseInt(selectedOption));
      }
    }
    setActiveTab('outline');
    router.push('/dashboard/ebook-writer/outline');
  };

  const handleBack = () => {
    setActiveTab('topic');
    router.push('/dashboard/ebook-writer');
  };

  const handleRegenerateTitles = () => {
    if (topic) {
      generateTitles(topic);
    }
  };

  const canContinue = (useCustom && customTitle.trim()) || (!useCustom && selectedOption);

  if (!topic) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-8 max-w-md text-center space-y-4">
          <Type className="w-12 h-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-medium mb-2">No Topic Selected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Please go back and select a topic first
            </p>
            <Button onClick={handleBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Topic
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-hover">
        <div className="px-6 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">Choose Your Title</h2>
            <p className="text-muted-foreground mt-2">Select from AI-generated options or create your own</p>
          </div>

          {/* Topic Display */}
          <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm font-medium text-primary">Current Topic:</p>
            <p className="text-base mt-1">{topic}</p>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* AI-Generated Titles - Takes up 2 columns */}
            <div className="xl:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-6 w-6 text-primary" />
                      <div>
                        <CardTitle>AI-Generated Titles</CardTitle>
                        <CardDescription>Choose from our suggestions based on your topic</CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={handleRegenerateTitles}
                      variant="outline"
                      size="sm"
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-3 w-3" />
                          Regenerate
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isGenerating ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="text-center space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        <p className="text-sm text-muted-foreground">Creating title suggestions...</p>
                      </div>
                    </div>
                  ) : titleOptions && titleOptions.options.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {titleOptions.options.map((option, index) => (
                        <button
                          key={index}
                          className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                            !useCustom && selectedOption === index.toString()
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => {
                            setSelectedOption(index.toString());
                            setUseCustom(false);
                            setCustomTitle('');
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                              !useCustom && selectedOption === index.toString()
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground'
                            }`}>
                              {!useCustom && selectedOption === index.toString() && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{option}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <p className="text-muted-foreground">
                        No titles generated yet. Click "Regenerate" to create options.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Custom Title - Takes up 1 column */}
            <div className="xl:col-span-1">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Edit2 className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle>Custom Title</CardTitle>
                      <CardDescription>Write your own title</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom-title">Enter your title</Label>
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
                      placeholder="e.g., The Ultimate Guide to..."
                      className="text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      Type to automatically select custom option
                    </p>
                  </div>

                  {customTitle && (
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <p className="text-sm font-medium text-primary">Custom title selected</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Clear the field to use AI suggestions
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Tips for a good title:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Keep it under 60 characters</li>
                      <li>• Include main keywords</li>
                      <li>• Make it compelling and clear</li>
                      <li>• Consider your target audience</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Selection Summary */}
          {canContinue && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">Selected Title:</p>
                  <p className="text-lg font-semibold text-green-900 dark:text-green-100 mt-1">
                    {useCustom ? customTitle : titleOptions?.options[parseInt(selectedOption)]}
                  </p>
                </div>
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Fixed Footer with Card styling */}
      <div className="border-t px-6 py-4 bg-card">
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handleBack}
            size="lg"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button 
            onClick={handleContinue}
            disabled={!canContinue}
            className="min-w-[200px] bg-primary hover:bg-primary/90"
            size="lg"
          >
            Continue to Outline
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}