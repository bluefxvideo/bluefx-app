'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { GenerateEmptyState, FaceSwapEmptyState, RecreateEmptyState } from './tab-empty-states';
import { ThumbnailPreview } from './thumbnail-preview';
import { Download, Trash2, Clock, CheckCircle, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { containerStyles } from '@/lib/container-styles';

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
      const thumbnail = activeTab === 'face-swap'
        ? (result?.face_swapped_thumbnails?.[0] || result?.thumbnails?.[0])
        : (result?.thumbnails?.[0] || result?.face_swapped_thumbnails?.[0]);
      if (!thumbnail) return;
      const url = (thumbnail as any).image_url || thumbnail.url || ((thumbnail as any).image_urls?.[0]) || '';
      if (!url) return;
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = activeTab === 'face-swap' ? 'faceswap.jpeg' : `thumbnail-${(thumbnail as any).variation_index || 1}.jpeg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } catch (error) {
        console.error('Download failed:', error);
      }
    };

    const handleOpenInNewTab = () => {
      const thumbnail = activeTab === 'face-swap'
        ? (result?.face_swapped_thumbnails?.[0] || result?.thumbnails?.[0])
        : (result?.thumbnails?.[0] || result?.face_swapped_thumbnails?.[0]);
      if (!thumbnail) return;
      const url = (thumbnail as any).image_url || thumbnail.url || ((thumbnail as any).image_urls?.[0]) || '';
      if (url) window.open(url, '_blank');
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
        <div className="relative z-10 flex-1 flex flex-col">
          {/* Centered Error Content Area */}
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full">
              <div className={`${containerStyles.error} p-8 rounded-lg text-center`}>
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
              </div>
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
    <div className="min-h-full lg:h-full flex flex-col lg:overflow-hidden relative">
      
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