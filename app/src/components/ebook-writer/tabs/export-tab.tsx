'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Book } from 'lucide-react';
import type { EbookMetadata } from '../store/ebook-writer-store';
import { GoogleDocsConnection } from '../components/google-docs-connection';
import { TabContentWrapper, TabBody } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

interface ExportTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
}

export function ExportTab({ ebook, isGenerating, error }: ExportTabProps) {
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'epub' | 'docx' | null>(null);
  
  // Convert ebook format for Google Docs export
  const convertedEbook = ebook && ebook.outline ? {
    title: ebook.title,
    author: 'Your Name', // TODO: Get from user profile
    chapters: ebook.outline.chapters.map(chapter => ({
      title: chapter.title,
      content: chapter.content || 'Chapter content will be generated here...'
    })),
    cover: ebook.cover ? {
      image_url: ebook.cover.image_url
    } : undefined
  } : null;

  const exportFormats = [
    {
      id: 'pdf' as const,
      name: 'PDF',
      description: 'Professional format for printing and sharing',
      icon: '📄',
      status: 'coming_soon' as const
    },
    {
      id: 'epub' as const,
      name: 'EPUB',
      description: 'Standard ebook format for e-readers',
      icon: '📚',
      status: 'coming_soon' as const
    },
    {
      id: 'docx' as const,
      name: 'Word Document',
      description: 'Microsoft Word format for editing',
      icon: '📝',
      status: 'coming_soon' as const
    }
  ];

  const handleExport = (format: 'pdf' | 'epub' | 'docx') => {
    setSelectedFormat(format);
    // TODO: Implement export functionality
    console.log(`Exporting as ${format}`);
  };

  return (
    <TabContentWrapper>
      <TabBody>
        <StandardStep
          stepNumber={1}
          title="Google Docs Export"
          description="Export your ebook as a formatted Google Document"
        >
          <GoogleDocsConnection 
            ebook={convertedEbook}
          />
        </StandardStep>

        <StandardStep
          stepNumber={2}
          title="Download Formats"
          description="Additional export formats (coming soon)"
        >
          <div className="grid gap-4">
            {exportFormats.map((format) => (
              <Card 
                key={format.id}
                className={`transition-all duration-200 ${
                  format.status === 'coming_soon' 
                    ? 'opacity-60 cursor-not-allowed' 
                    : 'cursor-pointer hover:shadow-md hover:bg-muted/50'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{format.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{format.name}</h3>
                          {format.status === 'coming_soon' && (
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{format.description}</p>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={format.status === 'coming_soon' || !ebook || isGenerating}
                      onClick={() => handleExport(format.id)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </StandardStep>

        {/* Error Display */}
        {error && (
          <Card className="p-4 border-destructive bg-destructive/5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-destructive" />
              <span className="font-medium text-sm">Export Error</span>
            </div>
            <p className="text-sm text-destructive mt-2">{error}</p>
          </Card>
        )}

        {/* Status Display */}
        {!ebook && !isGenerating && (
          <Card className="p-4 bg-blue-50 dark:bg-blue-950/20">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Book className="w-4 h-4" />
              <span className="font-medium text-sm">Complete Your Ebook First</span>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
              Generate your ebook content from the previous tabs to enable export options.
            </p>
          </Card>
        )}
      </TabBody>
    </TabContentWrapper>
  );
}