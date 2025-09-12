'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OutputPanelShellProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  status?: 'idle' | 'loading' | 'error' | 'ready';
  errorMessage?: string;
  actions?: React.ReactNode;
  empty?: React.ReactNode;
  loading?: React.ReactNode;
  errorContent?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  activeTab?: string; // Add activeTab prop for tab-specific backgrounds
  onCancelGeneration?: () => void; // Add cancel callback
}

/**
 * OutputPanelShell
 * Standard right-panel container for all tools.
 * - No Card or outer padding here (provided by StandardToolLayout)
 * - Handles header, states (empty/loading/error/ready), and scrolling
 */
export function OutputPanelShell({
  title,
  subtitle,
  icon,
  status = 'idle',
  errorMessage,
  actions,
  empty,
  loading,
  errorContent,
  children,
  className,
  activeTab,
  onCancelGeneration,
}: OutputPanelShellProps) {
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const isIdle = status === 'idle';

  return (
    <div className={cn('h-full flex flex-col min-h-0', className)}>
      {(title || actions) && (
        <div className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="flex-shrink-0">
                  {icon}
                </div>
              )}
              <div>
                {title && (
                  <h3 className="text-xl font-semibold text-white">{title}</h3>
                )}
                {subtitle && (
                  <p className="text-zinc-400 font-medium mt-1">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {actions}
              {/* Universal cancel button when loading */}
              {isLoading && onCancelGeneration && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancelGeneration}
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                  title="Cancel Generation"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading && (
          loading ? (
            loading
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="flex items-center gap-3 text-zinc-300">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generating...</span>
              </div>
            </div>
          )
        )}

        {isError && (
          errorContent ? (
            errorContent
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-200 max-w-md text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                  <div>
                    <p className="font-medium text-lg">Generation failed</p>
                    {errorMessage && (
                      <p className="text-sm text-red-200/80 mt-2 leading-relaxed">{errorMessage}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {isIdle && !isLoading && !isError && (
          <div className="h-full relative">
            {/* Tab-specific background examples for idle state */}
            {(activeTab === 'generate' || activeTab === 'face-swap' || activeTab === 'logo-generate') && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full space-y-3">
                  <div className={`relative ${activeTab === 'logo-generate' ? 'aspect-square max-w-md mx-auto' : 'aspect-video'} rounded-lg overflow-hidden border border-zinc-700/50 shadow-xl`}>
                    <img
                      src={
                        activeTab === 'logo-generate'
                          ? "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/images/placeholders/sun-metal-logo.png"
                          : activeTab === 'generate' 
                          ? "https://trjkxgkbkyzthrgkbwfe.supabase.co/storage/v1/object/public/images/placeholders/placeholder-thumbnail-9db9dd3c-374e-42a6-ae04-606cb073e9d7.jpg"
                          : activeTab === 'recreate'
                          ? "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/images/placeholders/thumbnail-recreate.png"
                          : "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/images/placeholders/thumbnail-recreate.png"
                      }
                      alt={activeTab === 'logo-generate' ? "Example logo" : "Example thumbnail"}
                      className="w-full h-full object-cover"
                    />
                    {/* Badge in Top Right */}
                    <div className="absolute top-3 right-3">
                      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-lg rounded-full px-2 py-1">
                        <span className="text-xs font-bold">Example</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Tab-specific Sample Prompt Text */}
                  <p className="text-xs text-zinc-500 text-center">
                    Sample: {
                      activeTab === 'logo-generate'
                        ? '"Modern tech startup logo with geometric shapes, blue gradient, minimalist design"'
                        : activeTab === 'generate' 
                        ? '"Lifestyle morning routine with lottery excitement, bright energetic scene with money and celebration"'
                        : activeTab === 'recreate'
                        ? '"Upload a thumbnail to recreate with AI-powered variations"'
                        : '"Epic gaming moment with shocked expression, bright colors, dramatic lighting"'
                    }
                  </p>
                </div>
              </div>
            )}
            {/* Empty content on top */}
            {empty}
          </div>
        )}

        {!isIdle && !isLoading && !isError && children}
      </div>
    </div>
  );
}


