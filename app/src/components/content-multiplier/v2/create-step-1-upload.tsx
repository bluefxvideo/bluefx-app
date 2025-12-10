'use client';

import { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Upload,
  Video,
  X,
  Mic,
  Loader2,
  Check,
  AlertCircle,
  Link,
  Youtube,
} from 'lucide-react';
import {
  useContentMultiplierV2Store,
  useConnectedAccounts,
  useSelectedPlatforms,
  useVideoUrl,
  useOriginalDescription,
  PLATFORM_CONFIGS,
  type SocialPlatform,
} from '../store/content-multiplier-v2-store';
import {
  TikTokIcon,
  InstagramIcon,
  YouTubeIcon,
  XIcon,
  LinkedInIcon,
  FacebookIcon,
} from '../components/brand-icons';

import { createClient } from '@/app/supabase/client';

const PLATFORM_ORDER: SocialPlatform[] = ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin', 'facebook'];

const PlatformIconMap: Record<SocialPlatform, React.FC<{ className?: string; size?: number }>> = {
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
  youtube: YouTubeIcon,
  twitter: XIcon,
  linkedin: LinkedInIcon,
  facebook: FacebookIcon,
};

const PLATFORM_COLORS: Record<SocialPlatform, { bg: string; text: string }> = {
  tiktok: { bg: 'bg-black', text: 'text-white' },
  instagram: { bg: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400', text: 'text-white' },
  youtube: { bg: 'bg-red-600', text: 'text-white' },
  twitter: { bg: 'bg-black', text: 'text-white' },
  linkedin: { bg: 'bg-blue-700', text: 'text-white' },
  facebook: { bg: 'bg-blue-600', text: 'text-white' },
};

export function CreateStep1Upload() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  // Store state
  const videoFile = useContentMultiplierV2Store((s) => s.videoFile);
  const videoUrl = useVideoUrl();
  const videoThumbnailUrl = useContentMultiplierV2Store((s) => s.videoThumbnailUrl);
  const originalDescription = useOriginalDescription();
  const isTranscribing = useContentMultiplierV2Store((s) => s.isTranscribing);
  const originalTranscript = useContentMultiplierV2Store((s) => s.originalTranscript);
  const selectedPlatforms = useSelectedPlatforms();
  const connectedAccounts = useConnectedAccounts();

  // Store actions
  const setVideoFile = useContentMultiplierV2Store((s) => s.setVideoFile);
  const setVideoUrl = useContentMultiplierV2Store((s) => s.setVideoUrl);
  const setVideoDuration = useContentMultiplierV2Store((s) => s.setVideoDuration);
  const setOriginalDescription = useContentMultiplierV2Store((s) => s.setOriginalDescription);
  const setOriginalTranscript = useContentMultiplierV2Store((s) => s.setOriginalTranscript);
  const setIsTranscribing = useContentMultiplierV2Store((s) => s.setIsTranscribing);
  const togglePlatform = useContentMultiplierV2Store((s) => s.togglePlatform);
  const generateAllContent = useContentMultiplierV2Store((s) => s.generateAllContent);
  const canProceedToStep2 = useContentMultiplierV2Store((s) => s.canProceedToStep2);
  const setActiveMainTab = useContentMultiplierV2Store((s) => s.setActiveMainTab);

  // Dropzone configuration
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // Create local URL for preview (immediate feedback)
      const localUrl = URL.createObjectURL(file);
      setVideoFile(file);
      setLocalPreviewUrl(localUrl);

      // Get video duration
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration);
      };
      video.src = localUrl;

      // Upload to Supabase storage for server-side access
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error('User not authenticated');
        setVideoUrl(localUrl); // Fallback to local URL for posting
        return;
      }

      const fileExt = file.name.split('.').pop() || 'mp4';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('content-multiplier-videos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Storage upload error:', error);
        setVideoUrl(localUrl); // Fallback to local URL for posting
        return;
      }

      // Get public URL for server-side posting
      const { data: urlData } = supabase.storage
        .from('content-multiplier-videos')
        .getPublicUrl(data.path);

      console.log('Video uploaded to storage:', urlData.publicUrl);
      setVideoUrl(urlData.publicUrl);

    } catch (error) {
      console.error('Video upload error:', error);
    } finally {
      setIsUploading(false);
    }
  }, [setVideoFile, setVideoUrl, setVideoDuration]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.webm', '.avi'],
    },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024, // 500MB
  });

  // Handle transcription
  const handleTranscribe = async () => {
    if (!videoFile) return;

    setIsTranscribing(true);

    try {
      const { transcribeMediaFile } = await import('@/actions/tools/media-transcription');
      const result = await transcribeMediaFile(videoFile);

      if (result.success && result.transcription) {
        setOriginalTranscript(result.transcription);
        // If description is empty, use transcript
        if (!originalDescription.trim()) {
          setOriginalDescription(result.transcription);
        }
      }
    } catch (error) {
      console.error('Transcription error:', error);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Handle YouTube URL transcript fetch
  const handleFetchYouTubeTranscript = async () => {
    if (!youtubeUrl.trim()) return;

    setIsFetchingTranscript(true);
    setTranscriptError(null);

    try {
      const { fetchYouTubeTranscript } = await import('@/actions/tools/youtube-transcript');
      const result = await fetchYouTubeTranscript(youtubeUrl);

      if (result.success && result.transcript) {
        setOriginalDescription(result.transcript);
        setOriginalTranscript(result.transcript);
        setTranscriptError(null);
      } else {
        setTranscriptError(result.error || 'Failed to fetch transcript');
      }
    } catch (error) {
      console.error('YouTube transcript error:', error);
      setTranscriptError('Failed to fetch transcript');
    } finally {
      setIsFetchingTranscript(false);
    }
  };

  // Remove video
  const handleRemoveVideo = () => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
    setVideoFile(null);
    setVideoUrl(null);
    setOriginalTranscript(null);
  };

  // Use local preview for video playback, fall back to remote URL
  const displayVideoUrl = localPreviewUrl || videoUrl;

  // Check if can proceed
  const canProceed = canProceedToStep2();
  const hasUnconnectedPlatforms = selectedPlatforms.some(
    (p) => !connectedAccounts[p]?.connected
  );

  return (
    <div className="h-full flex flex-col gap-6 overflow-y-auto">
      {/* Video Upload Section */}
      <div className="flex-shrink-0">
        <Label className="text-sm font-medium mb-2 block">Video</Label>

        {!displayVideoUrl ? (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
              transition-colors duration-200
              ${isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
              }
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              {isUploading ? (
                <>
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Uploading video...</p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Drop your video here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supports: MP4, MOV, WebM (max 500MB)
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <Card className="relative overflow-hidden max-h-[300px]">
            <video
              ref={videoRef}
              src={displayVideoUrl}
              className="w-full h-full object-cover"
              controls
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={handleRemoveVideo}
            >
              <X className="w-4 h-4" />
            </Button>
          </Card>
        )}
      </div>

      {/* YouTube URL Section - for fetching transcripts */}
      <div className="flex-shrink-0">
        <Label className="text-sm font-medium mb-2 block">
          <Youtube className="w-4 h-4 inline mr-1" />
          Or paste a YouTube URL for transcript
        </Label>
        <div className="flex gap-2">
          <Input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1"
          />
          <Button
            variant="secondary"
            onClick={handleFetchYouTubeTranscript}
            disabled={!youtubeUrl.trim() || isFetchingTranscript}
          >
            {isFetchingTranscript ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Link className="w-4 h-4 mr-1" />
                Get Transcript
              </>
            )}
          </Button>
        </div>
        {transcriptError && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {transcriptError}
          </p>
        )}
        {originalTranscript && youtubeUrl && (
          <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
            <Check className="w-3 h-3" />
            Transcript loaded successfully
          </p>
        )}
      </div>

      {/* Description Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">What's this video about?</Label>
          {displayVideoUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTranscribe}
              disabled={isTranscribing || !!originalTranscript}
              className="text-xs"
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Transcribing...
                </>
              ) : originalTranscript ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Transcribed
                </>
              ) : (
                <>
                  <Mic className="w-3 h-3 mr-1" />
                  Auto-transcribe
                </>
              )}
            </Button>
          )}
        </div>
        <Textarea
          value={originalDescription}
          onChange={(e) => setOriginalDescription(e.target.value)}
          placeholder="Brief description of your video content, or paste the transcript..."
          className="min-h-[100px] resize-none"
        />
        <p className="text-xs text-muted-foreground mt-1">
          This will be used to generate platform-specific captions
        </p>
      </div>

      {/* Platform Selection */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Select platforms</Label>

        <div className="grid grid-cols-2 gap-3">
          {PLATFORM_ORDER.map((platform) => {
            const config = PLATFORM_CONFIGS[platform];
            const account = connectedAccounts[platform];
            const isConnected = account?.connected && account?.connectionStatus === 'active';
            const isSelected = selectedPlatforms.includes(platform);
            const Icon = PlatformIconMap[platform];
            const colors = PLATFORM_COLORS[platform];

            return (
              <div
                key={platform}
                className={`
                  relative flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer
                  transition-all duration-200
                  ${isSelected
                    ? 'border-primary bg-primary/5'
                    : isConnected
                      ? 'border-muted hover:border-primary/50'
                      : 'border-muted/50 opacity-60 cursor-not-allowed'
                  }
                `}
                onClick={() => isConnected && togglePlatform(platform)}
              >
                {/* Checkbox */}
                <Checkbox
                  checked={isSelected}
                  disabled={!isConnected}
                  className="pointer-events-none"
                />

                {/* Platform Icon */}
                <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
                  <Icon className={colors.text} size={16} />
                </div>

                {/* Platform Name */}
                <div className="flex-1">
                  <p className="text-sm font-medium">{config.name}</p>
                  {!isConnected && (
                    <p className="text-xs text-muted-foreground">Not connected</p>
                  )}
                </div>

                {/* Connected indicator */}
                {isConnected && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
              </div>
            );
          })}
        </div>

        {/* Warning for unconnected platforms */}
        {hasUnconnectedPlatforms && selectedPlatforms.length > 0 && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Some selected platforms are not connected.{' '}
                <button
                  className="underline font-medium"
                  onClick={() => setActiveMainTab('accounts')}
                >
                  Connect accounts
                </button>
              </p>
            </div>
          </div>
        )}

        {/* No connected platforms */}
        {Object.values(connectedAccounts).filter(a => a?.connected).length === 0 && (
          <div className="mt-3 p-3 bg-muted rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">
                  No accounts connected yet.
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setActiveMainTab('accounts')}
                >
                  Connect your first account
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next Button */}
      <div className="mt-auto pt-4 border-t">
        <Button
          className="w-full"
          size="lg"
          onClick={() => generateAllContent()}
          disabled={!canProceed}
        >
          Next: Generate Content
        </Button>
        {!canProceed && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            {isUploading
              ? 'Uploading video...'
              : !videoUrl && !localPreviewUrl
                ? 'Upload a video to continue'
                : !videoUrl && localPreviewUrl
                  ? 'Finishing upload...'
                  : !originalDescription.trim()
                    ? 'Add a description to continue'
                    : 'Select at least one platform'
            }
          </p>
        )}
      </div>
    </div>
  );
}
