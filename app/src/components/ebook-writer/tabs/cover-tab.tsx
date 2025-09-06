'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Image, ArrowLeft, ArrowRight, Loader2, Palette, RefreshCw, Sparkles, SkipForward } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { SharedEbookEmptyState } from '../components/shared-empty-state';
import { ProgressIndicator } from '../components/progress-indicator';
import { useRouter } from 'next/navigation';
import type { EbookMetadata } from '../store/ebook-writer-store';

interface CoverTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
}

// Style options from legacy system
const styleOptions = [
  { id: 'minimal', name: 'Minimal', description: 'Clean and simple design' },
  { id: 'modern', name: 'Modern', description: 'Contemporary and stylish' },
  { id: 'professional', name: 'Professional', description: 'Business and corporate look' },
  { id: 'creative', name: 'Creative', description: 'Artistic and unique' }
];

const colorSchemeOptions = [
  { id: 'blue', name: 'Blue', colors: ['#3B82F6', '#1D4ED8'] },
  { id: 'green', name: 'Green', colors: ['#10B981', '#047857'] },
  { id: 'purple', name: 'Purple', colors: ['#8B5CF6', '#6D28D9'] },
  { id: 'red', name: 'Red', colors: ['#EF4444', '#B91C1C'] },
  { id: 'orange', name: 'Orange', colors: ['#F97316', '#C2410C'] },
  { id: 'teal', name: 'Teal', colors: ['#14B8A6', '#0D9488'] }
];

const fontOptions = [
  { id: 'serif', name: 'Serif', description: 'Classic and elegant' },
  { id: 'sans-serif', name: 'Sans Serif', description: 'Modern and clean' },
  { id: 'display', name: 'Display', description: 'Bold and attention-grabbing' },
  { id: 'handwriting', name: 'Handwriting', description: 'Personal and friendly' }
];

export function CoverTab({ ebook, isGenerating: _isGenerating, error: _error }: CoverTabProps) {
  const router = useRouter();
  const { setActiveTab, generateCover, generation_progress } = useEbookWriterStore();
  
  // Local state for preferences
  const [coverStyle, setCoverStyle] = useState('minimal');
  const [colorScheme, setColorScheme] = useState('blue');
  const [fontStyle, setFontStyle] = useState('sans-serif');
  const [authorName, setAuthorName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [showCustomization, setShowCustomization] = useState(false);

  // Check what step we need to go back to
  if (!ebook?.topic) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={Image}
            title="No Topic Selected"
            backTo="topic"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }

  if (!ebook?.title) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={Image}
            title="No Title Selected"
            backTo="title"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }

  if (!ebook?.outline) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={Image}
            title="No Outline Created"
            backTo="outline"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }

  // Check if content is generated (this would be the prerequisite for cover)
  const hasContent = ebook?.outline?.chapters?.some(chapter => chapter.content && chapter.content.trim() !== '');
  
  if (!hasContent) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={Image}
            title="No Content Generated"
            backTo="content"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }

  const handleGenerateCover = async () => {
    await generateCover({
      style: coverStyle,
      color_scheme: colorScheme,
      font_style: fontStyle,
      author_name: authorName,
      subtitle: subtitle
    });
  };
  
  const handleBack = () => {
    setActiveTab('content');
    router.push('/dashboard/ebook-writer/content');
  };
  
  const handleContinue = () => {
    setActiveTab('export');
    router.push('/dashboard/ebook-writer/export');
  };
  
  const estimatedCredits = 10;
  
  return (
    <TabContentWrapper>
      <TabBody>
        <StandardStep
          stepNumber={1}
          title="Design Your Book Cover"
          description={`Create a professional cover for: ${ebook.title}`}
        >
          <div className="space-y-6">
            {/* Author & Subtitle Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="author">Author Name</Label>
                <Input
                  id="author"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Enter author name..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle (Optional)</Label>
                <Input
                  id="subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Enter subtitle if any..."
                />
              </div>
            </div>
            
            {/* Generate Button */}
            <div className="space-y-3">
              <Button
                onClick={handleGenerateCover}
                disabled={generation_progress.is_generating}
                className="w-full"
                size="lg"
              >
                {generation_progress.is_generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Cover...
                  </>
                ) : ebook?.cover ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate Cover ({estimatedCredits} credits)
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Cover ({estimatedCredits} credits)
                  </>
                )}
              </Button>
              
              {/* Skip Button - only show if no cover yet */}
              {!ebook?.cover && !generation_progress.is_generating && (
                <Button
                  variant="outline"
                  onClick={handleContinue}
                  className="w-full"
                >
                  <SkipForward className="mr-2 h-4 w-4" />
                  Skip Cover Generation
                </Button>
              )}
            </div>
            
            {/* Customization Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowCustomization(!showCustomization)}
              className="w-full"
            >
              <Palette className="mr-2 h-4 w-4" />
              {showCustomization ? 'Hide' : 'Show'} Customization Options
            </Button>
            
            {/* Customization Options */}
            {showCustomization && (
              <div className="space-y-6 p-4 ">
                {/* Style */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Cover Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {styleOptions.map(option => (
                      <button
                        key={option.id}
                        onClick={() => setCoverStyle(option.id)}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          coverStyle === option.id
                            ? 'border-blue-500 bg-blue-950/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="font-medium text-sm">{option.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Color Scheme */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Color Scheme</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {colorSchemeOptions.map(option => (
                      <button
                        key={option.id}
                        onClick={() => setColorScheme(option.id)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          colorScheme === option.id
                            ? 'border-blue-500'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex gap-1 mb-2 justify-center">
                          {option.colors.map((color, index) => (
                            <div
                              key={index}
                              className="w-6 h-6 rounded"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span className="text-sm">{option.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Font Style */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Font Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {fontOptions.map(option => (
                      <button
                        key={option.id}
                        onClick={() => setFontStyle(option.id)}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          fontStyle === option.id
                            ? 'border-blue-500 bg-blue-950/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="font-medium text-sm">{option.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Error Display */}
            {generation_progress.error_message && (
              <Card className="p-4 border-destructive bg-destructive/5">
                <p className="text-sm text-destructive">{generation_progress.error_message}</p>
              </Card>
            )}
          </div>
        </StandardStep>
      </TabBody>
      
      <TabFooter>
        <ProgressIndicator currentStep="cover" className="mb-4" />
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
            className="flex-1 bg-primary"
          >
            {ebook?.cover ? 'Continue to Export' : 'Continue Without Cover'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </TabFooter>
    </TabContentWrapper>
  );
}