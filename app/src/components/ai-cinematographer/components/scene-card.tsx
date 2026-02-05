'use client';

import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MotionPresetSelector } from './motion-preset-selector';
import type { BreakdownScene } from '@/lib/scene-breakdown/types';
import { Clock, MessageSquare, Image, Video } from 'lucide-react';

interface SceneCardProps {
  scene: BreakdownScene;
  onUpdate: (updates: Partial<BreakdownScene>) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function SceneCard({
  scene,
  onUpdate,
  disabled = false,
  compact = false,
}: SceneCardProps) {
  const handleMotionPresetChange = (presetId: number, prompt: string) => {
    // Only update the prompt if a non-custom preset is selected
    if (presetId !== 15) {
      onUpdate({ motionPresetId: presetId, motionPrompt: prompt });
    } else {
      // For custom, just update the preset ID, keep existing prompt
      onUpdate({ motionPresetId: presetId });
    }
  };

  return (
    <Card className={`p-4 space-y-3 ${compact ? 'p-3' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            #{scene.sceneNumber}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{scene.duration}</span>
          </div>
        </div>
      </div>

      {/* Narration (readonly) */}
      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          Narration
        </Label>
        <div className="p-2 rounded-md bg-muted/50 text-sm">
          {scene.narration || <span className="text-muted-foreground italic">No narration</span>}
        </div>
      </div>

      {/* Visual Prompt (editable) */}
      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1">
          <Image className="w-3 h-3" />
          Visual Prompt
        </Label>
        <Textarea
          value={scene.visualPrompt}
          onChange={(e) => onUpdate({ visualPrompt: e.target.value })}
          placeholder="Describe what the viewer sees..."
          className="min-h-[80px] resize-y text-sm"
          disabled={disabled}
        />
      </div>

      {/* Motion/Camera Prompt (editable) */}
      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1">
          <Video className="w-3 h-3" />
          Motion / Camera
        </Label>
        <div className="flex gap-2">
          <MotionPresetSelector
            value={scene.motionPresetId}
            onChange={handleMotionPresetChange}
            disabled={disabled}
            className="w-[180px]"
          />
        </div>
        <Textarea
          value={scene.motionPrompt}
          onChange={(e) => onUpdate({ motionPrompt: e.target.value, motionPresetId: 15 })}
          placeholder="Camera movement or action..."
          className="min-h-[60px] resize-y text-sm"
          disabled={disabled}
        />
      </div>
    </Card>
  );
}
