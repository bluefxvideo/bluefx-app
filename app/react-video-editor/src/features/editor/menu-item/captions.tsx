import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Subtitles, FileText, Wand2 } from "lucide-react";
import { loadMockCaptionData, addCaptionTrackToEditor } from "../utils/caption-loader";
import { useState } from "react";

/**
 * Caption Menu Item - Add and manage captions
 */
export default function Captions() {
  const [isLoading, setIsLoading] = useState(false);
  const [captionAdded, setCaptionAdded] = useState(false);

  const handleLoadTestCaptions = async () => {
    setIsLoading(true);
    try {
      const captionTrack = await loadMockCaptionData();
      if (captionTrack) {
        addCaptionTrackToEditor(captionTrack);
        setCaptionAdded(true);
        setTimeout(() => setCaptionAdded(false), 3000);
      }
    } catch (error) {
      console.error('Failed to load captions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Subtitles className="h-5 w-5" />
        <h3 className="font-semibold">Captions</h3>
      </div>

      <Card className="p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Test Captions
            </h4>
            <p className="text-xs text-muted-foreground">
              Load sample captions with word-level timing
            </p>
            <Button
              onClick={handleLoadTestCaptions}
              disabled={isLoading}
              variant={captionAdded ? "secondary" : "default"}
              className="w-full"
            >
              {isLoading ? (
                "Loading..."
              ) : captionAdded ? (
                "✓ Captions Added"
              ) : (
                "Load Test Captions"
              )}
            </Button>
          </div>

          <div className="border-t pt-4 space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Import Captions
            </h4>
            <p className="text-xs text-muted-foreground">
              Import SRT or VTT files (Coming soon)
            </p>
            <Button variant="outline" className="w-full" disabled>
              Import File
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Captions sync with timeline</p>
            <p>• Word-level highlighting</p>
            <p>• Customizable styles</p>
          </div>
        </div>
      </Card>
    </div>
  );
}