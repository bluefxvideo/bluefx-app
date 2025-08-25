'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  List, 
  BookOpen, 
  FileText, 
  MoreVertical, 
  RotateCcw,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Trash2,
  Plus,
  Edit2
} from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { EbookChapter, EbookSubsection, EbookMetadata } from '../store/ebook-writer-store';
import type { UploadedDocument } from '@/actions/tools/ebook-document-handler';

interface OutlineOutputProps {
  ebook: EbookMetadata | null;
  uploadedDocuments: UploadedDocument[];
}

export function OutlineOutput({ ebook, uploadedDocuments }: OutlineOutputProps) {
  const { 
    clearCurrentProject,
    updateChapter,
    addSubsection,
    removeSubsection,
    reorderChapters,
    removeChapter,
    setActiveTab,
    generation_progress
  } = useEbookWriterStore();
  
  const [editingChapter, setEditingChapter] = useState<string | null>(null);
  const [editingSubsection, setEditingSubsection] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());

  const handleStartOver = async () => {
    if (confirm('Are you sure you want to start over? This will clear all progress and delete your session.')) {
      try {
        const { createClient } = await import('@/app/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          await clearCurrentProject(user.id);
          setActiveTab('topic');
          window.location.href = '/dashboard/ebook-writer';
        }
      } catch (error) {
        console.error('Error starting over:', error);
      }
    }
  };

  const handleChapterEdit = (chapterId: string, newTitle: string) => {
    updateChapter(chapterId, { title: newTitle });
    setEditingChapter(null);
  };

  const handleChapterDescriptionEdit = (chapterId: string, newDescription: string) => {
    updateChapter(chapterId, { description: newDescription });
    setEditingDescription(null);
  };

  const handleSubsectionEdit = (chapterId: string, subsectionId: string, newTitle: string) => {
    const chapter = ebook?.outline?.chapters.find(c => c.id === chapterId);
    if (chapter) {
      const updatedSubsections = chapter.subsections.map(sub =>
        sub.id === subsectionId ? { ...sub, title: newTitle } : sub
      );
      updateChapter(chapterId, { subsections: updatedSubsections });
    }
    setEditingSubsection(null);
  };

  const toggleChapterCollapse = (chapterId: string) => {
    const newCollapsed = new Set(collapsedChapters);
    if (newCollapsed.has(chapterId)) {
      newCollapsed.delete(chapterId);
    } else {
      newCollapsed.add(chapterId);
    }
    setCollapsedChapters(newCollapsed);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('chapterIndex', index.toString());
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('chapterIndex'));
    if (dragIndex !== dropIndex) {
      reorderChapters(dragIndex, dropIndex);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Empty state when no outline
  if (!ebook?.outline) {
    return (
      <OutputPanelShell
        title="Chapter Outline"
        subtitle="Your AI-generated chapter structure"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleStartOver} className="text-red-600">
                <RotateCcw className="mr-2 h-4 w-4" />
                Start Over
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <UnifiedEmptyState
          icon={List}
          title={generation_progress.is_generating ? "Generating outline..." : "No outline yet"}
          description={generation_progress.is_generating ? "Creating your chapter structure" : "Your chapter outline will appear here"}
        />
      </OutputPanelShell>
    );
  }

  const { outline } = ebook;
  const totalWords = outline.estimated_word_count || 0;
  const totalChapters = outline.chapters?.length || 0;

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Chapter Outline</h2>
            <p className="text-sm text-muted-foreground">{totalChapters} chapters • ~{totalWords.toLocaleString()} words</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleStartOver} className="text-red-600">
                <RotateCcw className="mr-2 h-4 w-4" />
                Start Over
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-visible scrollbar-hover space-y-4">
        {/* Ebook Info Card */}
      <Card className="mb-4 bg-muted/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">{ebook.title || 'Untitled Ebook'}</CardTitle>
              <p className="text-sm text-muted-foreground">{ebook.topic}</p>
            </div>
          </div>
        </CardHeader>
        {uploadedDocuments.length > 0 && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{uploadedDocuments.length} reference document{uploadedDocuments.length > 1 ? 's' : ''}</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Outline Preferences */}
      <Card className="mb-4 bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{outline.complexity_level} level</Badge>
            <Badge variant="secondary">{outline.writing_tone} tone</Badge>
            {outline.include_images && <Badge variant="secondary">With images</Badge>}
            {outline.include_ctas && <Badge variant="secondary">With CTAs</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Chapters List */}
      <div className="space-y-3">
        {outline.chapters ? (
          outline.chapters.map((chapter, index) => {
            const isCollapsed = collapsedChapters.has(chapter.id);
          
          return (
            <Card
              key={chapter.id}
              className="overflow-hidden bg-muted/30"
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragOver={handleDragOver}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  {/* Drag Handle */}
                  <div className="cursor-grab mt-1 opacity-50 hover:opacity-100">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Collapse Toggle */}
                  <button
                    onClick={() => toggleChapterCollapse(chapter.id)}
                    className="mt-1"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  <div className="flex-1 space-y-2">
                    {/* Chapter Title */}
                    <div className="flex items-start justify-between">
                      {editingChapter === chapter.id ? (
                        <input
                          type="text"
                          defaultValue={chapter.title}
                          onBlur={(e) => handleChapterEdit(chapter.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleChapterEdit(chapter.id, e.currentTarget.value);
                            }
                          }}
                          className="flex-1 font-medium bg-transparent border-b border-primary outline-none"
                          autoFocus
                        />
                      ) : (
                        <h4
                          className="font-medium cursor-text hover:text-primary flex items-center gap-2"
                          onClick={() => setEditingChapter(chapter.id)}
                        >
                          <span className="text-muted-foreground">{index + 1}.</span>
                          {chapter.title}
                          <Edit2 className="h-3 w-3 opacity-0 hover:opacity-100" />
                        </h4>
                      )}
                      <button
                        onClick={() => removeChapter(chapter.id)}
                        className="text-destructive opacity-50 hover:opacity-100 ml-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Chapter Description */}
                    {!isCollapsed && (
                      <>
                        {editingDescription === chapter.id ? (
                          <textarea
                            defaultValue={chapter.description || ''}
                            onBlur={(e) => handleChapterDescriptionEdit(chapter.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleChapterDescriptionEdit(chapter.id, e.currentTarget.value);
                              }
                            }}
                            className="w-full text-sm text-muted-foreground italic bg-transparent border rounded px-2 py-1 outline-none resize-none"
                            rows={2}
                            autoFocus
                          />
                        ) : (
                          <p
                            className="text-sm text-muted-foreground italic cursor-text hover:text-foreground"
                            onClick={() => setEditingDescription(chapter.id)}
                          >
                            {chapter.description || 'Click to add description...'}
                          </p>
                        )}

                        {/* Subsections */}
                        {chapter.subsections && chapter.subsections.length > 0 && (
                          <div className="pl-6 space-y-1 mt-2">
                            {chapter.subsections.map((subsection) => (
                              <div key={subsection.id} className="flex items-center gap-2">
                                <span className="text-muted-foreground">•</span>
                                {editingSubsection === subsection.id ? (
                                  <input
                                    type="text"
                                    defaultValue={subsection.title}
                                    onBlur={(e) => handleSubsectionEdit(chapter.id, subsection.id, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSubsectionEdit(chapter.id, subsection.id, e.currentTarget.value);
                                      }
                                    }}
                                    className="flex-1 text-sm bg-transparent border-b border-primary outline-none"
                                    autoFocus
                                  />
                                ) : (
                                  <span
                                    className="text-sm cursor-text hover:text-primary flex-1"
                                    onClick={() => setEditingSubsection(subsection.id)}
                                  >
                                    {subsection.title}
                                  </span>
                                )}
                                <button
                                  onClick={() => removeSubsection(chapter.id, subsection.id)}
                                  className="text-destructive opacity-0 hover:opacity-100"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Subsection Button */}
                        <button
                          onClick={() => addSubsection(chapter.id)}
                          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mt-2"
                        >
                          <Plus className="h-3 w-3" />
                          Add Subsection
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No chapters found in outline</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}