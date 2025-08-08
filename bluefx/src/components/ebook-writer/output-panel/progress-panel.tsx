'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Clock, 
  CreditCard, 
  CheckCircle,
  AlertCircle 
} from 'lucide-react';
import type { GenerationProgress } from '../store/ebook-writer-store';

interface ProgressPanelProps {
  progress: GenerationProgress;
}

export function ProgressPanel({ progress }: ProgressPanelProps) {
  const getStepLabel = (step: string) => {
    const labels = {
      topic: 'Topic Selection',
      title: 'Title Generation',
      outline: 'Outline Creation',
      content: 'Content Generation',
      cover: 'Cover Design',
      export: 'Export Processing',
      history: 'History'
    };
    return labels[step as keyof typeof labels] || step;
  };

  const getStepIcon = (step: string) => {
    if (progress.current_step === step && progress.is_generating) {
      return <Activity className="h-4 w-4 animate-pulse text-blue-500" />;
    }
    
    // Check if step is completed based on progress
    const stepOrder = ['topic', 'title', 'outline', 'content', 'cover', 'export'];
    const currentIndex = stepOrder.indexOf(progress.current_step);
    const stepIndex = stepOrder.indexOf(step);
    
    if (stepIndex < currentIndex || progress.total_progress === 100) {
      return <CheckCircle className="h-4 w-4 text-blue-600" />;
    }
    
    return <div className="h-4 w-4 border-2 border-muted rounded-full" />;
  };

  return (
    <Card className="w-full bg-white dark:bg-gray-800/40">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Generation Progress
          </span>
          <Badge variant={progress.is_generating ? "default" : "secondary"} className="text-xs">
            {progress.is_generating ? 'Generating' : 'Ready'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{Math.round(progress.total_progress)}%</span>
          </div>
          <Progress value={progress.total_progress} className="h-2" />
        </div>

        {/* Current Step Progress */}
        {progress.is_generating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Current Step</span>
              <span>{Math.round(progress.step_progress)}%</span>
            </div>
            <Progress value={progress.step_progress} className="h-1" />
          </div>
        )}

        {/* Step Status List */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Steps:</div>
          <div className="space-y-1">
            {['topic', 'title', 'outline', 'content', 'cover', 'export'].map((step) => (
              <div 
                key={step} 
                className={`flex items-center gap-2 text-sm p-2 rounded ${
                  progress.current_step === step ? 'bg-muted' : ''
                }`}
              >
                {getStepIcon(step)}
                <span className={progress.current_step === step ? 'font-medium' : ''}>
                  {getStepLabel(step)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CreditCard className="h-3 w-3" />
              Credits Used
            </div>
            <div className="text-sm font-medium">
              {progress.credits_used}
            </div>
          </div>
          
          {progress.estimated_time_remaining && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Time Remaining
              </div>
              <div className="text-sm font-medium">
                {Math.round(progress.estimated_time_remaining / 60)}m
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {progress.error_message && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">
              {progress.error_message}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}