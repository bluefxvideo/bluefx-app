'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookOpen, FileText, Sparkles, ArrowRight, MoreVertical, RotateCcw } from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { UploadedDocument } from '@/actions/tools/ebook-document-handler';

interface TopicPreviewProps {
  topic: string;
  documents: UploadedDocument[];
}

export function TopicPreview({ topic = '', documents = [] }: TopicPreviewProps) {
  const hasContent = topic && topic.trim().length > 0;
  const { setActiveTab, clearCurrentProject } = useEbookWriterStore();

  const handleStartOver = async () => {
    if (confirm('Are you sure you want to start over? This will clear all progress and delete your session.')) {
      try {
        // Get user ID from Supabase
        const { createClient } = await import('@/app/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          await clearCurrentProject(user.id);
          setActiveTab('topic');
          window.location.href = '/dashboard/ebook-writer';
        } else {
          console.warn('No user found for clearing session');
        }
      } catch (error) {
        console.error('Error starting over:', error);
      }
    }
  };

  // Three-dot menu for actions
  const actionsMenu = hasContent ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleStartOver} className="text-destructive">
          <RotateCcw className="mr-2 h-4 w-4" />
          Start Over
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;
  
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
    <OutputPanelShell title="Ebook Preview" status="ready" actions={actionsMenu}>
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