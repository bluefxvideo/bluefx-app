'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  console.log('🎯 TopicPreview render:', { topic, documents: documents.length, hasContent });
  
  return (
    <OutputPanelShell title="Ebook Preview" status="ready">
      <div className="space-y-4 p-4">
        {/* Topic Preview */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Your Ebook Topic
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasContent ? (
              <>
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
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400 italic">
                  Start typing your topic above...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* What Will Be Generated - Always show this */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              What You'll Get
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">1</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">5 Professional Titles</p>
                <p className="text-xs text-muted-foreground">AI-generated titles optimized for your audience</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">2</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Detailed Chapter Outline</p>
                <p className="text-xs text-muted-foreground">10-15 chapters with subsections</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">3</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Complete Content</p>
                <p className="text-xs text-muted-foreground">Full chapter content with your reference materials integrated</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">4</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Professional Cover</p>
                <p className="text-xs text-muted-foreground">AI-designed cover matching your content</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </OutputPanelShell>
  );
}