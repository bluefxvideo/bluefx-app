'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ElapsedTimer } from '@/components/tools/elapsed-timer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Clock, Loader2, Video, X, RefreshCw, SlidersHorizontal, Mic, Upload } from 'lucide-react';

interface VideoPreviewProps {
  video: {
    id: string;
    video_url: string;
    thumbnail_url?: string;
    duration: number;
    resolution?: string;
    prompt: string;
    created_at: string;
    voice_video_url?: string | null;
  };
  batchId: string;
  /** Generation tier — calibrates the time estimate ('fast' | 'pro' | 'ultra') */
  model?: string;
  onCancel?: () => void;
  onRegenerate?: () => void;
  onTweak?: () => void;
  /** Switch voice: null file = reuse the remembered sample. Absent = feature hidden. */
  onSwitchVoice?: (file: File | null) => void;
  lastVoiceSample?: { url: string; name: string } | null;
  isSwitchingVoice?: boolean;
}

/**
 * Estimate generation time in seconds, calibrated per model from measured
 * fal.ai generations (2026-07-02):
 * - Fast (LTX 2.3):       6s @ 1080p finished in <10s → ~10s + 2s/videosec
 * - Pro (Seedance 1.5):   6s clips observed 80-190s   → ~60s + 15s/videosec
 * - Ultra (Seedance 2.0): 6s ≈ 190s, 15s ≈ 300s       → ~120s + 12s/videosec
 * Higher Fast resolutions take longer (2k ~1.5x, 4k ~2.5x).
 */
function getEstimatedTime(duration: number, resolution?: string, model?: string): number {
  let estimatedSeconds: number;
  if (model === 'ultra') {
    estimatedSeconds = 120 + duration * 12;
  } else if (model === 'pro') {
    estimatedSeconds = 60 + duration * 15;
  } else {
    estimatedSeconds = 10 + duration * 2;
    if (resolution === '2k') estimatedSeconds *= 1.5;
    else if (resolution === '4k') estimatedSeconds *= 2.5;
  }
  return Math.round(estimatedSeconds);
}

/** Human-readable typical range per tier, shown next to the elapsed timer */
function getTypicalLabel(model?: string): string {
  if (model === 'ultra') return '3–5 minutes';
  if (model === 'pro') return '1–3 minutes';
  return 'under a minute';
}

/**
 * Video preview component with playback controls
 */
export function VideoPreview({ video, batchId, model, onCancel, onRegenerate, onTweak, onSwitchVoice, lastVoiceSample, isSwitchingVoice }: VideoPreviewProps) {
  const [progress, setProgress] = useState(0);
  // Switch voice UI state
  const [view, setView] = useState<'voice' | 'original'>('voice');
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [useLastSample, setUseLastSample] = useState(false);
  const [isVoiceDragging, setIsVoiceDragging] = useState(false);
  const voiceFileRef = useRef<HTMLInputElement>(null);
  const showVoice = view === 'voice' && !!video.voice_video_url;
  const shownVideoUrl = showVoice ? (video.voice_video_url as string) : video.video_url;

  const acceptVoiceFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type.startsWith('audio/') || /\.(mp3|wav|m4a)$/i.test(file.name)) {
      setVoiceFile(file);
      setUseLastSample(false);
    } else {
      toast.error('Upload an MP3, WAV or M4A voice sample');
    }
  };
  const canSwitchVoice = !!voiceFile || (useLastSample && !!lastVoiceSample);
  const [elapsedTime, setElapsedTime] = useState(0);
  const isProcessing = !video.video_url;

  // Calculate estimated time (model-calibrated)
  const estimatedTime = getEstimatedTime(video.duration, video.resolution, model);

  // Progress animation effect
  useEffect(() => {
    if (!isProcessing) {
      setProgress(100);
      return;
    }

    // Start time tracking
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);

      // Calculate progress - use easing to slow down near the end
      // This creates a more realistic feeling where it slows as it approaches completion
      const linearProgress = (elapsed / estimatedTime) * 100;

      // Ease out - progress slows down as it approaches 95%
      // Never reach 100% until actually complete
      const easedProgress = Math.min(95, linearProgress * (1 - linearProgress / 200));

      setProgress(easedProgress);
    }, 1000);

    return () => clearInterval(interval);
  }, [isProcessing, estimatedTime, video.id]);

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    if (!shownVideoUrl) return;
    
    try {
      // Fetch the video blob (the version currently shown: original or re-voiced)
      const response = await fetch(shownVideoUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Create blob URL and download
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `cinematographer-${batchId}${showVoice ? '-your-voice' : ''}-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to opening in new tab
      window.open(shownVideoUrl, '_blank');
    }
  };

  return (
    <div className="w-full h-auto">
      {/* Auto-height Video Card */}
      <Card className="overflow-hidden h-auto">
        {/* Video Player - Natural aspect ratio */}
        {video.video_url ? (
          <div className="relative aspect-video bg-black">
            {video.voice_video_url && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md border border-white/20 bg-black/60 p-0.5 text-xs backdrop-blur">
                <button
                  type="button"
                  onClick={() => setView('voice')}
                  className={`px-2.5 py-1 rounded ${showVoice ? 'bg-primary text-primary-foreground' : 'text-white/80'}`}
                >
                  <Mic className="w-3 h-3 inline mr-1" />
                  Your voice
                </button>
                <button
                  type="button"
                  onClick={() => setView('original')}
                  className={`px-2.5 py-1 rounded ${!showVoice ? 'bg-primary text-primary-foreground' : 'text-white/80'}`}
                >
                  Original
                </button>
              </div>
            )}
            <video
              key={shownVideoUrl}
              src={shownVideoUrl}
              className="w-full h-full object-contain"
              controls
              preload="metadata"
              poster={video.thumbnail_url}
            />
            {isSwitchingVoice && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <span className="text-sm text-white font-medium">Switching voice...</span>
              </div>
            )}
          </div>
        ) : (
          // Processing Card using aspect-video without footer
          <div className="relative aspect-video bg-muted flex items-center justify-center p-8">
            <Card className="p-8 max-w-sm text-center space-y-4 border-dashed bg-transparent dark:bg-card-content border-input">
              {/* Blue Square with Spinning Icon */}
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>

              {/* Processing Text */}
              <div>
                <h3 className="font-medium mb-2">Processing...</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {video.prompt}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 w-full">
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(elapsedTime)}
                  </span>
                  <span>
                    ~{formatTime(Math.max(0, estimatedTime - elapsedTime))} remaining
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                You can keep working — we&apos;ll notify you when it&apos;s ready.{' '}
                <ElapsedTimer typical={getTypicalLabel(model)} className="tabular-nums" />
              </p>

              {/* Cancel Button */}
              {onCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={onCancel}
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
              )}
            </Card>
          </div>
        )}

        {/* Action buttons - visible when video is ready */}
        {video.video_url && (onRegenerate || onTweak) && (
          <div className="px-4 pt-3 pb-1 bg-card border-t flex gap-2">
            {onRegenerate && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRegenerate}
                className="flex-1 gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </Button>
            )}
            {onTweak && (
              <Button
                variant="outline"
                size="sm"
                onClick={onTweak}
                className="flex-1 gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Tweak & Retry
              </Button>
            )}
          </div>
        )}

        {/* Switch voice — re-voice the finished clip with the user's own sample */}
        {video.video_url && onSwitchVoice && (
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsVoiceDragging(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsVoiceDragging(false); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsVoiceDragging(false); acceptVoiceFile(e.dataTransfer.files[0]); }}
            className={`mx-4 mt-3 mb-1 rounded-lg border bg-muted/20 p-3 space-y-2 transition-colors ${isVoiceDragging ? 'border-primary bg-primary/5' : 'border-border/50'}`}
          >
            <div className="flex items-center gap-2">
              <Mic className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium">
                {video.voice_video_url ? 'Your voice is on this clip' : 'Put your own voice on this clip'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Upload or drop a clean recording of your voice (10–30 seconds, no music). The picture and lip movement stay exactly as they are; only the voice changes.
            </p>
            <input
              ref={voiceFileRef}
              type="file"
              accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (voiceFileRef.current) voiceFileRef.current.value = ''; acceptVoiceFile(f); }}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="shrink-0" disabled={isSwitchingVoice} onClick={() => voiceFileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {voiceFile || useLastSample ? 'Change sample' : 'Choose voice sample'}
              </Button>
              <span className="text-[11px] text-muted-foreground truncate">
                {voiceFile ? `Selected: ${voiceFile.name}` : useLastSample && lastVoiceSample ? `Using last sample: ${lastVoiceSample.name}` : 'MP3, WAV or M4A, or drop it here'}
              </span>
            </div>
            {lastVoiceSample && !voiceFile && !useLastSample && (
              <button type="button" onClick={() => setUseLastSample(true)} disabled={isSwitchingVoice} className="text-[11px] text-primary hover:underline text-left">
                Reuse the sample from last time ({lastVoiceSample.name})
              </button>
            )}
            <Button onClick={() => onSwitchVoice(useLastSample ? null : voiceFile)} disabled={!canSwitchVoice || isSwitchingVoice} size="sm" className="w-full">
              {isSwitchingVoice ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Switching voice…</>
              ) : (
                <><Mic className="w-3.5 h-3.5 mr-1.5" />{video.voice_video_url ? 'Switch voice again' : 'Switch voice'} (4 credits)</>
              )}
            </Button>
          </div>
        )}

        {/* Compact Footer - always visible */}
        <div className="p-4 bg-card border-t">
          <div className="flex items-center justify-between text-sm">
            {video.video_url ? (
              // Completed state - show prompt
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-muted-foreground truncate">{video.prompt}</p>
              </div>
            ) : (
              // Processing state - show less info to match compact design
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-xs text-muted-foreground truncate">Processing video...</p>
              </div>
            )}
            <div className="flex gap-1 items-center shrink-0">
              <span className="text-muted-foreground">{video.duration}s</span>
              <span className="text-muted-foreground">•</span>
              <span className="font-mono text-muted-foreground">{video.id.slice(-8)}</span>
              <span className={video.video_url ? 'text-green-500' : 'text-yellow-500'}>
                {video.video_url ? '✓' : '⋯'}
              </span>
              {video.video_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="h-4 w-4 p-0 ml-1"
                >
                  <Download className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}