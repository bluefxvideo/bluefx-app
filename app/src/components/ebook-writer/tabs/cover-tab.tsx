'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Image } from 'lucide-react';
import type { EbookMetadata } from '../store/ebook-writer-store';

interface CoverTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
}

export function CoverTab({ ebook: _ebook, isGenerating: _isGenerating, error: _error }: CoverTabProps) {
  return (
    <div className="h-full overflow-y-auto scrollbar-hover p-4 space-y-6">
      <Card className="bg-gray-50 dark:bg-gray-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-pink-500" aria-hidden="true" />
            Design Cover
          </CardTitle>
          <CardDescription>
            Create a professional book cover
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cover generation functionality will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}