'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WIZARD_STEPS, type WizardStep } from './wizard-types';

interface WizardNavigationProps {
  currentStep: WizardStep;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext: boolean;
  isProcessing?: boolean;
}

const STEP_CTA: Record<WizardStep, string> = {
  2: 'Continue to Image Generation',
  3: 'Continue to Video Generation',
  4: 'Continue to Voice Over',
  5: 'Finish',
};

export function WizardNavigation({
  currentStep,
  onPrevious,
  onNext,
  canGoNext,
  isProcessing,
}: WizardNavigationProps) {
  const isFirstStep = currentStep === WIZARD_STEPS[0].number;
  const isLastStep = currentStep === WIZARD_STEPS[WIZARD_STEPS.length - 1].number;

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-border/30 bg-background/50 backdrop-blur-sm">
      <Button
        variant="ghost"
        onClick={onPrevious}
        disabled={isFirstStep || isProcessing}
        className="text-muted-foreground"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Previous
      </Button>

      {!isLastStep && (
        <Button
          onClick={onNext}
          disabled={!canGoNext || isProcessing}
          className="bg-primary hover:bg-primary/90"
        >
          {STEP_CTA[currentStep] || 'Next'}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      )}
    </div>
  );
}
