'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  Edit2, 
  Save, 
  X,
  SkipForward,
  Sparkles,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { EbookMetadata } from '../store/ebook-writer-store';

interface ContentOutputProps {
  ebook: EbookMetadata | null;
}

export function ContentOutput({ ebook }: ContentOutputProps) {
  const { 
    updateChapterContent,
    generateChapterContent,
    selected_chapter_id
  } = useEbookWriterStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Find the selected chapter
  const selectedChapter = ebook?.outline?.chapters.find(ch => ch.id === selected_chapter_id);

  // Update edit content when chapter selection changes
  useEffect(() => {
    if (selectedChapter?.content && selectedChapter.content !== '<!SKIPPED!>') {
      setEditContent(selectedChapter.content);
    } else {
      setEditContent('');
    }
    setIsEditing(false);
  }, [selected_chapter_id, selectedChapter?.content]);

  const handleSave = () => {
    if (selected_chapter_id && editContent !== selectedChapter?.content) {
      updateChapterContent(selected_chapter_id, editContent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(selectedChapter?.content || '');
    setIsEditing(false);
  };

  const handleGenerate = async () => {
    if (!selected_chapter_id) return;
    setIsGenerating(true);
    try {
      await generateChapterContent(selected_chapter_id);
      setEditContent(selectedChapter?.content || '');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSkip = () => {
    if (selected_chapter_id) {
      const newContent = selectedChapter?.content === '<!SKIPPED!>' ? '' : '<!SKIPPED!>';
      updateChapterContent(selected_chapter_id, newContent);
    }
  };

  // No chapter selected
  if (!selected_chapter_id || !selectedChapter) {
    return (
      <OutputPanelShell
        title="Chapter Content"
        subtitle="Select a chapter to view or edit content"
      >
        <UnifiedEmptyState
          icon={BookOpen}
          title="No Chapter Selected"
          description="Select a chapter from the list to view or edit its content"
        />
      </OutputPanelShell>
    );
  }

  const isSkipped = selectedChapter.content === '<!SKIPPED!>';
  const hasContent = selectedChapter.content && selectedChapter.content !== '' && !isSkipped;
  const chapterIndex = ebook?.outline?.chapters.findIndex(ch => ch.id === selected_chapter_id) || 0;

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-border bg-muted/30">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">
              Chapter {chapterIndex + 1}: {selectedChapter.title}
            </h2>
            {selectedChapter.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedChapter.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
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
            {!isEditing && hasContent && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
            {!isEditing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSkip}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-visible scrollbar-hover">
        <div className="p-6">
          <div className="space-y-4">
        {/* Content Area */}
        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[400px] font-mono text-sm resize-none"
              placeholder="Enter chapter content..."
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={handleCancel}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
              >
                <Save className="h-4 w-4 mr-1" />
                Save Changes
              </Button>
            </div>
          </div>
        ) : hasContent ? (
          <Card>
            <CardContent className="pt-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm">
                  {selectedChapter.content}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : isSkipped ? (
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <SkipForward className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">Chapter Skipped</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This chapter has been marked as skipped
                </p>
                <Button
                  variant="outline"
                  onClick={handleSkip}
                >
                  Unskip Chapter
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Content Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate content for this chapter based on your outline
                </p>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Content
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}