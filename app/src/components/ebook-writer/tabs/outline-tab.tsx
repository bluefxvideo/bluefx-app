'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { List, ArrowLeft, ArrowRight, Plus, Loader2, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { SharedEbookEmptyState } from '../components/shared-empty-state';
import { ProgressIndicator } from '../components/progress-indicator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { EbookMetadata } from '../store/ebook-writer-store';
import { useRouter } from 'next/navigation';

interface OutlineTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
  credits: number;
}

const wordCountOptions = [
  { id: 'short', name: 'Short', description: '~800 words/chapter' },
  { id: 'medium', name: 'Medium', description: '~1500 words/chapter' },
  { id: 'long', name: 'Long', description: '~2500 words/chapter' },
  { id: 'comprehensive', name: 'Comprehensive', description: '~3500 words/chapter' }
];

const complexityOptions = [
  { id: 'beginner', name: 'Beginner', description: 'Basic concepts' },
  { id: 'intermediate', name: 'Intermediate', description: 'Balanced approach' },
  { id: 'advanced', name: 'Advanced', description: 'Expert-level insights' }
];

const writingToneOptions = [
  { id: 'professional', name: 'Professional', description: 'Formal tone' },
  { id: 'conversational', name: 'Conversational', description: 'Friendly tone' },
  { id: 'academic', name: 'Academic', description: 'Scholarly tone' },
  { id: 'engaging', name: 'Engaging', description: 'Dynamic tone' }
];

export function OutlineTab({ ebook, isGenerating: _isGenerating, error: _error, credits }: OutlineTabProps) {
  const router = useRouter();
  const { 
    setActiveTab, 
    generateOutline, 
    addChapter,
    current_ebook,
    generation_progress,
    uploaded_documents 
  } = useEbookWriterStore();
  
  const [preferences, setPreferences] = useState({
    word_count_preference: 'medium',
    complexity: 'intermediate',
    writing_tone: 'professional'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [hasGeneratedOutline, setHasGeneratedOutline] = useState(false);
  
  // Auto-generate outline when tab is opened for the first time
  useEffect(() => {
    if (ebook?.title && !current_ebook?.outline && !hasGeneratedOutline && !generation_progress.is_generating) {
      console.log('🚀 Auto-generating outline for:', ebook.title);
      setHasGeneratedOutline(true);
      generateOutline(preferences);
    }
  }, []); // Only run once on mount
  
  const estimatedCredits = 10; // Fixed cost for outline generation
  
  const handleGenerateOutline = async () => {
    if (credits < estimatedCredits) return;
    await generateOutline(preferences);
  };
  
  const handleBack = () => {
    setActiveTab('title');
    router.push('/dashboard/ebook-writer/title');
  };
  
  const handleContinue = () => {
    setActiveTab('content');
    router.push('/dashboard/ebook-writer/content');
  };

  if (!ebook || !ebook.title) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={List}
            title="No Title Selected"
            message="Please select a title first to generate an outline."
            backTo="title"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }

  return (
    <TabContentWrapper>
      <TabBody>
        <StandardStep
          stepNumber={1}
          title="Create Chapter Outline"
          description={`Ebook: ${ebook.title}`}
        >
          <div className="space-y-6">
            {/* Generate/Regenerate Button */}
            <div>
              <Button
                onClick={handleGenerateOutline}
                disabled={generation_progress.is_generating || credits < estimatedCredits}
                className="w-full"
                size="lg"
              >
                {generation_progress.is_generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Outline...
                  </>
                ) : current_ebook?.outline ? (
                  `Regenerate Outline (${estimatedCredits} credits)`
                ) : (
                  `Generate Chapter Outline (${estimatedCredits} credits)`
                )}
              </Button>
              {credits < estimatedCredits && !generation_progress.is_generating && (
                <p className="text-xs text-destructive text-center mt-2">
                  Insufficient credits. You need {estimatedCredits} credits.
                </p>
              )}
            </div>
            
            {/* Add Chapter Button */}
            {current_ebook?.outline && (
              <div>
                <Button
                  onClick={() => addChapter()}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Chapter
                </Button>
              </div>
            )}
            
            {/* Collapsible Settings Panel */}
            <Collapsible open={showSettings} onOpenChange={setShowSettings}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Outline Settings</span>
                  </div>
                  {showSettings ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-6 p-4 mt-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                {/* Word Count */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Words per Chapter</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {wordCountOptions.map(option => (
                      <button
                        key={option.id}
                        onClick={() => setPreferences(prev => ({ ...prev, word_count_preference: option.id }))}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          preferences.word_count_preference === option.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="font-medium text-sm">{option.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Complexity */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Content Complexity</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {complexityOptions.map(option => (
                      <button
                        key={option.id}
                        onClick={() => setPreferences(prev => ({ ...prev, complexity: option.id }))}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          preferences.complexity === option.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="font-medium text-sm">{option.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Writing Tone */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Writing Tone</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {writingToneOptions.map(option => (
                      <button
                        key={option.id}
                        onClick={() => setPreferences(prev => ({ ...prev, writing_tone: option.id }))}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          preferences.writing_tone === option.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
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
              </CollapsibleContent>
            </Collapsible>
          </div>
        </StandardStep>
      </TabBody>
      
      <TabFooter>
        <ProgressIndicator currentStep="outline" className="mb-4" />
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
            disabled={!current_ebook?.outline || generation_progress.is_generating}
            className="flex-1 bg-primary"
          >
            Continue to Content Generation
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </TabFooter>
    </TabContentWrapper>
  );
}