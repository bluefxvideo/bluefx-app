'use client';

import { Check } from 'lucide-react';
import { WIZARD_STEPS, type WizardStep } from './wizard-types';
import { cn } from '@/lib/utils';

interface StepDef {
  number: WizardStep;
  label: string;
  description?: string;
}

interface WizardStepperProps {
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  highestStepReached?: WizardStep;
  onStepClick: (step: WizardStep) => void;
  steps?: StepDef[];
}

export function WizardStepper({ currentStep, completedSteps, highestStepReached, onStepClick, steps }: WizardStepperProps) {
  const displaySteps = steps || WIZARD_STEPS;
  return (
    <div className="flex items-center justify-center gap-1 px-4 py-2">
      {displaySteps.map((step, index) => {
        const isActive = currentStep === step.number;
        const isCompleted = completedSteps.has(step.number);
        const isClickable = isCompleted || step.number <= (highestStepReached || currentStep);

        return (
          <div key={step.number} className="flex items-center">
            {/* Step indicator */}
            <button
              onClick={() => isClickable && onStepClick(step.number)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm',
                isActive && 'bg-primary text-white',
                isCompleted && !isActive && 'bg-primary/20 text-primary hover:bg-primary/30',
                !isActive && !isCompleted && 'text-muted-foreground',
                isClickable && !isActive && 'cursor-pointer hover:bg-secondary/50',
                !isClickable && 'cursor-default opacity-50'
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0',
                  isActive && 'bg-white/20',
                  isCompleted && !isActive && 'bg-primary/30',
                  !isActive && !isCompleted && 'bg-secondary'
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.number - 1}
              </span>
              <span className="hidden sm:inline font-medium">{step.label}</span>
            </button>

            {/* Connector line */}
            {index < displaySteps.length - 1 && (
              <div
                className={cn(
                  'w-8 h-px mx-1',
                  completedSteps.has(step.number) ? 'bg-primary/50' : 'bg-border/50'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
