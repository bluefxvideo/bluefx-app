'use client';

import { useState, useEffect, useCallback } from 'react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BookMarked, Plus, Search, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PromptCard } from './prompt-card';
import { PromptDetailDialog } from './prompt-detail-dialog';
import { PromptEditorDialog } from './prompt-editor-dialog';
import { fetchPrompts, deletePrompt } from '@/actions/tools/prompt-library';
import type { Prompt, PromptCategory } from '@/lib/prompt-library/types';
import { PROMPT_CATEGORIES } from '@/lib/prompt-library/types';

interface PromptLibraryPageProps {
  isAdmin?: boolean;
}

export function PromptLibraryPage({ isAdmin = false }: PromptLibraryPageProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [viewPrompt, setViewPrompt] = useState<Prompt | null>(null);
  const [editPrompt, setEditPrompt] = useState<Prompt | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteConfirmPrompt, setDeleteConfirmPrompt] = useState<Prompt | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadPrompts = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchPrompts({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        search: searchQuery || undefined,
      });

      if (result.success && result.prompts) {
        setPrompts(result.prompts);
      } else {
        toast.error(result.error || 'Failed to load prompts');
      }
    } catch (error) {
      console.error('Error loading prompts:', error);
      toast.error('Failed to load prompts');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const handleCopy = async (prompt: Prompt) => {
    try {
      await navigator.clipboard.writeText(prompt.prompt_text);
      toast.success('Prompt copied to clipboard');
    } catch {
      toast.error('Failed to copy prompt');
    }
  };

  const handleView = (prompt: Prompt) => {
    setViewPrompt(prompt);
  };

  const handleEdit = (prompt: Prompt) => {
    setEditPrompt(prompt);
    setIsEditorOpen(true);
  };

  const handleAddNew = () => {
    setEditPrompt(null);
    setIsEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmPrompt) return;

    setIsDeleting(true);
    try {
      const result = await deletePrompt(deleteConfirmPrompt.id);
      if (result.success) {
        toast.success('Prompt deleted successfully');
        setDeleteConfirmPrompt(null);
        loadPrompts();
      } else {
        toast.error(result.error || 'Failed to delete prompt');
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error('Failed to delete prompt');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditorSaved = () => {
    loadPrompts();
  };

  // Filter prompts locally for search (in addition to server-side)
  const filteredPrompts = prompts.filter(prompt => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      prompt.title.toLowerCase().includes(query) ||
      prompt.description?.toLowerCase().includes(query) ||
      prompt.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  return (
    <StandardToolPage
      icon={BookMarked}
      title="Prompt Library"
      description="Ready-to-use AI prompts for various creative tasks"
      iconGradient="bg-primary"
      toolName="Prompt Library"
    >
      <div className="h-full overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Filters and Actions */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Category Filter */}
              <Select
                value={selectedCategory}
                onValueChange={(val) => setSelectedCategory(val as PromptCategory | 'all')}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {PROMPT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={loadPrompts}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>

              {/* Admin: Add New Button */}
              {isAdmin && (
                <Button onClick={handleAddNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Prompt
                </Button>
              )}
            </div>
          </Card>

          {/* Prompts Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredPrompts.length === 0 ? (
            <Card className="p-8 text-center">
              <BookMarked className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium text-lg mb-2">No prompts found</h3>
              <p className="text-muted-foreground">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Prompts will appear here once added'}
              </p>
              {isAdmin && !searchQuery && selectedCategory === 'all' && (
                <Button className="mt-4" onClick={handleAddNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Prompt
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  isAdmin={isAdmin}
                  onView={handleView}
                  onCopy={handleCopy}
                  onEdit={handleEdit}
                  onDelete={(p) => setDeleteConfirmPrompt(p)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View Prompt Dialog */}
      <PromptDetailDialog
        prompt={viewPrompt}
        open={!!viewPrompt}
        onOpenChange={(open) => !open && setViewPrompt(null)}
      />

      {/* Editor Dialog (Admin) */}
      {isAdmin && (
        <PromptEditorDialog
          prompt={editPrompt}
          open={isEditorOpen}
          onOpenChange={setIsEditorOpen}
          onSaved={handleEditorSaved}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmPrompt}
        onOpenChange={(open: boolean) => !open && setDeleteConfirmPrompt(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Prompt</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteConfirmPrompt?.title}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmPrompt(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StandardToolPage>
  );
}
