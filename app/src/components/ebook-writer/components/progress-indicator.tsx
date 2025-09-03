'use client';

import { CheckCircle, Circle } from 'lucide-react';

interface ProgressIndicatorProps {
  currentStep: 'topic' | 'title' | 'outline' | 'content' | 'cover' | 'export' | 'history';
  className?: string;
}

const STEPS = [
  { id: 'topic', label: 'Topic' },
  { id: 'title', label: 'Title' },
  { id: 'outline', label: 'Outline' },
  { id: 'content', label: 'Content' },
  { id: 'cover', label: 'Cover' },
  { id: 'export', label: 'Export' }
];

export function ProgressIndicator({ currentStep, className = '' }: ProgressIndicatorProps) {
  const currentIndex = STEPS.findIndex(step => step.id === currentStep);
  
  return (
    <div className={`flex items-center justify-center gap-2 py-3 ${className}`}>
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = step.id === currentStep;
        
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              {isCompleted ? (
                <CheckCircle className="h-4 w-4 text-primary" />
              ) : isCurrent ? (
                <div className="h-4 w-4 rounded-full bg-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={`text-xs mt-1 ${
                isCurrent ? 'text-primary font-medium' : 
                isCompleted ? 'text-muted-foreground' : 
                'text-muted-foreground/50'
              }`}>
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`h-px w-8 mx-1 ${
                isCompleted ? 'bg-primary' : 'bg-muted-foreground/20'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}