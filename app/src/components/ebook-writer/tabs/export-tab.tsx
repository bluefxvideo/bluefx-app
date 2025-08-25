'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Book, ArrowLeft } from 'lucide-react';
import type { EbookMetadata } from '../store/ebook-writer-store';
import { useEbookWriterStore } from '../store/ebook-writer-store';
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
  const { setActiveTab } = useEbookWriterStore();

  // Check what step we need to go back to
  if (!ebook?.topic) {
    return (
      <TabContentWrapper>
        <TabBody>
          <div className="h-full flex items-center justify-center">
            <Card className="max-w-md text-center bg-gray-50 dark:bg-gray-800/30">
              <CardContent className="pt-6">
                <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No Topic Selected</h3>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('topic')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Topic
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabBody>
      </TabContentWrapper>
    );
  }

  if (!ebook?.title) {
    return (
      <TabContentWrapper>
        <TabBody>
          <div className="h-full flex items-center justify-center">
            <Card className="max-w-md text-center bg-gray-50 dark:bg-gray-800/30">
              <CardContent className="pt-6">
                <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No Title Selected</h3>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('title')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Title
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabBody>
      </TabContentWrapper>
    );
  }

  if (!ebook?.outline) {
    return (
      <TabContentWrapper>
        <TabBody>
          <div className="h-full flex items-center justify-center">
            <Card className="max-w-md text-center bg-gray-50 dark:bg-gray-800/30">
              <CardContent className="pt-6">
                <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No Outline Created</h3>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('outline')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Outline
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabBody>
      </TabContentWrapper>
    );
  }

  // Check if content is generated
  const hasContent = ebook?.outline?.chapters?.some(chapter => chapter.content && chapter.content.trim() !== '');
  
  if (!hasContent) {
    return (
      <TabContentWrapper>
        <TabBody>
          <div className="h-full flex items-center justify-center">
            <Card className="max-w-md text-center bg-gray-50 dark:bg-gray-800/30">
              <CardContent className="pt-6">
                <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No Content Generated</h3>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('content')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Content
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabBody>
      </TabContentWrapper>
    );
  }
  
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

      </TabBody>
    </TabContentWrapper>
  );
}