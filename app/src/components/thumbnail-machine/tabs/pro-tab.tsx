'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Crown, X, Image, Youtube, Loader2, Sparkles, Type } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { ThumbnailMachineRequest, ThumbnailMachineResponse, generateThumbnailConcepts } from '@/actions/tools/thumbnail-machine';
import { PromptSection } from '../input-panel/prompt-section';
import { StandardStep } from '@/components/tools/standard-step';
import { uploadImageToStorage } from '@/actions/supabase-storage';
import { ThumbnailConceptChat } from './thumbnail-concept-chat';

interface ProTabProps {
  onGenerate: (request: ThumbnailMachineRequest) => Promise<ThumbnailMachineResponse>;
  isGenerating: boolean;
  credits: { available_credits: number } | null;
  error?: string;
}

const CREDITS_PER_PRO = 10;

export function ProTab({
  onGenerate,
  isGenerating,
  credits,
  error,
}: ProTabProps) {
  const [formData, setFormData] = useState({
    prompt: '',
    text_overlay: '',
    skip_prompt_enhancement: false,
  });

  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null!);

  // YouTube concept chat state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!formData.prompt?.trim()) return;

    await onGenerate({
      operation_mode: 'generate-pro',
      prompt: formData.prompt,
      text_overlay: formData.text_overlay.trim() || undefined,
      aspect_ratio: '16:9',
      resolution: '1K',
      output_format: 'jpeg',
      skip_prompt_enhancement: formData.skip_prompt_enhancement,
      image_input: referenceImages.length > 0 ? referenceImages : undefined,
      transcript: transcript || undefined,
      video_title: videoTitle || undefined,
      user_id: 'current-user',
    });
  };

  const handleGetIdeas = async () => {
    if (!youtubeUrl.trim()) return;

    setIsFetchingTranscript(true);
    setTranscriptError(null);
    setTranscript(null);
    setVideoTitle(null);

    try {
      const result = await generateThumbnailConcepts(youtubeUrl);
      if (result.success && result.transcript) {
        setTranscript(result.transcript);
        setVideoTitle(result.video_title || 'Untitled Video');
      } else {
        setTranscriptError(result.error || 'Failed to fetch video transcript');
      }
    } catch (err) {
      setTranscriptError('Failed to fetch video. Please try again.');
    } finally {
      setIsFetchingTranscript(false);
    }
  };

  const handleClearTranscript = () => {
    setTranscript(null);
    setVideoTitle(null);
    setYoutubeUrl('');
    setTranscriptError(null);
  };

  const handleUsePrompt = (prompt: string, textOverlay?: string) => {
    setFormData(prev => ({
      ...prev,
      prompt,
      text_overlay: textOverlay || prev.text_overlay,
    }));
  };

  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = 14 - referenceImages.length;
    const filesToUpload = Array.from(files).slice(0, remaining);

    setIsUploadingRef(true);
    try {
      for (const file of filesToUpload) {
        const result = await uploadImageToStorage(file, {
          folder: 'reference-images',
          contentType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
        });

        if (result.success && result.url) {
          setReferenceImages(prev => [...prev, result.url!]);
        } else {
          console.error('Failed to upload reference image:', result.error);
        }
      }
    } catch (error) {
      console.error('Error uploading reference image:', error);
    } finally {
      setIsUploadingRef(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: YouTube Video (Optional) */}
        <StandardStep
          stepNumber={1}
          title="YouTube Video"
          description="Paste a video URL to get AI thumbnail ideas (optional)"
        >
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Paste a YouTube URL..."
                  className="pl-9"
                  disabled={isFetchingTranscript || !!transcript}
                />
              </div>
              {!transcript ? (
                <Button
                  onClick={handleGetIdeas}
                  disabled={!youtubeUrl.trim() || isFetchingTranscript}
                  variant="secondary"
                  size="default"
                >
                  {isFetchingTranscript ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      Get Ideas
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleClearTranscript}
                  variant="ghost"
                  size="default"
                >
                  <X className="w-4 h-4 mr-1.5" />
                  Clear
                </Button>
              )}
            </div>

            {transcriptError && (
              <p className="text-sm text-destructive">{transcriptError}</p>
            )}

            {transcript && videoTitle && (
              <ThumbnailConceptChat
                transcript={transcript}
                videoTitle={videoTitle}
                onUsePrompt={handleUsePrompt}
                referenceImageUrls={referenceImages}
              />
            )}
          </div>
        </StandardStep>

        {/* Step 2: Describe Your Thumbnail */}
        <StandardStep
          stepNumber={2}
          title="Describe Your Thumbnail"
          description="Tell AI what kind of thumbnail you want"
        >
          <PromptSection
            value={formData.prompt}
            onChange={(prompt) => setFormData((prev) => ({ ...prev, prompt }))}
            ref={promptInputRef}
          />
        </StandardStep>

        {/* Step 3: Text Overlay (Optional) */}
        <StandardStep
          stepNumber={3}
          title="Text Overlay"
          description="Enter 2-4 words to render on the thumbnail (optional)"
        >
          <div className="space-y-2">
            <div className="relative">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={formData.text_overlay}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().slice(0, 30);
                  setFormData((prev) => ({ ...prev, text_overlay: value }));
                }}
                placeholder="e.g., WAIT WHAT or 10X FASTER"
                className="pl-9 uppercase font-bold tracking-wide"
                maxLength={30}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formData.text_overlay
                ? `${formData.text_overlay.split(/\s+/).filter(Boolean).length}/4 words — shorter text renders more reliably`
                : 'Leave empty for no text on the thumbnail.'}
            </p>
          </div>
        </StandardStep>

        {/* Step 4: Reference Images (Optional) */}
        <StandardStep
          stepNumber={4}
          title="Reference Images"
          description={`Upload images to guide the generation — up to 14 (${referenceImages.length}/14)`}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {referenceImages.map((url, i) => (
                <div key={i} className="relative">
                  <img
                    src={url}
                    alt={`Reference ${i + 1}`}
                    className="h-20 w-20 rounded-lg border border-border object-cover"
                  />
                  <button
                    onClick={() => removeReferenceImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center hover:bg-destructive/90"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {referenceImages.length < 14 && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleReferenceImageUpload}
                    className="hidden"
                    id="pro-reference-image-upload"
                  />
                  <label
                    htmlFor="pro-reference-image-upload"
                    className={`flex flex-col items-center justify-center h-20 w-20 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                      isUploadingRef ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    {isUploadingRef ? (
                      <span className="text-[10px] text-muted-foreground">Uploading...</span>
                    ) : (
                      <>
                        <Image className="w-4 h-4 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground mt-1">Add</span>
                      </>
                    )}
                  </label>
                </>
              )}
            </div>
          </div>
        </StandardStep>

        {/* Step 5: Options */}
        <StandardStep
          stepNumber={5}
          title="Options"
          description="Fine-tune your generation settings"
        >
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
            <div className="space-y-0.5">
              <Label htmlFor="pro-skip-enhancement" className="text-sm font-medium">
                Use Raw Prompt
              </Label>
              <p className="text-xs text-muted-foreground">
                Skip AI prompt enhancement for more literal results
              </p>
            </div>
            <Switch
              id="pro-skip-enhancement"
              checked={formData.skip_prompt_enhancement}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, skip_prompt_enhancement: checked }))
              }
            />
          </div>
        </StandardStep>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || !formData.prompt?.trim() || (credits?.available_credits || 0) < CREDITS_PER_PRO}
          className="w-full h-12 bg-primary hover:bg-primary/90 transition-all duration-300 font-medium"
          size="lg"
        >
          <Crown className="w-4 h-4 mr-2" />
          {isGenerating ? 'Generating...' : `Generate Pro Thumbnail (${CREDITS_PER_PRO} credits)`}
        </Button>
      </TabFooter>
    </TabContentWrapper>
  );
}
