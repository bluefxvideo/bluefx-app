'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  RefreshCw,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Loader2,
} from 'lucide-react';
import {
  useContentMultiplierV2Store,
  useSelectedPlatforms,
  usePlatformContent,
  useIsGenerating,
  useGenerationProgress,
  useVideoUrl,
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

const PlatformIconMap: Record<SocialPlatform, React.FC<{ className?: string; size?: number }>> = {
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
  youtube: YouTubeIcon,
  twitter: XIcon,
  linkedin: LinkedInIcon,
  facebook: FacebookIcon,
};

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  tiktok: 'bg-black',
  instagram: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400',
  youtube: 'bg-red-600',
  twitter: 'bg-black',
  linkedin: 'bg-blue-700',
  facebook: 'bg-blue-600',
};

export function CreateStep2Review() {
  const [newHashtag, setNewHashtag] = useState('');

  // Store state
  const selectedPlatforms = useSelectedPlatforms();
  const platformContent = usePlatformContent();
  const isGenerating = useIsGenerating();
  const generationProgress = useGenerationProgress();
  const videoUrl = useVideoUrl();
  const activePlatformTab = useContentMultiplierV2Store((s) => s.activePlatformTab);

  // Store actions
  const setActivePlatformTab = useContentMultiplierV2Store((s) => s.setActivePlatformTab);
  const updatePlatformCaption = useContentMultiplierV2Store((s) => s.updatePlatformCaption);
  const updatePlatformHashtags = useContentMultiplierV2Store((s) => s.updatePlatformHashtags);
  const updatePlatformTitle = useContentMultiplierV2Store((s) => s.updatePlatformTitle);
  const updatePlatformDescription = useContentMultiplierV2Store((s) => s.updatePlatformDescription);
  const approvePlatformContent = useContentMultiplierV2Store((s) => s.approvePlatformContent);
  const regeneratePlatformContent = useContentMultiplierV2Store((s) => s.regeneratePlatformContent);
  const prevStep = useContentMultiplierV2Store((s) => s.prevStep);
  const nextStep = useContentMultiplierV2Store((s) => s.nextStep);
  const canProceedToStep3 = useContentMultiplierV2Store((s) => s.canProceedToStep3);

  // Use first platform if none selected
  const currentPlatform = activePlatformTab || selectedPlatforms[0];
  const currentContent = currentPlatform ? platformContent[currentPlatform] : null;
  const config = currentPlatform ? PLATFORM_CONFIGS[currentPlatform] : null;

  // Add hashtag
  const handleAddHashtag = () => {
    if (!currentPlatform || !currentContent || !newHashtag.trim()) return;

    const cleanHashtag = newHashtag.trim().replace(/^#/, '');
    if (!currentContent.hashtags.includes(cleanHashtag)) {
      updatePlatformHashtags(currentPlatform, [...currentContent.hashtags, cleanHashtag]);
    }
    setNewHashtag('');
  };

  // Remove hashtag
  const handleRemoveHashtag = (hashtag: string) => {
    if (!currentPlatform || !currentContent) return;
    updatePlatformHashtags(
      currentPlatform,
      currentContent.hashtags.filter((h) => h !== hashtag)
    );
  };

  // Check if all approved
  const allApproved = selectedPlatforms.every((p) => platformContent[p]?.isApproved);
  const approvedCount = selectedPlatforms.filter((p) => platformContent[p]?.isApproved).length;

  // Loading state
  if (isGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <div className="text-center">
          <p className="font-medium">Generating content...</p>
          <p className="text-sm text-muted-foreground">
            {generationProgress}% complete
          </p>
        </div>
        <div className="w-48 bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${generationProgress}%` }}
          />
        </div>
      </div>
    );
  }

  if (!currentPlatform || !currentContent) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">No content to review</p>
      </div>
    );
  }

  const Icon = PlatformIconMap[currentPlatform];

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Platform Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {selectedPlatforms.map((platform) => {
          const PIcon = PlatformIconMap[platform];
          const pContent = platformContent[platform];
          const isActive = platform === currentPlatform;
          const isApproved = pContent?.isApproved;

          return (
            <button
              key={platform}
              onClick={() => setActivePlatformTab(platform)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all
                whitespace-nowrap flex-shrink-0
                ${isActive
                  ? 'border-primary bg-primary/5'
                  : isApproved
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                    : 'border-muted hover:border-primary/50'
                }
              `}
            >
              <div className={`w-6 h-6 rounded ${PLATFORM_COLORS[platform]} flex items-center justify-center`}>
                <PIcon className="text-white" size={12} />
              </div>
              <span className="text-sm font-medium">
                {PLATFORM_CONFIGS[platform].name}
              </span>
              {isApproved && <Check className="w-4 h-4 text-green-500" />}
            </button>
          );
        })}
      </div>

      {/* Video Preview */}
      {videoUrl && (
        <Card className="overflow-hidden flex-shrink-0">
          <video
            src={videoUrl}
            className="w-full aspect-video object-cover max-h-[200px]"
            controls
          />
        </Card>
      )}

      {/* Content Editor */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Caption */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">
              {config?.supportsTitle ? 'Caption' : 'Caption'}
            </Label>
            <span className={`text-xs ${
              currentContent.characterCount > (config?.maxCaptionLength || 0)
                ? 'text-red-500'
                : 'text-muted-foreground'
            }`}>
              {currentContent.characterCount}/{config?.maxCaptionLength}
            </span>
          </div>
          <Textarea
            value={currentContent.caption}
            onChange={(e) => updatePlatformCaption(currentPlatform, e.target.value)}
            className="min-h-[120px] resize-none"
            placeholder="Enter caption..."
          />
        </div>

        {/* YouTube-specific fields */}
        {config?.supportsTitle && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Title</Label>
              <span className="text-xs text-muted-foreground">
                {currentContent.title?.length || 0}/100
              </span>
            </div>
            <Input
              value={currentContent.title || ''}
              onChange={(e) => updatePlatformTitle(currentPlatform, e.target.value)}
              placeholder="Video title..."
              maxLength={100}
            />
          </div>
        )}

        {config?.supportsDescription && (
          <div>
            <Label className="text-sm font-medium mb-2 block">Description</Label>
            <Textarea
              value={currentContent.description || ''}
              onChange={(e) => updatePlatformDescription(currentPlatform, e.target.value)}
              className="min-h-[100px] resize-none"
              placeholder="Video description..."
            />
          </div>
        )}

        {/* Hashtags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Hashtags</Label>
            <span className="text-xs text-muted-foreground">
              {currentContent.hashtags.length}/{config?.maxHashtags}
            </span>
          </div>

          {/* Hashtag list */}
          <div className="flex flex-wrap gap-2 mb-3">
            {currentContent.hashtags.map((hashtag) => (
              <Badge
                key={hashtag}
                variant="secondary"
                className="flex items-center gap-1 pl-2 pr-1 py-1"
              >
                #{hashtag}
                <button
                  onClick={() => handleRemoveHashtag(hashtag)}
                  className="hover:bg-muted rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>

          {/* Add hashtag */}
          <div className="flex gap-2">
            <Input
              value={newHashtag}
              onChange={(e) => setNewHashtag(e.target.value)}
              placeholder="Add hashtag..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddHashtag();
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleAddHashtag}
              disabled={!newHashtag.trim() || currentContent.hashtags.length >= (config?.maxHashtags || 30)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 border-t space-y-3">
        {/* Regenerate / Approve */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => regeneratePlatformContent(currentPlatform)}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Regenerate
          </Button>
          <Button
            variant={currentContent.isApproved ? 'secondary' : 'default'}
            className="flex-1"
            onClick={() => approvePlatformContent(currentPlatform)}
            disabled={currentContent.isApproved}
          >
            {currentContent.isApproved ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Approved
              </>
            ) : (
              'Approve'
            )}
          </Button>
        </div>

        {/* Progress indicator */}
        <div className="text-center text-sm text-muted-foreground">
          {approvedCount}/{selectedPlatforms.length} platforms approved
        </div>

        {/* Navigation */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={prevStep} className="flex-1">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={nextStep}
            disabled={!allApproved}
            className="flex-1"
          >
            Next: Schedule
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
