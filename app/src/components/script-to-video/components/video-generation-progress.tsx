'use client';

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";
import { 
  Brain, 
  Zap, 
  Image, 
  Mic, 
  Film, 
  CheckCircle2,
  Circle,
  Loader2
} from "lucide-react";

const CheckIcon = ({ className }: { className?: string }) => {
  return (
    <CheckCircle2 className={cn("w-5 h-5", className)} />
  );
};

const PendingIcon = ({ className }: { className?: string }) => {
  return (
    <Circle className={cn("w-5 h-5", className)} />
  );
};

const LoadingIcon = ({ className }: { className?: string }) => {
  return (
    <Loader2 className={cn("w-5 h-5 animate-spin", className)} />
  );
};

interface GenerationStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  status: 'pending' | 'processing' | 'completed' | 'error';
  duration?: number;
}

interface VideoGenerationProgressProps {
  isGenerating: boolean;
  currentStep?: string;
  steps?: GenerationStep[];
  onComplete?: () => void;
}

const defaultSteps: GenerationStep[] = [
  {
    id: 'validation',
    title: 'Validating Credits',
    description: 'Checking account balance and permissions',
    icon: Zap,
    status: 'pending'
  },
  {
    id: 'analysis',
    title: 'AI Script Analysis',
    description: 'Understanding your content and creating production plan',
    icon: Brain,
    status: 'pending'
  },
  {
    id: 'storyboard',
    title: 'Creating Storyboard',
    description: 'AI generating scene-by-scene breakdown',
    icon: Film,
    status: 'pending'
  },
  {
    id: 'images',
    title: 'Generating Visuals',
    description: 'Creating AI-generated images for each scene',
    icon: Image,
    status: 'pending'
  },
  {
    id: 'voice',
    title: 'Generating Narration',
    description: 'Creating professional voiceover with your settings',
    icon: Mic,
    status: 'pending'
  },
  {
    id: 'assembly',
    title: 'Final Assembly',
    description: 'Combining all assets into your video',
    icon: Film,
    status: 'pending'
  }
];

const StepIcon = ({ step, isActive }: { step: GenerationStep, isActive: boolean }) => {
  const IconComponent = step.icon;
  
  if (step.status === 'completed') {
    return <CheckIcon className="text-green-500" />;
  } else if (step.status === 'processing' || isActive) {
    return <LoadingIcon className="text-blue-500" />;
  } else if (step.status === 'error') {
    return <Circle className="w-5 h-5 text-red-500" />;
  } else {
    return <PendingIcon className="text-gray-400" />;
  }
};

const ProgressCore = ({
  steps,
  currentStepIndex = 0,
}: {
  steps: GenerationStep[];
  currentStepIndex?: number;
}) => {
  return (
    <div className="flex flex-col space-y-4 w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Creating Your Video
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          AI is working on your script...
        </p>
      </div>
      
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex;
        const isCompleted = index < currentStepIndex;
        const opacity = isActive ? 1 : isCompleted ? 0.8 : 0.4;
        
        return (
          <motion.div
            key={step.id}
            className="flex items-center space-x-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <div className="flex-shrink-0">
              <StepIcon step={{ ...step, status: isCompleted ? 'completed' : isActive ? 'processing' : 'pending' }} isActive={isActive} />
            </div>
            
            <div className="flex-grow min-w-0">
              <div className={cn(
                "font-medium text-sm",
                isActive ? "text-blue-600 dark:text-blue-400" : 
                isCompleted ? "text-green-600 dark:text-green-400" : 
                "text-gray-500 dark:text-gray-400"
              )}>
                {step.title}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {step.description}
              </div>
            </div>
            
            {isActive && (
              <motion.div
                className="w-2 h-2 bg-blue-500 rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </motion.div>
        );
      })}
      
      <div className="mt-6 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      <div className="text-center text-xs text-gray-500 dark:text-gray-400">
        Step {currentStepIndex + 1} of {steps.length}
      </div>
    </div>
  );
};

export const VideoGenerationProgress = ({
  isGenerating,
  currentStep,
  steps = defaultSteps,
  onComplete
}: VideoGenerationProgressProps) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  useEffect(() => {
    if (!isGenerating) {
      setCurrentStepIndex(0);
      return;
    }
    
    // Auto-advance through steps
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          onComplete?.();
          return prev;
        }
      });
    }, 8000); // 8 seconds per step on average
    
    return () => clearInterval(interval);
  }, [isGenerating, steps.length, onComplete]);
  
  // Update step based on currentStep prop if provided
  useEffect(() => {
    if (currentStep) {
      const stepIndex = steps.findIndex(step => step.id === currentStep);
      if (stepIndex >= 0) {
        setCurrentStepIndex(stepIndex);
      }
    }
  }, [currentStep, steps]);
  
  return (
    <AnimatePresence mode="wait">
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full h-full flex items-center justify-center p-6"
        >
          <div className="relative w-full">
            <ProgressCore steps={steps} currentStepIndex={currentStepIndex} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};