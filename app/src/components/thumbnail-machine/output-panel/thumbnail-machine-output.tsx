'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { GenerateEmptyState, FaceSwapEmptyState, RecreateEmptyState } from './tab-empty-states';
import { ThumbnailPreview } from './thumbnail-preview';
import { Download, Trash2, Clock, CheckCircle, AlertCircle, Sparkles, Zap } from 'lucide-react';

interface ThumbnailMachineOutputProps {
  result?: ThumbnailMachineResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
  onCancelGeneration?: () => void;
  activeTab?: string;
  onFocusPrompt?: () => void;
  prompt?: string; // Add prompt for processing card display
  hasReferenceImage?: boolean;
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
  onCancelGeneration,
  activeTab = 'generate',
  onFocusPrompt,
  prompt,
  hasReferenceImage
}: ThumbnailMachineOutputProps) {
  
  // Show processing state or results if we have them
  const shouldShowResults = isGenerating || result;
  
  if (shouldShowResults) {
    const handleDownload = async () => {
      // TODO: Implement batch download
    };

    const handleOpenInNewTab = () => {
      // TODO: Implement gallery view in new tab
    };

    // Create fallback result for processing state if none exists
    const displayResult = result || {
      success: true,
      batch_id: 'processing',
      credits_used: 0,
      generation_time_ms: 0,
      thumbnails: []
    };

    return (
      <div className="h-full flex items-center justify-center overflow-auto">
        <div className="w-full max-w-4xl">
          <ThumbnailPreview
            result={displayResult}
            isGenerating={isGenerating}
            onDownload={handleDownload}
            onOpenInNewTab={handleOpenInNewTab}
            onCreateNew={onClearResults}
            onCancelGeneration={onCancelGeneration}
            prompt={prompt}
            activeTab={activeTab}
          />
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
            <div className="w-full">
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

  // Success state - now handled by unified ThumbnailPreview component
  // This case is actually covered above in the "if (isGenerating || result)" block

  // Empty State with centered layout
  
  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Subtle animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/20 via-transparent to-zinc-900/20"></div>
      
      <div className="relative z-10 flex-1 flex flex-col">
        
        {/* Centered Content Area */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full">
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