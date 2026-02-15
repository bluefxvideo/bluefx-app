'use client';

import { useYouTubeRepurposeStore } from './store/youtube-repurpose-store';
import { Step1Input } from './step-1-input';
import { Step2Review } from './step-2-review';
import { Step3Publish } from './step-3-publish';

const STEPS = [
  { number: 1, label: 'YouTube URL' },
  { number: 2, label: 'Review Content' },
  { number: 3, label: 'Publish' },
];

export function YouTubeRepurposePage() {
  const currentStep = useYouTubeRepurposeStore((s) => s.currentStep);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">YouTube Repurpose</h1>
        <p className="text-muted-foreground mt-1">
          Distribute your YouTube video across Facebook, LinkedIn, Twitter/X, and your WordPress blog
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => (
          <div key={step.number} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  currentStep === step.number
                    ? 'bg-primary text-primary-foreground'
                    : currentStep > step.number
                      ? 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {currentStep > step.number ? '✓' : step.number}
              </div>
              <span
                className={`text-sm font-medium ${
                  currentStep === step.number
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-2 h-px w-12 ${
                  currentStep > step.number ? 'bg-green-500' : 'bg-border'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {currentStep === 1 && <Step1Input />}
      {currentStep === 2 && <Step2Review />}
      {currentStep === 3 && <Step3Publish />}
    </div>
  );
}
