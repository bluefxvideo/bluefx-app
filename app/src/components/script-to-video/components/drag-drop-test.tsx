'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVideoEditorStore } from "../store/video-editor-store";
import { GripVertical, Plus, RotateCcw } from "lucide-react";

/**
 * Test component to verify drag and drop functionality
 */
export function DragDropTest() {
  const { 
    segments, 
    addEmptySegment, 
    reorderSegments,
    timeline,
    showToast 
  } = useVideoEditorStore();

  const testAddEmptySegment = () => {
    const newId = addEmptySegment();
    showToast(`Added empty segment ${newId} at position 0`, 'success');
  };

  const testReorderSegments = () => {
    if (segments.length < 2) {
      showToast('Need at least 2 segments to test reordering', 'warning');
      return;
    }
    
    // Move last segment to first position
    const lastIndex = segments.length - 1;
    reorderSegments(lastIndex, 0);
    showToast(`Moved segment from position ${lastIndex} to position 0`, 'success');
  };

  const addMultipleSegments = () => {
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        addEmptySegment();
      }, i * 100);
    }
    showToast('Adding 3 empty segments...', 'info');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Drag &amp; Drop Segment Test
          <Badge variant="outline" className="text-xs font-mono">
            Development Tool
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Status */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{segments.length}</div>
            <div className="text-xs text-muted-foreground">Total Segments</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">{timeline.selected_segment_ids.length}</div>
            <div className="text-xs text-muted-foreground">Selected</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {timeline.current_time.toFixed(1)}s
            </div>
            <div className="text-xs text-muted-foreground">Current Time</div>
          </div>
        </div>

        {/* Test Operations */}
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-2">Segment Operations</h4>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={testAddEmptySegment} size="sm" variant="outline">
                <Plus className="w-3 h-3 mr-1" />
                Add Empty Segment
              </Button>
              <Button onClick={addMultipleSegments} size="sm" variant="outline">
                <Plus className="w-3 h-3 mr-1" />
                Add 3 Segments
              </Button>
              <Button 
                onClick={testReorderSegments} 
                size="sm" 
                variant="outline"
                disabled={segments.length < 2}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Test Reorder
              </Button>
            </div>
          </div>
        </div>

        {/* Current Segments Preview */}
        {segments.length > 0 && (
          <div className="border rounded-lg p-3">
            <h4 className="font-medium mb-2 text-sm">Current Segment Order</h4>
            <div className="space-y-1">
              {segments.map((segment, index) => (
                <div key={segment.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-3 h-3 text-muted-foreground" />
                    <Badge variant="secondary" className="text-xs">
                      #{index + 1}
                    </Badge>
                    <span className="truncate max-w-32">{segment.text}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{segment.duration}s</span>
                    <span>({segment.start_time.toFixed(1)}s - {segment.end_time.toFixed(1)}s)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
          <strong>Drag &amp; Drop Instructions:</strong>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li>Click &quot;Add Empty Segment&quot; to add a new segment at position 0</li>
            <li>Hover over segments in the main grid to see drag handles</li>
            <li>Drag and drop segments to reorder them</li>
            <li>Timeline positions update automatically</li>
            <li>Selected segments follow their new position</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}