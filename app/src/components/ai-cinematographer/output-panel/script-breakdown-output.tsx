'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Send, Palette, ChevronDown, ChevronUp, FileText, Layers, Save, FolderOpen, Trash2 } from 'lucide-react';
import { SceneCard } from '../components/scene-card';
import type { BreakdownScene, SceneBreakdownResult } from '@/lib/scene-breakdown/types';
import { groupScenesIntoBatches, scenesToAnalyzerShots } from '@/lib/scene-breakdown/types';
import {
  saveBreakdown,
  listBreakdowns,
  loadBreakdown,
  deleteBreakdown,
  type SavedBreakdown,
} from '@/actions/tools/scene-breakdown';

interface ScriptBreakdownOutputProps {
  isProcessing: boolean;
  result: SceneBreakdownResult | null;
  scriptText?: string;
  onUpdateScene: (sceneNumber: number, updates: Partial<BreakdownScene>) => void;
  onUpdateGlobalAesthetic: (prompt: string) => void;
  onLoadBreakdown: (breakdown: SavedBreakdown) => void;
}

export function ScriptBreakdownOutput({
  isProcessing,
  result,
  scriptText,
  onUpdateScene,
  onUpdateGlobalAesthetic,
  onLoadBreakdown,
}: ScriptBreakdownOutputProps) {
  const router = useRouter();
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set([0])); // First batch expanded by default

  // Save/Load state
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedBreakdowns, setSavedBreakdowns] = useState<SavedBreakdown[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load saved breakdowns list
  const loadSavedBreakdowns = async () => {
    setIsLoadingList(true);
    try {
      const response = await listBreakdowns();
      if (response.success && response.breakdowns) {
        setSavedBreakdowns(response.breakdowns);
      }
    } catch (error) {
      console.error('Failed to load breakdowns:', error);
    } finally {
      setIsLoadingList(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!result || !saveTitle.trim()) return;

    setIsSaving(true);
    try {
      const response = await saveBreakdown({
        title: saveTitle.trim(),
        scriptText: scriptText,
        globalAesthetic: result.globalAestheticPrompt,
        scenes: result.scenes,
      });

      if (response.success) {
        setIsSaveDialogOpen(false);
        setSaveTitle('');
        // Refresh list
        loadSavedBreakdowns();
      } else {
        console.error('Failed to save:', response.error);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle load
  const handleLoad = async (id: string) => {
    try {
      const response = await loadBreakdown(id);
      if (response.success && response.breakdown) {
        onLoadBreakdown(response.breakdown);
      } else {
        console.error('Failed to load:', response.error);
      }
    } catch (error) {
      console.error('Load error:', error);
    }
  };

  // Handle delete
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const response = await deleteBreakdown(id);
      if (response.success) {
        setSavedBreakdowns(prev => prev.filter(b => b.id !== id));
      } else {
        console.error('Failed to delete:', response.error);
      }
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeletingId(null);
    }
  };

  // Group scenes into batches of 4 (2x2 grid)
  const batches = useMemo(() => {
    if (!result?.scenes) return [];
    return groupScenesIntoBatches(result.scenes);
  }, [result?.scenes]);

  const toggleBatch = (batchIndex: number) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchIndex)) {
        next.delete(batchIndex);
      } else {
        next.add(batchIndex);
      }
      return next;
    });
  };

  const handleSendToStoryboard = (batch: BreakdownScene[], batchIndex: number) => {
    if (!result) return;

    const promptId = `scene-breakdown-${Date.now()}`;

    // Build storyboard prompt: global aesthetic + frame descriptions
    const combinedPrompt = `${result.globalAestheticPrompt}

Create a 2x2 cinematic storyboard grid (2 columns, 2 rows = 4 frames).
CRITICAL: NO gaps, NO borders, NO black bars between frames. All frames must touch edge-to-edge.

${batch.map((s, i) =>
  `Frame ${i + 1}: ${s.visualPrompt}`
).join('\n\n')}

Maintain visual consistency across all frames.`;

    localStorage.setItem(promptId, combinedPrompt);

    // Convert to analyzerShots format for motion pre-fill
    const shots = scenesToAnalyzerShots(batch);
    localStorage.setItem(`${promptId}-shots`, JSON.stringify(shots));

    // Store batch number for tracking through the pipeline
    localStorage.setItem(`${promptId}-batchNumber`, String(batchIndex + 1));

    // Navigate to storyboard tab
    router.push(`/dashboard/ai-cinematographer/storyboard?promptId=${promptId}`);
  };

  // Loading state
  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <div className="text-center">
          <h3 className="font-medium text-lg">Breaking Down Script</h3>
          <p className="text-sm text-muted-foreground">
            Analyzing narration and generating visual prompts...
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium text-lg">No Script Breakdown Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Paste your script in the left panel and click &quot;Break Down Script&quot; to generate scenes with visual and motion prompts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Summary + Save/Load */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant="outline" className="text-sm">
              <Layers className="w-3 h-3 mr-1" />
              {result.scenes.length} Scenes
            </Badge>
            <Badge variant="outline" className="text-sm">
              {batches.length} Batches
            </Badge>
            <Badge variant="outline" className="text-sm">
              ~{result.scenes.length * 5}s Total
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* Load Saved Breakdowns */}
            <DropdownMenu onOpenChange={(open) => open && loadSavedBreakdowns()}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FolderOpen className="w-3 h-3 mr-1" />
                  My Breakdowns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {isLoadingList ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : savedBreakdowns.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No saved breakdowns yet
                  </div>
                ) : (
                  savedBreakdowns.map((breakdown) => (
                    <DropdownMenuItem
                      key={breakdown.id}
                      onClick={() => handleLoad(breakdown.id)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">{breakdown.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {breakdown.scenes.length} scenes
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 ml-2 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => handleDelete(breakdown.id, e)}
                        disabled={deletingId === breakdown.id}
                      >
                        {deletingId === breakdown.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </Button>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Save Breakdown */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsSaveDialogOpen(true)}
            >
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </Card>

      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Script Breakdown</DialogTitle>
            <DialogDescription>
              Save this breakdown to access it later. You can load it from &quot;My Breakdowns&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="breakdown-title">Title</Label>
            <Input
              id="breakdown-title"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder="e.g., Roman Decimation Script"
              className="mt-2"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!saveTitle.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Breakdown'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global Aesthetic Prompt */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          <Label className="font-medium">Global Aesthetic</Label>
          <Badge variant="secondary" className="text-xs">Applies to all scenes</Badge>
        </div>
        <Textarea
          value={result.globalAestheticPrompt}
          onChange={(e) => onUpdateGlobalAesthetic(e.target.value)}
          placeholder="Visual style description for all scenes..."
          className="min-h-[100px] resize-y"
        />
      </Card>

      {/* Batches */}
      {batches.map((batch, batchIndex) => {
        const isExpanded = expandedBatches.has(batchIndex);
        const startScene = batchIndex * 4 + 1;
        const endScene = startScene + batch.length - 1;

        return (
          <Card key={batchIndex} className="overflow-hidden">
            {/* Batch Header */}
            <button
              onClick={() => toggleBatch(batchIndex)}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Badge variant="default" className="font-mono">
                  Batch {batchIndex + 1}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Scenes {startScene}-{endScene} ({batch.length} scenes)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendToStoryboard(batch, batchIndex);
                  }}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Send to Storyboard
                </Button>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Batch Content */}
            {isExpanded && (
              <div className="p-4 pt-0 space-y-3 border-t">
                {batch.map((scene) => (
                  <SceneCard
                    key={scene.sceneNumber}
                    scene={scene}
                    onUpdate={(updates) => onUpdateScene(scene.sceneNumber, updates)}
                    compact
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {/* Bottom Spacer */}
      <div className="h-8" />
    </div>
  );
}
