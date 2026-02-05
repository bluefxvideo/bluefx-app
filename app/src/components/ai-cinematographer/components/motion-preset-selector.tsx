'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MOTION_PRESETS, getMotionPresetLabel, getMotionPresetById } from '@/lib/scene-breakdown/motion-presets';

interface MotionPresetSelectorProps {
  value: number | null;
  onChange: (presetId: number, prompt: string) => void;
  disabled?: boolean;
  className?: string;
}

export function MotionPresetSelector({
  value,
  onChange,
  disabled = false,
  className,
}: MotionPresetSelectorProps) {
  const selectedPreset = value ? getMotionPresetById(value) : undefined;

  const handleChange = (val: string) => {
    const presetId = parseInt(val, 10);
    const preset = getMotionPresetById(presetId);
    if (preset) {
      // For "Custom" preset (id 15), don't overwrite the existing prompt
      onChange(presetId, preset.prompt);
    }
  };

  return (
    <Select
      value={value?.toString() || ''}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select motion...">
          {selectedPreset ? getMotionPresetLabel(selectedPreset) : 'Select motion...'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {MOTION_PRESETS.map((preset) => (
          <SelectItem key={preset.id} value={preset.id.toString()}>
            <div className="flex flex-col">
              <span className="font-medium">{getMotionPresetLabel(preset)}</span>
              {preset.prompt && (
                <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                  {preset.prompt}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
