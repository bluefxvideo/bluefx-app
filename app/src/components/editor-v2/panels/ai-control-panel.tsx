'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Sparkles,
  RotateCcw,
  Trash2,
  Copy,
  Settings,
  Palette,
  Type,
  Volume2,
  Eye,
  Move,
  RotateCw
} from 'lucide-react';
import { useAIVideoEditorStore } from '../store/use-ai-video-editor-store';
import { useState } from 'react';

export function AIControlPanel() {
  const {
    timeline,
    composition,
    updateSequence,
    regenerateItem,
    deleteSequence,
    ai_operations
  } = useAIVideoEditorStore();
  
  const selectedItems = composition?.sequences.filter(seq => 
    timeline.selectedItemIds.includes(seq.id)
  ) || [];
  
  const selectedItem = selectedItems[0]; // For single selection
  const [regeneratePrompt, setRegeneratePrompt] = useState('');

  const handleRegenerateItem = async () => {
    if (!selectedItem) return;
    
    const prompt = regeneratePrompt.trim() || 'Regenerate with improvements';
    await regenerateItem(selectedItem.id, prompt);
    setRegeneratePrompt('');
  };

  const handlePropertyChange = (property: string, value: any) => {
    if (!selectedItem) return;
    
    updateSequence(selectedItem.id, {
      ...selectedItem,
      details: {
        ...selectedItem.details,
        [property]: value
      }
    });
  };

  const handleTransformChange = (property: string, value: number) => {
    if (!selectedItem) return;
    
    const currentTransform = selectedItem.details.transform || {
      x: 0, y: 0, scale: 1, rotation: 0
    };
    
    updateSequence(selectedItem.id, {
      ...selectedItem,
      details: {
        ...selectedItem.details,
        transform: {
          ...currentTransform,
          [property]: value
        }
      }
    });
  };

  if (selectedItems.length === 0) {
    return (
      <div className="flex w-80 flex-col bg-background">
        <div className="border-b border-border/80 p-4">
          <h2 className="text-lg font-semibold">Properties</h2>
          <p className="text-xs text-muted-foreground">
            Select an item to edit properties
          </p>
        </div>
        
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center text-muted-foreground">
            <Settings className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">No item selected</p>
            <p className="text-xs mt-1">
              Click on a timeline item to see its properties
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (selectedItems.length > 1) {
    return (
      <div className="flex w-80 flex-col bg-background">
        <div className="border-b border-border/80 p-4">
          <h2 className="text-lg font-semibold">Properties</h2>
          <p className="text-xs text-muted-foreground">
            {selectedItems.length} items selected
          </p>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <Card className="p-4">
              <div className="text-sm font-medium mb-2">Batch Actions</div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    selectedItems.forEach(item => deleteSequence(item.id));
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              </div>
            </Card>
          </div>
        </ScrollArea>
      </div>
    );
  }

  const transform = selectedItem.details.transform || {
    x: 0, y: 0, scale: 1, rotation: 0
  };

  return (
    <div className="flex w-80 flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/80 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Properties</h2>
            <p className="text-xs text-muted-foreground capitalize">
              {selectedItem.type} • Layer {selectedItem.layer}
            </p>
          </div>
          {selectedItem.ai_metadata && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              <Sparkles className="h-3 w-3 mr-1" />
              AI
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          <Tabs defaultValue="properties" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="transform">Transform</TabsTrigger>
              <TabsTrigger value="ai">AI</TabsTrigger>
            </TabsList>
            
            <TabsContent value="properties" className="space-y-4 mt-4">
              {/* Content Properties */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Type className="h-4 w-4" />
                  <Label className="text-sm font-medium">Content</Label>
                </div>
                
                {selectedItem.type === 'text' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="text-content" className="text-xs">Text</Label>
                      <Textarea
                        id="text-content"
                        value={selectedItem.details.text || ''}
                        onChange={(e) => handlePropertyChange('text', e.target.value)}
                        className="mt-1 min-h-[80px] resize-none"
                        placeholder="Enter text..."
                      />
                    </div>
                  </div>
                )}
                
                {(selectedItem.type === 'image' || selectedItem.type === 'video') && (
                  <div>
                    <Label htmlFor="src-content" className="text-xs">Source</Label>
                    <Input
                      id="src-content"
                      value={selectedItem.details.src || ''}
                      onChange={(e) => handlePropertyChange('src', e.target.value)}
                      className="mt-1"
                      placeholder="Enter URL..."
                    />
                  </div>
                )}
              </Card>
              
              {/* Timing Properties */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Settings className="h-4 w-4" />
                  <Label className="text-sm font-medium">Timing</Label>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">
                      Duration: {Math.round(selectedItem.duration / (composition?.composition.fps || 30) * 10) / 10}s
                    </Label>
                    <Slider
                      value={[selectedItem.duration]}
                      onValueChange={([value]) => 
                        updateSequence(selectedItem.id, { ...selectedItem, duration: value })
                      }
                      min={30}
                      max={600}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                </div>
              </Card>

              {/* Appearance Properties */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4" />
                  <Label className="text-sm font-medium">Appearance</Label>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">
                      Opacity: {Math.round((selectedItem.details.opacity || 1) * 100)}%
                    </Label>
                    <Slider
                      value={[selectedItem.details.opacity || 1]}
                      onValueChange={([value]) => handlePropertyChange('opacity', value)}
                      min={0}
                      max={1}
                      step={0.01}
                      className="mt-2"
                    />
                  </div>
                  
                  {selectedItem.type === 'audio' && (
                    <div>
                      <Label className="text-xs">
                        Volume: {Math.round((selectedItem.details.volume || 1) * 100)}%
                      </Label>
                      <Slider
                        value={[selectedItem.details.volume || 1]}
                        onValueChange={([value]) => handlePropertyChange('volume', value)}
                        min={0}
                        max={2}
                        step={0.01}
                        className="mt-2"
                      />
                    </div>
                  )}
                </div>
              </Card>
            </TabsContent>
            
            <TabsContent value="transform" className="space-y-4 mt-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Move className="h-4 w-4" />
                  <Label className="text-sm font-medium">Position</Label>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">X: {Math.round(transform.x)}</Label>
                    <Slider
                      value={[transform.x]}
                      onValueChange={([value]) => handleTransformChange('x', value)}
                      min={-500}
                      max={500}
                      step={1}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Y: {Math.round(transform.y)}</Label>
                    <Slider
                      value={[transform.y]}
                      onValueChange={([value]) => handleTransformChange('y', value)}
                      min={-500}
                      max={500}
                      step={1}
                      className="mt-1"
                    />
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <RotateCw className="h-4 w-4" />
                  <Label className="text-sm font-medium">Scale & Rotation</Label>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">
                      Scale: {Math.round(transform.scale * 100)}%
                    </Label>
                    <Slider
                      value={[transform.scale]}
                      onValueChange={([value]) => handleTransformChange('scale', value)}
                      min={0.1}
                      max={3}
                      step={0.01}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs">
                      Rotation: {Math.round(transform.rotation)}°
                    </Label>
                    <Slider
                      value={[transform.rotation]}
                      onValueChange={([value]) => handleTransformChange('rotation', value)}
                      min={0}
                      max={360}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            <TabsContent value="ai" className="space-y-4 mt-4">
              {selectedItem.ai_metadata ? (
                <>
                  {/* AI Metadata */}
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <Label className="text-sm font-medium">AI Metadata</Label>
                    </div>
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Regenerated:</span>
                        <span>{selectedItem.ai_metadata.regeneration_count} times</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Credits Used:</span>
                        <span>{selectedItem.ai_metadata.credits_used}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Updated:</span>
                        <span>{new Date(selectedItem.ai_metadata.last_regenerated).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </Card>
                  
                  {/* AI Regeneration */}
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <RotateCcw className="h-4 w-4 text-blue-500" />
                      <Label className="text-sm font-medium">Regenerate</Label>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="regenerate-prompt" className="text-xs">
                          Improvement Prompt (Optional)
                        </Label>
                        <Textarea
                          id="regenerate-prompt"
                          value={regeneratePrompt}
                          onChange={(e) => setRegeneratePrompt(e.target.value)}
                          className="mt-1 min-h-[60px] resize-none"
                          placeholder="Describe improvements..."
                        />
                      </div>
                      
                      <Button
                        onClick={handleRegenerateItem}
                        disabled={ai_operations.isRegenerating}
                        className="w-full"
                        variant="outline"
                      >
                        {ai_operations.isRegenerating ? (
                          <>
                            <div className="h-3 w-3 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Regenerating...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Regenerate with AI
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                </>
              ) : (
                <Card className="p-4">
                  <div className="text-center text-muted-foreground">
                    <Sparkles className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No AI metadata</p>
                    <p className="text-xs mt-1">
                      This item was not generated with AI
                    </p>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
      
      {/* Footer Actions */}
      <div className="border-t border-border/80 p-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              // Create duplicate
              const newSequence = {
                ...selectedItem,
                id: `${selectedItem.id}-copy-${Date.now()}`,
                start: selectedItem.start + selectedItem.duration
              };
              // Add to store (would need to implement this in store)
            }}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => deleteSequence(selectedItem.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}