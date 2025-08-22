'use client';

import { CheckCircle, Loader2, FileText, Mic, Video } from 'lucide-react';

interface ScriptPreviewPanelProps {
  currentStep: number;
  totalSteps: number;
  generatedScript?: string;
  finalScript?: string;
  useMyScript: boolean;
  isGeneratingScript?: boolean;
  isGeneratingVoice?: boolean;
  isGeneratingVideo?: boolean;
  voiceSelected?: boolean;
  onScriptEdit?: (script: string) => void;
  isEditable?: boolean;
}

export function ScriptPreviewPanel({
  currentStep,
  totalSteps,
  generatedScript,
  finalScript,
  useMyScript,
  isGeneratingScript = false,
  isGeneratingVoice = false,
  isGeneratingVideo = false,
  voiceSelected = false,
  onScriptEdit,
  isEditable = false
}: ScriptPreviewPanelProps) {

  // Determine the current phase and message
  const getCurrentMessage = () => {
    if (isGeneratingScript) {
      return 'Generating your script...';
    }
    if (isGeneratingVoice) {
      return 'Creating voice narration...';
    }
    if (isGeneratingVideo) {
      return 'Generating images and assembling assets...';
    }
    return 'Transform scripts into engaging videos with AI orchestration in 3 simple steps.';
  };

  const getCurrentTitle = () => {
    if (isGeneratingScript) {
      return 'Generating Script ✨';
    }
    if (isGeneratingVoice) {
      return 'Creating Voice ✨';
    }
    if (isGeneratingVideo) {
      return 'Preparing Assets ✨';
    }
    return 'Ready to Create Magic ✨';
  };

  const getMainIcon = () => {
    if (isGeneratingScript || isGeneratingVoice || isGeneratingVideo) {
      return <Loader2 className="w-8 h-8 text-white animate-spin" />;
    }
    return <Video className="w-8 h-8 text-white" />;
  };

  // Progress steps - same visual style as welcome panel
  const steps = [
    {
      number: 1,
      title: 'Create Script',
      description: 'Generate from idea or write your own',
      icon: FileText,
      complete: !!generatedScript,
      active: isGeneratingScript
    },
    {
      number: 2,
      title: 'Choose Voice',
      description: 'Select AI voice and speaking style',
      icon: Mic,
      complete: voiceSelected,
      active: isGeneratingVoice
    },
    {
      number: 3,
      title: 'Generate Assets',
      description: 'AI creates images and assembles video',
      icon: Video,
      complete: false, // Never mark as complete during generation
      active: isGeneratingVideo
    }
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 mb-6 bg-primary rounded-2xl flex items-center justify-center">
        {getMainIcon()}
      </div>
      
      <h3 className="text-2xl font-bold mb-2">{getCurrentTitle()}</h3>
      <p className="text-base text-muted-foreground mb-8 max-w-md">
        {getCurrentMessage()}
      </p>

      {/* Same 3-column grid as welcome panel but with progress states */}
      <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.number} className="text-center">
              <div className={`w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center ${
                step.active ? 'bg-primary' :
                step.complete ? 'bg-primary' : 'bg-muted border-2 border-muted-foreground/20'
              }`}>
                {step.active ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : step.complete ? (
                  <CheckCircle className="w-6 h-6 text-white" />
                ) : (
                  <Icon className="w-6 h-6 text-white" />
                )}
              </div>
              <div className={`text-lg font-bold mb-1 ${
                step.active ? 'text-primary' :
                step.complete ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {step.number}
              </div>
              <p className={`text-sm font-medium ${
                step.active ? 'text-white' :
                step.complete ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {step.title}
              </p>
              <p className={`text-xs ${
                step.active ? 'text-muted-foreground' :
                step.complete ? 'text-muted-foreground' : 'text-muted-foreground'
              }`}>
                {step.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}