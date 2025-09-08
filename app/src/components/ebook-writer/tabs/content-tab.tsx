'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  ArrowRight,
  ChevronRight, 
  ChevronDown,
  Loader2, 
  CheckCircle2, 
  SkipForward,
  BookOpen,
  Sparkles,
  Play,
  FileText,
  Folder,
  FolderOpen
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { SharedEbookEmptyState } from '../components/shared-empty-state';
import type { EbookMetadata, EbookChapter } from '../store/ebook-writer-store';

interface ContentTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
  credits: number;
}

export function ContentTab({ ebook, credits }: ContentTabProps) {
  const router = useRouter();
  const { 
    setActiveTab,
    generateChapterContent,
    updateChapterContent,
    setSelectedChapter
  } = useEbookWriterStore();

  // Local state for UI
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
          <SharedEbookEmptyState
            icon={BookOpen}
            title="No Outline Created"
            message="Please create an outline first before generating content."
            backTo="outline"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }

  const chapters = ebook.outline.chapters || [];
  const totalChapters = chapters.length;
  const completedChapters = chapters.filter(ch => ch.content && ch.content !== '<!SKIPPED!>').length;
  const skippedChapters = chapters.filter(ch => ch.content === '<!SKIPPED!>').length;
  const remainingChapters = chapters.filter(ch => (!ch.content || ch.content === '') && ch.content !== '<!SKIPPED!>').length;

  const estimatedCreditsPerChapter = 15;

  // Handle chapter selection for right panel
  const handleSelectChapter = (chapter: EbookChapter) => {
    setSelectedChapterId(chapter.id);
    setSelectedChapter(chapter.id);
  };

  // Handle content generation for a single chapter
  const handleGenerateChapter = async (chapter: EbookChapter) => {
    if (credits < estimatedCreditsPerChapter) return;
    
    setGeneratingChapters(prev => new Set(prev).add(chapter.id));
    try {
      await generateChapterContent(chapter.id);
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
    const chaptersToGenerate = chapters.filter(ch => !ch.content || ch.content === '');
    const totalCreditsNeeded = chaptersToGenerate.length * estimatedCreditsPerChapter;
    
    if (credits < totalCreditsNeeded) return;
    
    setIsGeneratingAll(true);
    
    for (const chapter of chaptersToGenerate) {
      if (chapter.content !== '<!SKIPPED!>') {
        await handleGenerateChapter(chapter);
      }
    }
    setIsGeneratingAll(false);
  };

  // Generate remaining (non-skipped, non-generated)
  const handleGenerateRemaining = async () => {
    const chaptersToGenerate = chapters.filter(ch => 
      (!ch.content || ch.content === '') && ch.content !== '<!SKIPPED!>'
    );
    const totalCreditsNeeded = chaptersToGenerate.length * estimatedCreditsPerChapter;
    
    if (credits < totalCreditsNeeded) return;
    
    setIsGeneratingAll(true);
    
    for (const chapter of chaptersToGenerate) {
      await handleGenerateChapter(chapter);
    }
    setIsGeneratingAll(false);
  };

  return (
    <TabContentWrapper>
      <TabBody className="px-0">
        <div className="h-full flex flex-col">
          {/* Header with Bulk Actions */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold">Chapters</h3>
                <p className="text-sm text-muted-foreground">
                  {completedChapters}/{totalChapters} complete
                  {skippedChapters > 0 && ` • ${skippedChapters} skipped`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleGenerateAll}
                  disabled={isGeneratingAll || completedChapters === totalChapters || credits < (chapters.filter(ch => !ch.content || ch.content === '').length * estimatedCreditsPerChapter)}
                  size="sm"
                  variant="outline"
                >
                  {isGeneratingAll ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1 h-3 w-3" />
                      Generate All
                    </>
                  )}
                </Button>
                
                {remainingChapters > 0 && (
                  <Button 
                    onClick={handleGenerateRemaining}
                    disabled={isGeneratingAll || remainingChapters === 0 || credits < (remainingChapters * estimatedCreditsPerChapter)}
                    size="sm"
                    variant="outline"
                  >
                    <Play className="mr-1 h-3 w-3" />
                    Generate Remaining ({remainingChapters})
                  </Button>
                )}
              </div>
            </div>

            {/* Credit warning */}
            {remainingChapters > 0 && credits < (remainingChapters * estimatedCreditsPerChapter) && (
              <p className="text-xs text-destructive">
                Insufficient credits. Need {remainingChapters * estimatedCreditsPerChapter} credits.
              </p>
            )}
          </div>

          {/* File System Style Chapter List */}
          <div className="flex-1 overflow-y-auto scrollbar-hover px-4">
            <div className="space-y-1">
              {chapters.map((chapter, index) => {
                const isSelected = selectedChapterId === chapter.id;
                const isGenerating = generatingChapters.has(chapter.id);
                const isSkipped = chapter.content === '<!SKIPPED!>';
                const hasContent = chapter.content && chapter.content !== '' && !isSkipped;

                return (
                  <div
                    key={chapter.id}
                    className={`
                      group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer
                      transition-all hover:bg-muted/50
                      ${isSelected ? 'bg-primary/10 hover:bg-primary/15' : ''}
                    `}
                    onClick={() => handleSelectChapter(chapter)}
                  >
                    {/* Left side - Chapter info */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Folder icon */}
                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <FolderOpen className="h-4 w-4 text-primary" />
                        ) : (
                          <Folder className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      
                      {/* Chapter title */}
                      <span className={`
                        text-sm truncate flex-1
                        ${hasContent ? 'text-green-600 dark:text-green-400 font-medium' : ''}
                        ${isSkipped ? 'text-muted-foreground line-through' : ''}
                        ${isSelected ? 'font-medium' : ''}
                      `}>
                        {index + 1}. {chapter.title}
                      </span>

                      {/* Status badges */}
                      {hasContent && (
                        <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                      )}
                      {isSkipped && (
                        <SkipForward className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>

                    {/* Right side - Actions (visible on hover) */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      {!hasContent && !isSkipped && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleGenerateChapter(chapter)}
                          disabled={isGenerating || isGeneratingAll || credits < estimatedCreditsPerChapter}
                        >
                          {isGenerating ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3 mr-1" />
                              Generate
                            </>
                          )}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleSkipChapter(chapter)}
                      >
                        {isSkipped ? 'Unskip' : 'Skip'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
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
            disabled={completedChapters === 0 && skippedChapters === 0}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            Continue to Cover
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </TabFooter>
    </TabContentWrapper>
  );
}