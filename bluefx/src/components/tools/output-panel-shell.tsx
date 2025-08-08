'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle } from 'lucide-react';

interface OutputPanelShellProps {
  title?: string;
  subtitle?: string;
  status?: 'idle' | 'loading' | 'error' | 'ready';
  errorMessage?: string;
  actions?: React.ReactNode;
  empty?: React.ReactNode;
  loading?: React.ReactNode;
  errorContent?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
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
  status = 'idle',
  errorMessage,
  actions,
  empty,
  loading,
  errorContent,
  children,
  className,
}: OutputPanelShellProps) {
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const isIdle = status === 'idle';

  return (
    <div className={cn('h-full flex flex-col min-h-0', className)}>
      {(title || actions) && (
        <div className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-xl font-semibold text-white">{title}</h3>
              )}
              {subtitle && (
                <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
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
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="font-medium">Generation failed</p>
                  {errorMessage && (
                    <p className="text-sm text-red-200/80 mt-1">{errorMessage}</p>
                  )}
                </div>
              </div>
            </div>
          )
        )}

        {isIdle && !isLoading && !isError && empty}

        {!isIdle && !isLoading && !isError && children}
      </div>
    </div>
  );
}


