'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Maximize2, Sparkles, Upload, Loader2, Video, CheckCircle, AlertCircle } from 'lucide-react';
import { useCredits } from '@/hooks/use-credits';
import { executeVideoUpscale, UpscaleResolution } from '@/actions/tools/video-upscaler';
import { useUser } from '@/hooks/use-user';

interface UpscaleJob {
  id: string;
  video_url: string;
  target_resolution: UpscaleResolution;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result_url?: string;
  error?: string;
  created_at: string;
}

export function VideoUpscaler() {
  const { user } = useUser();
  const { credits, isLoading: isLoadingCredits } = useCredits();
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [targetResolution, setTargetResolution] = useState<UpscaleResolution>('1080p');
  const [estimatedDuration, setEstimatedDuration] = useState(10);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJob, setCurrentJob] = useState<UpscaleJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculate estimated credits
  const estimatedCredits = estimatedDuration * (targetResolution === '4k' ? 2 : 1);

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl('');
      setError(null);

      // Try to get video duration
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setEstimatedDuration(Math.ceil(video.duration));
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
    }
  }, []);

  // Handle URL input
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVideoUrl(e.target.value);
    setVideoFile(null);
    setError(null);
  }, []);

  // Upload video file to storage
  const uploadVideo = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'video');

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload video');
    }

    const data = await response.json();
    return data.url;
  };

  // Start upscaling
  const handleUpscale = async () => {
    if (!user?.id) {
      setError('Please sign in to upscale videos');
      return;
    }

    if (!videoUrl && !videoFile) {
      setError('Please provide a video URL or upload a video file');
      return;
    }

    if (credits < estimatedCredits) {
      setError(`Insufficient credits. You need ${estimatedCredits} credits but have ${credits}.`);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let finalVideoUrl = videoUrl;

      // Upload file if provided
      if (videoFile) {
        setIsUploading(true);
        finalVideoUrl = await uploadVideo(videoFile);
        setIsUploading(false);
      }

      // Create upscale job
      const result = await executeVideoUpscale({
        video_url: finalVideoUrl,
        target_resolution: targetResolution,
        estimated_duration: estimatedDuration,
        user_id: user.id,
      });

      if (result.success && result.job) {
        setCurrentJob({
          id: result.job.id,
          video_url: finalVideoUrl,
          target_resolution: targetResolution,
          status: 'processing',
          created_at: result.job.created_at,
        });
      } else {
        setError(result.error || 'Failed to start upscaling');
      }
    } catch (err) {
      console.error('Upscale error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upscale video');
    } finally {
      setIsProcessing(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="rounded-xl bg-primary/10 p-3">
          <Maximize2 className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Video Upscaler</h1>
          <p className="text-muted-foreground">
            Enhance your videos to HD or 4K resolution using AI
          </p>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10">
          <CardContent className="flex items-center gap-3 pt-4">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <div>
              <p className="font-medium">AI Enhancement</p>
              <p className="text-sm text-muted-foreground">Intelligent detail recovery</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10">
          <CardContent className="flex items-center gap-3 pt-4">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <div>
              <p className="font-medium">Up to 4K</p>
              <p className="text-sm text-muted-foreground">720p to 1080p or 4K</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-pink-500/10 to-orange-500/10">
          <CardContent className="flex items-center gap-3 pt-4">
            <Sparkles className="h-5 w-5 text-pink-500" />
            <div>
              <p className="font-medium">Fast Processing</p>
              <p className="text-sm text-muted-foreground">Powered by Topaz Labs AI</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Form */}
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-6 space-y-6">
          {/* Video Input */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Video Source</Label>

            {/* File Upload */}
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
                id="video-upload"
              />
              <label htmlFor="video-upload" className="cursor-pointer">
                {videoFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <Video className="h-5 w-5 text-primary" />
                    <span className="font-medium">{videoFile.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="font-medium">Upload a video file</p>
                    <p className="text-sm text-muted-foreground">MP4, MOV, WebM up to 500MB</p>
                  </div>
                )}
              </label>
            </div>

            {/* OR Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* URL Input */}
            <div className="space-y-2">
              <Label htmlFor="video-url">Video URL</Label>
              <input
                id="video-url"
                type="url"
                placeholder="https://example.com/video.mp4"
                value={videoUrl}
                onChange={handleUrlChange}
                className="w-full px-3 py-2 border rounded-md bg-background"
                disabled={!!videoFile}
              />
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Target Resolution</Label>
              <Select value={targetResolution} onValueChange={(v) => setTargetResolution(v as UpscaleResolution)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                  <SelectItem value="4k">4K (Ultra HD)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estimated Duration (seconds)</Label>
              <input
                type="number"
                min={1}
                max={600}
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
            </div>
          </div>

          {/* Credits Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Estimated Cost:</span>
              <span className="font-medium">{estimatedCredits} credits</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Your Balance:</span>
              <span className={`font-medium ${credits < estimatedCredits ? 'text-red-500' : ''}`}>
                {isLoadingCredits ? '...' : `${credits} credits`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {targetResolution === '4k' ? '2 credits per second for 4K' : '1 credit per second for 1080p'}
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Current Job Status */}
          {currentJob && (
            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg p-4 flex items-start gap-3">
              {currentJob.status === 'processing' ? (
                <Loader2 className="h-5 w-5 flex-shrink-0 mt-0.5 animate-spin" />
              ) : currentJob.status === 'completed' ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {currentJob.status === 'processing' && 'Upscaling in progress...'}
                  {currentJob.status === 'completed' && 'Upscale complete!'}
                  {currentJob.status === 'failed' && 'Upscale failed'}
                </p>
                <p className="text-xs mt-1">
                  {currentJob.status === 'processing' && 'This may take a few minutes. You can close this page - the video will be updated in your library.'}
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleUpscale}
            disabled={isProcessing || (!videoUrl && !videoFile) || credits < estimatedCredits}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading video...
              </>
            ) : isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting upscale...
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4 mr-2" />
                Upscale Video ({estimatedCredits} credits)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Info Section */}
      <div className="max-w-2xl mx-auto mt-8 text-center text-sm text-muted-foreground">
        <p>
          Videos are processed using Topaz Labs AI. Results typically complete within 2-5 minutes depending on video length.
        </p>
        <p className="mt-2">
          For best results, start with a 720p video. Videos from AI Cinematographer can be upscaled directly from the history tab.
        </p>
      </div>
    </div>
  );
}
