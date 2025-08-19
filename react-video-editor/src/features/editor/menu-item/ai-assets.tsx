import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wand2, Sparkles, Upload, Loader2, CheckCircle, AlertCircle, AlignCenter } from "lucide-react";
import { useState } from "react";
import { loadAIGeneratedAssets, loadTestAIAssets, clearEditorForAIAssets } from "../utils/ai-asset-loader";
import { fixAllAIAssetPositioning } from "../utils/ai-positioning-fix";
import useStore from "../store/use-store";

/**
 * AI Assets Menu Item - Load AI-generated content into the editor
 */
export default function AIAssets() {
  const { trackItemsMap } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [videoId, setVideoId] = useState<string>("");
  const [lastLoadedVideoId, setLastLoadedVideoId] = useState<string>("");
  const [loadResult, setLoadResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [isFixingPositions, setIsFixingPositions] = useState(false);

  const handleLoadAIAssets = async () => {
    if (!videoId.trim()) {
      setLoadResult({ success: false, error: "Please enter a video ID" });
      return;
    }

    setIsLoading(true);
    setLoadResult(null);
    setLoadingProgress(0);
    setLoadingStage("Starting...");

    try {
      const result = await loadAIGeneratedAssets({
        video_id: videoId.trim(),
        onProgress: (stage, progress) => {
          setLoadingStage(stage);
          setLoadingProgress(progress);
        },
        onSuccess: (id) => {
          setLastLoadedVideoId(id);
          setLoadResult({ success: true });
        },
        onError: (error) => {
          setLoadResult({ success: false, error });
        }
      });

      if (!result.success) {
        setLoadResult({ success: false, error: result.error });
      }
    } catch (error) {
      setLoadResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
      setLoadingStage("");
      setLoadingProgress(0);
    }
  };

  const handleLoadTestAssets = async () => {
    setIsLoading(true);
    setLoadResult(null);
    setLoadingProgress(0);
    setLoadingStage("Loading test data...");

    try {
      const result = await loadTestAIAssets();
      if (result.success) {
        setLastLoadedVideoId("test-ai-video-123");
        setLoadResult({ success: true });
        setLoadingProgress(100);
      } else {
        setLoadResult({ success: false, error: result.error });
      }
    } catch (error) {
      setLoadResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
      setLoadingStage("");
      setLoadingProgress(0);
    }
  };

  const handleClearEditor = () => {
    clearEditorForAIAssets();
    setLoadResult(null);
    setLastLoadedVideoId("");
  };

  const handleFixPositioning = async () => {
    setIsFixingPositions(true);
    try {
      console.log('🔧 Manual positioning fix requested');
      fixAllAIAssetPositioning(trackItemsMap);
      
      // Show success feedback briefly
      setTimeout(() => {
        setIsFixingPositions(false);
      }, 1000);
    } catch (error) {
      console.error('❌ Failed to fix positioning:', error);
      setIsFixingPositions(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-5 w-5 text-purple-500" />
        <h3 className="font-semibold">AI Assets</h3>
      </div>

      {/* Load by Video ID */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Load AI Video
            </h4>
            <p className="text-xs text-muted-foreground">
              Enter the video ID from your Script-to-Video generation
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="video-id" className="text-xs">Video ID</Label>
              <Input
                id="video-id"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                placeholder="Enter video ID (e.g., 123e4567-e89b-12d3-a456-426614174000)"
                disabled={isLoading}
                className="text-sm"
              />
            </div>
            
            <Button
              onClick={handleLoadAIAssets}
              disabled={isLoading || !videoId.trim()}
              className="w-full"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loadingStage}
                </div>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Load AI Assets
                </>
              )}
            </Button>

            {/* Loading Progress */}
            {isLoading && loadingProgress > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{loadingStage}</span>
                  <span>{loadingProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Load Result */}
            {loadResult && (
              <div className={`flex items-center gap-2 p-2 rounded text-xs ${
                loadResult.success 
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {loadResult.success ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    AI assets loaded successfully!
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    {loadResult.error}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Test/Demo Section */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Test AI Assets
            </h4>
            <p className="text-xs text-muted-foreground">
              Load sample AI-generated content for testing
            </p>
            
            <Button
              onClick={handleLoadTestAssets}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Load Test AI Assets
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Editor Management */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Editor Management</h4>
            <p className="text-xs text-muted-foreground">
              Clear the editor or manage current content
            </p>
            
            {lastLoadedVideoId && (
              <div className="text-xs text-muted-foreground mb-2">
                Current: {lastLoadedVideoId}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={handleFixPositioning}
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isFixingPositions}
              >
                {isFixingPositions ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Fixed!
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <AlignCenter className="h-3 w-3" />
                    Fix Positions
                  </div>
                )}
              </Button>
              
              <Button
                onClick={handleClearEditor}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Clear Editor
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground space-y-1 border-t pt-4">
        <p><strong>Usage:</strong></p>
        <p>• Generate content with Script-to-Video tool</p>
        <p>• Copy the video ID from the generation result</p>
        <p>• Paste it here and click "Load AI Assets"</p>
        <p>• Edit and export your video!</p>
      </div>

      {/* URL Parameter Info */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded space-y-1">
        <p><strong>Pro Tip:</strong></p>
        <p>You can also use URL parameters:</p>
        <p className="font-mono bg-background px-2 py-1 rounded">
          ?loadAI=VIDEO_ID
        </p>
        <p className="font-mono bg-background px-2 py-1 rounded">
          ?mock=true
        </p>
      </div>
    </div>
  );
}