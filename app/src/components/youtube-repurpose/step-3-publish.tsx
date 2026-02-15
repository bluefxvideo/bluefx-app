'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Check,
  AlertCircle,
  Globe,
  Linkedin,
  ArrowLeft,
  ExternalLink,
  Send,
  RotateCcw,
} from 'lucide-react';
import {
  useYouTubeRepurposeStore,
  type PublishPlatform,
  type PostingStatus,
} from './store/youtube-repurpose-store';

const PLATFORM_INFO: Record<PublishPlatform, {
  name: string;
  icon: React.ReactNode;
  description: string;
}> = {
  wordpress: {
    name: 'WordPress Blog',
    icon: <Globe className="h-5 w-5" />,
    description: 'SEO-optimized blog post with YouTube embed',
  },
  linkedin: {
    name: 'LinkedIn',
    icon: <Linkedin className="h-5 w-5" />,
    description: 'Native video + professional caption',
  },
};

function StatusIcon({ status }: { status: PostingStatus }) {
  switch (status) {
    case 'pending':
      return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    case 'posting':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'done':
      return <Check className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
  }
}

export function Step3Publish() {
  const selectedPlatforms = useYouTubeRepurposeStore((s) => s.selectedPlatforms);
  const isPublishing = useYouTubeRepurposeStore((s) => s.isPublishing);
  const postingProgress = useYouTubeRepurposeStore((s) => s.postingProgress);
  const wordpressConnected = useYouTubeRepurposeStore((s) => s.wordpressConnected);
  const socialConnections = useYouTubeRepurposeStore((s) => s.socialConnections);
  const videoStorageUrl = useYouTubeRepurposeStore((s) => s.videoStorageUrl);
  const error = useYouTubeRepurposeStore((s) => s.error);

  const togglePlatform = useYouTubeRepurposeStore((s) => s.togglePlatform);
  const publishAll = useYouTubeRepurposeStore((s) => s.publishAll);
  const canPublish = useYouTubeRepurposeStore((s) => s.canPublish);
  const prevStep = useYouTubeRepurposeStore((s) => s.prevStep);
  const resetWizard = useYouTubeRepurposeStore((s) => s.resetWizard);

  const hasFinished = postingProgress.length > 0 && !isPublishing;
  const allDone = postingProgress.every(p => p.status === 'done');
  const anySuccess = postingProgress.some(p => p.status === 'done');

  // Show results if publishing is complete
  if (hasFinished) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="text-center mb-6">
            {allDone ? (
              <>
                <Check className="mx-auto mb-3 h-12 w-12 text-green-500" />
                <h3 className="text-lg font-semibold">All Published</h3>
                <p className="text-muted-foreground">Your content has been distributed to all platforms.</p>
              </>
            ) : anySuccess ? (
              <>
                <AlertCircle className="mx-auto mb-3 h-12 w-12 text-yellow-500" />
                <h3 className="text-lg font-semibold">Partially Published</h3>
                <p className="text-muted-foreground">Some platforms failed. Check the details below.</p>
              </>
            ) : (
              <>
                <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-500" />
                <h3 className="text-lg font-semibold">Publishing Failed</h3>
                <p className="text-muted-foreground">All platforms failed. Check the errors below.</p>
              </>
            )}
          </div>

          <div className="space-y-3">
            {postingProgress.map((progress) => {
              const info = PLATFORM_INFO[progress.platform];
              return (
                <div
                  key={progress.platform}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon status={progress.status} />
                    <div className="flex items-center gap-2">
                      {info.icon}
                      <span className="font-medium">{info.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {progress.status === 'done' && progress.url && (
                      <a
                        href={progress.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {progress.status === 'error' && progress.message && (
                      <span className="text-sm text-red-500 max-w-xs truncate">
                        {progress.message}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex justify-center">
          <Button size="lg" onClick={resetWizard}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Repurpose Another Video
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform Selection */}
      <Card className="p-6">
        <Label className="text-lg font-semibold mb-4 block">
          Select Destinations
        </Label>

        <div className="space-y-3">
          {(Object.keys(PLATFORM_INFO) as PublishPlatform[]).map((platform) => {
            const info = PLATFORM_INFO[platform];
            const isSelected = selectedPlatforms.includes(platform);
            const isSocialPlatform = platform !== 'wordpress';
            const isNotConnected = isSocialPlatform
              ? !socialConnections[platform as keyof typeof socialConnections]?.connected
              : !wordpressConnected;
            const isDisabled = isNotConnected || (isSocialPlatform && !videoStorageUrl);

            return (
              <label
                key={platform}
                className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => !isDisabled && togglePlatform(platform)}
                    disabled={isDisabled}
                  />
                  <div className="flex items-center gap-2">
                    {info.icon}
                    <div>
                      <span className="font-medium">{info.name}</span>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>
                  </div>
                </div>
                {isDisabled && (
                  <span className="text-xs text-muted-foreground">
                    {isNotConnected ? 'Not connected' : 'No video'}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </Card>

      {/* Publishing Progress (during publish) */}
      {isPublishing && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <Label className="text-lg font-semibold">Publishing...</Label>
          </div>

          <div className="space-y-3">
            {postingProgress.map((progress) => {
              const info = PLATFORM_INFO[progress.platform];
              return (
                <div
                  key={progress.platform}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <StatusIcon status={progress.status} />
                  <div className="flex items-center gap-2">
                    {info.icon}
                    <span className="font-medium">{info.name}</span>
                  </div>
                  {progress.message && (
                    <span className="ml-auto text-sm text-muted-foreground">
                      {progress.message}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep} disabled={isPublishing}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          size="lg"
          onClick={publishAll}
          disabled={!canPublish() || isPublishing}
        >
          {isPublishing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Publishing...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Publish to {selectedPlatforms.length} Platform{selectedPlatforms.length !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
