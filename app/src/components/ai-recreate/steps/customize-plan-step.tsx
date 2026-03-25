'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Image as ImageIcon, Monitor, Smartphone, Palette, X, Plus, MessageSquare } from 'lucide-react';
import { breakdownScript } from '@/actions/tools/scene-breakdown';
// Product substitution removed — breakdown is a faithful copy, client customizes via AI chat
import { refineBreakdownWithAI } from '@/actions/tools/scene-breakdown';
import { groupScenesIntoBatches } from '@/lib/scene-breakdown/types';
import { MOTION_PRESETS } from '@/lib/scene-breakdown/motion-presets';
import type { WizardData, ChatMessage } from '../wizard-types';
import type { BreakdownScene, SceneBreakdownResult } from '@/lib/scene-breakdown/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CustomizePlanStepProps {
  wizardData: WizardData;
  onBreakdownComplete: (result: SceneBreakdownResult) => void;
  onUpdateScene: (sceneNumber: number, updates: Partial<BreakdownScene>) => void;
  onUpdateGlobalAesthetic: (prompt: string) => void;
  onUpdateNarration: (narration: string) => void;
  onUpdateReferenceImages: (images: { file: File; preview: string }[]) => void;
  onUpdateAspectRatio: (ratio: '16:9' | '9:16') => void;
  onToggleScene?: (sceneNumber: number) => void;
}

export function CustomizePlanStep({
  wizardData,
  onBreakdownComplete,
  onUpdateScene,
  onUpdateGlobalAesthetic,
  onUpdateNarration,
  onUpdateReferenceImages,
  onUpdateAspectRatio,
  onToggleScene,
}: CustomizePlanStepProps) {
  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasBreakdown = wizardData.scenes.length > 0;
  const batches = hasBreakdown ? groupScenesIntoBatches(wizardData.scenes) : [];

  // ===== Break down script =====
  const handleBreakdown = async () => {
    let scriptText = wizardData.analysisText || wizardData.narrationScript;
    if (!scriptText.trim()) {
      toast.error('Please paste a script or analysis text first');
      return;
    }

    // No product substitution — breakdown is a faithful copy of the original video
    // Client uses AI chat to customize scenes after breakdown

    setIsBreakingDown(true);
    try {
      const response = await breakdownScript({
        scriptText,
        visualStyle: 'Cinematic Realism',
      });

      if (response.success && response.result) {
        onBreakdownComplete(response.result);
        toast.success(`Script broken down into ${response.result.scenes.length} scenes`);
      } else {
        toast.error(response.error || 'Failed to break down script');
      }
    } catch (err) {
      toast.error('Failed to break down script');
    }
    setIsBreakingDown(false);
  };

  // ===== AI Chat: refine all scenes at once =====
  const handleSendChat = async () => {
    if (!chatInput.trim() || !hasBreakdown) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsRefining(true);

    try {
      const response = await refineBreakdownWithAI({
        currentScenes: wizardData.scenes,
        globalAesthetic: wizardData.globalAestheticPrompt,
        narrationScript: wizardData.narrationScript,
        userInstruction: chatInput,
      });

      if (response.success && response.result) {
        // Update all scenes at once
        onBreakdownComplete(response.result);

        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: response.summary || `Updated ${response.result.scenes.length} scenes based on your instructions.`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I couldn't apply those changes: ${response.error || 'Unknown error'}`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }
    } catch {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }

    setIsRefining(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // ===== Reference image handling =====
  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    onUpdateReferenceImages([...wizardData.referenceImages, ...newImages]);
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    const updated = [...wizardData.referenceImages];
    URL.revokeObjectURL(updated[index].preview);
    updated.splice(index, 1);
    onUpdateReferenceImages(updated);
  };

  return (
    <div className="flex h-full">
      {/* Left: AI Chat + Settings */}
      <div className="w-80 border-r border-border/30 flex flex-col shrink-0">
        {/* Settings section */}
        <div className="p-4 space-y-4 border-b border-border/30">
          {/* Aspect Ratio */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Aspect Ratio</label>
            <div className="flex gap-2">
              <Button
                variant={wizardData.aspectRatio === '9:16' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdateAspectRatio('9:16')}
                className="flex-1"
              >
                <Smartphone className="w-3 h-3 mr-1" /> 9:16
              </Button>
              <Button
                variant={wizardData.aspectRatio === '16:9' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdateAspectRatio('16:9')}
                className="flex-1"
              >
                <Monitor className="w-3 h-3 mr-1" /> 16:9
              </Button>
            </div>
          </div>

          {/* Reference Images */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Product / Reference Images
            </label>
            <div className="flex flex-wrap gap-2">
              {wizardData.referenceImages.map((img, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="relative w-14 h-14 rounded-md overflow-hidden border border-border/50">
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemoveImage(i)}
                      className="absolute top-0 right-0 bg-black/60 rounded-bl p-0.5"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={img.label || ''}
                    onChange={e => {
                      const updated = [...wizardData.referenceImages];
                      updated[i] = { ...updated[i], label: e.target.value };
                      onUpdateReferenceImages(updated);
                    }}
                    placeholder={`Product ${i + 1}`}
                    className="w-16 text-[10px] text-center bg-secondary/30 border border-border/30 rounded px-1 py-0.5 text-muted-foreground"
                  />
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 rounded-md border border-dashed border-border/50 flex items-center justify-center text-muted-foreground hover:bg-secondary/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleAddImages}
              />
            </div>

          </div>
        </div>

        {/* AI Chat */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2 border-b border-border/30">
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              AI Assistant
            </h3>
            <p className="text-xs text-muted-foreground">
              Give instructions to update all scenes at once
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.length === 0 && hasBreakdown && (
              <div className="text-xs text-muted-foreground italic p-2">
                Try: &quot;Change the product to a magnesium powder jar&quot; or &quot;Make it in English&quot;
              </div>
            )}
            {chatMessages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  'text-sm rounded-lg px-3 py-2 max-w-[90%]',
                  msg.role === 'user'
                    ? 'bg-primary/20 ml-auto'
                    : 'bg-secondary/50'
                )}
              >
                {msg.content}
              </div>
            ))}
            {isRefining && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Updating scenes...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          {hasBreakdown && (
            <div className="p-3 border-t border-border/30">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                  placeholder="Update all scenes..."
                  disabled={isRefining}
                  className="flex-1 text-sm bg-secondary/30 border border-border/30 rounded-md px-3 py-1.5 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <Button
                  size="sm"
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || isRefining}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Script + Shot List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!hasBreakdown ? (
          /* Pre-breakdown: Customize with your product and brand */
          <div className="max-w-2xl mx-auto space-y-6">
            {isBreakingDown ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <div className="text-center">
                  <h2 className="text-lg font-semibold mb-1">Breaking Down Script...</h2>
                  <p className="text-sm text-muted-foreground">
                    Creating scene-by-scene breakdown with your product details
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-lg font-semibold mb-1">Customize with Your Product & Brand</h2>
                  <p className="text-sm text-muted-foreground">
                    {wizardData.analysisText
                      ? 'Upload your product image and the AI will automatically adapt the video to feature your brand.'
                      : 'Paste your narration script, upload your product image, and the AI will create a shot-by-shot plan.'}
                  </p>
                </div>

                {/* Narration script (only if no analysis loaded — manual mode) */}
                {!wizardData.analysisText && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Narration Script</label>
                    <Textarea
                      value={wizardData.narrationScript}
                      onChange={e => onUpdateNarration(e.target.value)}
                      placeholder="Paste your narration script here..."
                      className="min-h-[200px] font-mono text-sm"
                    />
                  </div>
                )}

                {/* Generate button */}
                <Button
                  onClick={handleBreakdown}
                  disabled={!(wizardData.analysisText || wizardData.narrationScript).trim()}
                  className="w-full h-12"
                  size="lg"
                >
                  {wizardData.analysisText ? 'Generate Shot Plan' : 'Break Down Script'}
                </Button>

                {!wizardData.referenceImages.length && wizardData.analysisText && (
                  <p className="text-xs text-muted-foreground text-center">
                    Add your product image on the left panel for best results
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          /* Post-breakdown: show scenes */
          <>
            {/* Stats bar */}
            <div className="flex items-center gap-3 text-sm">
              <span className="bg-secondary/50 px-3 py-1 rounded-md">{wizardData.scenes.length} Scenes</span>
              <span className="bg-secondary/50 px-3 py-1 rounded-md">{batches.length} Batches</span>
              <span className="bg-secondary/50 px-3 py-1 rounded-md">
                ~{wizardData.scenes.reduce((t, s) => t + (parseInt(s.duration) || 5), 0)}s Total
              </span>
              <Button variant="outline" size="sm" onClick={handleBreakdown} disabled={isBreakingDown}>
                {isBreakingDown ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Re-break Down'}
              </Button>
            </div>

            {/* Global Aesthetic */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-medium">Global Aesthetic</h3>
                <span className="text-xs text-muted-foreground">Applies to all scenes</span>
              </div>
              <Textarea
                value={wizardData.globalAestheticPrompt}
                onChange={e => onUpdateGlobalAesthetic(e.target.value)}
                className="text-sm min-h-[60px]"
              />
            </Card>

            {/* Narration Script (editable) */}
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-2">Narration Script</h3>
              <Textarea
                value={wizardData.narrationScript}
                onChange={e => onUpdateNarration(e.target.value)}
                className="text-sm min-h-[80px] font-mono"
              />
            </Card>

            {/* Scene list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Shot List</h3>
                <span className="text-xs text-muted-foreground">
                  {wizardData.enabledScenes.size}/{wizardData.scenes.length} selected for generation
                </span>
              </div>
              {wizardData.scenes.map(scene => {
                const isEnabled = wizardData.enabledScenes.has(scene.sceneNumber);
                return (
                  <Card key={scene.sceneNumber} className={cn("p-3 transition-opacity", !isEnabled && "opacity-40")}>
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => onToggleScene?.(scene.sceneNumber)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-primary">#{scene.sceneNumber}</span>
                        <span className="text-xs text-muted-foreground">{scene.duration}</span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm text-muted-foreground">{scene.narration}</p>
                        {isEnabled && (
                          <>
                            <Textarea
                              value={scene.visualPrompt}
                              onChange={e => onUpdateScene(scene.sceneNumber, { visualPrompt: e.target.value })}
                              className="text-xs min-h-[40px] bg-secondary/20"
                              placeholder="Visual prompt..."
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Motion:</span>
                              <select
                                value={scene.motionPresetId || 6}
                                onChange={e => onUpdateScene(scene.sceneNumber, { motionPresetId: parseInt(e.target.value) })}
                                className="text-xs bg-secondary/30 border border-border/30 rounded px-2 py-0.5"
                              >
                                {MOTION_PRESETS.map(p => (
                                  <option key={p.id} value={p.id}>#{p.id} - {p.name}</option>
                                ))}
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
