'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Video, Volume2, X, Image, Zap, Sparkles, Lock, Mic, Gem } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { UnifiedDragDrop } from '@/components/ui/unified-drag-drop';
import { InsufficientCreditsNotice } from '@/components/ui/insufficient-credits-notice';
import type { CinematographerRequest, GenerationSettings } from '@/types/cinematographer';
import { VIDEO_MODEL_CONFIG, VideoModel, ProAspectRatio, FastCameraMotion } from '@/types/cinematographer';

// Worked Ultra example — a real 15s multi-shot generation made with two
// reference images. Shown as an expandable helper to teach the [Image1]
// syntax and multi-shot prompt structure.
const ULTRA_EXAMPLE_VIDEO_URL = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/videos/placeholders/ultra-multishot-example.mp4';
const ULTRA_EXAMPLE_PROMPT = `Shot 1: The woman from [Image1] stands in her bright kitchen holding the supplement bottle from [Image2], looks into the camera and says: "Okay, real talk — three weeks in, and my mornings are unrecognizable." Subtle handheld feel. Shot 2: Hard cut to a macro close-up of the bottle from [Image2] standing on the wooden counter, morning sunlight raking across the label, camera slowly orbits around it. Shot 3: Cut to the same woman from [Image1] outdoors at golden hour, jogging toward the camera on a tree-lined street, she laughs and pumps her fist, camera tracking backward smoothly. Audio: her natural voice in shot 1, quiet kitchen ambience in shot 2, birdsong and footsteps in shot 3 — no background music.`;

// Camera style presets that append to the prompt
const CAMERA_PRESETS: Record<string, string> = {
  none: '',
  amateur: 'Shot with handheld camera, slight natural shake, authentic amateur footage feel',
  stable: 'Smooth stabilized camera movement, professional gimbal-like stability',
  cinematic: 'Cinematic camera movement, dramatic dolly shots, epic sweeping motion, professional film quality',
};

interface GeneratorTabProps {
  onGenerate: (request: CinematographerRequest) => void;
  isGenerating: boolean;
  credits: number;
  isLoadingCredits?: boolean;
  pendingImageUrl?: string; // Image URL from Starting Shot
  onClearPendingImage?: () => void;
  defaultAspectRatio?: string; // Remember aspect ratio across tabs
  onAspectRatioChange?: (ratio: string) => void;
  analyzerShots?: Array<{
    shotNumber: number;
    description: string;
    duration: string;
    shotType?: string;
    action?: string;    // What movement/action happens
    dialogue?: string;  // What is being said (narration, voiceover, dialogue)
  }>;
  tweakSettings?: { prompt: string; settings: GenerationSettings } | null; // Pre-fill form for tweak & retry
  onClearTweakSettings?: () => void;
}

/**
 * Video Generation Tab - Multi-model cinematic video creation
 * Features:
 * - Fast Mode (LTX-2.3-Fast): Quick generation, longer videos, higher resolutions, camera movements, 9:16
 * - Pro Mode (Seedance 1.5 Pro): Better quality, lip sync, singing, frame control
 */
export function GeneratorTab({
  onGenerate,
  isGenerating,
  credits,
  isLoadingCredits,
  pendingImageUrl,
  onClearPendingImage,
  defaultAspectRatio = '16:9',
  onAspectRatioChange,
  analyzerShots,
  tweakSettings,
  onClearTweakSettings,
}: GeneratorTabProps) {
  const [formData, setFormData] = useState({
    prompt: '',
    reference_image: null as File | null,
    last_frame_image: null as File | null,
    // Ultra reference set (up to 9) — replaces first/last frame when present
    ultra_reference_images: [] as File[],
    // Ultra reference audio (up to 3 clips, combined ≤15s) — free, needs ≥1 ref image
    ultra_reference_audios: [] as File[],
    model: 'fast' as VideoModel,
    duration: 6 as number,
    resolution: '1080p' as string,
    aspect_ratio: defaultAspectRatio as ProAspectRatio,
    generate_audio: true,
    seed: '' as string,
    camera_fixed: false,
    camera_motion: 'none' as FastCameraMotion,
  });

  // Camera style presets only used for Pro mode (Fast uses native camera_motion)
  const [cameraStyle, setCameraStyle] = useState<string>('none');
  const [customCameraText, setCustomCameraText] = useState<string>('');
  const [showUltraExample, setShowUltraExample] = useState(false);

  // Apply tweak settings when provided (pre-fill form for retry)
  useEffect(() => {
    if (tweakSettings) {
      const { prompt, settings } = tweakSettings;
      setFormData({
        prompt,
        reference_image: null,
        last_frame_image: null,
        ultra_reference_images: [],
        ultra_reference_audios: [],
        model: settings.model,
        duration: settings.duration,
        resolution: settings.resolution,
        aspect_ratio: (settings.aspect_ratio || '16:9') as ProAspectRatio,
        generate_audio: settings.generate_audio,
        seed: settings.seed?.toString() || '',
        camera_fixed: settings.camera_fixed || false,
        camera_motion: (settings.camera_motion || 'none') as FastCameraMotion,
      });
      onClearTweakSettings?.();
    }
  }, [tweakSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const config = VIDEO_MODEL_CONFIG[formData.model];

  // Track if we're using a pending image URL from Starting Shot
  const usingPendingImage = !!pendingImageUrl && !formData.reference_image;

  // Ultra is references-only: a Starting Shot handoff becomes [Image1]
  const ultraPendingRef = formData.model === 'ultra' && usingPendingImage && !!pendingImageUrl;
  const ultraRefCount = formData.ultra_reference_images.length + (ultraPendingRef ? 1 : 0);

  // Get available durations for the selected model
  const availableDurations = config.durations as readonly number[];

  // For Fast model: Durations > 10 seconds require 1080p resolution
  const availableResolutions = formData.model === 'fast' && formData.duration > 10
    ? { '1080p': { label: '1080p (Full HD)', creditsPerSecond: 2 } }
    : formData.model === 'fast'
      ? {
          '1080p': { label: '1080p (Full HD)', creditsPerSecond: 2 },
          '2k': { label: '2K', creditsPerSecond: 4 },
          '4k': { label: '4K', creditsPerSecond: 8 },
        }
      : formData.model === 'ultra'
        ? {
            '720p': { label: '720p', creditsPerSecond: 10 },
          }
        : {
            '720p': { label: '720p', creditsPerSecond: 4 },
          };

  // Handle model change
  const handleModelChange = (newModel: VideoModel) => {
    setFormData(prev => ({
      ...prev,
      model: newModel,
      // 6s is a valid duration on every model — keep the default consistent
      duration: 6,
      // Reset resolution based on model
      resolution: newModel === 'fast' ? '1080p' : '720p',
      // Reset aspect ratio to 16:9 (valid for all models)
      aspect_ratio: '16:9',
      // Seed is only supported on Pro (Seedance 1.5)
      seed: newModel === 'pro' ? prev.seed : '',
      // Reference sets are Ultra-only
      ultra_reference_images: newModel === 'ultra' ? prev.ultra_reference_images : [],
      ultra_reference_audios: newModel === 'ultra' ? prev.ultra_reference_audios : [],
      // Reset camera motion when switching models
      camera_motion: 'none' as FastCameraMotion,
    }));
  };

  // Handle duration change
  const handleDurationChange = (newDuration: number) => {
    setFormData(prev => ({
      ...prev,
      duration: newDuration,
      // Force 1080p for Fast mode durations > 10s
      resolution: formData.model === 'fast' && newDuration > 10 ? '1080p' : prev.resolution
    }));
  };

  // Handle resolution change
  const handleResolutionChange = (newResolution: string) => {
    setFormData(prev => ({
      ...prev,
      resolution: newResolution,
    }));
  };

  const handleSubmit = () => {
    if (!formData.prompt?.trim()) return;

    // For Pro/Ultra (Seedance), append text-based camera style to prompt
    // For Fast mode, camera is controlled via native camera_motion param
    let finalPrompt = formData.prompt;
    if (formData.model !== 'fast') {
      const cameraText = cameraStyle === 'custom'
        ? customCameraText
        : CAMERA_PRESETS[cameraStyle];
      if (cameraText) {
        finalPrompt = `${formData.prompt} ${cameraText}`;
      }
    }

    // Build base request
    const request: any = {
      prompt: finalPrompt,
      duration: formData.duration,
      resolution: formData.resolution,
      generate_audio: formData.generate_audio,
      // Audio on = AI voice without background music (directive applied
      // server-side); off = silent video (add your own audio later)
      audio_mode: formData.generate_audio ? 'voice' : 'silent',
      workflow_intent: 'generate',
      user_id: '',
      model: formData.model,
      aspect_ratio: formData.aspect_ratio,
    };

    if (formData.model === 'ultra') {
      // Ultra is references-only: a Starting Shot handoff becomes [Image1],
      // uploaded files follow. First/last-frame inputs don't apply here.
      if (usingPendingImage && pendingImageUrl) {
        request.ultra_reference_image_urls = [pendingImageUrl];
      }
      if (formData.ultra_reference_images.length > 0) {
        request.ultra_reference_images = formData.ultra_reference_images;
      }
      if (
        (formData.ultra_reference_images.length > 0 || (usingPendingImage && pendingImageUrl)) &&
        formData.ultra_reference_audios.length > 0
      ) {
        request.ultra_reference_audios = formData.ultra_reference_audios;
      }
    } else {
      // Fast/Pro: exact first/last frame control
      if (formData.reference_image) {
        request.reference_image = formData.reference_image;
      } else if (usingPendingImage && pendingImageUrl) {
        request.reference_image_url = pendingImageUrl;
      }
      if (formData.last_frame_image) {
        request.last_frame_image = formData.last_frame_image;
      }
    }

    // Add Fast model specific fields
    if (formData.model === 'fast') {
      request.camera_motion = formData.camera_motion;
    }

    // Add Pro model specific fields
    if (formData.model === 'pro') {
      request.camera_fixed = formData.camera_fixed;
      if (formData.seed) {
        request.seed = parseInt(formData.seed);
      }
    }

    onGenerate(request);
  };

  const handleImageUpload = (file: File | null) => {
    setFormData(prev => ({ ...prev, reference_image: file }));
  };

  const handleLastFrameUpload = (file: File | null) => {
    setFormData(prev => ({ ...prev, last_frame_image: file }));
  };

  // Calculate credits based on model and settings (must match server-side calc)
  const calculateCredits = () => {
    if (formData.model === 'fast') {
      const creditsPerSecond = formData.resolution === '4k' ? 8 : formData.resolution === '2k' ? 4 : 2;
      return formData.duration * creditsPerSecond;
    } else if (formData.model === 'ultra') {
      // Ultra (Seedance 2.0): 10 credits/sec
      return formData.duration * 10;
    } else {
      // Pro (Seedance 1.5): 4 credits/sec
      return formData.duration * 4;
    }
  };

  const estimatedCredits = calculateCredits();

  return (
    <TabContentWrapper>
      {/* Form Sections */}
      <TabBody>
        {/* Model Selector — equal thirds so all three tiers stay visible at any panel width */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-muted/50 rounded-lg mb-4">
          <Button
            type="button"
            variant={formData.model === 'fast' ? 'default' : 'ghost'}
            className="flex flex-col h-auto py-2 gap-0.5"
            onClick={() => handleModelChange('fast')}
            disabled={isGenerating}
          >
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              <span className="font-medium">Fast</span>
            </span>
            <span className="text-[10px] opacity-70">Ready in seconds</span>
          </Button>
          <Button
            type="button"
            variant={formData.model === 'pro' ? 'default' : 'ghost'}
            className="flex flex-col h-auto py-2 gap-0.5"
            onClick={() => handleModelChange('pro')}
            disabled={isGenerating}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span className="font-medium">Pro</span>
            </span>
            <span className="text-[10px] opacity-70">Best value</span>
          </Button>
          <Button
            type="button"
            variant={formData.model === 'ultra' ? 'default' : 'ghost'}
            className="flex flex-col h-auto py-2 gap-0.5"
            onClick={() => handleModelChange('ultra')}
            disabled={isGenerating}
          >
            <span className="flex items-center gap-1.5">
              <Gem className="w-4 h-4" />
              <span className="font-medium">Ultra</span>
            </span>
            <span className="text-[10px] opacity-70">Max quality</span>
          </Button>
        </div>

        {/* Model description badge */}
        <div className="text-xs text-muted-foreground mb-4 p-2 rounded bg-muted/30">
          {formData.model === 'fast' ? (
            <>
              <strong>Fast Mode:</strong> Ready in seconds, up to 4K — great for social content and b-roll. Up to 20s videos,
              1080p/2K/4K, landscape or portrait (9:16), camera movements (dolly, jib, focus shift), first & last frame control.
            </>
          ) : formData.model === 'ultra' ? (
            <>
              <strong>Ultra Mode:</strong> Our most advanced model (Seedance 2.0) — cinematic multi-shot scenes, complex direction,
              top-tier motion and consistency. Reference images keep people and products consistent across scenes. Voice with lip sync, 4-15s at 720p.
            </>
          ) : (
            <>
              <strong>Pro Mode:</strong> Best value for talking presenters and product shots — excellent identity and product-label
              consistency, voice with lip sync, singing mode, first & last frame control, consistency number for repeatable results. 4-12s at 720p.
            </>
          )}
        </div>

        {/* Ultra worked example — video + the exact prompt, teaches [Image1] syntax */}
        {formData.model === 'ultra' && (
          <div className="mb-4 rounded-lg border bg-muted/20 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/40 transition-colors"
              onClick={() => setShowUltraExample(prev => !prev)}
            >
              <span className="flex items-center gap-2">
                <Video className="w-4 h-4 text-primary" />
                See an Ultra example — 3 scenes, 1 generation
              </span>
              <span className="text-muted-foreground">{showUltraExample ? '▴' : '▾'}</span>
            </button>
            {showUltraExample && (
              <div className="p-3 pt-0 space-y-3">
                <div className="flex gap-3 flex-col sm:flex-row">
                  <video
                    src={ULTRA_EXAMPLE_VIDEO_URL}
                    controls
                    playsInline
                    preload="metadata"
                    className="rounded-lg border w-full sm:w-[180px] sm:shrink-0 aspect-[9/16] object-cover bg-black"
                  />
                  <div className="space-y-2 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Made from two reference images (the woman + the product) and this prompt — kitchen pitch,
                      macro product shot, outdoor scene, all in one 15s generation:
                    </p>
                    <pre className="text-[11px] leading-relaxed whitespace-pre-wrap bg-muted/40 rounded-md p-2 max-h-40 overflow-y-auto font-mono">{ULTRA_EXAMPLE_PROMPT}</pre>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isGenerating}
                      onClick={() => setFormData(prev => ({ ...prev, prompt: ULTRA_EXAMPLE_PROMPT, duration: 15 }))}
                    >
                      Use as template
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Describe Your Video */}
        <StandardStep
          stepNumber={1}
          title="Describe Your Video"
          description="Tell AI what cinematic video to create"
        >
          {/* Shot Selector - Pre-fill from Video Analyzer */}
          {analyzerShots && analyzerShots.length > 0 && (
            <div className="p-3 rounded-lg border bg-primary/5 border-primary/20 mb-4">
              <Label className="text-xs text-muted-foreground mb-2 block">
                Pre-fill from analyzed shot:
              </Label>
              <Select
                onValueChange={(val) => {
                  const shot = analyzerShots[parseInt(val)];
                  if (shot) {
                    // Build prompt with action and dialogue combined
                    const parts: string[] = [];
                    if (shot.action) {
                      parts.push(shot.action);
                    }
                    if (shot.dialogue) {
                      parts.push(`Narration: "${shot.dialogue}"`);
                    }
                    // Fallback to description if no action/dialogue
                    const prompt = parts.length > 0 ? parts.join('\n\n') : shot.description;
                    setFormData(prev => ({ ...prev, prompt }));
                  }
                }}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a shot to use its action..." />
                </SelectTrigger>
                <SelectContent className="max-w-[400px]">
                  {analyzerShots.map((shot, idx) => {
                    // Calculate suggested duration for hint
                    const durationMatch = shot.duration.match(/(\d+\.?\d*)/);
                    const seconds = durationMatch ? parseFloat(durationMatch[1]) : 5;
                    const suggestedDuration = seconds > 7 ? '10s' : '5s';

                    return (
                      <SelectItem key={idx} value={idx.toString()} className="h-auto py-2 whitespace-normal">
                        <div className="flex flex-col gap-0.5 text-left max-w-[350px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">Shot {shot.shotNumber}</span>
                            <span className="text-xs text-muted-foreground">({shot.duration})</span>
                            {shot.shotType && (
                              <span className="text-xs bg-primary/10 px-1.5 py-0.5 rounded">{shot.shotType}</span>
                            )}
                          </div>
                          {shot.action && (
                            <span className="text-xs text-blue-600 dark:text-blue-400 line-clamp-1">
                              {shot.action}
                            </span>
                          )}
                          {shot.dialogue && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 line-clamp-1">
                              &quot;{shot.dialogue}&quot;
                            </span>
                          )}
                          {!shot.action && !shot.dialogue && shot.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {shot.description}
                            </span>
                          )}
                          <span className="text-xs text-green-600 dark:text-green-400">
                            Suggested duration: {suggestedDuration}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                {analyzerShots.length} shots available from Video Analyzer.
              </p>
            </div>
          )}

          <Textarea
            placeholder={formData.model === 'ultra'
              ? "Describe your scene(s)... Ultra handles complex direction and multiple shots (e.g., 'Shot 1: close-up of a chef plating pasta. Shot 2: wide shot of the busy kitchen, camera dollies right')"
              : formData.model === 'pro'
                ? "Describe your video... Pro mode excels at people, lip sync, and complex motion (e.g., 'A woman smiling and waving at the camera')"
                : "Describe the cinematic video you want to create... (e.g., 'A majestic eagle soaring over snow-capped mountains at sunset')"
            }
            value={formData.prompt}
            onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
            className="min-h-[120px] resize-y"
            disabled={isGenerating}
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>Be specific for better results</span>
            <span>{formData.prompt.length}/500</span>
          </div>

          {/* Camera Control */}
          {formData.model === 'fast' ? (
            <div className="space-y-2 mt-4">
              <Label>Camera Movement</Label>
              <Select
                value={formData.camera_motion}
                onValueChange={(value: FastCameraMotion) => setFormData(prev => ({ ...prev, camera_motion: value }))}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select camera movement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Default)</SelectItem>
                  <SelectItem value="dolly_in">Dolly In</SelectItem>
                  <SelectItem value="dolly_out">Dolly Out</SelectItem>
                  <SelectItem value="dolly_left">Dolly Left</SelectItem>
                  <SelectItem value="dolly_right">Dolly Right</SelectItem>
                  <SelectItem value="jib_up">Jib Up</SelectItem>
                  <SelectItem value="jib_down">Jib Down</SelectItem>
                  <SelectItem value="static">Static</SelectItem>
                  <SelectItem value="focus_shift">Focus Shift</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Standard camera movement applied to the video
              </p>
            </div>
          ) : (
            <div className="space-y-2 mt-4">
              <Label>Camera Style</Label>
              <Select
                value={cameraStyle}
                onValueChange={setCameraStyle}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select camera style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Default)</SelectItem>
                  <SelectItem value="amateur">Amateur / Handheld</SelectItem>
                  <SelectItem value="stable">Stable / Gimbal</SelectItem>
                  <SelectItem value="cinematic">Cinematic / Epic</SelectItem>
                  <SelectItem value="custom">Custom...</SelectItem>
                </SelectContent>
              </Select>
              {cameraStyle === 'custom' && (
                <Textarea
                  placeholder="Enter your custom camera style description..."
                  value={customCameraText}
                  onChange={(e) => setCustomCameraText(e.target.value)}
                  className="mt-2 min-h-[60px]"
                  disabled={isGenerating}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Adds camera movement style to your prompt
              </p>
            </div>
          )}
        </StandardStep>

        {/* Ultra only: Reference Images (Seedance 2.0 reference-to-video) */}
        {formData.model === 'ultra' && (
          <StandardStep
            stepNumber={2}
            title="Reference Images"
            description="Optional: Up to 9 images for consistent people, products, or scenes"
          >
            <div className="space-y-3">
              {ultraRefCount > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {ultraPendingRef && (
                    <div className="relative rounded-lg overflow-hidden border bg-muted/30 aspect-video">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pendingImageUrl}
                        alt="Starting Shot reference"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
                        [Image1]
                      </span>
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-primary/90 text-primary-foreground text-[10px]">
                        Starting Shot
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-5 w-5 bg-background/80 hover:bg-background"
                        onClick={() => onClearPendingImage?.()}
                        disabled={isGenerating}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  {formData.ultra_reference_images.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="relative rounded-lg overflow-hidden border bg-muted/30 aspect-video">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Reference ${i + (ultraPendingRef ? 2 : 1)}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
                        [Image{i + (ultraPendingRef ? 2 : 1)}]
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-5 w-5 bg-background/80 hover:bg-background"
                        onClick={() => setFormData(prev => {
                          const remaining = prev.ultra_reference_images.filter((_, idx) => idx !== i);
                          return {
                            ...prev,
                            ultra_reference_images: remaining,
                            // Audio refs require ≥1 image — drop them with the last one
                            ultra_reference_audios: remaining.length === 0 && !ultraPendingRef ? [] : prev.ultra_reference_audios,
                          };
                        })}
                        disabled={isGenerating}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {ultraRefCount < 9 && (
                <label className="flex flex-col items-center justify-center gap-1 p-4 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors text-center">
                  <Image className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm">Add reference images ({ultraRefCount}/9)</span>
                  <span className="text-xs text-muted-foreground">People, products, scenes — JPG/PNG/WebP</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={isGenerating}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length) {
                        const maxFiles = 9 - (ultraPendingRef ? 1 : 0);
                        setFormData(prev => ({
                          ...prev,
                          ultra_reference_images: [...prev.ultra_reference_images, ...files].slice(0, maxFiles),
                        }));
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              )}

              <p className="text-xs text-muted-foreground">
                Mention them in your prompt as <code className="font-mono">[Image1]</code>, <code className="font-mono">[Image2]</code>… —
                e.g. “The woman from [Image1] holds the product from [Image2] in a bright kitchen.”
                To start on an exact look, add that image and open with “Start on the framing of [Image1]”.
              </p>

              {/* Reference audio — free extra; the model requires ≥1 ref image alongside */}
              <div className="space-y-2 pt-2 border-t">
                  <Label className="flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" />
                    Reference Audio <span className="text-xs font-normal text-muted-foreground">(optional, no extra credits)</span>
                  </Label>
                  {ultraRefCount === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Add at least one reference image above to attach audio — the model needs a visual
                      anchor and can&apos;t generate from audio alone.
                    </p>
                  )}
                  {formData.ultra_reference_audios.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                      <span className="px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono shrink-0">[Audio{i + 1}]</span>
                      <span className="text-xs truncate flex-1">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          ultra_reference_audios: prev.ultra_reference_audios.filter((_, idx) => idx !== i),
                        }))}
                        disabled={isGenerating}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {formData.ultra_reference_audios.length < 3 && (
                    <label className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-border transition-colors ${
                      ultraRefCount === 0
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-primary/50 cursor-pointer'
                    }`}>
                      <Volume2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs">Add audio clip ({formData.ultra_reference_audios.length}/3) — voice line or music, ≤15s combined</span>
                      <input
                        type="file"
                        accept="audio/*"
                        multiple
                        className="hidden"
                        disabled={isGenerating || ultraRefCount === 0}
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length) {
                            setFormData(prev => ({
                              ...prev,
                              ultra_reference_audios: [...prev.ultra_reference_audios, ...files].slice(0, 3),
                            }));
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  {formData.ultra_reference_audios.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Reference it in your prompt — e.g. “She speaks the line from [Audio1]” or “Score the scene with [Audio1].”
                    </p>
                  )}
              </div>
            </div>
          </StandardStep>
        )}

        {/* Step 2: First Frame (Fast/Pro) — Ultra uses the reference set instead */}
        {formData.model !== 'ultra' && (
        <StandardStep
          stepNumber={2}
          title="First Frame Image"
          description="Optional: Upload a starting frame for image-to-video generation"
        >
          {usingPendingImage ? (
            // Show pending image from Starting Shot
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden border bg-muted/30">
                <img
                  src={pendingImageUrl}
                  alt="Starting shot reference"
                  className="w-full h-auto max-h-[200px] object-contain"
                />
                <div className="absolute top-2 left-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/90 text-primary-foreground text-xs font-medium">
                    <Image className="w-3 h-3" />
                    From Starting Shot
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 bg-background/80 hover:bg-background"
                  onClick={() => onClearPendingImage?.()}
                  disabled={isGenerating}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Using image from Starting Shot. Click X to remove and upload a different image.
              </p>
            </div>
          ) : (
            <>
              <UnifiedDragDrop
                fileType="reference"
                selectedFile={formData.reference_image}
                onFileSelect={handleImageUpload}
                disabled={isGenerating}
                title="Drop image or click to upload"
                description="Optional — upload an image to start from a specific look, or leave empty to create from scratch."
                previewSize="medium"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supports JPG, PNG, WebP. Max 10MB.
              </p>
            </>
          )}
        </StandardStep>
        )}

        {/* Step 2.5: Last Frame (Fast/Pro) — Ultra uses the reference set instead */}
        {config.features.lastFrame && formData.model !== 'ultra' && (
          <StandardStep
            stepNumber={2.5}
            title="Last Frame Image"
            description="Optional: Upload an ending frame for controlled transitions"
          >
            <UnifiedDragDrop
              fileType="reference"
              selectedFile={formData.last_frame_image}
              onFileSelect={handleLastFrameUpload}
              disabled={isGenerating}
              title="Drop ending frame or click to upload"
              description="Optional - The video will transition to this frame"
              previewSize="medium"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Control how your video ends by specifying the last frame. Requires a first frame image.
            </p>
          </StandardStep>
        )}

        {/* Step 3: Video Settings */}
        <StandardStep
          stepNumber={3}
          title="Video Settings"
          description="Configure duration, resolution, and audio"
        >
          <div className="space-y-4">
            {/* Aspect Ratio (both models) */}
            {config.aspectRatios && (
              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select
                  value={formData.aspect_ratio}
                  onValueChange={(value: string) => {
                    setFormData(prev => ({ ...prev, aspect_ratio: value as ProAspectRatio }));
                    onAspectRatioChange?.(value);
                  }}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.aspectRatios.map((ratio) => (
                      <SelectItem key={ratio} value={ratio}>
                        {ratio === '16:9' && '16:9 (Landscape)'}
                        {ratio === '9:16' && '9:16 (Portrait/TikTok)'}
                        {ratio === '1:1' && '1:1 (Square)'}
                        {ratio === '4:3' && '4:3 (Classic)'}
                        {ratio === '3:4' && '3:4 (Portrait Classic)'}
                        {ratio === '21:9' && '21:9 (Ultrawide)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Duration Selection - Button Grid */}
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="grid grid-cols-4 gap-2">
                {availableDurations.map((d) => {
                  const cost = formData.model === 'fast'
                    ? d * (formData.resolution === '4k' ? 8 : formData.resolution === '2k' ? 4 : 2)
                    : formData.model === 'ultra'
                      ? d * 10 // Ultra (Seedance 2.0): 10 credits/sec
                      : d * 4; // Pro (Seedance 1.5): 4 credits/sec
                  return (
                    <Button
                      key={d}
                      type="button"
                      variant={formData.duration === d ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleDurationChange(d)}
                      disabled={isGenerating}
                      className="flex flex-col h-auto py-2"
                    >
                      <span className="font-medium">{d}s</span>
                      <span className="text-xs opacity-70">{cost} credits</span>
                    </Button>
                  );
                })}
              </div>
              {formData.model === 'fast' && formData.duration > 10 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Note: Durations over 10 seconds require 1080p resolution
                </p>
              )}
            </div>

            {/* Resolution Selection */}
            <div className="space-y-2">
              <Label>Resolution</Label>
              <Select
                value={formData.resolution}
                onValueChange={handleResolutionChange}
                disabled={isGenerating || (formData.model === 'fast' && formData.duration > 10)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(availableResolutions).map(([key, { label, creditsPerSecond }]) => (
                    <SelectItem key={key} value={key}>
                      {label} ({creditsPerSecond} credits/sec)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.model === 'fast'
                  ? '1080p is plenty for TikTok/Instagram/YouTube — use 4K only for big screens.'
                  : 'Native 720p — sharp on phones and social feeds, where these videos live.'}
              </p>
              {formData.model === 'pro' && formData.resolution === '1080p' && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  1080p uses AI upscaling from 720p (+1 credit/sec)
                </p>
              )}
            </div>

            {/* Pro Mode Advanced Controls */}
            {formData.model === 'pro' && (
              <>
                {/* Seed Input */}
                {config.features.seed && (
                  <div className="space-y-2">
                    <Label htmlFor="seed">Consistency number (optional)</Label>
                    <Input
                      id="seed"
                      type="number"
                      placeholder="Leave empty for varied results"
                      value={formData.seed}
                      onChange={(e) => setFormData(prev => ({ ...prev, seed: e.target.value }))}
                      disabled={isGenerating}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty for varied results — enter any number to get the same result every time
                    </p>
                  </div>
                )}

                {/* Camera Lock Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label htmlFor="camera-lock" className="cursor-pointer">Lock Camera</Label>
                      <p className="text-xs text-muted-foreground">Keep camera stationary during video</p>
                    </div>
                  </div>
                  <Switch
                    id="camera-lock"
                    checked={formData.camera_fixed}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, camera_fixed: checked }))}
                    disabled={isGenerating}
                  />
                </div>

                {/* Singing Mode Info */}
                {config.features.singing && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                    <Mic className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Lip Sync & Singing Ready</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Pro mode supports accurate lip sync and singing animations
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Audio Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="audio-toggle" className="cursor-pointer">AI Audio Generation</Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.model === 'fast'
                      ? 'Generate ambient audio for your video'
                      : 'Voice and natural sound — no background music. Turn off for a silent video (add your own music later).'}
                  </p>
                </div>
              </div>
              <Switch
                id="audio-toggle"
                checked={formData.generate_audio}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, generate_audio: checked }))}
                disabled={isGenerating}
              />
            </div>
          </div>
        </StandardStep>
      </TabBody>

      <TabFooter>
        {!isLoadingCredits && credits < estimatedCredits && (
          <InsufficientCreditsNotice needed={estimatedCredits} available={credits} className="mb-2" />
        )}
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || (!isLoadingCredits && credits < estimatedCredits) || !formData.prompt?.trim()}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating Video...
            </>
          ) : (
            <>
              <Video className="w-4 h-4 mr-2" />
              Generate {formData.model === 'ultra' ? 'Ultra' : formData.model === 'pro' ? 'Pro' : 'Fast'} Video · {estimatedCredits} credits
            </>
          )}
        </Button>
        {isGenerating && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            You can keep working — we&apos;ll notify you when it&apos;s ready.
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
