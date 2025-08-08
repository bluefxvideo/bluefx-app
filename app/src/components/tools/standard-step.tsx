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
    <div className={cn("group space-y-5", className)}>
      {/* Step Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center transition-all duration-300">
            <span className="text-white text-sm font-bold">{stepNumber}</span>
          </div>
        </div>
        <div>
          <h3 className="text-xl font-bold text-white mb-1 tracking-tight">{title}</h3>
          <p className="text-zinc-400 font-medium">{description}</p>
        </div>
      </div>
      
      {/* Step Content */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}