'use client';

import { Card } from '@/components/ui/card';
import { LogoMachineResponse } from '@/actions/tools/logo-machine';
import { LogoPreview } from './logo-preview';
import { GenerateEmptyState, RecreateEmptyState } from './tab-empty-states';
import { Clock, CheckCircle, AlertCircle, Zap, Loader2, X, Sparkles } from 'lucide-react';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface LogoMachineOutputProps {
  result?: LogoMachineResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
  onCancelGeneration?: () => void;
  activeTab?: string;
}

/**
 * Premium Output Panel with Dribbble-level polish
 * Enhanced with sophisticated animations, gradients, and micro-interactions
 */
export function LogoMachineOutput({
  result,
  isGenerating,
  error,
  onClearResults,
  onCancelGeneration,
  activeTab = 'generate'
}: LogoMachineOutputProps) {
  // Loading state with premium processing card
  if (isGenerating) {
    return (
      <div className="h-full flex items-center justify-center overflow-auto py-6">
        <div className="w-full">
          <LogoPreview
            isGenerating={true}
            companyName={result?.logo?.company_name}
            onCancelGeneration={onCancelGeneration}
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
            <div className="w-full w-full">
              <Card className="p-8 bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 backdrop-blur-sm text-center">
                <div className="flex flex-col items-center gap-6">
                  <UnifiedEmptyState
                    icon={AlertCircle}
                    title="Generation Failed"
                    description={`Something went wrong during processing: ${error}`}
                  />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state with logo preview
  if (result && result.success) {
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        {/* Subtle solid overlay */}
        <div className="absolute inset-0 bg-secondary/20"></div>
        
        <div className="relative z-10 h-full flex flex-col">
          {/* Logo Preview Section */}
          <div className="flex-1 min-h-0 flex items-center justify-center py-6">
            <div className="w-full">
              <LogoPreview logo={result.logo} />
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
          <div className="w-full w-full">
            {activeTab === 'recreate' ? (
              <RecreateEmptyState />
            ) : (
              <GenerateEmptyState />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}