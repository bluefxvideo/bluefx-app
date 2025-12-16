'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, Image, Download, Loader2 } from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';

interface StartingShotOutputProps {
  isGenerating: boolean;
  generatedImage?: {
    id: string;
    image_url: string;
    prompt: string;
    aspect_ratio: string;
  } | null;
  onMakeVideo?: (imageUrl: string) => void;
  error?: string;
}

/**
 * Starting Shot Output Panel - Shows generated image result
 * Matches the video output panel pattern
 */
export function StartingShotOutput({
  isGenerating,
  generatedImage,
  onMakeVideo,
  error,
}: StartingShotOutputProps) {
  const handleMakeVideo = () => {
    if (generatedImage?.image_url && onMakeVideo) {
      onMakeVideo(generatedImage.image_url);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage?.image_url) return;

    try {
      const response = await fetch(generatedImage.image_url);
      if (!response.ok) throw new Error('Failed to fetch image');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `starting-shot-${generatedImage.id}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
      window.open(generatedImage.image_url, '_blank');
    }
  };

  // Loading state
  if (isGenerating) {
    return (
      <OutputPanelShell
        title="Image Generation"
        status="loading"
      >
        <div className="h-full flex flex-col items-center justify-center p-6">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Image className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h3 className="font-medium text-lg mb-2">Generating Image...</h3>
          <p className="text-sm text-muted-foreground text-center">
            Creating your starting shot. This usually takes ~5 seconds.
          </p>
        </div>
      </OutputPanelShell>
    );
  }

  // Error state
  if (error) {
    return (
      <OutputPanelShell
        title="Image Generation"
        status="error"
        errorMessage={error}
      >
        <div className="h-full flex items-center justify-center p-6">
          <Card className="p-6 max-w-sm text-center border-destructive/50">
            <p className="text-destructive">{error}</p>
          </Card>
        </div>
      </OutputPanelShell>
    );
  }

  // Success state - show generated image
  if (generatedImage) {
    return (
      <OutputPanelShell
        title="Generated Image"
        status="ready"
      >
        <div className="h-full flex flex-col p-4 space-y-4">
          {/* Image Preview */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div className="relative rounded-lg overflow-hidden border bg-muted/30 max-h-full">
              <img
                src={generatedImage.image_url}
                alt={generatedImage.prompt}
                className="max-w-full max-h-[400px] object-contain"
              />
            </div>
          </div>

          {/* Image Info */}
          <div className="text-sm text-muted-foreground">
            <p className="line-clamp-2">{generatedImage.prompt}</p>
            <p className="mt-1">Aspect Ratio: {generatedImage.aspect_ratio}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleMakeVideo}
              className="w-full h-12 font-medium"
              size="lg"
            >
              <Video className="w-4 h-4 mr-2" />
              Make Video From This Image
            </Button>

            <Button
              onClick={handleDownload}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Image
            </Button>
          </div>
        </div>
      </OutputPanelShell>
    );
  }

  // Empty state
  return (
    <OutputPanelShell
      title="Image Results"
      status="idle"
    >
      <div className="h-full flex items-center justify-center p-6">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
          <Image className="w-12 h-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-medium mb-2">No Image Generated</h3>
            <p className="text-sm text-muted-foreground">
              Describe your first frame and generate a starting shot.
              You can then use it as a reference for video generation.
            </p>
          </div>
        </Card>
      </div>
    </OutputPanelShell>
  );
}
