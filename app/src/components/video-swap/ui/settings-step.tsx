'use client';

import { Settings, Coins, AlertTriangle, Clock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { VideoSwapSettings } from '../store/video-swap-store';

interface SettingsStepProps {
  settings: VideoSwapSettings;
  onSettingsChange: (settings: Partial<VideoSwapSettings>) => void;
  availableCredits: number;
  creditsRequired: number;
  onGenerate: () => void;
  onBack: () => void;
  isLoading: boolean;
}

export function SettingsStep({
  settings,
  onSettingsChange,
  availableCredits,
  creditsRequired,
  onGenerate,
  onBack,
  isLoading,
}: SettingsStepProps) {
  const hasEnoughCredits = availableCredits >= creditsRequired;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Configure Settings</h2>
        <p className="text-muted-foreground mt-2">
          Adjust the video swap settings (optional)
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
                {availableCredits} available
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

      {/* Processing Time Notice */}
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>Processing Time</AlertTitle>
        <AlertDescription>
          Video swap uses advanced AI that takes <strong>8-12 minutes</strong> to process even short videos (5-10 seconds).
          Longer videos will take proportionally more time. You can close this page and check back later -
          your video will appear in the History tab when complete.
        </AlertDescription>
      </Alert>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Video Settings
          </CardTitle>
          <CardDescription>
            Fine-tune the output quality and processing options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Resolution */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="resolution">Resolution</Label>
              <p className="text-sm text-muted-foreground">
                Higher resolution = better quality
              </p>
            </div>
            <Select
              value={settings.resolution}
              onValueChange={(value) => onSettingsChange({ resolution: value as '480' | '720' })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="480">480p</SelectItem>
                <SelectItem value="720">720p</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Frame Rate */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="fps">Frame Rate</Label>
              <p className="text-sm text-muted-foreground">
                Match your source video for best results
              </p>
            </div>
            <Select
              value={settings.frames_per_second.toString()}
              onValueChange={(value) => onSettingsChange({ frames_per_second: parseInt(value) })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 fps</SelectItem>
                <SelectItem value="30">30 fps</SelectItem>
                <SelectItem value="60">60 fps</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reference Frames */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="refert">Reference Frames</Label>
              <p className="text-sm text-muted-foreground">
                More frames = smoother but slower
              </p>
            </div>
            <Select
              value={settings.refert_num.toString()}
              onValueChange={(value) => onSettingsChange({ refert_num: parseInt(value) as 1 | 5 })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 frame</SelectItem>
                <SelectItem value="5">5 frames</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Keep Audio */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="audio">Keep Original Audio</Label>
              <p className="text-sm text-muted-foreground">
                Preserve the audio from your source video
              </p>
            </div>
            <Switch
              id="audio"
              checked={settings.merge_audio}
              onCheckedChange={(checked) => onSettingsChange({ merge_audio: checked })}
            />
          </div>

          {/* Fast Processing */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="fast">Fast Processing</Label>
              <p className="text-sm text-muted-foreground">
                Speed up generation (recommended)
              </p>
            </div>
            <Switch
              id="fast"
              checked={settings.go_fast}
              onCheckedChange={(checked) => onSettingsChange({ go_fast: checked })}
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
          disabled={!hasEnoughCredits || isLoading}
          size="lg"
        >
          {isLoading ? 'Starting...' : `Generate (${creditsRequired} credits)`}
        </Button>
      </div>
    </div>
  );
}
