'use client';

import { VideoSwapWizard } from './video-swap-wizard';
import { HistorySection } from './ui/history-section';
import { useVideoSwap } from './hooks/use-video-swap';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Repeat, Sparkles, Wand2, History } from 'lucide-react';

export function VideoSwap() {
  const { jobHistory, refreshHistory } = useVideoSwap();

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="rounded-xl bg-primary/10 p-3">
          <Repeat className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Video Swap</h1>
          <p className="text-muted-foreground">
            Replace the character in your video while keeping all motion and expressions
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="create" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Create
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10">
              <CardContent className="flex items-center gap-3 pt-4">
                <Sparkles className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">Motion Preserved</p>
                  <p className="text-sm text-muted-foreground">Keep all movements & gestures</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10">
              <CardContent className="flex items-center gap-3 pt-4">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="font-medium">Lip Sync Intact</p>
                  <p className="text-sm text-muted-foreground">Perfect audio synchronization</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-pink-500/10 to-orange-500/10">
              <CardContent className="flex items-center gap-3 pt-4">
                <Sparkles className="h-5 w-5 text-pink-500" />
                <div>
                  <p className="font-medium">Scene Lighting</p>
                  <p className="text-sm text-muted-foreground">Automatic lighting adjustment</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Wizard */}
          <VideoSwapWizard />
        </TabsContent>

        <TabsContent value="history">
          <HistorySection jobs={jobHistory} onRefresh={refreshHistory} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Re-export components for external use
export { VideoSwapWizard } from './video-swap-wizard';
export { useVideoSwap } from './hooks/use-video-swap';
export { useVideoSwapStore } from './store/video-swap-store';
export type { VideoSwapJob, VideoSwapSettings, WizardStep, JobStatus } from './store/video-swap-store';
