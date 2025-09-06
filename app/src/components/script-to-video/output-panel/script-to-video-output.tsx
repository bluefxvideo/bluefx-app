'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Download, 
  Share2, 
  Clock, 
  Layers, 
  Film, 
  Sparkles,
  Zap,
  CheckCircle,
  AlertCircle,
  Edit3
} from 'lucide-react';
import { TabEmptyStates } from './tab-empty-states';
import { LoadingSkeleton } from './loading-skeleton';
import type { ScriptToVideoResponse } from '@/actions/tools/script-to-video-orchestrator';

interface ScriptToVideoOutputProps {
  result?: ScriptToVideoResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
  activeTab: string;
}

export function ScriptToVideoOutput({
  result,
  isGenerating,
  error,
  onClearResults,
  activeTab
}: ScriptToVideoOutputProps) {
  // Loading state
  if (isGenerating) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="p-6 max-w-md text-center border-red-200 bg-red-50/50">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-medium text-red-900 mb-2">Generation Failed</h3>
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <Button onClick={onClearResults} variant="outline">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  // Empty state
  if (!result) {
    return <TabEmptyStates activeTab={activeTab} />;
  }

  // Success state - show generated video
  return (
    <div className="space-y-6">
      {/* Success Header */}
      <Card className="border-blue-200 ">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-blue-600" />
            <div>
              <h3 className="font-medium text-blue-600">Video Generated Successfully!</h3>
              <p className="text-sm text-blue-600">
                {result.segments?.length || 0} segments • {result.timeline_data?.total_duration || 0}s duration
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Player */}
      <Card>
        <CardContent className="pt-6">
          <div className="aspect-[9/16] bg-black rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
            {result.video_url ? (
              <video
                src={result.video_url}
                controls
                className="w-full h-full object-cover rounded-lg"
                poster={result.generated_images?.[0]?.url}
              />
            ) : (
              <div className="text-white text-center">
                <Film className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm opacity-75">Video Preview</p>
              </div>
            )}
          </div>

          {/* Video Actions */}
          <div className="flex items-center gap-2">
            <Button className="flex-1">
              <Play className="w-4 h-4 mr-2" />
              Play
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                // Redirect to React Video Editor with auto-load
                const editorUrl = `${process.env.NEXT_PUBLIC_REACT_VIDEO_EDITOR_URL || 'http://localhost:3002'}/?loadAI=${result.video_id}`;
                window.open(editorUrl, '_blank');
              }}
              title="Edit in Video Editor"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline"
              onClick={async () => {
                if (!result.video_url) return;
                
                try {
                  // Fetch the video blob
                  const response = await fetch(result.video_url);
                  
                  if (!response.ok) {
                    throw new Error(`Failed to fetch video: ${response.status}`);
                  }
                  
                  const blob = await response.blob();
                  
                  // Create blob URL and download
                  const blobUrl = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = blobUrl;
                  a.download = `script-video-${result.video_id || Date.now()}.mp4`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  
                  // Clean up blob URL
                  URL.revokeObjectURL(blobUrl);
                } catch (error) {
                  console.error('Download failed:', error);
                  // Fallback to opening in new tab
                  window.open(result.video_url, '_blank');
                }
              }}
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="outline">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generation Details */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h4 className="font-medium">Generation Details</h4>
          
          {/* Production Plan */}
          {result.production_plan && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Workflow Type:</span>
                <Badge variant="secondary" className="capitalize">
                  {result.production_plan.workflow_type}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Complexity:</span>
                <Badge variant={result.production_plan.complexity_score > 7 ? 'destructive' : 'default'}>
                  {result.production_plan.complexity_score}/10
                </Badge>
              </div>
            </div>
          )}

          {/* Timeline Data */}
          {result.timeline_data && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm font-medium">{result.timeline_data.total_duration}s</p>
                <p className="text-xs text-muted-foreground">Duration</p>
              </div>
              <div>
                <Layers className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm font-medium">{result.timeline_data.segment_count}</p>
                <p className="text-xs text-muted-foreground">Segments</p>
              </div>
              <div>
                <Film className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm font-medium">{result.timeline_data.frame_count}</p>
                <p className="text-xs text-muted-foreground">Frames</p>
              </div>
            </div>
          )}

          {/* AI Optimizations */}
          {result.optimization_applied && result.optimization_applied.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">AI Optimizations Applied</span>
              </div>
              <div className="space-y-1">
                {result.optimization_applied.map((optimization: string, index: number) => (
                  <div key={index} className="text-xs text-muted-foreground flex items-center gap-2">
                    <Zap className="w-3 h-3 text-blue-500" />
                    {optimization}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Credits Used */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">Credits Used:</span>
            <Badge variant="outline">{result.credits_used} credits</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Clear Results */}
      <Button
        variant="outline"
        onClick={onClearResults}
        className="w-full"
      >
        Generate New Video
      </Button>
    </div>
  );
}