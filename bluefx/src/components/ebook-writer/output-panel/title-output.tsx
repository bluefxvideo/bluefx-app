'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Type, Sparkles, Clock } from 'lucide-react';
import type { TitleOptions } from '../store/ebook-writer-store';

interface TitleOutputProps {
  titleOptions: TitleOptions | null;
  isGenerating: boolean;
  error?: string;
}

export function TitleOutput({ titleOptions, isGenerating, error }: TitleOutputProps) {
  if (isGenerating) {
    return (
      <Card className="bg-white dark:bg-gray-800/40">
        <CardContent className="pt-6 text-center">
          <div className="animate-spin mb-4">
            <Sparkles className="h-8 w-8 text-blue-500 mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground">
            AI is generating compelling title options...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive bg-white dark:bg-gray-800/40">
        <CardContent className="pt-6">
          <div className="text-sm text-destructive text-center">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!titleOptions) {
    return (
      <Card className="border-dashed bg-white dark:bg-gray-800/40">
        <CardContent className="pt-6 text-center">
          <Type className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Generate title options to see them here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-800/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Type className="h-4 w-4 text-blue-500" />
          Generated Titles
          <Badge variant="secondary" className="text-xs">
            {titleOptions.options.length} options
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {titleOptions.options.map((title, index) => (
          <div 
            key={index}
            className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-blue-600">
                  {index + 1}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium leading-relaxed">
                  {title}
                </p>
              </div>
            </div>
          </div>
        ))}
        
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Generated {new Date(titleOptions.generated_at).toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}