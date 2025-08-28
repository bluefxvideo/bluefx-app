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
import { Type, BookOpen, Sparkles, ArrowLeft, MoreVertical, RotateCcw, FileText } from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { TitleOptions, EbookMetadata } from '../store/ebook-writer-store';
import type { UploadedDocument } from '@/actions/tools/ebook-document-handler';

interface TitleOutputProps {
  titleOptions: TitleOptions | null;
  isGenerating: boolean;
  topic?: string;
  ebook?: EbookMetadata | null;
  uploadedDocuments?: UploadedDocument[];
}

export function TitleOutput({ titleOptions, isGenerating, topic = '', ebook, uploadedDocuments = [] }: TitleOutputProps) {
  const { setActiveTab, clearCurrentProject, selectTitle, setCustomTitle } = useEbookWriterStore();

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
  const actionsMenu = (
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
  );
  const handleTitleSelect = (titleIndex: number) => {
    selectTitle(titleIndex);
    // Could navigate to next step here
  };

  // Show generating state
  if (isGenerating) {
    return (
      <OutputPanelShell 
        title="Title Options" 
        status="loading"
      >
        <div className="p-4">
          <div className="text-center">
            <UnifiedEmptyState
              icon={Type}
              title="Generating Titles..."
              description="AI is creating engaging title options for your ebook"
            />
          </div>
        </div>
      </OutputPanelShell>
    );
  }

  // Show title options in the same format as popular topics
  if (titleOptions && titleOptions.options && titleOptions.options.length > 0) {
    return (
      <OutputPanelShell 
        title="Title Options" 
        status="ready"
        actions={actionsMenu}
      >
        <div className="p-4 space-y-2">
          <div className="space-y-2">
            {titleOptions.options.map((title, index) => (
              <div 
                key={index} 
                className={`p-4 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                  ebook?.title === title 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                    : 'border-border'
                }`}
                onClick={() => handleTitleSelect(index)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    ebook?.title === title
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {ebook?.title === title && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed font-medium">
                      {title}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </OutputPanelShell>
    );
  }

  // Show empty state when no titles generated yet
  return (
    <OutputPanelShell 
      title="Title Options" 
      status="idle"
    >
      <div className="p-4">
        <div className="flex items-center justify-center h-full">
          <UnifiedEmptyState
            icon={Type}
            title="Ready to Generate Titles"
            description="Click generate in the left panel to create title options for your ebook"
          />
        </div>
      </div>
    </OutputPanelShell>
  );
}