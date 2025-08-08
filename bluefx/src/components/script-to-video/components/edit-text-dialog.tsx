'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVideoEditorStore } from '../store/video-editor-store';

interface EditTextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentId?: string;
}

export function EditTextDialog({ open, onOpenChange, segmentId }: EditTextDialogProps) {
  const { segments, updateSegmentText } = useVideoEditorStore();
  const [text, setText] = useState('');
  
  const segment = segments.find(s => s.id === segmentId);

  useEffect(() => {
    if (open && segment) {
      setText(segment.text);
    }
  }, [open, segment]);

  const handleSave = () => {
    if (segmentId && text.trim()) {
      updateSegmentText(segmentId, text.trim());
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setText(segment?.text || '');
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Segment Text</DialogTitle>
          <DialogDescription>
            Modify the text for this segment. Changes will mark the timeline as out of sync and require voice regeneration.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="segment-text">Segment Text</Label>
            <Textarea
              id="segment-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter segment text..."
              className="min-h-[100px] resize-none"
              autoFocus
            />
          </div>
          
          {segment && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Segment #{segments.indexOf(segment) + 1}</div>
              <div>Duration: {segment.duration.toFixed(1)}s</div>
              <div>Status: {segment.status === 'ready' ? 'Ready' : 'Draft'}</div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!text.trim()}>
            Save Changes
          </Button>
        </DialogFooter>
        
        <div className="text-xs text-muted-foreground mt-2 px-1">
          <strong>Shortcuts:</strong> Ctrl/⌘+Enter to save, Escape to cancel
        </div>
      </DialogContent>
    </Dialog>
  );
}