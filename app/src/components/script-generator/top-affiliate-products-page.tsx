'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Library,
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
  GripVertical,
  Flame,
  DollarSign,
  ExternalLink,
  UserPlus,
  Mail,
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
import type { LibraryProduct } from '@/lib/affiliate-toolkit/types';
import { countWords } from '@/lib/affiliate-toolkit/types';
import {
  fetchLibraryProducts,
  deleteLibraryProduct
} from '@/actions/tools/affiliate-script-generator';

interface TopAffiliateProductsPageProps {
  isAdmin?: boolean;
}

export function TopAffiliateProductsPage({ isAdmin = false }: TopAffiliateProductsPageProps) {
  const router = useRouter();
  const [products, setProducts] = useState<LibraryProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<LibraryProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchLibraryProducts();
      if (result.success && result.products) {
        setProducts(result.products);
      } else {
        setError(result.error || 'Failed to load products');
      }
    } catch (err) {
      setError('Failed to load products');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = (product: LibraryProduct) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteLibraryProduct(productToDelete.id);
      if (result.success) {
        await loadProducts();
        setDeleteConfirmOpen(false);
        setProductToDelete(null);
      } else {
        setError(result.error || 'Failed to delete product');
      }
    } catch (err) {
      setError('An error occurred while deleting');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Navigate to content generator with this product selected
  const handleUseProduct = (product: LibraryProduct) => {
    router.push(`/dashboard/script-generator?productId=${product.id}&source=library`);
  };

  // Helper to get content summary for product card
  const getProductContentSummary = (product: LibraryProduct) => {
    const parts: string[] = [];
    if (product.offer_content) parts.push('Text');
    if (product.media_files?.length) parts.push(`${product.media_files.length} media`);
    if (product.youtube_transcripts?.length) parts.push(`${product.youtube_transcripts.length} YouTube`);
    return parts.length > 0 ? parts.join(' + ') : 'No content';
  };

  // Get icons for content sources
  const getContentIcons = (product: LibraryProduct) => {
    const icons = [];
    if (product.media_files?.some(m => m.type === 'video')) {
      icons.push(<Video key="video" className="w-4 h-4 text-blue-400" />);
    }
    if (product.media_files?.some(m => m.type === 'audio')) {
      icons.push(<Music key="audio" className="w-4 h-4 text-purple-400" />);
    }
    if (product.youtube_transcripts?.length) {
      icons.push(<Youtube key="youtube" className="w-4 h-4 text-red-500" />);
    }
    return icons;
  };

  // Check if product is "trained" (has aggregated content)
  const isProductTrained = (product: LibraryProduct) => {
    return product.aggregated_content && countWords(product.aggregated_content) > 100;
  };

  return (
    <StandardToolPage
      icon={Library}
      title="Top Affiliate Products"
      description="Pre-trained affiliate products ready for content generation"
      iconGradient="bg-gradient-to-br from-green-500 to-emerald-600"
      toolName="Top Affiliate Products"
    >
      <div className="h-full overflow-auto p-4 lg:p-8">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-zinc-400 text-sm">
              {products.length} products available
              {!isAdmin && ' - Click "Use Product" to generate content'}
            </p>
          </div>

          {isAdmin && (
            <Button
              onClick={() => router.push('/dashboard/script-generator/offers/new')}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add New Product
            </Button>
          )}
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
          /* Products Grid */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card
                key={product.id}
                className="bg-card border-border hover:border-zinc-600 transition-colors group relative"
              >
                {/* Admin drag handle */}
                {isAdmin && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                    <GripVertical className="w-4 h-4 text-zinc-600" />
                  </div>
                )}

                {/* Product Image */}
                {product.image_url && (
                  <div className={`h-32 bg-zinc-800/50 overflow-hidden ${isAdmin ? 'ml-6' : ''}`}>
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <CardHeader className={`pb-2 ${isAdmin ? 'pl-8' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg text-white line-clamp-1">
                        {product.name}
                      </CardTitle>
                      {isProductTrained(product) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                          <Sparkles className="w-3 h-3" />
                          Trained
                        </span>
                      )}
                    </div>

                    {/* Admin buttons */}
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/script-generator/offers/${product.id}`)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="w-4 h-4 text-zinc-400 hover:text-white" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmDelete(product)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-400" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {product.niche && (
                    <span className="inline-block px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                      {product.niche}
                    </span>
                  )}
                </CardHeader>
                <CardContent className={isAdmin ? 'pl-8' : ''}>
                  {/* ClickBank Stats */}
                  {product.clickbank_stats && (
                    <div className="mb-3 p-2 bg-zinc-800/50 rounded-lg space-y-2">
                      {/* Stats row */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Flame className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-semibold text-orange-400">
                            {product.clickbank_stats.gravity_score.toFixed(1)}
                          </span>
                          <span className="text-xs text-zinc-500">gravity</span>
                        </div>
                        {product.clickbank_stats.average_dollar_per_sale && (
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-semibold text-green-400">
                              ${product.clickbank_stats.average_dollar_per_sale.toFixed(0)}
                            </span>
                            <span className="text-xs text-zinc-500">/sale</span>
                          </div>
                        )}
                      </div>
                      {/* Action buttons row */}
                      <div className="flex items-center gap-2 pt-1 border-t border-zinc-700/50">
                        {product.clickbank_stats.sales_page_url && (
                          <a
                            href={product.clickbank_stats.sales_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-700/50 rounded transition-colors"
                            title="View Sales Page"
                          >
                            <ExternalLink className="w-3 h-3" />
                            See Offer
                          </a>
                        )}
                        {product.clickbank_stats.affiliate_page_url && (
                          <a
                            href={product.clickbank_stats.affiliate_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-700/50 rounded transition-colors"
                            title="Become an Affiliate"
                          >
                            <UserPlus className="w-3 h-3" />
                            Become Affiliate
                          </a>
                        )}
                        {product.clickbank_stats.vendor_contact_email && (
                          <a
                            href={`mailto:${product.clickbank_stats.vendor_contact_email}`}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-700/50 rounded transition-colors"
                            title="Contact Seller"
                          >
                            <Mail className="w-3 h-3" />
                            Contact
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-zinc-400 line-clamp-2">
                    {product.offer_content || 'No description'}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      {getContentIcons(product)}
                      <span className="text-xs text-zinc-500">{getProductContentSummary(product)}</span>
                    </div>
                    {product.aggregated_content && (
                      <span className="text-xs font-medium text-primary">
                        {countWords(product.aggregated_content).toLocaleString()} words
                      </span>
                    )}
                  </div>

                  {/* Use Product button (for non-admin users) */}
                  {!isAdmin && (
                    <Button
                      onClick={() => handleUseProduct(product)}
                      className="w-full mt-4 gap-2"
                      disabled={!isProductTrained(product)}
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate Content
                    </Button>
                  )}

                  {/* Admin: quick generate button */}
                  {isAdmin && (
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUseProduct(product)}
                        className="flex-1 gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {products.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Library className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                {isAdmin ? (
                  <>
                    <p className="text-zinc-500 mb-4">No products in the library yet. Add your first product.</p>
                    <Button
                      onClick={() => router.push('/dashboard/script-generator/offers/new')}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Product
                    </Button>
                  </>
                ) : (
                  <p className="text-zinc-500">No products available yet. Check back soon!</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Dialog (Admin only) */}
        {isAdmin && (
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent className="sm:max-w-[400px] bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-white">Delete Product</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
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
        )}
      </div>
    </StandardToolPage>
  );
}
