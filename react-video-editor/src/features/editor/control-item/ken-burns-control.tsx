import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";
import { IImage, IVideo, ITrackItem } from "@designcombo/types";
import { Sparkles, Image as ImageIcon, Video } from "lucide-react";
import { 
  KenBurnsPreset, 
  KenBurnsConfig, 
  KEN_BURNS_PRESET_LABELS,
  DEFAULT_KEN_BURNS_CONFIG 
} from "../effects/ken-burns";

interface KenBurnsControlProps {
  selectedItems: (IImage | IVideo)[];
  onApply?: () => void;
}

export function KenBurnsControl({ selectedItems, onApply }: KenBurnsControlProps) {
  // Get current Ken Burns config from first selected item
  const currentConfig: KenBurnsConfig = selectedItems[0]?.metadata?.kenBurns || DEFAULT_KEN_BURNS_CONFIG;
  
  const handleApplyEffect = (config: KenBurnsConfig) => {
    // Apply to all selected images
    const payload: any = {};
    selectedItems.forEach((item) => {
      payload[item.id] = {
        metadata: {
          ...(item.metadata || {}),
          kenBurns: config
        }
      };
    });
    
    dispatch(EDIT_OBJECT, { payload });
    
    console.log(`✨ Applied Ken Burns effect to ${selectedItems.length} image(s):`, config);
    onApply?.();
  };
  
  const handlePresetChange = (preset: KenBurnsPreset) => {
    handleApplyEffect({
      ...currentConfig,
      preset
    });
  };
  
  const handleIntensityChange = (value: number[]) => {
    handleApplyEffect({
      ...currentConfig,
      intensity: value[0]
    });
  };
  
  const handleSmoothnessChange = (smoothness: KenBurnsConfig['smoothness']) => {
    handleApplyEffect({
      ...currentConfig,
      smoothness
    });
  };
  
  const handleRemoveEffect = () => {
    handleApplyEffect(DEFAULT_KEN_BURNS_CONFIG);
  };
  
  const isMultipleSelection = selectedItems.length > 1;
  
  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <h3 className="font-semibold text-sm">Ken Burns Effect</h3>
        </div>
        {isMultipleSelection && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {selectedItems.some(item => item.type === 'video') ? (
              <Video className="h-3 w-3" />
            ) : (
              <ImageIcon className="h-3 w-3" />
            )}
            <span>{selectedItems.length} items selected</span>
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        {/* Effect Preset */}
        <div className="space-y-2">
          <Label htmlFor="ken-burns-preset" className="text-xs">Effect Type</Label>
          <Select value={currentConfig.preset} onValueChange={handlePresetChange}>
            <SelectTrigger id="ken-burns-preset" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(KEN_BURNS_PRESET_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Intensity Slider */}
        {currentConfig.preset !== 'none' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ken-burns-intensity" className="text-xs">Intensity</Label>
                <span className="text-xs text-muted-foreground">{currentConfig.intensity}%</span>
              </div>
              <Slider
                id="ken-burns-intensity"
                value={[currentConfig.intensity]}
                onValueChange={handleIntensityChange}
                min={5}
                max={50}
                step={5}
                className="w-full"
              />
            </div>
            
            {/* Smoothness */}
            <div className="space-y-2">
              <Label htmlFor="ken-burns-smoothness" className="text-xs">Animation Style</Label>
              <Select value={currentConfig.smoothness} onValueChange={handleSmoothnessChange}>
                <SelectTrigger id="ken-burns-smoothness" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="ease-in">Ease In</SelectItem>
                  <SelectItem value="ease-out">Ease Out</SelectItem>
                  <SelectItem value="ease-in-out">Ease In-Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
      
      {/* Action Buttons */}
      {currentConfig.preset !== 'none' && (
        <div className="pt-2">
          <Button
            onClick={handleRemoveEffect}
            variant="outline"
            size="sm"
            className="w-full"
          >
            Remove Effect
          </Button>
        </div>
      )}
      
      {/* Info Text */}
      <div className="text-xs text-muted-foreground">
        {isMultipleSelection ? (
          <p>Effect will be applied to all selected images</p>
        ) : (
          <p>Add smooth zoom and pan animations to your image</p>
        )}
      </div>
    </Card>
  );
}