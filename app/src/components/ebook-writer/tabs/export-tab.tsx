'use client';

import { useState } from 'react';
import type { EbookMetadata } from '../store/ebook-writer-store';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { GoogleDocsConnection } from '../components/google-docs-connection';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { SharedEbookEmptyState } from '../components/shared-empty-state';
import { ProgressIndicator } from '../components/progress-indicator';
import { Download, FileText, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { generateAndDownloadPDF } from '@/lib/pdf-generator';
import { useRouter } from 'next/navigation';

interface ExportTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
}

export function ExportTab({ ebook, isGenerating, error }: ExportTabProps) {
  const router = useRouter();
  const { setActiveTab } = useEbookWriterStore();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Check what step we need to go back to
  if (!ebook?.topic) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={Download}
            title="No Topic Selected"
            backTo="topic"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }

  if (!ebook?.title) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={Download}
            title="No Title Selected"
            backTo="title"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }

  if (!ebook?.outline) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={Download}
            title="No Outline Created"
            backTo="outline"
          />
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
          <SharedEbookEmptyState
            icon={Download}
            title="No Content Generated"
            backTo="content"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }
  
  // Convert ebook format for export
  const convertedEbook = ebook && ebook.outline ? {
    title: ebook.title,
    author: ebook.cover?.author_name || '', // Get from cover settings
    chapters: ebook.outline.chapters.map(chapter => ({
      title: chapter.title,
      content: chapter.content || 'Chapter content will be generated here...'
    })),
    cover: ebook.cover ? {
      image_url: ebook.cover.image_url
    } : undefined
  } : null;

  const handleDownloadPDF = async () => {
    if (!convertedEbook) return;
    
    setIsGeneratingPDF(true);
    setPdfError(null);
    
    try {
      await generateAndDownloadPDF(convertedEbook);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleBack = () => {
    setActiveTab('cover');
    router.push('/dashboard/ebook-writer/cover');
  };

  const handleFinish = () => {
    setActiveTab('history');
    router.push('/dashboard/ebook-writer/history');
  };

  return (
    <TabContentWrapper>
      <TabBody>
        <div className="space-y-6">
          {/* PDF Download */}
          <StandardStep
            stepNumber={1}
            title="Download PDF"
            description="Get a simple, clean PDF of your ebook"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  PDF Export
                </CardTitle>
                <CardDescription>
                  Download your ebook as a PDF file that you can read, print, or share
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                  className="w-full"
                  size="lg"
                >
                  {isGeneratingPDF ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download as PDF
                    </>
                  )}
                </Button>
                {pdfError && (
                  <p className="text-sm text-destructive mt-2">{pdfError}</p>
                )}
              </CardContent>
            </Card>
          </StandardStep>

          {/* Google Docs Export - Coming Soon */}
          <StandardStep
            stepNumber={2}
            title="Export to Google Docs"
            description="Coming soon - Google Docs integration"
          >
            <GoogleDocsConnection 
              ebook={convertedEbook}
            />
          </StandardStep>
        </div>
      </TabBody>
      
      <TabFooter>
        <ProgressIndicator currentStep="export" className="mb-4" />
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleBack}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cover
          </Button>
          <Button 
            onClick={handleFinish}
            className="flex-1 bg-primary"
          >
            Finish
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </TabFooter>
    </TabContentWrapper>
  );
}