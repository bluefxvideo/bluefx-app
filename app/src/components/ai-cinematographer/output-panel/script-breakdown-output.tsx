'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Palette, ChevronDown, ChevronUp, FileText, Layers } from 'lucide-react';
import { SceneCard } from '../components/scene-card';
import type { BreakdownScene, SceneBreakdownResult } from '@/lib/scene-breakdown/types';
import { groupScenesIntoBatches, scenesToAnalyzerShots } from '@/lib/scene-breakdown/types';

interface ScriptBreakdownOutputProps {
  isProcessing: boolean;
  result: SceneBreakdownResult | null;
  onUpdateScene: (sceneNumber: number, updates: Partial<BreakdownScene>) => void;
  onUpdateGlobalAesthetic: (prompt: string) => void;
}

export function ScriptBreakdownOutput({
  isProcessing,
  result,
  onUpdateScene,
  onUpdateGlobalAesthetic,
}: ScriptBreakdownOutputProps) {
  const router = useRouter();
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set([0])); // First batch expanded by default

  // Group scenes into batches of 9
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

Create a 3x3 cinematic storyboard grid (3 columns, 3 rows = 9 frames).
CRITICAL: NO gaps, NO borders, NO black bars between frames. All frames must touch edge-to-edge.

${batch.map((s, i) =>
  `Frame ${i + 1}: ${s.visualPrompt}`
).join('\n\n')}

Maintain visual consistency across all frames.`;

    localStorage.setItem(promptId, combinedPrompt);

    // Convert to analyzerShots format for motion pre-fill
    const shots = scenesToAnalyzerShots(batch);
    localStorage.setItem(`${promptId}-shots`, JSON.stringify(shots));

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
      {/* Summary */}
      <Card className="p-4">
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
      </Card>

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
        const startScene = batchIndex * 9 + 1;
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
