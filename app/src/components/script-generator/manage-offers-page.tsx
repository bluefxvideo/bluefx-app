'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  ArrowLeft,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AffiliateOffer } from '@/lib/affiliate-toolkit/types';
import {
  fetchAffiliateOffers,
  createAffiliateOffer,
  updateAffiliateOffer,
  deleteAffiliateOffer
} from '@/actions/tools/affiliate-script-generator';

interface OfferFormData {
  name: string;
  niche: string;
  offer_content: string;
}

const emptyForm: OfferFormData = {
  name: '',
  niche: '',
  offer_content: ''
};

export function ManageOffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<AffiliateOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<AffiliateOffer | null>(null);
  const [formData, setFormData] = useState<OfferFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<AffiliateOffer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load offers on mount
  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchAffiliateOffers();
      if (result.success && result.offers) {
        setOffers(result.offers);
      } else {
        setError(result.error || 'Failed to load offers');
      }
    } catch (err) {
      setError('Failed to load offers');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingOffer(null);
    setFormData(emptyForm);
    setIsFormOpen(true);
  };

  const openEditForm = (offer: AffiliateOffer) => {
    setEditingOffer(offer);
    setFormData({
      name: offer.name,
      niche: offer.niche || '',
      offer_content: offer.offer_content || ''
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingOffer(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Offer name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (editingOffer) {
        // Update existing offer
        const result = await updateAffiliateOffer(editingOffer.id, formData);
        if (result.success) {
          await loadOffers();
          closeForm();
        } else {
          setError(result.error || 'Failed to update offer');
        }
      } else {
        // Create new offer
        const result = await createAffiliateOffer(formData);
        if (result.success) {
          await loadOffers();
          closeForm();
        } else {
          setError(result.error || 'Failed to create offer');
        }
      }
    } catch (err) {
      setError('An error occurred while saving');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (offer: AffiliateOffer) => {
    setOfferToDelete(offer);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!offerToDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteAffiliateOffer(offerToDelete.id);
      if (result.success) {
        await loadOffers();
        setDeleteConfirmOpen(false);
        setOfferToDelete(null);
      } else {
        setError(result.error || 'Failed to delete offer');
      }
    } catch (err) {
      setError('An error occurred while deleting');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <StandardToolPage
      icon={FileText}
      title="Manage Affiliate Offers"
      description="Add, edit, and delete affiliate offers for script generation"
      iconGradient="bg-primary"
      toolName="Manage Offers"
    >
      <div className="h-full overflow-auto p-4 lg:p-8">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/script-generator')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Script Generator
          </Button>

          <Button onClick={openCreateForm} className="gap-2">
            <Plus className="w-4 h-4" />
            Add New Offer
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-400">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="ml-auto"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        ) : (
          /* Offers Grid */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <Card key={offer.id} className="bg-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg text-white line-clamp-1">
                      {offer.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditForm(offer)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="w-4 h-4 text-zinc-400 hover:text-white" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirmDelete(offer)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-400" />
                      </Button>
                    </div>
                  </div>
                  {offer.niche && (
                    <span className="inline-block px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                      {offer.niche}
                    </span>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-400 line-clamp-3">
                    {offer.offer_content || 'No description'}
                  </p>
                  <p className="text-xs text-zinc-600 mt-2">
                    Created: {new Date(offer.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}

            {offers.length === 0 && (
              <div className="col-span-full text-center py-12">
                <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-500 mb-4">No offers yet. Add your first offer to get started.</p>
                <Button onClick={openCreateForm} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add New Offer
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-[600px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingOffer ? 'Edit Offer' : 'Add New Offer'}
              </DialogTitle>
              <DialogDescription>
                {editingOffer
                  ? 'Update the offer details below.'
                  : 'Fill in the details for your new affiliate offer.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Offer Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Weight Loss Program XYZ"
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="niche">Niche / Category</Label>
                <Input
                  id="niche"
                  value={formData.niche}
                  onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                  placeholder="e.g., Health & Wellness, Finance, Tech"
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="offer_content">Offer Description</Label>
                <Textarea
                  id="offer_content"
                  value={formData.offer_content}
                  onChange={(e) => setFormData({ ...formData, offer_content: e.target.value })}
                  placeholder="Describe the offer in detail: benefits, features, pricing, target audience, unique selling points, testimonials, guarantees, etc. The more detail you provide, the better the AI can generate relevant scripts."
                  className="min-h-[200px] bg-background border-border resize-none"
                />
                <p className="text-xs text-zinc-500">
                  Tip: Include key benefits, pricing, target audience, and unique selling points for best results.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeForm} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingOffer ? 'Update Offer' : 'Create Offer'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-[400px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-white">Delete Offer</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{offerToDelete?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </StandardToolPage>
  );
}
