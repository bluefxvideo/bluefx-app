'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { List, ArrowLeft, ArrowRight, RefreshCw, Loader2, ChevronDown, ChevronUp, BookOpen, FileText } from 'lucide-react';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { EbookMetadata } from '../store/ebook-writer-store';
import { useRouter } from 'next/navigation';

interface OutlineTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
  credits: number;
}

export function OutlineTab({ ebook, isGenerating: _isGenerating, error: _error, credits }: OutlineTabProps) {
  const router = useRouter();
  const { 
    setActiveTab, 
    generateOutline,
    current_ebook,
    generation_progress,
  } = useEbookWriterStore();
  
  const [preferences] = useState({
    word_count_preference: 'medium',
    complexity: 'intermediate',
    writing_tone: 'professional'
  });
  const [hasGeneratedOutline, setHasGeneratedOutline] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  
  // Auto-generate outline when tab is opened for the first time
  useEffect(() => {
    if (ebook?.title && !current_ebook?.outline && !hasGeneratedOutline && !generation_progress.is_generating) {
      setHasGeneratedOutline(true);
      generateOutline(preferences);
    }
  }, []);
  
  const handleGenerateOutline = async () => {
    if (credits < 10) return;
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

  const toggleChapter = (index: number) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedChapters(newExpanded);
  };

  const toggleAllChapters = () => {
    if (expandedChapters.size === chapters.length) {
      setExpandedChapters(new Set());
    } else {
      setExpandedChapters(new Set(chapters.map((_, i) => i)));
    }
  };

  if (!ebook || !ebook.title) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-8 max-w-md text-center space-y-4">
          <List className="w-12 h-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-medium mb-2">No Title Selected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Please select a title first to generate an outline
            </p>
            <Button onClick={handleBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Title
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const chapters = current_ebook?.outline?.chapters || [];
  const chapterCount = chapters.length;
  const estimatedWords = chapterCount * 1500;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-hover">
        <div className="px-6 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">Chapter Outline</h2>
            <p className="text-muted-foreground mt-2">Review and refine your ebook structure</p>
          </div>

          {/* Title Display */}
          <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm font-medium text-primary">Selected Title:</p>
            <p className="text-base mt-1 font-semibold">{ebook.title}</p>
          </div>

          {/* Main Content Grid - Full Width */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Left Side - Chapter List (3 columns) */}
            <div className="xl:col-span-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-6 w-6 text-primary" />
                      <div>
                        <CardTitle>Chapters</CardTitle>
                        <CardDescription>Your ebook structure - {chapterCount} chapters</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {chapters.length > 0 && (
                        <Button
                          onClick={toggleAllChapters}
                          variant="outline"
                          size="sm"
                        >
                          {expandedChapters.size === chapters.length ? 'Collapse All' : 'Expand All'}
                        </Button>
                      )}
                      <Button
                        onClick={handleGenerateOutline}
                        variant="outline"
                        size="sm"
                        disabled={generation_progress.is_generating || credits < 10}
                      >
                        {generation_progress.is_generating ? (
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
                  </div>
                </CardHeader>
                <CardContent>
                  {generation_progress.is_generating && generation_progress.current_step === 'outline' ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center space-y-3">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                        <p className="text-sm text-muted-foreground">Creating your chapter outline...</p>
                        <p className="text-xs text-muted-foreground">This may take a moment...</p>
                      </div>
                    </div>
                  ) : chapters.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {chapters.map((chapter, index) => (
                        <div
                          key={index}
                          className="border-2 rounded-lg overflow-hidden transition-all hover:shadow-md"
                        >
                          <button
                            onClick={() => toggleChapter(index)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-sm line-clamp-1">{chapter.title}</p>
                                {!expandedChapters.has(index) && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                    {chapter.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            {expandedChapters.has(index) ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                          </button>
                          
                          {expandedChapters.has(index) && (
                            <div className="px-4 py-3 border-t bg-muted/10">
                              <div className="space-y-3 pl-10">
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Overview</p>
                                  <p className="text-xs">{chapter.description}</p>
                                </div>
                                {chapter.subtopics && chapter.subtopics.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Key Topics</p>
                                    <ul className="space-y-1">
                                      {chapter.subtopics.map((subtopic, subIndex) => (
                                        <li key={subIndex} className="flex items-start gap-1">
                                          <span className="text-primary mt-0.5 text-xs">•</span>
                                          <span className="text-xs">{subtopic}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        No outline generated yet. Click "Regenerate" to create one.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Side - Statistics (1 column) */}
            <div className="xl:col-span-1">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle className="text-lg">Outline Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-muted-foreground">Total Chapters</span>
                      <span className="font-semibold">{chapterCount}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-muted-foreground">Est. Word Count</span>
                      <span className="font-semibold">{estimatedWords.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-muted-foreground">Reading Time</span>
                      <span className="font-semibold">~{Math.ceil(estimatedWords / 200)} min</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">Credits Required</span>
                      <span className="font-semibold">10</span>
                    </div>
                  </div>

                  {credits < 10 && !generation_progress.is_generating && (
                    <div className="p-3 bg-destructive/10 rounded-lg">
                      <p className="text-xs text-destructive">
                        Insufficient credits. You need 10 credits to regenerate.
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <p className="text-xs font-medium mb-2">Next Steps:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Review each chapter</li>
                      <li>• Continue to content generation</li>
                      <li>• Each chapter will be written individually</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
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
            disabled={chapters.length === 0}
            className="min-w-[200px] bg-primary hover:bg-primary/90"
            size="lg"
          >
            Continue to Content
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}