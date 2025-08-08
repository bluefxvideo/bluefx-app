'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { LogoMachineResponse } from '@/actions/tools/logo-machine';
import { ResultsGrid } from './results-grid';
import { LoadingSkeleton } from './loading-skeleton';
import { ErrorDisplay } from './error-display';
import { GenerateEmptyState, RecreateEmptyState } from './tab-empty-states';
import { Download, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface LogoMachineOutputProps {
  result?: LogoMachineResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
  activeTab?: string;
}

/**
 * Output Panel - Right side of two-column layout
 * Displays generation results, loading states, and errors
 */
export function LogoMachineOutput({
  result,
  isGenerating,
  error,
  onClearResults,
  activeTab = 'generate'
}: LogoMachineOutputProps) {
  // Loading state
  if (isGenerating) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <h3 className="font-medium">Generating Logo</h3>
          </div>
          <Badge variant="outline" className="bg-primary/20 text-primary-foreground border-primary/30">
            <Clock className="w-3 h-3 mr-1" />
            Processing
          </Badge>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <h3 className="font-medium text-destructive">Generation Failed</h3>
          </div>
        </div>
        <ErrorDisplay error={error} onRetry={() => {}} />
      </div>
    );
  }

  // Success state with results
  if (result && result.success) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            <h3 className="font-medium">Generation Complete</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/20 text-primary-foreground border-primary/30">
              {result.logo ? 1 : 0} logos
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearResults}
              className="text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Generation Stats */}
        <Card className="p-3 mb-4 bg-muted/30">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-primary">{result.credits_used}</p>
              <p className="text-xs text-muted-foreground">Credits Used</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{Math.round(result.generation_time_ms / 1000)}s</p>
              <p className="text-xs text-muted-foreground">Generation Time</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{result.remaining_credits || 0}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </div>
        </Card>

        {/* Warnings */}
        {result.warnings && result.warnings.length > 0 && (
          <Card className="p-3 mb-4 bg-yellow-50 border-yellow-200">
            <div className="space-y-1">
              {result.warnings.map((warning, index) => (
                <p key={index} className="text-xs text-yellow-700 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {warning}
                </p>
              ))}
            </div>
          </Card>
        )}

        {/* Results Grid */}
        <div className="flex-1 overflow-y-auto">
          <ResultsGrid
            thumbnails={result.logo ? [{ ...result.logo, variation_index: 0 }] : []}
            faceSwappedThumbnails={[]}
            titles={result.logo ? [result.logo.company_name] : []}
            batchId={result.batch_id}
          />
        </div>

        {/* Download All Button */}
        {result.logo && (
          <div className="mt-4 pt-4 border-t">
            <Button className="w-full bg-primary hover:bg-primary/90 text-white">
              <Download className="w-4 h-4 mr-2" />
              Download Logo
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Empty state
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-muted-foreground">Logo Results</h3>
      </div>
      {activeTab === 'recreate' ? (
        <RecreateEmptyState />
      ) : (
        <GenerateEmptyState />
      )}
    </div>
  );
}