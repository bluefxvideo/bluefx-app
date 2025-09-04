'use client';

import { useRouter } from 'next/navigation';
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
import { SharedActionsMenu } from '../components/shared-actions-menu';
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
  const router = useRouter();
  const { selectTitle, setCustomTitle, setActiveTab } = useEbookWriterStore();
  
  const handleTitleSelect = (titleIndex: number) => {
    selectTitle(titleIndex);
    
    // Automatically navigate to outline tab
    setActiveTab('outline');
    router.push('/dashboard/ebook-writer/outline');
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
        actions={<SharedActionsMenu />}
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