'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Image, ArrowLeft, ArrowRight, Loader2, RefreshCw, Sparkles, SkipForward } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { SharedEbookEmptyState } from '../components/shared-empty-state';
import { useRouter } from 'next/navigation';
import type { EbookMetadata } from '../store/ebook-writer-store';

interface CoverTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
}


export function CoverTab({ ebook, isGenerating: _isGenerating, error: _error }: CoverTabProps) {
  const router = useRouter();
  const { setActiveTab, generateCover, generation_progress } = useEbookWriterStore();
  
  // Local state for preferences
  const [authorName, setAuthorName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [styleDescription, setStyleDescription] = useState('');

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
      style: 'modern', // Default style
      color_scheme: 'blue', // Default color
      font_style: 'sans-serif', // Default font
      author_name: authorName,
      subtitle: subtitle,
      style_description: styleDescription // Custom style description from user
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
        <div className="space-y-6">
          {/* Step 1: Basic Information */}
          <StandardStep
            stepNumber={1}
            title="Book Information"
            description={`Creating cover for: ${ebook.title}`}
          >
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
          </StandardStep>
          
          {/* Step 2: Style Description */}
          <StandardStep
            stepNumber={2}
            title="Describe Your Cover Style"
            description="Tell us what style and mood you want for your book cover"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="style">Style Description</Label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <Textarea
                id="style"
                value={styleDescription}
                onChange={(e) => setStyleDescription(e.target.value)}
                placeholder="Leave blank for AI to choose, or describe the style you want... (e.g., minimalist with blue tones, professional and modern, creative with bold typography, elegant serif fonts with warm colors)"
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                Be specific about colors, typography, mood, and any visual elements you want. If left empty, AI will create a style based on your book's content.
              </p>
            </div>
          </StandardStep>
          
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
          
          {/* Error Display */}
          {generation_progress.error_message && (
            <Card className="p-4 border-destructive bg-destructive/5">
              <p className="text-sm text-destructive">{generation_progress.error_message}</p>
            </Card>
          )}
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