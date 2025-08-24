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
                  <Video className="w-4 h-4 text-white" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping"></div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Creating Your Video</h3>
                <p className="text-zinc-400">
                  {isStateRestored ? 'Continuing video generation...' : 'AI is generating cinematic content...'}
                </p>
              </div>
            </div>
            
            <Badge className="bg-primary/20 border border-primary/30 text-primary-foreground/80 animate-pulse">
              <Clock className="w-3 h-3 mr-1.5" />
              {isStateRestored ? 'Resumed' : 'Processing'}
            </Badge>
          </div>
          
          {/* State restored notification */}
          {isStateRestored && (
            <div className="px-6 pb-4">
              <Card className="p-3 bg-blue-500/10 border border-blue-500/30 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <p className="text-sm text-blue-300 font-medium">
                    Video generation resumed - your video was still processing in the background
                  </p>
                </div>
              </Card>
            </div>
          )}
          
          {/* Loading skeleton for video */}
          <div className="flex-1 min-h-0 flex items-center justify-center py-6">
            <div className="w-full max-w-2xl">
              <Card className="group overflow-hidden animate-pulse">
                <div className="relative aspect-video bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 flex items-center justify-center">
                  <Video className="w-12 h-12 text-zinc-600" />
                </div>
              </Card>
            </div>
          </div>
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

  // Success state with centered professional results display
  if (result && result.success) {
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        {/* Subtle solid overlay */}
        <div className="absolute inset-0 bg-secondary/20"></div>
        
        <div className="relative z-10 h-full flex flex-col">
          {/* Header now handled by OutputPanelShell */}

          {/* Results Section - Clean and Simple */}
          <div className="flex-1 min-h-0 flex items-center justify-center py-6">
            <div className="w-full max-w-2xl">
              {result.video && (
                <VideoPreview
                  video={result.video}
                  batchId={result.batch_id}
                />
              )}
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