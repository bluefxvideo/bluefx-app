'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Zap, Brain, Mic, Camera, Film } from 'lucide-react';

export function LoadingSkeleton() {
  const steps = [
    { icon: Brain, label: 'AI analyzing script', completed: true },
    { icon: Zap, label: 'Creating production plan', completed: true },
    { icon: Mic, label: 'Generating voice over', completed: false },
    { icon: Camera, label: 'Creating visuals', completed: false },
    { icon: Film, label: 'Assembling video', completed: false },
  ];

  return (
    <div className="space-y-6">
      {/* Progress Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Film className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-medium mb-2">AI Video Orchestrator Working...</h3>
            <p className="text-sm text-muted-foreground">
              Creating your professional video with intelligent workflow optimization
            </p>
          </div>

          <Progress value={35} className="mb-4" />

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  step.completed 
                    ? 'bg-blue-100 text-blue-600' 
                    : index === 2 
                    ? 'bg-blue-100 text-blue-600 animate-pulse' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  <step.icon className="w-3 h-3" />
                </div>
                <span className={`text-sm ${
                  step.completed 
                    ? 'text-blue-600' 
                    : index === 2 
                    ? 'text-blue-600 font-medium' 
                    : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Video Preview Skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="aspect-[9/16] bg-gray-100 rounded-lg animate-pulse mb-4" />
          <div className="flex gap-2">
            <div className="flex-1 h-10 bg-gray-100 rounded animate-pulse" />
            <div className="w-10 h-10 bg-gray-100 rounded animate-pulse" />
            <div className="w-10 h-10 bg-gray-100 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}