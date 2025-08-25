'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { List, ArrowLeft } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { EbookMetadata } from '../store/ebook-writer-store';

interface OutlineTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
}

export function OutlineTab({ ebook, isGenerating: _isGenerating, error: _error }: OutlineTabProps) {
  const { setActiveTab } = useEbookWriterStore();

  if (!ebook || !ebook.title) {
    return (
      <TabContentWrapper>
        <TabBody>
          <div className="h-full flex items-center justify-center">
            <Card className="max-w-md text-center bg-gray-50 dark:bg-gray-800/30">
              <CardContent className="pt-6">
                <List className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No Title Selected</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Please select a title first to generate an outline.
                </p>
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

  return (
    <TabContentWrapper>
      <TabBody>
        <StandardStep
          stepNumber={1}
          title="Create Chapter Outline"
          description={`Ebook: ${ebook.title}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Outline generation functionality will be implemented here.
            </p>
          </div>
        </StandardStep>
      </TabBody>
    </TabContentWrapper>
  );
}