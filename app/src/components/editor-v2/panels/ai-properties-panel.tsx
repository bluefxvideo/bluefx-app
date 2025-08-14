'use client';

import { useEffect, useState } from 'react';
import { ITrackItem, IText, IImage, IVideo, IAudio } from '@designcombo/types';
import { useAIVideoEditorStore } from '../store/use-ai-video-editor-store';
import { LassoSelect } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Trash2, Copy, Scissors } from 'lucide-react';

interface AIPropertiesPanelProps {
  selectedTrackItem?: ITrackItem | null;
  onUpdateItem?: (updates: Partial<ITrackItem>) => void;
  onDeleteItem?: (itemId: string) => void;
  onCloneItem?: (itemId: string) => void;
  onSplitItem?: (itemId: string) => void;
}

// Text Properties Component
const TextProperties = ({ 
  trackItem, 
  onUpdate 
}: { 
  trackItem: ITrackItem & IText; 
  onUpdate: (updates: Partial<ITrackItem>) => void;
}) => {
  const details = trackItem.details;
  
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="text">Text</Label>
        <Input
          id="text"
          value={details.text || ''}
          onChange={(e) => onUpdate({
            details: { ...details, text: e.target.value }
          })}
        />
      </div>
      
      <div>
        <Label htmlFor="fontSize">Font Size</Label>
        <div className="flex items-center space-x-2">
          <Slider
            value={[details.fontSize || 48]}
            onValueChange={([value]) => onUpdate({
              details: { ...details, fontSize: value }
            })}
            max={200}
            min={8}
            step={1}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground w-12">
            {details.fontSize || 48}
          </span>
        </div>
      </div>
      
      <div>
        <Label htmlFor="color">Color</Label>
        <Input
          id="color"
          type="color"
          value={details.color || '#ffffff'}
          onChange={(e) => onUpdate({
            details: { ...details, color: e.target.value }
          })}
          className="w-full h-10"
        />
      </div>
      
      <div>
        <Label htmlFor="opacity">Opacity</Label>
        <div className="flex items-center space-x-2">
          <Slider
            value={[(details.opacity || 1) * 100]}
            onValueChange={([value]) => onUpdate({
              details: { ...details, opacity: value / 100 }
            })}
            max={100}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground w-12">
            {Math.round((details.opacity || 1) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

// Image Properties Component  
const ImageProperties = ({ 
  trackItem, 
  onUpdate 
}: { 
  trackItem: ITrackItem & IImage; 
  onUpdate: (updates: Partial<ITrackItem>) => void;
}) => {
  const details = trackItem.details;
  
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="src">Image Source</Label>
        <Input
          id="src"
          value={details.src || ''}
          onChange={(e) => onUpdate({
            details: { ...details, src: e.target.value }
          })}
          placeholder="Enter image URL"
        />
      </div>
      
      <div>
        <Label htmlFor="opacity">Opacity</Label>
        <div className="flex items-center space-x-2">
          <Slider
            value={[(details.opacity || 1) * 100]}
            onValueChange={([value]) => onUpdate({
              details: { ...details, opacity: value / 100 }
            })}
            max={100}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground w-12">
            {Math.round((details.opacity || 1) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

// Video Properties Component
const VideoProperties = ({ 
  trackItem, 
  onUpdate 
}: { 
  trackItem: ITrackItem & IVideo; 
  onUpdate: (updates: Partial<ITrackItem>) => void;
}) => {
  const details = trackItem.details;
  
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="src">Video Source</Label>
        <Input
          id="src"
          value={details.src || ''}
          onChange={(e) => onUpdate({
            details: { ...details, src: e.target.value }
          })}
          placeholder="Enter video URL"
        />
      </div>
      
      <div>
        <Label htmlFor="volume">Volume</Label>
        <div className="flex items-center space-x-2">
          <Slider
            value={[(details.volume || 1) * 100]}
            onValueChange={([value]) => onUpdate({
              details: { ...details, volume: value / 100 }
            })}
            max={100}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground w-12">
            {Math.round((details.volume || 1) * 100)}%
          </span>
        </div>
      </div>
      
      <div>
        <Label htmlFor="opacity">Opacity</Label>
        <div className="flex items-center space-x-2">
          <Slider
            value={[(details.opacity || 1) * 100]}
            onValueChange={([value]) => onUpdate({
              details: { ...details, opacity: value / 100 }
            })}
            max={100}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground w-12">
            {Math.round((details.opacity || 1) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

// Audio Properties Component
const AudioProperties = ({ 
  trackItem, 
  onUpdate 
}: { 
  trackItem: ITrackItem & IAudio; 
  onUpdate: (updates: Partial<ITrackItem>) => void;
}) => {
  const details = trackItem.details;
  
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="src">Audio Source</Label>
        <Input
          id="src"
          value={details.src || ''}
          onChange={(e) => onUpdate({
            details: { ...details, src: e.target.value }
          })}
          placeholder="Enter audio URL"
        />
      </div>
      
      <div>
        <Label htmlFor="volume">Volume</Label>
        <div className="flex items-center space-x-2">
          <Slider
            value={[(details.volume || 1) * 100]}
            onValueChange={([value]) => onUpdate({
              details: { ...details, volume: value / 100 }
            })}
            max={100}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground w-12">
            {Math.round((details.volume || 1) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export function AIPropertiesPanel({ 
  selectedTrackItem, 
  onUpdateItem, 
  onDeleteItem, 
  onCloneItem, 
  onSplitItem 
}: AIPropertiesPanelProps) {
  if (!selectedTrackItem) {
    return (
      <div className="w-[320px] border-l border-border/80 bg-muted/30 flex-none">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground h-full py-32">
          <LassoSelect size={48} className="text-muted-foreground/50" />
          <div className="text-center">
            <p className="font-medium">No item selected</p>
            <p className="text-sm text-muted-foreground/70">
              Click on a timeline item to see its properties
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleUpdate = (updates: Partial<ITrackItem>) => {
    if (onUpdateItem) {
      onUpdateItem(updates);
    }
  };

  const renderPropertiesForType = () => {
    switch (selectedTrackItem.type) {
      case 'text':
        return <TextProperties trackItem={selectedTrackItem as ITrackItem & IText} onUpdate={handleUpdate} />;
      case 'image':  
        return <ImageProperties trackItem={selectedTrackItem as ITrackItem & IImage} onUpdate={handleUpdate} />;
      case 'video':
        return <VideoProperties trackItem={selectedTrackItem as ITrackItem & IVideo} onUpdate={handleUpdate} />;
      case 'audio':
        return <AudioProperties trackItem={selectedTrackItem as ITrackItem & IAudio} onUpdate={handleUpdate} />;
      default:
        return <div className="text-sm text-muted-foreground">Properties not available for this item type.</div>;
    }
  };

  return (
    <div className="w-[320px] border-l border-border/80 bg-background flex-none flex flex-col">
      <div className="border-b border-border/80 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Properties</h3>
            <p className="text-sm text-muted-foreground capitalize">
              {selectedTrackItem.type} • {selectedTrackItem.name}
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {renderPropertiesForType()}
        </div>
        
        {/* Timeline Controls */}
        <div className="border-t border-border/80 p-4">
          <div className="space-y-2">
            <Label>Timeline Actions</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSplitItem?.(selectedTrackItem.id)}
                className="flex-1"
              >
                <Scissors className="w-4 h-4 mr-2" />
                Split
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCloneItem?.(selectedTrackItem.id)}
                className="flex-1"
              >
                <Copy className="w-4 h-4 mr-2" />
                Clone
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDeleteItem?.(selectedTrackItem.id)}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}