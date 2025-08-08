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

  // Error state with enhanced styling
  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-6 bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/25">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-300">Generation Failed</h3>
              <p className="text-red-400/80 text-sm">Something went wrong</p>
            </div>
          </div>
          <ErrorDisplay error={error} onRetry={() => {}} />
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
        
        <div className="relative z-10 h-full flex flex-col">
          {/* Left-Aligned Professional Header - Consistent with Form Pattern */}
          <div className="pt-6 pb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-xl shadow-primary/20">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  {/* Success sparkle */}
                  <div className="absolute -top-1 -right-1">
                    <Sparkles className="w-4 h-4 text-yellow-400 animate-bounce" />
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-white tracking-tight">Generation Complete!</h3>
                  <p className="text-zinc-300 text-lg font-medium">Your thumbnails are ready</p>
                </div>
              </div>
              
              {/* Clear Results Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearResults}
                className="h-10 px-4 hover:bg-zinc-800/50 transition-all duration-300 hover:scale-105 text-zinc-400 hover:text-zinc-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Results
              </Button>
            </div>
          </div>

          {/* Results Section - left aligned, reduced padding so image feels larger */}
          <div className="flex-1 min-h-0 overflow-auto scrollbar-hover">
            {/* Remove max-width center constraint; let grid span available space */}
            <div className="w-full">
              <ResultsGrid
                thumbnails={result.thumbnails || []}
                faceSwappedThumbnails={result.face_swapped_thumbnails || []}
                titles={result.titles || []}
                batchId={result.batch_id}
              />
            </div>
          </div>

          {/* Bottom Section with Stats and Actions */}
          <div className="border-t border-zinc-800/50 pt-4 pb-4">
            {/* Compact Generation Stats */}
            <div className="flex justify-center items-center gap-8 mb-6 text-center">
              <div className="group">
                <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-1">
                  {result.credits_used}
                </div>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Credits Used</p>
              </div>
              
              <div className="w-px h-8 bg-zinc-700"></div>
              
              <div className="group">
                <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-1">
                  {Math.round(result.generation_time_ms / 1000)}s
                </div>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Generation Time</p>
              </div>
              
              <div className="w-px h-8 bg-zinc-700"></div>
              
              <div className="group">
                <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent mb-1">
                  {result.remaining_credits || 0}
                </div>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Remaining</p>
              </div>
            </div>

            {/* Premium Download Button */}
            {(result.thumbnails?.length || 0) > 0 && (
              <div className="flex justify-center">
                <Button className="h-12 px-8 text-lg font-bold tracking-wide bg-primary hover:bg-primary/90 transition-all duration-300 transform hover:scale-[1.02]">
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5" />
                    <span>Download All ({result.thumbnails?.length || 0} files)</span>
                    <Sparkles className="w-4 h-4" />
                  </div>
                </Button>
              </div>
            )}
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
          <div className="w-full max-w-lg">
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