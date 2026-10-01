'use client';

import { useEffect, useState } from 'react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { Film, History, Upload as UploadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { urlToFile } from '@/lib/url-to-file';
import { useVideoRoughcut } from './hooks/use-video-roughcut';
import { UploadTab } from './tabs/upload-tab';
import { HistoryTab } from './tabs/history-tab';
import { JobOutput } from './output-panel/job-output';
import type { RoughcutExample } from './examples';
import { RoughcutExamples, RoughcutTips } from './roughcut-examples';

/**
 * Rough-Cut Editor — top-level page.
 * Tabs: Upload | History. Upload tab uses a 2-column layout on large screens
 * (input on the left, output panel on the right).
 */
export function VideoRoughcutPage() {
  const [tab, setTab] = useState<'upload' | 'history'>('upload');
  const {
    currentJob,
    isProcessing,
    stage,
    progress,
    error,
    pending,
    availableCredits,
    prepareFile,
    confirmJob,
    reset,
  } = useVideoRoughcut();

  // "Try this example": the example recording goes through the same steps as a dropped file.
  // Reading the file and showing the price is free; the charge comes with "Create rough cut".
  const [loadingExampleId, setLoadingExampleId] = useState<string | null>(null);
  const handleTryExample = async (example: RoughcutExample) => {
    setLoadingExampleId(example.id);
    try {
      const file = await urlToFile(example.rawVideo.url, example.rawVideo.name, 'video/mp4');
      await prepareFile(file);
    } catch {
      toast.error('Could not load the example. Please try again.');
    } finally {
      setLoadingExampleId(null);
    }
  };

  // Toast on completion / failure
  useEffect(() => {
    if (!currentJob) return;
    if (currentJob.status === 'done') {
      toast.success('Rough cut ready. Download the XML for Premiere Pro or DaVinci Resolve.');
    } else if (currentJob.status === 'failed') {
      toast.error(currentJob.status_reason || 'Job failed');
    }
  }, [currentJob?.status, currentJob?.status_reason, currentJob]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
          <Film className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Rough-Cut Editor</h1>
          <p className="text-sm text-muted-foreground">
            Drop a talking-head video. Get back an XML for Premiere Pro or DaVinci
            Resolve with the umms, false starts and bad takes already cut.
          </p>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'upload' | 'history')}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="upload">
            <UploadIcon className="w-3.5 h-3.5" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-3.5 h-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <RoughcutTips />
              <UploadTab
                stage={stage}
                progress={progress}
                error={error}
                isProcessing={isProcessing}
                pending={pending}
                availableCredits={availableCredits}
                onStart={prepareFile}
                onConfirm={confirmJob}
                onReset={reset}
              />
            </div>
            <div>
              {currentJob ? (
                <JobOutput
                  job={currentJob}
                  onDismiss={reset}
                  onRetry={reset}
                />
              ) : (
                // No job yet: a real rough cut from this tool, played against the raw recording
                <RoughcutExamples onTry={handleTryExample} loadingId={loadingExampleId} busy={isProcessing} />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default VideoRoughcutPage;
