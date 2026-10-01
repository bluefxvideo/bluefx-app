'use client';

import { useEffect, useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { ExampleChip, ExampleFile, ExampleText, ToolExamples } from '@/components/tools/tool-examples';
import { ToolTips } from '@/components/tools/tool-tips';
import { ANALYZE_VIDEO_EXAMPLES, type AnalyzeVideoExample } from './examples';

/** The saved analysis of an example, the whole text in a box that scrolls. Mounted anew for each example. */
function SavedAnalysis({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`analysis: ${res.status}`);
        return res.text();
      })
      .then((body) => {
        if (!cancelled) setText(body);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="flex min-h-0 flex-col rounded-lg border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium">What came out</p>
      <pre className="max-h-[340px] flex-1 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted-foreground">
        {failed ? 'The saved analysis could not be loaded. Check the connection and reload the page.' : text ?? 'Loading the analysis...'}
      </pre>
    </div>
  );
}

/**
 * Shown where the analysis appears while nothing is analyzed: an ad, the analysis
 * the tool made of it, what went in, and a button that opens it all in the form.
 */
export function AnalyzeVideoExamples({
  onTry,
  loadingId,
  busy,
}: {
  onTry: (example: AnalyzeVideoExample) => void;
  loadingId: string | null;
  busy: boolean;
}) {
  return (
    <ToolExamples
      heading="What Analyze Video makes"
      intro="Three of our own sample ads and what this tool wrote about each one. The businesses are made up. Under each: exactly what went in."
      icon={ScanSearch}
      examples={ANALYZE_VIDEO_EXAMPLES}
      media={(example) => (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
          <video
            src={example.video.url}
            poster={example.video.posterUrl}
            controls
            playsInline
            preload="metadata"
            className="mx-auto aspect-[9/16] w-full max-w-[200px] rounded-lg bg-black"
          />
          <SavedAnalysis url={example.analysisUrl} />
        </div>
      )}
      renderInputs={(example) => (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ExampleFile name={example.video.name} url={example.video.url} kind="clip" caption="Video file" />
            <ExampleChip>Analysis type: {example.analysisTypeLabel}</ExampleChip>
            <ExampleChip>{example.credits} credits</ExampleChip>
          </div>
          {example.instructions && <ExampleText>Instructions: {example.instructions}</ExampleText>}
        </>
      )}
      onTry={onTry}
      loadingId={loadingId}
      busy={busy}
      tryNote="Opens the video, the settings and the saved analysis, free. Analyze Video would run it again for 3 credits."
    />
  );
}

/** Short rules for a strong result, above the upload box. */
export function AnalyzeVideoTips() {
  return (
    <ToolTips
      storageKey="analyzeVideo.tips.closed"
      tips={[
        'Pick the analysis for the job: Storyboard Recreation to clone an ad, Script/Dialogue Extraction for the words, Shot List Only for camera work and timing.',
        'Have the video file? Upload the file: 3 credits per minute. A link from YouTube, TikTok, Instagram or Facebook costs 6 credits.',
        'A video can run up to 3 minutes and 100 MB. Cut a longer video down to the part you want analyzed.',
        'Aim the analysis with Additional Instructions, for example "Focus on the first 5 seconds and why the hook works".',
        'Custom Prompt Only sends just your own question: "List the hook, the offer and the call to action, then write 3 new hooks".',
        'Click Clone this ad to carry the breakdown into Clone Video Ad and remake the ad with your own product. Every analysis stays under View Analysis History.',
      ]}
    />
  );
}
