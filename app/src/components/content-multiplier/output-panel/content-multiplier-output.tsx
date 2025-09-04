'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Copy, RefreshCw, Sparkles, Check } from 'lucide-react';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { HistoryOutput } from './history-output';
import { useContentMultiplierStore, useCurrentVariant } from '../store/content-multiplier-store';
import { toast } from 'sonner';

interface ContentMultiplierOutputProps {
  activeTab: string;
}

/**
 * Content Multiplier Output Panel
 * Shows platform tabs with generated content or empty state
 */
export function ContentMultiplierOutput({ activeTab }: ContentMultiplierOutputProps) {
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  
  const currentVariant = useCurrentVariant();
  const {
    selected_platforms,
    generation_progress,
    updatePlatformContent,
    regeneratePlatformContent,
  } = useContentMultiplierStore();

  // Handle history tab separately
  if (activeTab === 'history') {
    return <HistoryOutput />;
  }

  // Show empty state before generation
  if (!currentVariant || !currentVariant.platform_adaptations || currentVariant.platform_adaptations.length === 0) {
    return (
      <div className="h-full flex flex-col min-h-0">
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-border bg-muted/30">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Generated Content</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your adapted content will appear here
              </p>
            </div>
          </div>
        </div>
        
        {/* Centered Empty State */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <UnifiedEmptyState
            icon={Sparkles}
            title="Generate Content"
            description="Enter your content and select platforms to generate adapted versions"
          />
        </div>
      </div>
    );
  }

  const handleCopy = (platform: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedPlatform(platform);
    toast.success('Content copied to clipboard');
    setTimeout(() => setCopiedPlatform(null), 2000);
  };

  const handleContentEdit = (platform: string, content: string) => {
    setEditedContent(prev => ({
      ...prev,
      [platform]: content
    }));
    // Update the store with edited content
    updatePlatformContent(platform as any, content);
  };

  const handleRegenerate = async (platform: string) => {
    await regeneratePlatformContent(platform as any);
    toast.success(`Regenerated content for ${platform}`);
  };

  const getPlatformLabel = (platform: string) => {
    const labels: Record<string, string> = {
      twitter: 'Twitter',
      instagram: 'Instagram',
      tiktok: 'TikTok',
      linkedin: 'LinkedIn',
      facebook: 'Facebook',
    };
    return labels[platform] || platform;
  };

  // Filter platform adaptations to only show selected platforms
  const platformContent = currentVariant.platform_adaptations.filter(
    p => selected_platforms.includes(p.platform as any)
  );

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header with platform tabs */}
      <div className="flex-shrink-0 border-b border-border">
        <Tabs defaultValue={platformContent[0]?.platform} className="w-full">
          <div className="p-6 pb-0">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Generated Content</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Adapted for {platformContent.length} platform{platformContent.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <TabsList className="w-full justify-start">
              {platformContent.map(p => (
                <TabsTrigger key={p.platform} value={p.platform}>
                  {getPlatformLabel(p.platform)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          
          {/* Content for each platform */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hover">
            {platformContent.map(platformData => (
              <TabsContent key={platformData.platform} value={platformData.platform} className="p-6 pt-4 space-y-4 mt-0">
                {/* Content Editor Card */}
                <Card className="bg-secondary">
                  <CardContent className="p-4 space-y-4">
                    {/* Character count and status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {platformData.character_count} characters
                        </Badge>
                        {platformData.engagement_score && (
                          <Badge variant="secondary">
                            {platformData.engagement_score}% engagement score
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRegenerate(platformData.platform)}
                          disabled={generation_progress.is_generating}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(platformData.platform, platformData.content)}
                        >
                          {copiedPlatform === platformData.platform ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Editable Content */}
                    <Textarea
                      value={editedContent[platformData.platform] || platformData.content}
                      onChange={(e) => handleContentEdit(platformData.platform, e.target.value)}
                      className="min-h-[200px] text-base resize-y"
                    />
                    
                    {/* Hashtags */}
                    {platformData.hashtags && platformData.hashtags.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Hashtags</p>
                        <div className="flex flex-wrap gap-2">
                          {platformData.hashtags.map((tag, i) => (
                            <Badge key={i} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Optimization Notes */}
                    {platformData.optimization_notes && platformData.optimization_notes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Optimization Notes</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {platformData.optimization_notes.map((note, i) => (
                            <li key={i} className="flex items-start">
                              <span className="text-primary mr-2">•</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button 
                    className="flex-1"
                    onClick={() => handleCopy(platformData.platform, editedContent[platformData.platform] || platformData.content)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Content
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleRegenerate(platformData.platform)}
                    disabled={generation_progress.is_generating}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate
                  </Button>
                </div>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </div>
  );
}