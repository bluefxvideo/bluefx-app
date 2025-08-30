'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, ExternalLink } from 'lucide-react';

interface AvatarVideoPreviewProps {
  video: {
    id: string;
    video_url: string;
    thumbnail_url?: string;
    script_text: string;
    avatar_image_url: string;
    created_at: string;
  };
  onDownload?: () => void;
  onOpenInNewTab?: () => void;
  onCreateNew?: () => void;
}

/**
 * Unified Avatar Video Preview component matching AI Cinematographer design
 * Single card with compact footer - no scrolling needed
 */
export function AvatarVideoPreview({ 
  video, 
  onDownload, 
  onOpenInNewTab, 
  onCreateNew 
}: AvatarVideoPreviewProps) {
  const handleDownload = async () => {
    if (!video.video_url || !onDownload) return;
    onDownload();
  };

  return (
    <div className="w-full h-auto">
      {/* Single Auto-height Video Card */}
      <Card className="overflow-hidden h-auto">
        {/* Video Player */}
        {video.video_url ? (
          <div className="relative aspect-video bg-black">
            <video
              src={video.video_url}
              className="w-full h-full object-contain"
              controls
              preload="metadata"
              poster={video.thumbnail_url}
            />
          </div>
        ) : (
          // Processing Card using UnifiedEmptyState design
          <div className="relative aspect-video bg-muted flex items-center justify-center p-8">
            <Card className="p-8 w-96 min-h-[280px] text-center space-y-4 border-dashed bg-transparent dark:bg-card-content border-input flex flex-col justify-center">
              {/* Blue Square with Spinning Icon */}
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
              
              {/* Processing Text */}
              <div className="space-y-2">
                <h3 className="font-medium">Processing...</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {(() => {
                    const text = video.script_text || 'Generating your avatar video...';
                    return text.length > 100 ? `${text.substring(0, 100)}...` : text;
                  })()}
                </p>
                <p className="text-xs text-yellow-500">
                  ~2-3 minutes
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Compact Footer - always visible */}
        <div className="p-4 bg-card border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex-1 min-w-0 mr-2">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm">Generated Talking Avatar</h4>
                <Badge variant="outline" className="text-xs">Avatar Video</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {(() => {
                  const text = video.script_text || 'Avatar video generated successfully';
                  return text.length > 60 ? `${text.substring(0, 60)}...` : text;
                })()}
              </p>
            </div>
            
            <div className="flex gap-1 items-center shrink-0">
              <span className="text-muted-foreground text-xs">{video.id.slice(-8)}</span>
              <span className={video.video_url ? 'text-green-500' : 'text-yellow-500'}>
                {video.video_url ? '✓' : '⋯'}
              </span>
              
              {/* Action Buttons - only show when video is ready */}
              {video.video_url && (
                <div className="flex gap-1 ml-2">
                  {onOpenInNewTab && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onOpenInNewTab}
                      className="h-6 w-6 p-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}
                  {onDownload && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownload}
                      className="h-6 w-6 p-0"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Create New Button - bottom row when video is complete */}
          {video.video_url && onCreateNew && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateNew}
                className="w-full text-xs"
              >
                Create New Avatar
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}