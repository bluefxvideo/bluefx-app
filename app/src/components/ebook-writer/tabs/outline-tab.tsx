'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { List, ArrowLeft } from 'lucide-react';
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
      <div className="h-full flex items-center justify-center p-4">
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
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hover p-4 space-y-6">
      <Card className="bg-gray-50 dark:bg-gray-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5 text-blue-600" />
            Create Chapter Outline
          </CardTitle>
          <CardDescription>
            Ebook: <span className="font-medium">{ebook.title}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Outline generation functionality will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}