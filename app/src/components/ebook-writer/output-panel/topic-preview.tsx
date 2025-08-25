'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, FileText, Sparkles, ArrowRight } from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import type { UploadedDocument } from '@/actions/tools/ebook-document-handler';

interface TopicPreviewProps {
  topic: string;
  documents: UploadedDocument[];
}

export function TopicPreview({ topic = '', documents = [] }: TopicPreviewProps) {
  const hasContent = topic && topic.trim().length > 0;
  
  // Show empty state when no topic
  if (!hasContent) {
    return (
      <OutputPanelShell 
        title="Ebook Preview" 
        status="idle"
        empty={
          <div className="flex items-center justify-center h-full">
            <UnifiedEmptyState
              icon={BookOpen}
              title="No Topic Yet"
              description="Enter a topic to start creating your ebook"
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
            {documents.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {documents.length} reference document{documents.length > 1 ? 's' : ''} uploaded
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Placeholder cards for future steps */}
        <Card className="opacity-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-gray-400">
              <Sparkles className="h-5 w-5" />
              Title
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 italic">Not selected yet</p>
          </CardContent>
        </Card>

      </div>
    </OutputPanelShell>
  );
}