'use client';

import NextImage from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  FileText, 
  Image, 
  Download, 
  Clock,
  Sparkles,
  Trash2
} from 'lucide-react';
import type { EbookMetadata } from '../store/ebook-writer-store';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';

interface EbookOutputProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
  activeTab: string;
}

export function EbookOutput({ ebook, isGenerating, error, activeTab }: EbookOutputProps) {
  const getStatus = () => {
    if (isGenerating) return 'loading';
    if (error) return 'error';
    if (!ebook) return 'idle';
    return 'ready';
  };

  const renderEmpty = () => {
    switch (activeTab) {
      case 'topic':
        return (
          <div className="flex items-center justify-center h-full">
            <UnifiedEmptyState
              icon={BookOpen}
              title="Choose Your Topic"
              description="Start by selecting what your ebook will be about to begin the creation process."
            />
          </div>
        );
      case 'outline':
        return (
          <div className="flex items-center justify-center h-full">
            <UnifiedEmptyState
              icon={BookOpen}
              title="No Outline Ready"
              description="Create a topic and title first to generate your ebook outline."
            />
          </div>
        );
      case 'content':
        return (
          <div className="flex items-center justify-center h-full">
            <UnifiedEmptyState
              icon={FileText}
              title="No Content Generated"
              description="Complete the outline step to start generating ebook content."
            />
          </div>
        );
      case 'cover':
        return (
          <div className="flex items-center justify-center h-full">
            <UnifiedEmptyState
              icon={Image}
              title="No Cover Created"
              description="Generate content first before creating your ebook cover."
            />
          </div>
        );
      case 'export':
        return (
          <div className="flex items-center justify-center h-full">
            <UnifiedEmptyState
              icon={Download}
              title="Ready to Export"
              description="Complete your ebook to export in various formats."
            />
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <UnifiedEmptyState
              icon={BookOpen}
              title="Choose Your Topic"
              description="Start by selecting what your ebook will be about to begin the creation process."
            />
          </div>
        );
    }
  };

  if (!ebook) {
    return (
      <OutputPanelShell
        title="Ebook Results"
        status={getStatus()}
        errorMessage={error}
        empty={renderEmpty()}
      />
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-blue-100';
      case 'in_progress': return 'bg-blue-500';
      case 'draft': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getCompletionPercentage = () => {
    if (!ebook.outline) return 0;
    const totalChapters = ebook.outline.chapters.length;
    const completedChapters = ebook.outline.chapters.filter(c => c.status === 'completed').length;
    return totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;
  };

  const renderContent = () => (
    <>
      {/* Main Ebook Card */}
      <Card >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-emerald-500" />
                {ebook.title || 'Untitled Ebook'}
              </CardTitle>
              <CardDescription className="mt-1">
                {ebook.topic && (
                  <span className="text-sm">Topic: {ebook.topic}</span>
                )}
              </CardDescription>
            </div>
            <Badge 
              className={`${getStatusColor(ebook.status)} text-white`}
            >
              {ebook.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          {ebook.outline && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(getCompletionPercentage())}%</span>
              </div>
              <Progress value={getCompletionPercentage()} className="h-2" />
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                Chapters
              </div>
              <div className="font-medium">
                {ebook.outline?.chapters.length || 0}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                Word Count
              </div>
              <div className="font-medium">
                {ebook.outline?.estimated_word_count?.toLocaleString() || '0'}
              </div>
            </div>
          </div>

          {/* Cover Preview */}
          {ebook.cover && (
            <div className="space-y-2">
              <div className="text-sm font-medium flex items-center gap-2">
                <Image className="h-4 w-4" aria-hidden="true" />
                Cover Image
              </div>
              <div className="relative">
                <NextImage 
                  src={ebook.cover.image_url} 
                  alt="Ebook Cover"
                  width={200}
                  height={300}
                  className="w-full max-w-[200px] rounded-lg shadow-md"
                />
              </div>
            </div>
          )}

          {/* Outline Preview */}
          {ebook.outline && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Chapter Outline</div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-hover">
                {ebook.outline.chapters.map((chapter, index) => (
                  <div 
                    key={chapter.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                  >
                    <span className="flex-1">{index + 1}. {chapter.title}</span>
                    <Badge 
                      variant={chapter.status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {chapter.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            {ebook.status === 'completed' && (
              <Button size="sm" className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-sm text-destructive">
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation Status */}
      {isGenerating && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="animate-spin">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">
                Generating content...
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );

  return (
    <OutputPanelShell
      title="Ebook Results"
      status={getStatus()}
      errorMessage={error}
      empty={renderEmpty()}
    >
      <div className="space-y-4">
        {renderContent()}
      </div>
    </OutputPanelShell>
  );
}