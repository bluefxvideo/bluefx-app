'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Video,
  Music,
  Youtube,
  Sparkles,
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
import type { UserBusinessOffer } from '@/lib/affiliate-toolkit/types';
import { countWords } from '@/lib/affiliate-toolkit/types';
import {
  fetchUserBusinessOffers,
  deleteUserBusinessOffer
} from '@/actions/tools/affiliate-script-generator';

export function TrainMyBusinessPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<UserBusinessOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<UserBusinessOffer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load offers on mount
  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchUserBusinessOffers();
      if (result.success && result.offers) {
        setOffers(result.offers);
      } else {
        setError(result.error || 'Failed to load your business offers');
      }
    } catch (err) {
      setError('Failed to load your business offers');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = (offer: UserBusinessOffer) => {
    setOfferToDelete(offer);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!offerToDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteUserBusinessOffer(offerToDelete.id);
      if (result.success) {
        await loadOffers();
        setDeleteConfirmOpen(false);
        setOfferToDelete(null);
      } else {
        setError(result.error || 'Failed to delete');
      }
    } catch (err) {
      setError('An error occurred while deleting');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Navigate to content generator with this offer selected
  const handleUseOffer = (offer: UserBusinessOffer) => {
    router.push(`/dashboard/script-generator?productId=${offer.id}&source=business`);
  };

  // Helper to get content summary
  const getOfferContentSummary = (offer: UserBusinessOffer) => {
    const parts: string[] = [];
    if (offer.offer_content) parts.push('Text');
    if (offer.media_files?.length) parts.push(`${offer.media_files.length} media`);
    if (offer.youtube_transcripts?.length) parts.push(`${offer.youtube_transcripts.length} YouTube`);
    return parts.length > 0 ? parts.join(' + ') : 'No content';
  };

  // Get icons for content sources
  const getContentIcons = (offer: UserBusinessOffer) => {
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

  // Check if offer is "trained" (has aggregated content)
  const isOfferTrained = (offer: UserBusinessOffer) => {
    return offer.aggregated_content && countWords(offer.aggregated_content) > 100;
  };

  return (
    <StandardToolPage
      icon={Briefcase}
      title="Train My Business"
      description="Upload your product information to train AI for your business"
      iconGradient="bg-gradient-to-br from-blue-500 to-indigo-600"
      toolName="Train My Business"
    >
      <div className="h-full overflow-auto p-4 lg:p-8">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-zinc-400 text-sm">
              {offers.length === 0
                ? 'Add your products/services to train the AI'
                : `${offers.length} product${offers.length === 1 ? '' : 's'} trained`
              }
            </p>
          </div>

          <Button
            onClick={() => router.push('/dashboard/business-tools/train-my-business/new')}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Product/Service
          </Button>
        </div>

        {/* Info Banner for new users */}
        {offers.length === 0 && !isLoading && (
          <div className="mb-6 p-6 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Train AI on Your Business</h3>
            <p className="text-zinc-400 mb-4">
              Upload sales pages, product descriptions, testimonials, and videos about your product.
              The AI will learn about your business and create content that sells YOUR stuff.
            </p>
            <Button
              onClick={() => router.push('/dashboard/business-tools/train-my-business/new')}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Get Started
            </Button>
          </div>
        )}

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
        ) : offers.length > 0 && (
          /* Offers Grid */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <Card
                key={offer.id}
                className="bg-card border-border hover:border-zinc-600 transition-colors group"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg text-white line-clamp-1">
                        {offer.name}
                      </CardTitle>
                      {isOfferTrained(offer) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                          <Sparkles className="w-3 h-3" />
                          Trained
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/business-tools/train-my-business/${offer.id}`)}
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

                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/dashboard/business-tools/train-my-business/${offer.id}`)}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUseOffer(offer)}
                      disabled={!isOfferTrained(offer)}
                      className="flex-1 gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate
                    </Button>
                  </div>

                  <p className="text-xs text-zinc-600 mt-3">
                    Updated: {new Date(offer.updated_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-[400px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-white">Delete Product</DialogTitle>
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
