'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabContentWrapper, TabBody } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import {
  Upload, Loader2, ImagePlus, Sparkles, Film, RefreshCw, X, Download, RotateCcw,
} from 'lucide-react';
import type { AgentCloneShot, AgentCloneCameraMotion, AgentCloneDuration } from '@/types/reelestate';
import { AGENT_CLONE_CAMERA_MOTIONS, AGENT_CLONE_DURATIONS } from '@/types/reelestate';

const DEFAULT_PROMPT = 'A real estate agent standing naturally in this property. Professional photo, natural lighting, matching perspective and shadows.';

const ACTION_PRESETS = [
  { label: 'Standing still', value: 'standing still, looking at the camera with a confident smile' },
  { label: 'Walking in', value: 'walking into the room naturally, looking around the space' },
  { label: 'Gesturing around', value: 'gesturing around the room, presenting the space to the viewer' },
  { label: 'Pointing at feature', value: 'pointing at a notable feature of the property' },
  { label: 'Opening door', value: 'opening a door and walking through, inviting the viewer inside' },
  { label: 'Looking out window', value: 'looking out the window and turning back to the camera with a smile' },
];

const CAMERA_MOTION_LABELS: Record<AgentCloneCameraMotion, string> = {
  none: 'None',
  dolly_in: 'Dolly In',
  dolly_out: 'Dolly Out',
  dolly_left: 'Dolly Left',
  dolly_right: 'Dolly Right',
  jib_up: 'Jib Up',
  jib_down: 'Jib Down',
  static: 'Static',
  focus_shift: 'Focus Shift',
};

interface AgentCloneTabProps {
  agentPhotoUrl: string | null;
  onSetAgentPhoto: (url: string) => void;
  aspectRatio: '16:9' | '9:16';
  onSetAspectRatio: (ratio: '16:9' | '9:16') => void;
  shots: AgentCloneShot[];
  credits: number;
  isWorking: boolean;
  onUpdateShot: (id: string, updates: Partial<AgentCloneShot>) => void;
  onRemoveShot: (id: string) => void;
  onCreateAndGenerate: (backgroundUrl: string, prompt: string) => void;
  onRegenerateComposite: (shotId: string, prompt: string) => void;
  onAnimateShot: (shotId: string) => void;
}

export function AgentCloneTab({
  agentPhotoUrl,
  onSetAgentPhoto,
  aspectRatio,
  onSetAspectRatio,
  shots,
  credits,
  isWorking,
  onUpdateShot,
  onRemoveShot,
  onCreateAndGenerate,
  onRegenerateComposite,
  onAnimateShot,
}: AgentCloneTabProps) {
  const agentFileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const [bgUrl, setBgUrl] = useState('');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [isDragging, setIsDragging] = useState(false);

  // Current active shot (latest)
  const shot = shots.length > 0 ? shots[shots.length - 1] : null;
  const isProcessing = shot?.status === 'compositing' || shot?.status === 'animating';
  const hasComposite = shot?.status === 'composite_ready' || shot?.status === 'animating' || shot?.status === 'ready';
  const hasVideo = shot?.status === 'ready';
  const isFailed = shot?.status === 'failed';

  // ─── File Helpers ──────────────────────────────

  const fileToDataUri = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

  const handleAgentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onSetAgentPhoto(await fileToDataUri(file));
    }
    if (agentFileRef.current) agentFileRef.current.value = '';
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setBgUrl(await fileToDataUri(file));
    }
    if (bgFileRef.current) bgFileRef.current.value = '';
  };

  const handleBgDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setBgUrl(reader.result as string);
      reader.readAsDataURL(file);
      return;
    }
    const text = e.dataTransfer.getData('text/plain');
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      setBgUrl(text);
    }
  }, []);

  // ─── Actions ───────────────────────────────────

  const handleGenerate = () => {
    if (!bgUrl) return;
    if (shot) onRemoveShot(shot.id);
    onCreateAndGenerate(bgUrl, prompt);
  };

  const handleRegenerate = () => {
    if (!shot) return;
    onRegenerateComposite(shot.id, prompt);
  };

  const handleChangeBackground = () => {
    if (shot) onRemoveShot(shot.id);
    setBgUrl('');
  };

  const handleNewShot = () => {
    if (shot) onRemoveShot(shot.id);
    setBgUrl('');
    setPrompt(DEFAULT_PROMPT);
  };

  // ─── Credit Checks ────────────────────────────

  const canGenerate = credits >= 2;
  const canAnimate = shot ? credits >= shot.duration : false;

  return (
    <TabContentWrapper>
      <TabBody>
        {/* ── Step 1: Setup ──────────────────────── */}
        <StandardStep
          stepNumber={1}
          title="Setup"
          description="Upload your photo and choose format"
        >
          {/* Agent Photo */}
          {agentPhotoUrl ? (
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-border/50">
                <img src={agentPhotoUrl} alt="Agent" className="w-full h-full object-cover" />
              </div>
              <Button variant="outline" size="sm" onClick={() => agentFileRef.current?.click()}>
                Change Photo
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => agentFileRef.current?.click()}
              className="w-full h-20 border-dashed"
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload Your Photo
            </Button>
          )}
          <input ref={agentFileRef} type="file" accept="image/*" onChange={handleAgentUpload} className="hidden" />

          {/* Aspect Ratio — inline below photo */}
          <div className="flex gap-2 mt-3">
            {(['16:9', '9:16'] as const).map(ratio => (
              <Button
                key={ratio}
                variant={aspectRatio === ratio ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => onSetAspectRatio(ratio)}
                disabled={!agentPhotoUrl || isProcessing}
              >
                {ratio === '16:9' ? 'Landscape' : 'Portrait'} ({ratio})
              </Button>
            ))}
          </div>
        </StandardStep>

        {/* ── Step 2: Create ─────────────────────── */}
        <StandardStep
          stepNumber={2}
          title="Create"
          description={hasVideo ? 'Your clip is ready' : hasComposite ? 'Composite ready — configure and animate' : 'Add a background and generate'}
        >
          <div className={`space-y-3 ${!agentPhotoUrl ? 'opacity-50 pointer-events-none' : ''}`}>

            {/* ── Background Image ─────────────── */}
            {!shot && !bgUrl && (
              <div>
                <Label className="text-xs">Background Image</Label>
                <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
                  onDrop={handleBgDrop}
                  onClick={() => agentPhotoUrl ? bgFileRef.current?.click() : undefined}
                  className={`mt-1 flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-muted-foreground/50'
                  }`}
                >
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground text-center">
                    Drop image here or click to upload
                  </span>
                </div>
              </div>
            )}

            {!shot && bgUrl && (
              <div>
                <Label className="text-xs">Background Image</Label>
                <div className="mt-1 relative aspect-video rounded-lg overflow-hidden border border-border/50">
                  <img src={bgUrl} alt="Background" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setBgUrl('')}
                    className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              </div>
            )}

            {shot && (
              <div className="flex items-center gap-2">
                <div className="w-16 h-12 rounded overflow-hidden border border-border/50 shrink-0">
                  <img src={shot.backgroundUrl} alt="Background" className="w-full h-full object-cover" />
                </div>
                {!isProcessing && (
                  <Button variant="ghost" size="sm" onClick={handleChangeBackground} className="text-xs text-muted-foreground">
                    Change
                  </Button>
                )}
              </div>
            )}

            <input ref={bgFileRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />

            {/* ── Prompt (visible when editable) ── */}
            {!isProcessing && (
              <div>
                <Label className="text-xs">Prompt</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="mt-1 min-h-[70px] text-sm"
                  disabled={!agentPhotoUrl}
                />
              </div>
            )}

            {/* ── Generate / Regenerate / Retry ─── */}
            {!shot && bgUrl && (
              <Button onClick={handleGenerate} disabled={!canGenerate || isWorking} className="w-full">
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Composite {canGenerate ? '(2 credits)' : `(need 2 credits)`}
              </Button>
            )}

            {/* Generate button placeholder when no background yet */}
            {!shot && !bgUrl && (
              <Button disabled className="w-full">
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Composite (2 credits)
              </Button>
            )}

            {shot?.status === 'compositing' && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating composite...
              </div>
            )}

            {isFailed && (
              <div className="space-y-2">
                <p className="text-xs text-destructive">{shot?.error}</p>
                <Button onClick={handleRegenerate} disabled={isWorking} variant="outline" className="w-full">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retry {canGenerate ? '(2 credits)' : '(need 2 credits)'}
                </Button>
              </div>
            )}

            {(shot?.status === 'composite_ready' || shot?.status === 'ready') && (
              <>
                {/* Download + New Shot (when video exists) */}
                {shot.videoUrl && (
                  <div className="flex gap-2">
                    <a
                      href={shot.videoUrl}
                      download="agent-clone-video.mp4"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Download
                      </Button>
                    </a>
                    <Button variant="outline" size="sm" onClick={handleNewShot} className="flex-1">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      New
                    </Button>
                  </div>
                )}

                {/* Regenerate */}
                <Button onClick={handleRegenerate} disabled={isWorking} variant="outline" size="sm" className="w-full">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Regenerate Composite (2 credits)
                </Button>

                {/* Error from failed animation attempt */}
                {shot.error && (
                  <p className="text-xs text-destructive">{shot.error}</p>
                )}

                <div className="border-t border-border/50 pt-3 space-y-3">
                  {/* Animation controls */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Camera</Label>
                      <Select
                        value={shot.cameraMotion}
                        onValueChange={(v) => onUpdateShot(shot.id, { cameraMotion: v as AgentCloneCameraMotion })}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AGENT_CLONE_CAMERA_MOTIONS.map(m => (
                            <SelectItem key={m} value={m}>{CAMERA_MOTION_LABELS[m]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Duration</Label>
                      <Select
                        value={String(shot.duration)}
                        onValueChange={(v) => onUpdateShot(shot.id, { duration: Number(v) as AgentCloneDuration })}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AGENT_CLONE_DURATIONS.map(d => (
                            <SelectItem key={d} value={String(d)}>{d}s</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Action */}
                  <div>
                    <Label className="text-xs">Action (optional)</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {ACTION_PRESETS.map(preset => (
                        <button
                          key={preset.value}
                          onClick={() => onUpdateShot(shot.id, { action: shot.action === preset.value ? '' : preset.value })}
                          className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                            shot.action === preset.value
                              ? 'bg-primary/15 border-primary/40 text-primary'
                              : 'border-border/50 text-muted-foreground hover:border-muted-foreground/50'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <Textarea
                      placeholder="Or describe a custom action..."
                      value={shot.action}
                      onChange={(e) => onUpdateShot(shot.id, { action: e.target.value })}
                      className="min-h-[32px] text-xs mt-1.5"
                    />
                  </div>

                  {/* Dialogue */}
                  <div>
                    <Label className="text-xs">Dialogue (optional)</Label>
                    <Textarea
                      placeholder="What are you saying in this shot?"
                      value={shot.dialogue}
                      onChange={(e) => onUpdateShot(shot.id, { dialogue: e.target.value })}
                      className="min-h-[40px] text-xs mt-1"
                    />
                  </div>

                  <Button onClick={() => onAnimateShot(shot.id)} disabled={!canAnimate || isWorking} className="w-full">
                    <Film className="w-4 h-4 mr-2" />
                    {hasVideo ? 'Re-animate' : 'Animate'} {canAnimate ? `(${shot.duration} credits)` : `(need ${shot.duration} credits)`}
                  </Button>
                </div>
              </>
            )}

            {shot?.status === 'animating' && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Animating video...
              </div>
            )}


          </div>
        </StandardStep>
      </TabBody>
    </TabContentWrapper>
  );
}
