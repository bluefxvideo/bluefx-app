'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPrompt, updatePrompt } from '@/actions/tools/prompt-library';
import type { Prompt, PromptCategory, CreatePromptInput } from '@/lib/prompt-library/types';
import { PROMPT_CATEGORIES } from '@/lib/prompt-library/types';

interface PromptEditorDialogProps {
  prompt?: Prompt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function PromptEditorDialog({
  prompt,
  open,
  onOpenChange,
  onSaved,
}: PromptEditorDialogProps) {
  const isEditing = !!prompt;
  const [isLoading, setIsLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [promptText, setPromptText] = useState('');
  const [category, setCategory] = useState<PromptCategory>('general');
  const [useCase, setUseCase] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  // Reset form when dialog opens/closes or prompt changes
  useEffect(() => {
    if (open && prompt) {
      setTitle(prompt.title);
      setDescription(prompt.description || '');
      setPromptText(prompt.prompt_text);
      setCategory(prompt.category);
      setUseCase(prompt.use_case || '');
      setTagsInput(prompt.tags?.join(', ') || '');
      setIsFeatured(prompt.is_featured);
    } else if (open && !prompt) {
      setTitle('');
      setDescription('');
      setPromptText('');
      setCategory('general');
      setUseCase('');
      setTagsInput('');
      setIsFeatured(false);
    }
  }, [open, prompt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !promptText.trim()) {
      toast.error('Title and prompt text are required');
      return;
    }

    setIsLoading(true);

    try {
      const tags = tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const data: CreatePromptInput = {
        title: title.trim(),
        description: description.trim() || null,
        prompt_text: promptText.trim(),
        category,
        use_case: useCase.trim() || null,
        tags,
        is_featured: isFeatured,
        display_order: prompt?.display_order ?? 0,
      };

      const result = isEditing
        ? await updatePrompt(prompt!.id, data)
        : await createPrompt(data);

      if (result.success) {
        toast.success(isEditing ? 'Prompt updated successfully' : 'Prompt created successfully');
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(result.error || 'Failed to save prompt');
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast.error('An error occurred while saving');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Prompt' : 'Add New Prompt'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Historic Video Generation Script"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this prompt does..."
              rows={2}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={(val) => setCategory(val as PromptCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROMPT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Use Case */}
          <div className="space-y-2">
            <Label htmlFor="useCase">Use Case</Label>
            <Input
              id="useCase"
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              placeholder="e.g., Creating documentary-style videos"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., youtube, faceless, documentary"
            />
          </div>

          {/* Prompt Text */}
          <div className="space-y-2">
            <Label htmlFor="promptText">Prompt Text *</Label>
            <Textarea
              id="promptText"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Enter the full prompt text..."
              rows={10}
              className="font-mono text-sm"
              required
            />
          </div>

          {/* Featured Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Featured Prompt</Label>
              <p className="text-sm text-muted-foreground">
                Featured prompts appear at the top of the library
              </p>
            </div>
            <Switch
              checked={isFeatured}
              onCheckedChange={setIsFeatured}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Prompt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
