'use client';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { 
  Type, 
  Image as ImageIcon, 
  Music, 
  Video,
  Sparkles,
  Plus,
  Upload,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAIVideoEditorStore } from '../store/use-ai-video-editor-store';
import { useState } from 'react';

export function AIAssetPanel() {
  const { 
    ui,
    setActivePanel,
    generateNewItem,
    loadMockCaptionData,
    ai_operations 
  } = useAIVideoEditorStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleGenerateItem = async (type: 'text' | 'image' | 'audio' | 'video', prompt?: string) => {
    const position = 0; // Start at beginning for now
    await generateNewItem(type, prompt || `Generate ${type}`, position);
  };
  
  return (
    <div className="flex w-80 flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/80 p-4">
        <h2 className="text-lg font-semibold">AI Assets</h2>
        <p className="text-xs text-muted-foreground">
          Generate and manage your content
        </p>
      </div>
      
      {/* Search */}
      <div className="border-b border-border/80 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      
      {/* Asset Tabs */}
      <div className="flex-1">
        <Tabs 
          value={ui.activePanel} 
          onValueChange={(value) => setActivePanel(value as any)}
          className="h-full"
        >
          <TabsList className="grid w-full grid-cols-4 rounded-none border-b border-border/80">
            <TabsTrigger value="text" className="rounded-none">
              <Type className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="images" className="rounded-none">
              <ImageIcon className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="audio" className="rounded-none">
              <Music className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="effects" className="rounded-none">
              <Video className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="text" className="m-0 h-full">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* AI Text Generation */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    <h3 className="font-medium">AI Text</h3>
                  </div>
                  <Button
                    onClick={() => handleGenerateItem('text', 'Generate engaging text')}
                    disabled={ai_operations.isGenerating}
                    className="w-full"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Text
                  </Button>
                </Card>
                
                {/* Text Presets */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Text Presets</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { label: 'Heading', style: 'text-2xl font-bold' },
                      { label: 'Subtitle', style: 'text-lg font-medium' },
                      { label: 'Body Text', style: 'text-base' },
                      { label: 'Caption', style: 'text-sm text-muted-foreground' }
                    ].map((preset) => (
                      <Button
                        key={preset.label}
                        variant="ghost"
                        className="h-12 justify-start"
                        onClick={() => handleGenerateItem('text', `Generate ${preset.label.toLowerCase()}`)}
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-xs text-muted-foreground">{preset.label}</span>
                          <span className={preset.style}>Sample Text</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="images" className="m-0 h-full">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* AI Image Generation */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <h3 className="font-medium">AI Images</h3>
                  </div>
                  <Button
                    onClick={() => handleGenerateItem('image', 'Generate stunning image')}
                    disabled={ai_operations.isGenerating}
                    className="w-full mb-2"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Image
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    disabled
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </Button>
                </Card>
                
                {/* Image Categories */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Categories</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Landscapes',
                      'Portraits',
                      'Abstract',
                      'Technology',
                      'Business',
                      'Nature'
                    ].map((category) => (
                      <Button
                        key={category}
                        variant="outline"
                        size="sm"
                        className="h-20 flex-col"
                        onClick={() => handleGenerateItem('image', `Generate ${category.toLowerCase()} image`)}
                      >
                        <ImageIcon className="h-6 w-6 mb-1" />
                        <span className="text-xs">{category}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="audio" className="m-0 h-full">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* AI Audio Generation */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-green-500" />
                    <h3 className="font-medium">AI Audio</h3>
                  </div>
                  <Button
                    onClick={() => handleGenerateItem('audio', 'Generate background music')}
                    disabled={ai_operations.isGenerating}
                    className="w-full mb-2"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Music
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    disabled
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Audio
                  </Button>
                </Card>
                
                {/* Audio Categories */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Music Styles</h3>
                  <div className="space-y-1">
                    {[
                      'Cinematic',
                      'Upbeat',
                      'Ambient',
                      'Electronic',
                      'Acoustic',
                      'Corporate'
                    ].map((style) => (
                      <Button
                        key={style}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleGenerateItem('audio', `Generate ${style.toLowerCase()} music`)}
                      >
                        <Music className="h-4 w-4 mr-2" />
                        {style}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="effects" className="m-0 h-full">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Video className="h-4 w-4 text-orange-500" />
                    <h3 className="font-medium">Effects & Transitions</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Coming soon...
                  </p>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Development: Mock Data Loader */}
      {process.env.NODE_ENV === 'development' && (
        <div className="border-t border-border/80 p-4">
          <div className="text-xs text-muted-foreground mb-2">Development Only</div>
          <Button
            onClick={loadMockCaptionData}
            variant="outline"
            size="sm"
            className="w-full text-xs"
          >
            Load Mock Captions
          </Button>
        </div>
      )}
    </div>
  );
}