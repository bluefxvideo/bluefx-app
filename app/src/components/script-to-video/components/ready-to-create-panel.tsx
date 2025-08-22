'use client';

import { FileText, Mic, Video, CheckCircle, LucideIcon } from 'lucide-react';

interface StepIndicatorProps {
  stepNumber: number;
  title: string;
  description: string;
  icon: LucideIcon;
  isCompleted: boolean;
  isActive: boolean;
}

function StepIndicator({ stepNumber, title, description, icon: Icon, isCompleted, isActive }: StepIndicatorProps) {
  return (
    <div className="text-center">
      <div className={`w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center ${
        isCompleted 
          ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
          : isActive 
            ? 'bg-gradient-to-r from-blue-500 to-cyan-500' 
            : 'bg-muted border-2 border-muted-foreground/20'
      }`}>
        {isCompleted ? (
          <CheckCircle className="w-6 h-6 text-white" />
        ) : (
          <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
        )}
      </div>
      <div className={`text-lg font-bold mb-1 ${
        isCompleted 
          ? 'text-green-500' 
          : isActive 
            ? 'text-blue-500' 
            : 'text-muted-foreground'
      }`}>
        {stepNumber}
      </div>
      <p className={`text-sm font-medium ${isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
        {title}
      </p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

interface ReadyToCreatePanelProps {
  currentStep?: number;
  scriptGenerated?: boolean;
  voiceSelected?: boolean;
}

/**
 * Ready to Create Panel - Welcome state for Script-to-Video
 * Shows dynamic step completion based on current progress
 */
export function ReadyToCreatePanel({ 
  currentStep = 1, 
  scriptGenerated = false, 
  voiceSelected = false 
}: ReadyToCreatePanelProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
        <Video className="w-8 h-8 text-white" />
      </div>
      
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground mb-8 max-w-md">
        Transform scripts into engaging videos with AI orchestration in 3 simple steps.
      </p>

      <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
        <StepIndicator
          stepNumber={1}
          title="Create Script"
          description="Generate from idea or write your own"
          icon={FileText}
          isCompleted={scriptGenerated}
          isActive={currentStep === 1 && !scriptGenerated}
        />
        
        <StepIndicator
          stepNumber={2}
          title="Choose Voice"
          description="Select AI voice and speaking style"
          icon={Mic}
          isCompleted={voiceSelected}
          isActive={currentStep === 2 || (currentStep === 3 && !voiceSelected)}
        />
        
        <StepIndicator
          stepNumber={3}
          title="Generate Assets"
          description="AI creates images and assembles video"
          icon={Video}
          isCompleted={false}
          isActive={currentStep === 3 && voiceSelected}
        />
      </div>
    </div>
  );
}