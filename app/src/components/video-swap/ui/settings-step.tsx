'use client';

import { Settings, Coins, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { VideoSwapSettings } from '../store/video-swap-store';
import {
  VIDEO_SWAP_CREDITS_PER_SECOND,
  VIDEO_SWAP_MAX_SECONDS,
  type VideoSwapOrientation,
} from '@/lib/video-swap/pricing';

interface SettingsStepProps {
  settings: VideoSwapSettings;
  onSettingsChange: (settings: Partial<VideoSwapSettings>) => void;
  availableCredits: number;
  creditsRequired: number;
  /** Source clip length in seconds, read in the browser at upload. */
  sourceVideoDuration: number | null;
  onGenerate: () => void;
  onBack: () => void;
  isLoading: boolean;
}

const ORIENTATIONS: Array<{ value: VideoSwapOrientation; title: string; detail: string }> = [
  {
    value: 'video',
    title: 'Follow the video',
    detail: `The character faces the way the person in the video does. Best for complex motion. Up to ${VIDEO_SWAP_MAX_SECONDS.video} seconds.`,
  },
  {
    value: 'image',
    title: 'Follow the image',
    detail: `The character keeps the pose and angle of the photo. Best when the camera moves. Up to ${VIDEO_SWAP_MAX_SECONDS.image} seconds.`,
  },
];

export function SettingsStep({
  settings,
  onSettingsChange,
  availableCredits,
  creditsRequired,
  sourceVideoDuration,
  onGenerate,
  onBack,
  isLoading,
}: SettingsStepProps) {
  const hasEnoughCredits = availableCredits >= creditsRequired;
  const maxSeconds = VIDEO_SWAP_MAX_SECONDS[settings.character_orientation];
  const tooLong = !!sourceVideoDuration && sourceVideoDuration > maxSeconds + 0.5;
  const billedSeconds = sourceVideoDuration ? Math.max(1, Math.ceil(sourceVideoDuration)) : 0;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground mt-2">
          Three choices, straight from the engine. The defaults work for most clips.
        </p>
      </div>

      {/* Credits Card */}
      <Card className={hasEnoughCredits ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'}>
        <CardContent className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-3">
            <Coins className={`h-5 w-5 ${hasEnoughCredits ? 'text-green-500' : 'text-red-500'}`} />
            <div>
              <p className="font-medium">Credits Required</p>
              <p className="text-sm text-muted-foreground">
                {billedSeconds > 0
                  ? `${billedSeconds} s × ${VIDEO_SWAP_CREDITS_PER_SECOND} credits per second · ${availableCredits} available`
                  : `${VIDEO_SWAP_CREDITS_PER_SECOND} credits per second of video · ${availableCredits} available`}
              </p>
            </div>
          </div>
          <Badge variant={hasEnoughCredits ? 'default' : 'destructive'} className="text-lg px-4 py-1">
            {creditsRequired} credits
          </Badge>
        </CardContent>
      </Card>

      {!hasEnoughCredits && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="font-medium text-red-500">Insufficient Credits</p>
              <p className="text-sm text-muted-foreground">
                You need {creditsRequired - availableCredits} more credits to generate this video.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {tooLong && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Clip too long for this setting</AlertTitle>
          <AlertDescription>
            Your clip is {sourceVideoDuration!.toFixed(1)} s. Following the image allows {VIDEO_SWAP_MAX_SECONDS.image} s;
            switch to following the video for clips up to {VIDEO_SWAP_MAX_SECONDS.video} s, or upload a shorter clip.
          </AlertDescription>
        </Alert>
      )}

      {/* Processing Time Notice */}
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>Processing Time</AlertTitle>
        <AlertDescription>
          About <strong>2 minutes per second</strong> of video, so a 5 second clip takes around 10 minutes.
          You can close this page; the finished video appears in the History tab.
        </AlertDescription>
      </Alert>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Swap Settings
          </CardTitle>
          <CardDescription>
            The person from your photo performs the motion of the person in your video
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Character orientation */}
          <div className="space-y-2">
            <Label>Character orientation</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {ORIENTATIONS.map((option) => {
                const selected = settings.character_orientation === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onSettingsChange({ character_orientation: option.value })}
                    className={cn(
                      'rounded-lg border p-4 text-left transition-colors',
                      selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    )}
                  >
                    <p className="font-medium">{option.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{option.detail}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Keep original sound */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sound">Keep original sound</Label>
              <p className="text-sm text-muted-foreground">
                The audio track of your video stays on the result
              </p>
            </div>
            <Switch
              id="sound"
              checked={settings.keep_original_sound}
              onCheckedChange={(checked) => onSettingsChange({ keep_original_sound: checked })}
            />
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt (optional)</Label>
            <Textarea
              id="prompt"
              value={settings.prompt}
              onChange={(e) => onSettingsChange({ prompt: e.target.value })}
              placeholder="Describe the scene if you want to steer it, e.g. a bright kitchen, soft daylight"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          size="lg"
          disabled={isLoading}
        >
          Back
        </Button>
        <Button
          onClick={onGenerate}
          disabled={!hasEnoughCredits || tooLong || isLoading || creditsRequired === 0}
          size="lg"
        >
          {isLoading ? 'Starting...' : `Swap (${creditsRequired} credits)`}
        </Button>
      </div>
    </div>
  );
}
