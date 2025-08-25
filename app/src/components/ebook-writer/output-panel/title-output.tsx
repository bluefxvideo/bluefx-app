'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Type, BookOpen, Sparkles, ArrowLeft } from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { TitleOptions, EbookMetadata } from '../store/ebook-writer-store';

interface TitleOutputProps {
  titleOptions: TitleOptions | null;
  isGenerating: boolean;
  topic?: string;
  ebook?: EbookMetadata | null;
}

export function TitleOutput({ titleOptions, isGenerating, topic = '', ebook }: TitleOutputProps) {
  const { setActiveTab } = useEbookWriterStore();
  
  // Show empty state when no topic
  if (!topic || !topic.trim()) {
    return (
      <OutputPanelShell 
        title="Ebook Preview" 
        status="idle"
        empty={
          <div className="flex items-center justify-center h-full">
            <UnifiedEmptyState
              icon={Type}
              title="No Topic Selected"
              description="Choose a topic first to generate title options"
              action={
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('topic')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Topic
                </Button>
              }
            />
          </div>
        }
      />
    );
  }
  
  return (
    <OutputPanelShell title="Ebook Preview" status="ready">
      <div className="space-y-4 p-4">
        {/* Topic Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Topic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {topic}
            </p>
          </CardContent>
        </Card>

        {/* Title Card */}
        <Card className={ebook?.title ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Type className="h-5 w-5 text-green-500" />
              Title
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ebook?.title ? (
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {ebook.title}
              </p>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 italic">
                {isGenerating ? 'Generating titles...' : 'Select a title from the options'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Placeholder for Outline */}
        <Card className="opacity-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-gray-400">
              <Sparkles className="h-5 w-5" />
              Outline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 italic">Not created yet</p>
          </CardContent>
        </Card>
      </div>
    </OutputPanelShell>
  );
}