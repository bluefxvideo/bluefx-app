'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  AlertCircle
} from 'lucide-react';

interface GoogleDocsConnectionProps {
  ebook: {
    title: string;
    author?: string;
    chapters: {
      title: string;
      content: string;
    }[];
    cover?: {
      image_url: string;
    };
  } | null;
}

export function GoogleDocsConnection({ ebook }: GoogleDocsConnectionProps) {
  // TEMPORARILY DISABLED - Coming Soon
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Google Docs Export
        </CardTitle>
        <CardDescription>
          Export your ebook directly to Google Docs for collaborative editing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <Badge variant="secondary" className="mb-3">
            <AlertCircle className="w-4 h-4 mr-1" />
            Coming Soon
          </Badge>
          <p className="text-sm text-muted-foreground">
            Google Docs integration is being finalized and will be available shortly.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}