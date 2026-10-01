'use client';

import { containerStyles } from '@/lib/container-styles';
import { BeforeAfterView } from '../components/before-after-view';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2 } from 'lucide-react';
import type { CleanupResult } from '@/types/reelestate';
import { CLEANUP_PRESET_CONFIG } from '@/types/reelestate';
import type { PhotoCleanupExample } from '../examples';
import { PhotoCleanupExamples } from '../reelestate-examples';

interface PhotoCleanupOutputProps {
  results: CleanupResult[];
  isCleaning: boolean;
  /** "Try this example" in the examples shown while nothing is cleaned. */
  onTryExample: (example: PhotoCleanupExample) => void;
}

export function PhotoCleanupOutput({ results, isCleaning, onTryExample }: PhotoCleanupOutputProps) {
  // Nothing cleaned yet: real before and after pairs from this tool
  if (results.length === 0 && !isCleaning) {
    return (
      <div className={`h-full overflow-y-auto ${containerStyles.panel} p-4`}>
        <PhotoCleanupExamples onTry={onTryExample} busy={isCleaning} />
      </div>
    );
  }

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className={`h-full overflow-y-auto space-y-4 ${containerStyles.panel} p-4`}>
      {isCleaning && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm">Cleaning up photos...</span>
        </div>
      )}

      {results.map((result, i) => (
        <div key={i} className="rounded-lg border border-border/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-2 bg-muted/30">
            <Badge variant="outline" className="text-xs">
              {CLEANUP_PRESET_CONFIG[result.preset]?.label || result.preset}
            </Badge>
            {result.success && result.cleaned_url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(result.cleaned_url!, `cleaned-${i + 1}.jpg`)}
                className="h-7 text-xs"
              >
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
            )}
          </div>

          {/* Comparison */}
          {result.success && result.cleaned_url ? (
            <BeforeAfterView
              beforeUrl={result.original_url}
              afterUrl={result.cleaned_url}
              className="aspect-video"
            />
          ) : (
            <div className="aspect-video bg-destructive/10 flex items-center justify-center">
              <p className="text-sm text-destructive">{result.error || 'Cleanup failed'}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
