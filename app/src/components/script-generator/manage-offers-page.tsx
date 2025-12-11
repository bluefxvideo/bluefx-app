'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  X,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Video,
  Music,
  Youtube,
} from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AffiliateOffer } from '@/lib/affiliate-toolkit/types';
import { countWords } from '@/lib/affiliate-toolkit/types';
import {
  fetchAffiliateOffers,
  deleteAffiliateOffer
} from '@/actions/tools/affiliate-script-generator';

export function ManageOffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<AffiliateOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Helper to get content summary for offer card
  const getOfferContentSummary = (offer: AffiliateOffer) => {
    const parts: string[] = [];
    if (offer.offer_content) parts.push('Text');
    if (offer.media_files?.length) parts.push(`${offer.media_files.length} media`);
    if (offer.youtube_transcripts?.length) parts.push(`${offer.youtube_transcripts.length} YouTube`);
    return parts.length > 0 ? parts.join(' + ') : 'No content';
  };

  // Get icons for content sources
  const getContentIcons = (offer: AffiliateOffer) => {
    const icons = [];
    if (offer.media_files?.some(m => m.type === 'video')) {
      icons.push(<Video key="video" className="w-4 h-4 text-blue-400" />);
    }
    if (offer.media_files?.some(m => m.type === 'audio')) {
      icons.push(<Music key="audio" className="w-4 h-4 text-purple-400" />);
    }
    if (offer.youtube_transcripts?.length) {
      icons.push(<Youtube key="youtube" className="w-4 h-4 text-red-500" />);
    }
    return icons;
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

          <Button
            onClick={() => router.push('/dashboard/script-generator/offers/new')}
            className="gap-2"
          >
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
              <Card
                key={offer.id}
                className="bg-card border-border hover:border-zinc-600 transition-colors cursor-pointer group"
                onClick={() => router.push(`/dashboard/script-generator/offers/${offer.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg text-white line-clamp-1 group-hover:text-primary transition-colors">
                      {offer.name}
                    </CardTitle>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/script-generator/offers/${offer.id}`)}
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
                  <p className="text-sm text-zinc-400 line-clamp-2">
                    {offer.offer_content || 'No description'}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      {getContentIcons(offer)}
                      <span className="text-xs text-zinc-500">{getOfferContentSummary(offer)}</span>
                    </div>
                    {offer.aggregated_content && (
                      <span className="text-xs font-medium text-primary">
                        {countWords(offer.aggregated_content).toLocaleString()} words
                      </span>
                    )}
                  </div>
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
                <Button
                  onClick={() => router.push('/dashboard/script-generator/offers/new')}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add New Offer
                </Button>
              </div>
            )}
          </div>
        )}

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
