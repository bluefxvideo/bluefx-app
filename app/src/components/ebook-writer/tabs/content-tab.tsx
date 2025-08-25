'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, ArrowLeft } from 'lucide-react';
import { TabContentWrapper, TabBody } from '@/components/tools/tab-content-wrapper';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { EbookMetadata } from '../store/ebook-writer-store';

interface ContentTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
}

export function ContentTab({ ebook, isGenerating: _isGenerating, error: _error }: ContentTabProps) {
  const { setActiveTab } = useEbookWriterStore();

  // Check what step we need to go back to
  if (!ebook?.topic) {
    return (
      <TabContentWrapper>
        <TabBody>
          <div className="h-full flex items-center justify-center">
            <Card className="max-w-md text-center bg-gray-50 dark:bg-gray-800/30">
              <CardContent className="pt-6">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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

  return (
    <TabContentWrapper>
      <TabBody>
        <div className="h-full overflow-y-auto scrollbar-hover space-y-6">
          <Card className="bg-gray-50 dark:bg-gray-800/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-500" />
                Generate Content
              </CardTitle>
              <CardDescription>
                Create detailed content for each chapter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Content generation functionality will be implemented here.
              </p>
            </CardContent>
          </Card>
        </div>
      </TabBody>
    </TabContentWrapper>
  );
}