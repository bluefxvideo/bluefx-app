'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCircle, Type, Trash2 } from 'lucide-react';
// import { LoadingSkeleton } from './loading-skeleton';
// import { EmptyState } from './empty-state';

interface TitleGeneratorOutputProps {
  titles?: string[];
  isGenerating: boolean;
  error?: string;
}

/**
 * Title Generator Output - Shows generated YouTube titles
 * Specialized output panel for title generation results
 */
export function TitleGeneratorOutput({
  titles,
  isGenerating,
  error
}: TitleGeneratorOutputProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = async (title: string, index: number) => {
    try {
      await navigator.clipboard.writeText(title);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  // Loading state
  if (isGenerating) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <h3 className="font-medium">Generating Titles</h3>
          </div>
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            Processing
          </Badge>
        </div>
        
        <div className="flex-1 space-y-3">
          {/* Title Loading Skeletons */}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <Card key={i} className="p-3 bg-transparent dark:bg-card-content border-input">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
                  <div className="h-3 bg-muted animate-pulse rounded w-20" />
                </div>
                <div className="w-8 h-8 bg-muted animate-pulse rounded" />
              </div>
            </Card>
          ))}
          
          <div className="text-center py-4">
            <p className="text-base text-muted-foreground">
              AI is crafting engaging titles... This usually takes 10-20 seconds
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-6 max-w-md text-center space-y-4 bg-transparent dark:bg-card-content border-input">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <Type className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h3 className="font-medium text-destructive mb-2">Title Generation Failed</h3>
            <p className="text-base text-muted-foreground">{error}</p>
          </div>
        </Card>
      </div>
    );
  }

  // Success state with titles
  if (titles && titles.length > 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Clean Titles List - Header handled by OutputPanelShell */}
        <div className="flex-1 space-y-3 overflow-y-auto scrollbar-hover py-4">
          {titles.map((title, index) => (
            <Card key={index} className="p-4 group hover:shadow-md transition-all bg-transparent dark:bg-card-content border-input">
              <div className="space-y-3">
                {/* Title Text */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-base font-medium leading-relaxed">{title}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{title.length} characters</span>
                      <span>•</span>
                      <span className={title.length <= 60 ? 'text-blue-600' : 'text-yellow-600'}>
                        {title.length <= 60 ? 'Mobile friendly' : 'May truncate on mobile'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Copy Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(title, index)}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                      copiedIndex === index ? 'text-blue-600' : ''
                    }`}
                  >
                    {copiedIndex === index ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* SEO Indicators */}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm">
                    #{index + 1}
                  </Badge>
                  
                  {/* Length indicator */}
                  {title.length <= 60 && (
                    <Badge variant="outline" className="text-sm bg-blue-50 text-blue-600 border-blue-200">
                      ✓ Optimal length
                    </Badge>
                  )}
                  
                  {/* Emotional trigger detection */}
                  {/[!?]/.test(title) && (
                    <Badge variant="outline" className="text-sm bg-blue-50 text-blue-700 border-blue-200">
                      ⚡ Engaging
                    </Badge>
                  )}
                  
                  {/* Number detection */}
                  {/\d/.test(title) && (
                    <Badge variant="outline" className="text-sm bg-blue-50 text-blue-600 border-blue-200">
                      # Numbers
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Actions Footer */}
        <div className="mt-4 pt-4 border-t space-y-2">
          <Button variant="outline" className="w-full">
            <Copy className="w-4 h-4 mr-2" />
            Copy All Titles
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="sm">
              Export to CSV
            </Button>
            <Button variant="ghost" size="sm">
              <Trash2 className="w-4 h-4 mr-1" />
              Clear Results
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed bg-transparent dark:bg-card-content border-input">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto">
            <Type className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="font-medium mb-2">Ready to Generate Titles</h3>
            <p className="text-base text-muted-foreground leading-relaxed">
              Enter a video topic in the Title Generator tab to create engaging YouTube titles optimized for clicks and SEO.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}