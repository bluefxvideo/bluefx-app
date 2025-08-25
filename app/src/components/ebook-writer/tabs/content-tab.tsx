'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  ArrowRight,
  ChevronDown, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  SkipForward,
  BookOpen,
  Sparkles,
  Play
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { EbookMetadata, EbookChapter } from '../store/ebook-writer-store';

interface ContentTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
}

export function ContentTab({ ebook }: ContentTabProps) {
  const router = useRouter();
  const { 
    setActiveTab,
    generateChapterContent,
    updateChapterContent,
    setSelectedChapter
  } = useEbookWriterStore();

  // Local state for UI
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [generatingChapters, setGeneratingChapters] = useState<Set<string>>(new Set());
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  // Navigate back handlers
  const handleBack = () => {
    setActiveTab('outline');
    router.push('/dashboard/ebook-writer/outline');
  };

  const handleContinue = () => {
    setActiveTab('cover');
    router.push('/dashboard/ebook-writer/cover');
  };

  // Check what step we need to go back to
  if (!ebook?.outline) {
    return (
      <TabContentWrapper>
        <TabBody>
          <div className="h-full flex items-center justify-center">
            <Card className="max-w-md text-center bg-gray-50 dark:bg-gray-800/30">
              <CardContent className="pt-6">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No Outline Created</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Please create an outline first before generating content.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setActiveTab('outline');
                    router.push('/dashboard/ebook-writer/outline');
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Outline
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabBody>
      </TabContentWrapper>
    );
  }

  const chapters = ebook.outline.chapters || [];
  const totalChapters = chapters.length;
  const completedChapters = chapters.filter(ch => ch.content && ch.content !== '<!SKIPPED!>').length;
  const skippedChapters = chapters.filter(ch => ch.content === '<!SKIPPED!>').length;
  const progressPercentage = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;

  // Toggle chapter expansion
  const toggleChapter = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  // Handle chapter selection for right panel
  const handleSelectChapter = (chapter: EbookChapter) => {
    setSelectedChapterId(chapter.id);
    setSelectedChapter(chapter.id);
    // Also expand the chapter when selected
    setExpandedChapters(prev => new Set(prev).add(chapter.id));
  };

  // Handle content generation for a single chapter
  const handleGenerateChapter = async (chapter: EbookChapter) => {
    setGeneratingChapters(prev => new Set(prev).add(chapter.id));
    try {
      await generateChapterContent(chapter.id);
      // Auto-select and expand chapter after generation
      handleSelectChapter(chapter);
    } finally {
      setGeneratingChapters(prev => {
        const next = new Set(prev);
        next.delete(chapter.id);
        return next;
      });
    }
  };

  // Handle skip/unskip
  const handleSkipChapter = (chapter: EbookChapter) => {
    const newContent = chapter.content === '<!SKIPPED!>' ? '' : '<!SKIPPED!>';
    updateChapterContent(chapter.id, newContent);
  };

  // Generate all content
  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    const chaptersToGenerate = chapters.filter(ch => !ch.content || ch.content === '');
    
    for (const chapter of chaptersToGenerate) {
      if (chapter.content !== '<!SKIPPED!>') {
        await handleGenerateChapter(chapter);
      }
    }
    setIsGeneratingAll(false);
  };

  // Generate remaining (non-skipped, non-generated)
  const handleGenerateRemaining = async () => {
    setIsGeneratingAll(true);
    const chaptersToGenerate = chapters.filter(ch => 
      (!ch.content || ch.content === '') && ch.content !== '<!SKIPPED!>'
    );
    
    for (const chapter of chaptersToGenerate) {
      await handleGenerateChapter(chapter);
    }
    setIsGeneratingAll(false);
  };

  return (
    <TabContentWrapper>
      <TabBody>
        <div className="space-y-4">
          {/* Header */}
          <div>
            <h2 className="text-xl font-bold mb-2">Generate Content</h2>
            <p className="text-sm text-muted-foreground">
              Generate and edit content for each chapter
            </p>
          </div>

          {/* Progress and Actions */}
          <Card className="p-4 bg-muted/30">
            <div className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>{completedChapters} of {totalChapters} chapters complete</span>
                  {skippedChapters > 0 && (
                    <span className="text-muted-foreground">{skippedChapters} skipped</span>
                  )}
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {/* Bulk Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={handleGenerateAll}
                  disabled={isGeneratingAll || completedChapters === totalChapters}
                  size="sm"
                >
                  {isGeneratingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate All
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={handleGenerateRemaining}
                  disabled={isGeneratingAll || (completedChapters + skippedChapters) === totalChapters}
                  variant="outline"
                  size="sm"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Generate Remaining
                </Button>
              </div>
            </div>
          </Card>

          {/* Chapters Accordion List */}
          <div className="space-y-3">
            {chapters.map((chapter, index) => {
              const isExpanded = expandedChapters.has(chapter.id);
              const isSelected = selectedChapterId === chapter.id;
              const isGenerating = generatingChapters.has(chapter.id);
              const isSkipped = chapter.content === '<!SKIPPED!>';
              const hasContent = chapter.content && chapter.content !== '' && !isSkipped;

              return (
                <Card 
                  key={chapter.id}
                  className={`overflow-hidden ${
                    isSelected ? 'ring-2 ring-primary' : ''
                  } ${
                    hasContent ? 'bg-green-50/30 dark:bg-green-900/10 border-green-200 dark:border-green-800' :
                    isSkipped ? 'bg-gray-50/50 dark:bg-gray-900/20 opacity-60' :
                    'bg-muted/30'
                  }`}
                >
                  {/* Chapter Header */}
                  <CardHeader 
                    className="cursor-pointer"
                    onClick={() => {
                      toggleChapter(chapter.id);
                      handleSelectChapter(chapter);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button className="p-0" onClick={(e) => {
                          e.stopPropagation();
                          toggleChapter(chapter.id);
                        }}>
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                        <div>
                          <h3 className="text-lg font-semibold">
                            Chapter {index + 1}: {chapter.title}
                          </h3>
                          {chapter.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {chapter.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Chapter Actions */}
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {hasContent && (
                          <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Complete
                          </Badge>
                        )}
                        
                        {isSkipped && (
                          <Badge variant="secondary">
                            <SkipForward className="h-3 w-3 mr-1" />
                            Skipped
                          </Badge>
                        )}

                        {!hasContent && !isSkipped && (
                          <Button
                            size="sm"
                            onClick={() => handleGenerateChapter(chapter)}
                            disabled={isGenerating || isGeneratingAll}
                          >
                            {isGenerating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-1" />
                                Generate
                              </>
                            )}
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSkipChapter(chapter)}
                        >
                          {isSkipped ? (
                            <Play className="h-4 w-4" />
                          ) : (
                            <SkipForward className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Expanded Content Preview */}
                  {isExpanded && (
                    <CardContent className="pt-0">
                      {hasContent ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <div className="text-sm text-muted-foreground line-clamp-3 bg-white dark:bg-gray-900 p-3 rounded border">
                            {chapter.content.substring(0, 200)}...
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Click to view and edit full content in the right panel →
                          </p>
                        </div>
                      ) : isSkipped ? (
                        <div className="text-center py-4 text-muted-foreground">
                          <SkipForward className="h-6 w-6 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">This chapter has been skipped</p>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <BookOpen className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No content generated yet</p>
                        </div>
                      )}

                      {/* Show subsections if available */}
                      {chapter.subsections && chapter.subsections.length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Sections:</p>
                          {chapter.subsections.map((section, idx) => (
                            <div key={section.id} className="text-xs text-muted-foreground">
                              {idx + 1}. {section.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
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
            disabled={completedChapters === 0}
            className="flex-1 bg-primary"
          >
            Continue to Cover
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </TabFooter>
    </TabContentWrapper>
  );
}