'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Youtube,
  Loader2,
  Check,
  AlertCircle,
  Download,
  FileText,
  Tag,
  Globe,
  ExternalLink,
  Link,
} from 'lucide-react';
import { useYouTubeRepurposeStore } from './store/youtube-repurpose-store';
import { WordPressConnectionDialog } from './wordpress-connection-dialog';

export function Step1Input() {
  const [wpDialogOpen, setWpDialogOpen] = useState(false);

  const youtubeUrl = useYouTubeRepurposeStore((s) => s.youtubeUrl);
  const isExtracting = useYouTubeRepurposeStore((s) => s.isExtracting);
  const extractionStatus = useYouTubeRepurposeStore((s) => s.extractionStatus);
  const youtubeMetadata = useYouTubeRepurposeStore((s) => s.youtubeMetadata);
  const transcript = useYouTubeRepurposeStore((s) => s.transcript);
  const videoStorageUrl = useYouTubeRepurposeStore((s) => s.videoStorageUrl);
  const videoFileSizeMB = useYouTubeRepurposeStore((s) => s.videoFileSizeMB);
  const isDownloadingVideo = useYouTubeRepurposeStore((s) => s.isDownloadingVideo);
  const wordpressConnected = useYouTubeRepurposeStore((s) => s.wordpressConnected);
  const wordpressSiteUrl = useYouTubeRepurposeStore((s) => s.wordpressSiteUrl);
  const error = useYouTubeRepurposeStore((s) => s.error);
  const videoDownloadWarning = useYouTubeRepurposeStore((s) => s.videoDownloadWarning);

  const productUrl = useYouTubeRepurposeStore((s) => s.productUrl);

  const setYouTubeUrl = useYouTubeRepurposeStore((s) => s.setYouTubeUrl);
  const setProductUrl = useYouTubeRepurposeStore((s) => s.setProductUrl);
  const extractYouTubeData = useYouTubeRepurposeStore((s) => s.extractYouTubeData);
  const downloadVideo = useYouTubeRepurposeStore((s) => s.downloadVideo);
  const loadWordPressConnection = useYouTubeRepurposeStore((s) => s.loadWordPressConnection);
  const loadSocialConnections = useYouTubeRepurposeStore((s) => s.loadSocialConnections);
  const nextStep = useYouTubeRepurposeStore((s) => s.nextStep);
  const canProceedToStep2 = useYouTubeRepurposeStore((s) => s.canProceedToStep2);

  // Load connections on mount
  useEffect(() => {
    loadWordPressConnection();
    loadSocialConnections();
  }, [loadWordPressConnection, loadSocialConnections]);

  const handleExtractAndDownload = async () => {
    await extractYouTubeData();
    // Try video download in background — non-fatal if it fails
    const state = useYouTubeRepurposeStore.getState();
    if (state.youtubeMetadata && !state.videoStorageUrl) {
      downloadVideo();
    }
  };

  const wordCount = transcript ? transcript.split(/\s+/).length : 0;

  return (
    <div className="space-y-6">
      {/* YouTube URL Input */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" />
            <Label className="text-lg font-semibold">YouTube Video URL</Label>
          </div>

          <div className="flex gap-3">
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYouTubeUrl(e.target.value)}
              disabled={isExtracting || isDownloadingVideo}
              className="flex-1"
            />
            <Button
              onClick={handleExtractAndDownload}
              disabled={!youtubeUrl.trim() || isExtracting || isDownloadingVideo}
            >
              {isExtracting || isDownloadingVideo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {extractionStatus || 'Processing...'}
                </>
              ) : youtubeMetadata ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Extracted
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Extract & Download
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </Card>

      {/* Extracted Metadata */}
      {youtubeMetadata && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              <Label className="text-lg font-semibold">Extracted Data</Label>
            </div>

            {/* Thumbnail + Title */}
            <div className="flex gap-4">
              {youtubeMetadata.thumbnailUrl && (
                <img
                  src={youtubeMetadata.thumbnailUrl}
                  alt={youtubeMetadata.title}
                  className="w-48 rounded-lg object-cover"
                />
              )}
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-lg">{youtubeMetadata.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {youtubeMetadata.channelName}
                </p>
                {youtubeMetadata.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {youtubeMetadata.description}
                  </p>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-4 text-sm">
              {/* Tags */}
              {youtubeMetadata.tags.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {youtubeMetadata.tags.length} tags
                  </span>
                </div>
              )}

              {/* Transcript */}
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {transcript ? (
                  <span className="text-green-600">{wordCount.toLocaleString()} words</span>
                ) : (
                  <span className="text-yellow-600">No transcript available</span>
                )}
              </div>

              {/* Video download status */}
              <div className="flex items-center gap-1.5">
                <Download className="h-4 w-4 text-muted-foreground" />
                {isDownloadingVideo ? (
                  <span className="text-blue-600 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Downloading video...
                  </span>
                ) : videoStorageUrl ? (
                  <span className="text-green-600">
                    Video ready ({videoFileSizeMB}MB)
                  </span>
                ) : videoDownloadWarning ? (
                  <span className="text-yellow-600 text-sm">
                    Video unavailable — LinkedIn will post as link share
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-blue-600"
                      onClick={downloadVideo}
                    >
                      Download video
                    </Button>
                    <span className="text-xs">(optional — for native video posts)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Tags display */}
            {youtubeMetadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {youtubeMetadata.tags.slice(0, 15).map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
                {youtubeMetadata.tags.length > 15 && (
                  <span className="text-xs text-muted-foreground">
                    +{youtubeMetadata.tags.length - 15} more
                  </span>
                )}
              </div>
            )}

            {/* Product URL — auto-detected, editable */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Link className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="product-url" className="text-sm font-medium">
                  Product / Website URL
                </Label>
                <span className="text-xs text-muted-foreground">
                  (included in social posts as CTA)
                </span>
              </div>
              <Input
                id="product-url"
                placeholder="https://your-product.com — auto-detected from description"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
              />
            </div>
          </div>
        </Card>
      )}

      {/* WordPress Connection */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-blue-500" />
            <div>
              <Label className="text-lg font-semibold">WordPress Blog</Label>
              {wordpressConnected && wordpressSiteUrl && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-500" />
                  Connected to {wordpressSiteUrl}
                </p>
              )}
              {!wordpressConnected && (
                <p className="text-sm text-muted-foreground">
                  Connect your WordPress site to publish blog posts
                </p>
              )}
            </div>
          </div>
          <Button
            variant={wordpressConnected ? 'outline' : 'default'}
            size="sm"
            onClick={() => setWpDialogOpen(true)}
          >
            {wordpressConnected ? (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Configure
              </>
            ) : (
              'Connect WordPress'
            )}
          </Button>
        </div>
      </Card>

      {/* Continue Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={nextStep}
          disabled={!canProceedToStep2()}
        >
          Continue to Content Generation
        </Button>
      </div>

      {/* WordPress Connection Dialog */}
      <WordPressConnectionDialog
        open={wpDialogOpen}
        onOpenChange={setWpDialogOpen}
      />
    </div>
  );
}
