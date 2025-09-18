'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CinematographerResponse } from '@/actions/tools/ai-cinematographer';
import { VideoPreview } from './video-preview';
import { GenerateEmptyState, HistoryEmptyState } from './tab-empty-states';
import { Clock, CheckCircle, AlertCircle, Zap, Video } from 'lucide-react';

interface CinematographerOutputProps {
  result?: CinematographerResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
  activeTab?: string;
  isStateRestored?: boolean;
}

/**
 * Premium Output Panel with Dribbble-level polish
 * Enhanced with sophisticated animations, gradients, and micro-interactions
 * Following the same pattern as Thumbnail Machine and Logo Machine
 */
export function CinematographerOutput({
  result,
  isGenerating,
  error,
  onClearResults,
  activeTab = 'generate',
  isStateRestored = false
}: CinematographerOutputProps) {
  // Debug logging for restoration issues
  console.log('🎬 CinematographerOutput render:', {
    isGenerating,
    hasResult: !!result,
    resultSuccess: result?.success,
    hasVideo: !!result?.video,
    isStateRestored,
    batchId: result?.batch_id,
    videoId: result?.video?.id,
    videoUrl: result?.video?.video_url
  });

  // Loading state with premium styling - show video placeholder if we have result data
  if (isGenerating) {
    // If we have result data from the hook, use it
    if (result && result.success && result.video) {
      console.log('📺 Showing VideoPreview during generation for:', result.batch_id);
      return (
        <div className="h-full flex items-center justify-center overflow-auto">
          <div className="w-full max-w-4xl">
            <VideoPreview
              video={result.video}
              batchId={result.batch_id}
            />
          </div>
        </div>
      );
    }

    // Fallback loading state (this shouldn't happen with current hook logic)
    console.log('⏳ Showing loading state without result data');
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Initializing video generation...</p>
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
              <Card className="p-8 bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 backdrop-blur-sm text-center">
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-red-400" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-red-500/30 animate-pulse"></div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white">Generation Failed</h3>
                    <p className="text-zinc-300 max-w-md mx-auto leading-relaxed">{error}</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state - Same clean layout as placeholder
  if (result && result.success) {
    return (
      <div className="h-full flex items-center justify-center overflow-auto">
        <div className="w-full max-w-4xl">
          {result.video && (
            <VideoPreview
              video={result.video}
              batchId={result.batch_id}
            />
          )}
          
          {/* Warnings below video if any */}
          {result.warnings && result.warnings.length > 0 && (
            <Card className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30">
              <div className="space-y-2">
                {result.warnings.map((warning, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <p className="text-sm text-yellow-300 font-medium">{warning}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Normal empty state
  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      <div className="relative z-10 flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full">
            {activeTab === 'history' ? (
              <HistoryEmptyState />
            ) : (
              <GenerateEmptyState />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}