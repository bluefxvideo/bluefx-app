'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
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
  CheckCircle2,
  Eye,
  Code
} from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { EbookMetadata } from '../store/ebook-writer-store';
import ReactMarkdown from 'react-markdown';

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
  const contentRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

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

  const handleEditClick = () => {
    setIsEditing(true);
  };

  // Convert plain text back to markdown
  const convertToMarkdown = (html: string) => {
    // Create a temporary div to parse the HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    let markdown = '';
    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as HTMLElement;
        const tagName = elem.tagName.toLowerCase();
        const children = Array.from(elem.childNodes).map(processNode).join('');
        
        switch (tagName) {
          case 'h1': return `# ${children}\n\n`;
          case 'h2': return `## ${children}\n\n`;
          case 'h3': return `### ${children}\n\n`;
          case 'p': return `${children}\n\n`;
          case 'strong':
          case 'b': return `**${children}**`;
          case 'em':
          case 'i': return `*${children}*`;
          case 'ul': return children + '\n';
          case 'ol': return children + '\n';
          case 'li': return `- ${children}\n`;
          case 'br': return '\n';
          case 'div': return children + (children.endsWith('\n') ? '' : '\n');
          default: return children;
        }
      }
      
      return '';
    };
    
    markdown = Array.from(temp.childNodes).map(processNode).join('');
    
    // Clean up extra newlines
    markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
    
    return markdown;
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
      <div className="flex-shrink-0 p-4 border-b border-border bg-muted/30">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">
              Chapter {chapterIndex + 1}: {selectedChapter.title}
            </h2>
            {selectedChapter.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
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
          </div>
        </div>

        {/* Action Bar */}
        {hasContent && (
          <div className="flex items-center gap-2 mt-3">
            {!isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEditClick}
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSkip}
                >
                  <SkipForward className="h-3 w-3 mr-1" />
                  Skip
                </Button>
              </>
            ) : (
              <>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hover p-4">
        {isEditing ? (
          // Visual editing mode - clean WYSIWYG editor
          <div className="h-full">
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded flex items-center justify-between">
                  <span></span>
                  <div className="flex items-center gap-2">
                    {/* Simple formatting toolbar */}
                    <button
                      type="button"
                      onClick={() => {
                        document.execCommand('bold', false);
                      }}
                      className="px-2 py-1 hover:bg-muted rounded text-xs font-bold"
                      title="Bold (Ctrl+B)"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        document.execCommand('italic', false);
                      }}
                      className="px-2 py-1 hover:bg-muted rounded text-xs italic"
                      title="Italic (Ctrl+I)"
                    >
                      I
                    </button>
                    <div className="w-px h-4 bg-border" />
                    <button
                      type="button"
                      onClick={() => {
                        document.execCommand('formatBlock', false, 'h1');
                      }}
                      className="px-2 py-1 hover:bg-muted rounded text-xs"
                      title="Heading 1"
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        document.execCommand('formatBlock', false, 'h2');
                      }}
                      className="px-2 py-1 hover:bg-muted rounded text-xs"
                      title="Heading 2"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        document.execCommand('formatBlock', false, 'p');
                      }}
                      className="px-2 py-1 hover:bg-muted rounded text-xs"
                      title="Paragraph"
                    >
                      P
                    </button>
                    <div className="w-px h-4 bg-border" />
                    <button
                      type="button"
                      onClick={() => {
                        document.execCommand('insertUnorderedList', false);
                      }}
                      className="px-2 py-1 hover:bg-muted rounded text-xs"
                      title="Bullet List"
                    >
                      •
                    </button>
                  </div>
                </div>
                <Card className="p-6">
                  <div 
                    ref={editorRef}
                    className="prose prose-sm dark:prose-invert max-w-none min-h-[400px] focus:outline-none [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-4 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mb-3 [&>h2]:mt-4 [&>h3]:text-lg [&>h3]:font-medium [&>h3]:mb-3 [&>h3]:mt-4 [&>p]:mb-4 [&>p]:leading-relaxed [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&>ul]:space-y-1 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4 [&>ol]:space-y-1"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      // Store the HTML content temporarily
                      const html = e.currentTarget.innerHTML;
                      // Convert to markdown for storage
                      const markdown = convertToMarkdown(html);
                      setEditContent(markdown);
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: (() => {
                        // Render the markdown as HTML for editing
                        // This creates a clean visual editing experience
                        const paragraphs = editContent.split(/\n\n+/);
                        let html = '';
                        let inList = false;
                        
                        for (const paragraph of paragraphs) {
                          const lines = paragraph.split('\n');
                          
                          for (const line of lines) {
                            const trimmedLine = line.trim();
                            
                            if (!trimmedLine) continue;
                            
                            // Close list if needed
                            if (inList && !trimmedLine.match(/^[-*+]\s+/) && !trimmedLine.match(/^\d+\.\s+/)) {
                              html += '</ul>';
                              inList = false;
                            }
                            
                            // Headers - with proper spacing
                            if (trimmedLine.startsWith('### ')) {
                              const content = trimmedLine.slice(4)
                                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*([^*]+)\*/g, '<em>$1</em>');
                              html += `<h3 class="text-lg font-medium mb-3 mt-4">${content}</h3>`;
                            } else if (trimmedLine.startsWith('## ')) {
                              const content = trimmedLine.slice(3)
                                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*([^*]+)\*/g, '<em>$1</em>');
                              html += `<h2 class="text-xl font-semibold mb-3 mt-4">${content}</h2>`;
                            } else if (trimmedLine.startsWith('# ')) {
                              const content = trimmedLine.slice(2)
                                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*([^*]+)\*/g, '<em>$1</em>');
                              html += `<h1 class="text-2xl font-bold mb-4 mt-4">${content}</h1>`;
                            }
                            // Lists
                            else if (trimmedLine.match(/^[-*+]\s+/)) {
                              if (!inList) {
                                html += '<ul class="list-disc pl-6 mb-4 space-y-1">';
                                inList = true;
                              }
                              const content = trimmedLine.replace(/^[-*+]\s+/, '')
                                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*([^*]+)\*/g, '<em>$1</em>');
                              html += `<li>${content}</li>`;
                            }
                            // Regular paragraph
                            else {
                              // Process inline formatting - handle nested asterisks properly
                              let processed = trimmedLine;
                              
                              // Process bold first (double asterisks)
                              processed = processed.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
                              
                              // Then process italic (single asterisks) - but not those that are part of bold
                              processed = processed.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
                              
                              // Process inline code
                              processed = processed.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-muted rounded text-sm">$1</code>');
                              
                              html += `<p class="mb-4 leading-relaxed">${processed}</p>`;
                            }
                          }
                        }
                        
                        if (inList) {
                          html += '</ul>';
                        }
                        
                        return html || '<p class="mb-4">Start typing your chapter content...</p>';
                      })()
                    }}
                  />
                </Card>
              </div>
          </div>
        ) : hasContent ? (
          // Display content with rendered markdown
          <Card 
            className="cursor-text hover:bg-muted/30 transition-colors"
            onClick={handleEditClick}
          >
            <div className="p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    // Custom renderers to make it look nice
                    h1: ({children}) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
                    h2: ({children}) => <h2 className="text-xl font-semibold mb-3">{children}</h2>,
                    h3: ({children}) => <h3 className="text-lg font-medium mb-2">{children}</h3>,
                    p: ({children}) => <p className="mb-4 leading-relaxed">{children}</p>,
                    ul: ({children}) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
                    ol: ({children}) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
                    li: ({children}) => <li className="mb-1">{children}</li>,
                    strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                    em: ({children}) => <em className="italic">{children}</em>,
                    blockquote: ({children}) => (
                      <blockquote className="border-l-4 border-primary/30 pl-4 italic my-4">
                        {children}
                      </blockquote>
                    ),
                    code: ({inline, children}) => 
                      inline ? (
                        <code className="px-1 py-0.5 bg-muted rounded text-sm">{children}</code>
                      ) : (
                        <pre className="bg-muted p-3 rounded overflow-x-auto">
                          <code className="text-sm">{children}</code>
                        </pre>
                      ),
                  }}
                >
                  {selectedChapter.content}
                </ReactMarkdown>
              </div>
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center">
                  Click anywhere to edit this chapter
                </p>
              </div>
            </div>
          </Card>
        ) : isSkipped ? (
          <Card className="bg-muted/30">
            <div className="p-6">
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
            </div>
          </Card>
        ) : (
          <Card className="bg-muted/30">
            <div className="p-6">
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
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}