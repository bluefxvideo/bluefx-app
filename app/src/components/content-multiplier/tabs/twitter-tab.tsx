'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  RefreshCw, 
  Send, 
  Calendar, 
  Hash,
  ArrowLeft,
} from 'lucide-react';
import { useContentMultiplierStore, usePlatformConnections } from '../store/content-multiplier-store';

/**
 * Twitter Tab Component
 * Shows Twitter/X specific content preview and editing
 */
export function TwitterTab() {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  const {
    current_variant,
    generation_progress,
    regeneratePlatformContent,
    updatePlatformContent,
    publishNow,
    setActiveTab,
  } = useContentMultiplierStore();

  const connections = usePlatformConnections();

  const twitterContent = current_variant?.platform_adaptations.find(p => p.platform === 'twitter');
  const isConnected = connections.twitter?.connected || false;

  const handleEdit = () => {
    setEditedContent(twitterContent?.content || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editedContent.trim()) {
      updatePlatformContent('twitter', editedContent.trim());
    }
    setIsEditing(false);
  };

  const handleRegenerate = async () => {
    await regeneratePlatformContent('twitter');
  };

  const handlePublish = async () => {
    await publishNow('twitter');
  };

  if (!current_variant) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">No Content Generated</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate content first to see Twitter optimization.
            </p>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('input')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Input
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!twitterContent) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">Twitter Not Selected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Twitter was not selected for content generation.
            </p>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('input')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Input
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hover p-4 space-y-6">
      {/* Connection Status */}
      <Card >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-sky-500" />
            Twitter/X
          </CardTitle>
          <CardDescription>
            {isConnected 
              ? `Connected as @${connections.twitter?.username}`
              : 'Not connected to Twitter'
            }
          </CardDescription>
        </CardHeader>
        {!isConnected && (
          <CardContent>
            <Button variant="outline" className="w-full">
              <MessageSquare className="mr-2 h-4 w-4" />
              Connect Twitter Account
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Content Preview */}
      <Card >
        <CardHeader>
          <CardTitle className="text-lg">Content Preview</CardTitle>
          <CardDescription>
            How your content will appear on Twitter/X
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Twitter Post Mockup */}
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold">You</span>
                  <span className="text-muted-foreground">@{connections.twitter?.username || 'username'}</span>
                  <span className="text-muted-foreground text-sm">• now</span>
                </div>
                
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="text-sm resize-none"
                      rows={3}
                    />
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${
                        editedContent.length > 280 ? 'text-red-500' : 'text-muted-foreground'
                      }`}>
                        {editedContent.length}/280
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave}>
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm leading-relaxed mb-3">
                      {twitterContent.content}
                    </p>
                    
                    {/* Hashtags */}
                    {twitterContent.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {twitterContent.hashtags.map((hashtag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            <Hash className="h-2 w-2 mr-1" />
                            {hashtag.replace('#', '')}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Thread Indicator */}
                    {twitterContent.thread_parts && twitterContent.thread_parts.length > 1 && (
                      <div className="text-xs text-sky-500 mb-2">
                        🧵 Thread: {twitterContent.thread_parts.length} tweets
                      </div>
                    )}

                    {/* Character Count */}
                    <div className="text-xs text-muted-foreground">
                      {twitterContent.character_count} characters
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Thread Preview */}
          {twitterContent.thread_parts && twitterContent.thread_parts.length > 1 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Thread Preview:</h4>
              {twitterContent.thread_parts.map((part, index) => (
                <div key={index} className="border rounded p-3 text-sm bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">
                    Tweet {index + 1}/{twitterContent.thread_parts!.length}
                  </div>
                  <p>{part}</p>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              disabled={isEditing || generation_progress.is_generating}
            >
              Edit Content
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={generation_progress.is_generating}
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Regenerate
            </Button>

            {isConnected && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isConnected}
                >
                  <Calendar className="mr-2 h-3 w-3" />
                  Schedule
                </Button>
                
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={!isConnected || generation_progress.is_generating}
                  className="bg-sky-500 hover:bg-sky-600"
                >
                  <Send className="mr-2 h-3 w-3" />
                  Post Now
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Platform Insights */}
      <Card >
        <CardHeader>
          <CardTitle className="text-lg">Twitter Optimization</CardTitle>
          <CardDescription>
            Platform-specific insights and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-100 rounded-full mt-1.5" />
            <div className="text-sm">
              <span className="font-medium">Character Limit:</span> Within 280 character limit
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-100 rounded-full mt-1.5" />
            <div className="text-sm">
              <span className="font-medium">Hashtags:</span> {twitterContent.hashtags.length} trending hashtags added
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 " />
            <div className="text-sm">
              <span className="font-medium">Engagement:</span> Optimized for Twitter&apos;s algorithm
            </div>
          </div>

          {twitterContent.thread_parts && (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-100 rounded-full mt-1.5" />
              <div className="text-sm">
                <span className="font-medium">Threading:</span> Long content split into {twitterContent.thread_parts.length} connected tweets
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}