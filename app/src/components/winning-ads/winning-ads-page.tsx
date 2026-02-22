'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Flame,
  Heart,
  MessageCircle,
  Share2,
  Clock,
  ArrowUpDown,
  Filter,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface WinningAd {
  id: number;
  tiktok_material_id: string;
  ad_title: string | null;
  brand_name: string | null;
  niche: string;
  likes: number;
  comments: number;
  shares: number;
  ctr: number;
  video_duration: number | null;
  video_cover_url: string | null;
  video_url: string | null;
  landing_page: string | null;
  keywords: string[];
  country_codes: string[];
  clone_score: number;
  date_scraped: string;
}

interface NicheInfo {
  name: string;
  slug: string;
  ad_count: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getCtrPercentile(ctr: number): string | null {
  if (ctr >= 0.05) return 'Top 1% CTR';
  if (ctr >= 0.03) return 'Top 3% CTR';
  if (ctr >= 0.02) return 'Top 10% CTR';
  return null;
}

export function WinningAdsPage() {
  const router = useRouter();
  const [ads, setAds] = useState<WinningAd[]>([]);
  const [niches, setNiches] = useState<NicheInfo[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    has_more: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNiche, setSelectedNiche] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('clone_score');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAds = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedNiche !== 'all') params.set('niche', selectedNiche);
      params.set('sort', sortBy);
      params.set('page', page.toString());
      params.set('limit', '20');

      const response = await fetch(`/api/winning-ads?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch ads');

      const data = await response.json();
      setAds(data.ads);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch ads:', error);
      toast.error('Something went wrong loading ads. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedNiche, sortBy]);

  const fetchNiches = useCallback(async () => {
    try {
      const response = await fetch('/api/winning-ads/niches');
      if (!response.ok) throw new Error('Failed to fetch niches');
      const data = await response.json();
      setNiches(data.niches);
    } catch (error) {
      console.error('Failed to fetch niches:', error);
    }
  }, []);

  useEffect(() => {
    fetchNiches();
  }, [fetchNiches]);

  useEffect(() => {
    fetchAds(1);
  }, [fetchAds]);

  const handleCloneAd = (ad: WinningAd) => {
    // Build the TikTok Creative Center URL for this ad
    const adUrl = `https://ads.tiktok.com/business/creativecenter/topads/${ad.tiktok_material_id}/pc/en`;
    // Navigate to Video Analyzer with the URL pre-filled
    router.push(`/dashboard/video-analyzer?videoUrl=${encodeURIComponent(adUrl)}`);
  };

  const handleCopyUrl = async (ad: WinningAd) => {
    const adUrl = `https://ads.tiktok.com/business/creativecenter/topads/${ad.tiktok_material_id}/pc/en`;
    await navigator.clipboard.writeText(adUrl);
    setCopiedId(ad.tiktok_material_id);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePageChange = (newPage: number) => {
    fetchAds(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <StandardToolPage
      icon={Flame}
      title="Winning Ads Right Now"
      description="See what's performing on TikTok. Clone any ad in one click."
      toolName="Winning Ads Finder"
    >
      <div className="flex-1 p-4 lg:p-6 overflow-auto">
        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 flex-1">
            <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
            <Select value={selectedNiche} onValueChange={setSelectedNiche}>
              <SelectTrigger className="bg-background border-border w-full sm:w-[220px]">
                <SelectValue placeholder="All Niches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Niches</SelectItem>
                {niches.map((niche) => (
                  <SelectItem key={niche.slug} value={niche.name}>
                    {niche.name} ({niche.ad_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-zinc-400 shrink-0" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="bg-background border-border w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clone_score">Best Clone Score</SelectItem>
                <SelectItem value="likes">Most Liked</SelectItem>
                <SelectItem value="ctr">Highest CTR</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results count */}
        {!isLoading && (
          <p className="text-sm text-zinc-400 mb-4">
            {pagination.total} ads found
            {selectedNiche !== 'all' ? ` in ${selectedNiche}` : ''}
          </p>
        )}

        {/* Ad Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : ads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Flame className="w-12 h-12 text-zinc-600 mb-4" />
            <p className="text-zinc-400 text-lg mb-2">
              No ads found{selectedNiche !== 'all' ? ` for ${selectedNiche}` : ''}.
            </p>
            <p className="text-zinc-500 text-sm max-w-md">
              Ads are scraped automatically every few days. Make sure the database
              migration has been applied and check back after the next scheduled scrape.
            </p>
            {selectedNiche !== 'all' && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setSelectedNiche('all')}
              >
                View all niches
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {ads.map((ad) => (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  onClone={() => handleCloneAd(ad)}
                  onCopyUrl={() => handleCopyUrl(ad)}
                  isCopied={copiedId === ad.tiktok_material_id}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-zinc-400">
                  Page {pagination.page} of{' '}
                  {Math.ceil(pagination.total / pagination.limit)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.has_more}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </StandardToolPage>
  );
}

function AdCard({
  ad,
  onClone,
  onCopyUrl,
  isCopied,
}: {
  ad: WinningAd;
  onClone: () => void;
  onCopyUrl: () => void;
  isCopied: boolean;
}) {
  const ctrBadge = getCtrPercentile(ad.ctr);

  return (
    <Card className="overflow-hidden border border-border/50 hover:border-border transition-colors flex flex-col">
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] bg-zinc-900 max-h-[320px]">
        {ad.video_cover_url ? (
          <img
            src={ad.video_cover_url}
            alt={ad.ad_title || 'TikTok Ad'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Flame className="w-8 h-8 text-zinc-700" />
          </div>
        )}

        {/* Duration badge */}
        {ad.video_duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(ad.video_duration)}
          </div>
        )}

        {/* CTR badge */}
        {ctrBadge && (
          <div className="absolute top-2 right-2">
            <Badge
              variant="secondary"
              className="bg-emerald-500/90 text-white text-[10px] border-0"
            >
              {ctrBadge}
            </Badge>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col flex-1">
        {/* Title */}
        {ad.ad_title && (
          <p className="text-sm font-medium text-white truncate mb-2">
            {ad.ad_title}
          </p>
        )}

        {/* Engagement stats */}
        <div className="flex items-center gap-3 text-xs text-zinc-400 mb-2">
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-red-400" />
            {formatNumber(ad.likes)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3 text-blue-400" />
            {formatNumber(ad.comments)}
          </span>
          <span className="flex items-center gap-1">
            <Share2 className="w-3 h-3 text-green-400" />
            {formatNumber(ad.shares)}
          </span>
        </div>

        {/* Niche tag */}
        <Badge
          variant="outline"
          className="text-[10px] w-fit mb-3 text-zinc-400 border-zinc-700"
        >
          {ad.niche}
        </Badge>

        {/* Spacer to push buttons to bottom */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            size="sm"
            onClick={onClone}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Clone This Ad
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="px-2.5"
            onClick={onCopyUrl}
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card className="overflow-hidden border border-border/50">
      <div className="aspect-[9/16] bg-zinc-800 animate-pulse max-h-[320px]" />
      <div className="p-3 space-y-3">
        <div className="h-4 bg-zinc-800 animate-pulse rounded w-3/4" />
        <div className="flex gap-3">
          <div className="h-3 bg-zinc-800 animate-pulse rounded w-12" />
          <div className="h-3 bg-zinc-800 animate-pulse rounded w-12" />
          <div className="h-3 bg-zinc-800 animate-pulse rounded w-12" />
        </div>
        <div className="h-5 bg-zinc-800 animate-pulse rounded w-20" />
        <div className="h-8 bg-zinc-800 animate-pulse rounded" />
      </div>
    </Card>
  );
}
