'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVideoEditorStore } from "../store/video-editor-store";
import { Volume2, Plus, RotateCcw } from "lucide-react";

/**
 * Test component to demonstrate sync status functionality
 */
export function SyncStatusTest() {
  const { 
    timeline,
    segments,
    addEmptySegment,
    regenerateTimelineSync,
    markTimelineOutOfSync,
    checkSyncStatus,
    showToast
  } = useVideoEditorStore();

  const syncStatus = checkSyncStatus();
  const segmentsNeedingVoice = timeline.segments_needing_voice.length;

  const testAddSegmentOutOfSync = () => {
    addEmptySegment();
    showToast('Added segment - timeline now out of sync', 'warning');
  };

  const testMarkOutOfSync = () => {
    if (segments.length === 0) {
      showToast('Add some segments first', 'warning');
      return;
    }
    markTimelineOutOfSync([segments[0].id]);
    showToast('Marked timeline as out of sync', 'warning');
  };

  const testRegenerateSync = async () => {
    await regenerateTimelineSync();
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'synced': return 'text-blue-600';
      case 'out_of_sync': return 'text-orange-600';
      case 'regenerating': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Timeline Sync Status Test
          <Badge variant="outline" className="text-xs font-mono">
            Development Tool
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getSyncStatusColor(syncStatus)}`}>
              {syncStatus.replace('_', ' ').toUpperCase()}
            </div>
            <div className="text-xs text-muted-foreground">Sync Status</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">{segmentsNeedingVoice}</div>
            <div className="text-xs text-muted-foreground">Need Voice</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{segments.length}</div>
            <div className="text-xs text-muted-foreground">Total Segments</div>
          </div>
        </div>

        {/* Test Operations */}
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-2">Sync Status Tests</h4>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={testAddSegmentOutOfSync} size="sm" variant="outline">
                <Plus className="w-3 h-3 mr-1" />
                Add Segment (Out of Sync)
              </Button>
              <Button 
                onClick={testMarkOutOfSync} 
                size="sm" 
                variant="outline"
                disabled={segments.length === 0}
              >
                <Volume2 className="w-3 h-3 mr-1" />
                Mark Out of Sync
              </Button>
              <Button 
                onClick={testRegenerateSync} 
                size="sm" 
                variant="default"
                disabled={syncStatus === 'synced' || syncStatus === 'regenerating'}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Regenerate Sync
              </Button>
            </div>
          </div>
        </div>

        {/* Segments Status */}
        {segments.length > 0 && (
          <div className="border rounded-lg p-3">
            <h4 className="font-medium mb-2 text-sm">Segments Voice Status</h4>
            <div className="space-y-1">
              {segments.map((segment, index) => {
                const needsVoice = timeline.segments_needing_voice.includes(segment.id);
                const hasVoice = segment.assets.voice.status === 'ready';
                
                return (
                  <div key={segment.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        #{index + 1}
                      </Badge>
                      <span className="truncate max-w-32">{segment.text}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {needsVoice ? (
                        <Badge variant="destructive" className="text-xs">
                          Needs Voice
                        </Badge>
                      ) : hasVoice ? (
                        <Badge variant="default" className="text-xs">
                          Has Voice
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Explanation */}
        <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
          <strong>Sync Status Explanation:</strong>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li><strong>Synced:</strong> All segments have voice and captions aligned</li>
            <li><strong>Out of Sync:</strong> Some segments need voice generation (subtle orange indicators)</li>
            <li><strong>Regenerating:</strong> System is generating voice and captions</li>
          </ul>
          <div className="mt-2">
            <strong>Visual Indicators:</strong>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>Segments with voice issues show orange borders and volume icons</li>
              <li>Sync indicator appears at top when timeline is out of sync</li>
              <li>"Sync Audio" button allows regeneration of missing voice/captions</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}