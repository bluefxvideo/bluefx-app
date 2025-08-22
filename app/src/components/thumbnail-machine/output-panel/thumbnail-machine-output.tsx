'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { ResultsGrid } from './results-grid';
import { LoadingSkeleton } from './loading-skeleton';
import { ErrorDisplay } from './error-display';
import { GenerateEmptyState, FaceSwapEmptyState, RecreateEmptyState } from './tab-empty-states';
import { Download, Trash2, Clock, CheckCircle, AlertCircle, Sparkles, Zap } from 'lucide-react';

interface ThumbnailMachineOutputProps {
  result?: ThumbnailMachineResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
  activeTab?: string;
  onFocusPrompt?: () => void;
}

/**
 * Premium Output Panel with Dribbble-level polish
 * Enhanced with sophisticated animations, gradients, and micro-interactions
 */
export function ThumbnailMachineOutput({
  result,
  isGenerating,
  error,
  onClearResults,
  activeTab = 'generate',
  onFocusPrompt
}: ThumbnailMachineOutputProps) {
  // Loading state with premium styling
  if (isGenerating) {
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        {/* Solid subtle overlay for consistency with theme */}
        <div className="absolute inset-0 bg-secondary/20"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center animate-spin">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping"></div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Creating Your Masterpiece</h3>
                <p className="text-zinc-400">AI is working its magic...</p>
              </div>
            </div>
            
            <Badge className="bg-primary/20 border border-primary/30 text-primary-foreground/80 animate-pulse">
              <Clock className="w-3 h-3 mr-1.5" />
              Processing
            </Badge>
          </div>
          
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  // Error state with centered layout matching empty states
  if (error) {
    return (
      <div className="h-full flex flex-col overflow-hidden relative">
        {/* Subtle animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/20 via-transparent to-zinc-900/20"></div>
        
        <div className="relative z-10 flex-1 flex flex-col">
          {/* Centered Error Content Area */}
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-2xl">
              <Card className="p-8 bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 backdrop-blur-sm text-center">
                <div className="flex flex-col items-center gap-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/25">
                    <AlertCircle className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-red-300 mb-2">Generation Failed</h3>
                    <p className="text-red-400/80 text-base mb-4">Something went wrong during processing</p>
                    <div className="text-sm text-red-300/70 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                      {error}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state with centered professional results display
  if (result && result.success) {
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        {/* Subtle solid overlay */}
        <div className="absolute inset-0 bg-secondary/20"></div>
        
        <div className="relative z-10 h-full flex flex-col">{/* Header now handled by OutputPanelShell */}

          {/* Results Section - Clean and Simple */}
          <div className="flex-1 min-h-0 flex items-center justify-center py-6">
            <div className="w-full max-w-2xl">
              <ResultsGrid
                thumbnails={result.thumbnails || []}
                faceSwappedThumbnails={result.face_swapped_thumbnails || []}
                titles={result.titles || []}
                batchId={result.batch_id}
              />
            </div>
          </div>

          {/* Premium Warnings - if any */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="px-6 pb-4">
              <Card className="p-4 bg-yellow-500/10 border border-yellow-500/30 backdrop-blur-sm">
                <div className="space-y-2">
                  {result.warnings.map((warning, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      <p className="text-sm text-yellow-300 font-medium">{warning}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Enhanced Empty State with centered layout
  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Subtle animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/20 via-transparent to-zinc-900/20"></div>
      
      <div className="relative z-10 flex-1 flex flex-col">
        
        {/* Centered Content Area */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-2xl">
            {activeTab === 'face-swap' ? (
              <FaceSwapEmptyState onFocusPrompt={onFocusPrompt} />
            ) : activeTab === 'recreate' ? (
              <RecreateEmptyState onFocusPrompt={onFocusPrompt} />
            ) : (
              <GenerateEmptyState onFocusPrompt={onFocusPrompt} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}