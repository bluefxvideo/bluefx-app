'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Type, Clock } from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import type { TitleOptions } from '../store/ebook-writer-store';

interface TitleOutputProps {
  titleOptions: TitleOptions | null;
  isGenerating: boolean;
}

export function TitleOutput({ titleOptions, isGenerating }: TitleOutputProps) {
  console.log('🎯 TitleOutput received:', { titleOptions, isGenerating, titleCount: titleOptions?.options?.length });
  
  const getStatus = () => {
    if (isGenerating) return 'loading';
    if (!titleOptions || titleOptions.options.length === 0) return 'idle';
    return 'ready';
  };

  const renderEmpty = () => (
    <div className="flex items-center justify-center h-full">
      <UnifiedEmptyState
        icon={Type}
        title="No Titles Generated"
        description="Generate title options for your ebook by providing a topic first."
      />
    </div>
  );

  const renderContent = () => (
    <Card className="bg-white dark:bg-gray-800/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Type className="h-5 w-5 text-blue-500" />
          Generated Titles
          <Badge variant="secondary" className="text-xs">
            {titleOptions?.options.length} options
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {titleOptions?.options.map((title, index) => (
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
                <h4 className="font-medium text-sm leading-snug">
                  {title.title}
                </h4>
                {title.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {title.subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Generated {titleOptions ? new Date(titleOptions.generated_at).toLocaleTimeString() : ''}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <OutputPanelShell
      title="Title Options"
      status={getStatus()}
      empty={renderEmpty()}
    >
      {titleOptions && titleOptions.options.length > 0 && renderContent()}
    </OutputPanelShell>
  );
}