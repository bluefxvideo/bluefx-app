'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download } from 'lucide-react';
import type { EbookMetadata } from '../store/ebook-writer-store';

interface ExportTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
}

export function ExportTab({ ebook, isGenerating, error }: ExportTabProps) {
  return (
    <div className="h-full overflow-y-auto scrollbar-hover p-4 space-y-6">
      <Card className="bg-gray-50 dark:bg-gray-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            Export Ebook
          </CardTitle>
          <CardDescription>
            Download your completed ebook
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Export functionality will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}