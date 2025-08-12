'use client';

import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
}

interface WorkflowChecklistProps {
  currentStep: number;
  scriptGenerated: boolean;
  voiceSelected: boolean;
  isGeneratingScript: boolean;
  isGeneratingVoice: boolean;
  isGeneratingVideo: boolean;
}

export function WorkflowChecklist({
  currentStep,
  scriptGenerated,
  voiceSelected,
  isGeneratingScript,
  isGeneratingVoice,
  isGeneratingVideo
}: WorkflowChecklistProps) {
  
  // Define all workflow steps
  const getWorkflowSteps = (): WorkflowStep[] => {
    const steps: WorkflowStep[] = [
      {
        id: 'script',
        title: 'Script Generation',
        description: 'AI creates your video script',
        status: scriptGenerated ? 'completed' : isGeneratingScript ? 'active' : 'pending'
      },
      {
        id: 'review',
        title: 'Script Review',
        description: 'Edit and finalize your script',
        status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'active' : 'pending'
      },
      {
        id: 'voice',
        title: 'Voice Selection',
        description: 'Choose your narrator voice',
        status: voiceSelected ? 'completed' : currentStep === 3 && !isGeneratingVideo ? 'active' : 'pending'
      },
      {
        id: 'storyboard',
        title: 'Creating Storyboard',
        description: 'AI generating scene breakdown',
        status: isGeneratingVideo ? 'active' : 'pending'
      },
      {
        id: 'visuals',
        title: 'Generating Visuals',
        description: 'Creating AI images for each scene',
        status: 'pending'
      },
      {
        id: 'narration',
        title: 'Generating Narration',
        description: 'Creating professional voiceover',
        status: 'pending'
      },
      {
        id: 'assembly',
        title: 'Final Assembly',
        description: 'Combining all assets into video',
        status: 'pending'
      }
    ];

    // Update statuses based on video generation progress
    if (isGeneratingVideo) {
      // Mark earlier steps as completed
      steps[0].status = 'completed'; // Script
      steps[1].status = 'completed'; // Review
      steps[2].status = 'completed'; // Voice
      
      // These will be dynamically updated during actual generation
      // For now, show storyboard as active when generating
      steps[3].status = 'active';
    }

    return steps;
  };

  const workflowSteps = getWorkflowSteps();

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="p-6 flex-1">
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Video Creation Workflow</h3>
          <p className="text-sm text-muted-foreground">
            Track your progress through each step
          </p>
        </div>

        <div className="space-y-4">
          {workflowSteps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 transition-all duration-300",
                step.status === 'completed' && "opacity-80"
              )}
            >
              {/* Status Icon */}
              <div className="mt-0.5">
                {step.status === 'completed' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : step.status === 'active' ? (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/50" />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "font-medium text-sm",
                    step.status === 'completed' && "text-green-600 dark:text-green-400",
                    step.status === 'active' && "text-blue-600 dark:text-blue-400",
                    step.status === 'pending' && "text-muted-foreground"
                  )}
                >
                  {step.title}
                </div>
                <div
                  className={cn(
                    "text-xs mt-0.5",
                    step.status === 'pending' ? "text-muted-foreground/60" : "text-muted-foreground"
                  )}
                >
                  {step.description}
                </div>
              </div>

              {/* Progress Line */}
              {index < workflowSteps.length - 1 && (
                <div className="absolute ml-2.5 mt-7 w-0.5 h-8 -z-10">
                  <div
                    className={cn(
                      "w-full h-full transition-all duration-500",
                      step.status === 'completed' ? "bg-green-500/30" : "bg-muted"
                    )}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Progress Summary */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">
              {workflowSteps.filter(s => s.status === 'completed').length} / {workflowSteps.length}
            </span>
          </div>
          <div className="mt-2 w-full bg-muted rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${(workflowSteps.filter(s => s.status === 'completed').length / workflowSteps.length) * 100}%`
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}