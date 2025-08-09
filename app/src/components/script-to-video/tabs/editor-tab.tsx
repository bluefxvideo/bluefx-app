'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit3, Plus, Trash2, RotateCcw } from 'lucide-react';
import type { SegmentData } from '../store/video-editor-store';

interface Composition {
  segments?: SegmentData[];
}

interface EditorTabProps {
  onEdit: (editData: unknown) => void;
  isEditing: boolean;
  currentComposition?: Composition;
  credits: number;
}

export function EditorTab({ currentComposition }: EditorTabProps) {
  if (!currentComposition) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto">
            <Edit3 className="w-8 h-8 text-white" />
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Ready to Edit Videos</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Generate a video first, then come back here to make intelligent edits with minimal regeneration.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">🎬 Editor Features:</p>
              <ul className="text-left space-y-1">
                <li>• Add/remove segments</li>
                <li>• Regenerate specific images</li>
                <li>• Adjust timing & pacing</li>
                <li>• Smart lip-sync preservation</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Edit3 className="w-4 h-4 text-white" />
            </div>
            Video Editor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Segment Timeline */}
          <div className="space-y-4">
            <h4 className="font-medium">Segments Timeline</h4>
            {currentComposition.segments?.map((segment: SegmentData, index: number) => (
              <div key={segment.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Segment {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline">
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Regenerate Image
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="text-sm">
                  <p className="mb-2">{segment.text}</p>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Duration: {segment.duration}s</span>
                    <span>Start: {segment.start_time}s</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Segment */}
          <Button variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add New Segment
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}