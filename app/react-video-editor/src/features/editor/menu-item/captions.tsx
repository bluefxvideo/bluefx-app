import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Subtitles, FileText, Wand2, Play, Edit, Clock } from "lucide-react";
import { loadMockCaptionData, addCaptionTrackToEditor } from "../utils/caption-loader";
import { useState, useMemo } from "react";
import useStore from "../store/use-store";

// Caption segment management component
function CaptionSegmentManager({ captionTracks }: { captionTracks: any[] }) {
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  
  // Get all segments from all caption tracks
  const allSegments = useMemo(() => {
    const segments: any[] = [];
    captionTracks.forEach(track => {
      const trackSegments = (track.details as any)?.captionSegments || [];
      trackSegments.forEach((segment: any, index: number) => {
        segments.push({
          ...segment,
          trackId: track.id,
          segmentIndex: index
        });
      });
    });
    return segments.sort((a, b) => a.start - b.start);
  }, [captionTracks]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const remainingMs = ms % 1000;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${Math.floor(remainingMs / 100)}`;
  };

  const handleEditClick = (index: number, text: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setEditingSegmentIndex(index);
    setEditText(text);
  };

  const handleSave = () => {
    // TODO: Update the segment text in the store
    console.log('Saving text:', editText);
    setEditingSegmentIndex(null);
    setEditText("");
  };

  const handleCancel = () => {
    setEditingSegmentIndex(null);
    setEditText("");
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Edit className="h-4 w-4" />
          Segments ({allSegments.length})
        </h4>
        <Button size="sm" variant="outline" className="text-xs">
          Add Segment
        </Button>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto">
        {allSegments.map((segment, index) => (
          <Card 
            key={`${segment.trackId}-${segment.segmentIndex}`}
            className={`p-2 transition-colors ${
              editingSegmentIndex === index ? 'bg-accent' : 'hover:bg-accent/50'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Clock className="h-3 w-3 flex-shrink-0" />
                    <span className="text-xs">{formatTime(segment.start)} - {formatTime(segment.end)}</span>
                  </div>
                  
                  {editingSegmentIndex === index ? (
                    // Editing mode - replace text with textarea
                    <div className="space-y-2">
                      <textarea 
                        className="w-full text-sm p-1 border rounded resize-none leading-tight"
                        rows={2}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        placeholder="Edit segment text..."
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={handleSave}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={handleCancel}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode - clickable text
                    <p 
                      className="text-sm break-words leading-tight cursor-text hover:bg-accent/30 rounded p-1 -m-1" 
                      onClick={(e) => handleEditClick(index, segment.text, e)}
                    >
                      {segment.text}
                    </p>
                  )}
                </div>
                
                {editingSegmentIndex !== index && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 flex-shrink-0 ml-1">
                    <Play className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Caption Menu Item - Add and manage captions
 */
export default function Captions() {
  const [isLoading, setIsLoading] = useState(false);
  const [captionAdded, setCaptionAdded] = useState(false);
  const { trackItemsMap } = useStore();

  // Check if caption tracks exist
  const captionTracks = useMemo(() => {
    return Object.values(trackItemsMap).filter(item => 
      item.type === "text" && (item.details as any)?.isCaptionTrack
    );
  }, [trackItemsMap]);

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

  // Show different content based on whether captions exist
  if (captionTracks.length > 0) {
    // Caption management mode
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Subtitles className="h-5 w-5" />
          <h3 className="font-semibold">Captions</h3>
        </div>

        <CaptionSegmentManager captionTracks={captionTracks} />

        <div className="border-t pt-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
            onClick={handleLoadTestCaptions}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Load More Test Data"}
          </Button>
        </div>
      </div>
    );
  }

  // Caption loading mode (no captions exist)
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