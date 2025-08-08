'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useVideoEditorStore } from "../store/video-editor-store";

interface AddSegmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  afterSegmentId?: string;
}

export function AddSegmentDialog({ open, onOpenChange, afterSegmentId }: AddSegmentDialogProps) {
  const [text, setText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { addSegment, segments } = useVideoEditorStore();

  const afterSegment = afterSegmentId ? segments.find(s => s.id === afterSegmentId) : null;
  const position = afterSegment 
    ? `after "${afterSegment.text.substring(0, 30)}..."` 
    : 'at the end of the timeline';

  const handleAdd = async () => {
    if (!text.trim()) return;
    
    setIsAdding(true);
    try {
      await addSegment(afterSegmentId, text.trim());
      setText('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to add segment:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setText('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Segment</DialogTitle>
          <DialogDescription>
            Enter the text for your new segment. It will be added {position}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="segment-text">Segment Text</Label>
            <Textarea
              id="segment-text"
              placeholder="Enter what you want to say in this segment..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <div className="text-xs text-muted-foreground">
              {text.length} characters
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isAdding}>
              Cancel
            </Button>
            <Button 
              onClick={handleAdd} 
              disabled={!text.trim() || isAdding}
            >
              {isAdding ? 'Adding...' : 'Add Segment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}