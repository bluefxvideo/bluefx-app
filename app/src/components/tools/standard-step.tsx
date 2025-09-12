'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StandardStepProps {
  stepNumber: number;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

/**
 * StandardStep - Uniform step component used across ALL BlueFX tools
 * Provides consistent styling for numbered workflow steps
 */
export function StandardStep({ 
  stepNumber, 
  title, 
  description, 
  children, 
  className 
}: StandardStepProps) {
  return (
    <div className={cn("bg-background border-b border-border/50 py-8", className)}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-sm font-semibold text-primary-foreground">{stepNumber}</span>
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
          
          {/* Step Content */}
          <div className="relative">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}