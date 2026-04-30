'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<string | null | undefined>;
}

export function NewProjectModal({ open, onOpenChange, onCreate }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const placeholder = `Untitled Project — ${new Date().toLocaleDateString()}`;

  const handleCreate = async () => {
    setCreating(true);
    const id = await onCreate(name.trim() || placeholder);
    setCreating(false);
    if (id) {
      setName('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="project-name">Project name</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            disabled={creating}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !creating) handleCreate();
            }}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">You can rename it later.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
