'use client';

import { Button } from '@/components/ui/button';
import { Loader2, Wand2, AlertTriangle } from 'lucide-react';

interface GenerateButtonProps {
  onClick: () => void;
  disabled: boolean;
  isGenerating: boolean;
  estimatedCredits: number;
  availableCredits: number;
}

export function GenerateButton({
  onClick,
  disabled,
  isGenerating,
  estimatedCredits,
  availableCredits
}: GenerateButtonProps) {
  const insufficientCredits = availableCredits < estimatedCredits;
  
  return (
    <div className="space-y-3">
      {/* Credit Warning */}
      {insufficientCredits && (
        <div className="flex items-center gap-2 p-3 sm:p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span className="text-sm sm:text-xs text-destructive">
            Need {estimatedCredits} credits, have {availableCredits}
          </span>
        </div>
      )}
      
      {/* Generate Button */}
      <Button
        onClick={onClick}
        disabled={disabled}
        className="w-full h-12 sm:h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-[1.02] transition-all duration-300 font-medium text-base sm:text-sm"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating Thumbnails...
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4 mr-2" />
            Generate Thumbnails
          </>
        )}
      </Button>
      
    </div>
  );
}