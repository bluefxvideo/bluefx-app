'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Flame,
  Heart,
  MessageCircle,
  Share2,
  Clock,
  ArrowUpDown,
  Filter,
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  Search,
  Bookmark,
  BookmarkCheck,
  Facebook,
  Globe,
} from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type Platform = 'tiktok' | 'facebook';

interface WinningAd {
  id: number;
  tiktok_material_id: string;
  ad_title: string | null;
  brand_name: string | null;
  niche: string;
  platform: Platform;
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

const WINNING_ADS_TABS = [
  { id: 'tiktok',   label: 'TikTok Ads',   icon: Flame,    path: '/dashboard/winning-ads' },
  { id: 'facebook', label: 'Facebook Ads', icon: Facebook, path: '/dashboard/winning-ads/facebook' },
];

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

function isNewAd(dateScraped: string): boolean {
  const scraped = new Date(dateScraped);
  const fortyEightHoursAgo = new Date();
  fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
  return scraped > fortyEightHoursAgo;
}

function getDaysRunning(dateScraped: string): number {
  return Math.floor((Date.now() - new Date(dateScraped).getTime()) / 86_400_000);
}

export function WinningAdsPage({ platform = 'tiktok' }: { platform?: Platform }) {
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedAdIds, setSavedAdIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset niche filter when switching platforms (Facebook has no niches)
  useEffect(() => {
    setSelectedNiche('all');
    setSortBy('clone_score');
    setSearchQuery('');
    setDebouncedSearch('');
  }, [platform]);

  // Debounce search input
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const fetchAds = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('platform', platform);
      if (selectedNiche !== 'all') params.set('niche', selectedNiche);
      params.set('sort', sortBy);
      params.set('page', page.toString());
      params.set('limit', '20');
      if (debouncedSearch) params.set('search', debouncedSearch);

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
  }, [platform, selectedNiche, sortBy, debouncedSearch]);

  const fetchNiches = useCallback(async () => {
    if (platform === 'facebook') return; // no niche filter for Facebook
    try {
      const response = await fetch('/api/winning-ads/niches');
      if (!response.ok) throw new Error('Failed to fetch niches');
      const data = await response.json();
      setNiches(data.niches);
    } catch (error) {
      console.error('Failed to fetch niches:', error);
    }
  }, [platform]);

  const fetchSavedAdIds = useCallback(async () => {
    try {
      const response = await fetch('/api/winning-ads/saved');
      if (!response.ok) return;
      const data = await response.json();
      setSavedAdIds(new Set(data.saved_ad_ids ?? []));
    } catch (error) {
      console.error('Failed to fetch saved ads:', error);
    }
  }, []);

  useEffect(() => {
    fetchNiches();
    fetchSavedAdIds();
  }, [fetchNiches, fetchSavedAdIds]);

  useEffect(() => {
    fetchAds(1);
  }, [fetchAds]);

  const handleCloneAd = (ad: WinningAd) => {
    if (ad.platform === 'facebook') {
      window.open(
        `https://www.facebook.com/ads/library/?id=${ad.tiktok_material_id}`,
        '_blank'
      );
    } else {
      const adUrl = `https://ads.tiktok.com/business/creativecenter/topads/${ad.tiktok_material_id}/pc/en`;
      router.push(`/dashboard/video-analyzer?videoUrl=${encodeURIComponent(adUrl)}`);
    }
  };

  const handleCopyUrl = async (ad: WinningAd) => {
    const adUrl =
      ad.platform === 'facebook'
        ? `https://www.facebook.com/ads/library/?id=${ad.tiktok_material_id}`
        : `https://ads.tiktok.com/business/creativecenter/topads/${ad.tiktok_material_id}/pc/en`;
    await navigator.clipboard.writeText(adUrl);
    setCopiedId(ad.tiktok_material_id);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleSave = async (ad: WinningAd) => {
    const isSaved = savedAdIds.has(ad.id);
    setSavedAdIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(ad.id);
      else next.add(ad.id);
      return next;
    });
    try {
      const response = await fetch('/api/winning-ads/saved', {
        method: isSaved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winning_ad_id: ad.id,
          tiktok_material_id: ad.tiktok_material_id,
        }),
      });
      if (!response.ok) throw new Error('Request failed');
      toast.success(isSaved ? 'Removed from saved' : 'Ad saved!');
    } catch {
      setSavedAdIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(ad.id);
        else next.delete(ad.id);
        return next;
      });
      toast.error('Failed to update saved ads');
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchAds(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const displayedAds = showSavedOnly ? ads.filter((ad) => savedAdIds.has(ad.id)) : ads;

  const isTikTok = platform === 'tiktok';

  return (
    <StandardToolPage
      icon={isTikTok ? Flame : Facebook}
      title={isTikTok ? 'Winning TikTok Ads' : 'Winning Facebook Ads'}
      description={
        isTikTok
          ? "See what's performing on TikTok. Clone any ad in one click."
          : 'Long-running active ads on Facebook & Instagram.'
      }
      toolName="Winning Ads Finder"
      tabs={
        <StandardToolTabs
          tabs={WINNING_ADS_TABS}
          activeTab={platform}
          basePath="/dashboard/winning-ads"
        />
      }
    >
      <div className="flex-1 p-4 lg:p-6 overflow-auto">
        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ad titles..."
              className="pl-8 bg-background border-border"
            />
          </div>

          {/* Niche filter — TikTok only */}
          {isTikTok && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
              <Select value={selectedNiche} onValueChange={setSelectedNiche}>
                <SelectTrigger className="bg-background border-border w-full sm:w-[200px]">
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
          )}

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-zinc-400 shrink-0" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="bg-background border-border w-full sm:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clone_score">
                  {isTikTok ? 'Best Clone Score' : 'Longest Running'}
                </SelectItem>
                {isTikTok && (
                  <>
                    <SelectItem value="likes">Most Liked</SelectItem>
                    <SelectItem value="ctr">Highest CTR</SelectItem>
                  </>
                )}
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Saved toggle */}
          <Button
            variant={showSavedOnly ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5 shrink-0 h-10"
            onClick={() => setShowSavedOnly((v) => !v)}
          >
            <Bookmark className="w-4 h-4" />
            Saved {savedAdIds.size > 0 && `(${savedAdIds.size})`}
          </Button>
        </div>

        {/* Results count */}
        {!isLoading && (
          <p className="text-sm text-zinc-400 mb-4">
            {showSavedOnly
              ? `${displayedAds.length} saved ad${displayedAds.length !== 1 ? 's' : ''}`
              : `${pagination.total} ads found${isTikTok && selectedNiche !== 'all' ? ` in ${selectedNiche}` : ''}${debouncedSearch ? ` matching "${debouncedSearch}"` : ''}`}
          </p>
        )}

        {/* Ad Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : displayedAds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {isTikTok ? (
              <Flame className="w-12 h-12 text-zinc-600 mb-4" />
            ) : (
              <Facebook className="w-12 h-12 text-zinc-600 mb-4" />
            )}
            <p className="text-zinc-400 text-lg mb-2">
              {showSavedOnly
                ? 'No saved ads yet.'
                : `No ${isTikTok ? 'TikTok' : 'Facebook'} ads found.`}
            </p>
            <p className="text-zinc-500 text-sm max-w-md">
              {showSavedOnly
                ? 'Bookmark ads by clicking the bookmark icon on any ad card.'
                : 'Ads are scraped automatically every few days. Check back after the next scheduled scrape.'}
            </p>
            {showSavedOnly && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowSavedOnly(false)}
              >
                Browse all ads
              </Button>
            )}
            {!showSavedOnly && isTikTok && selectedNiche !== 'all' && (
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
              {displayedAds.map((ad) => (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  onClone={() => handleCloneAd(ad)}
                  onCopyUrl={() => handleCopyUrl(ad)}
                  onToggleSave={() => handleToggleSave(ad)}
                  isCopied={copiedId === ad.tiktok_material_id}
                  isSaved={savedAdIds.has(ad.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {!showSavedOnly && pagination.total > pagination.limit && (
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
  onToggleSave,
  isCopied,
  isSaved,
}: {
  ad: WinningAd;
  onClone: () => void;
  onCopyUrl: () => void;
  onToggleSave: () => void;
  isCopied: boolean;
  isSaved: boolean;
}) {
  const isTikTok = ad.platform === 'tiktok';
  const ctrBadge = isTikTok ? getCtrPercentile(ad.ctr) : null;
  const fresh = isNewAd(ad.date_scraped);
  const daysRunning = getDaysRunning(ad.date_scraped);

  const adUrl = isTikTok
    ? `https://ads.tiktok.com/business/creativecenter/topads/${ad.tiktok_material_id}/pc/en`
    : `https://www.facebook.com/ads/library/?id=${ad.tiktok_material_id}`;

  return (
    <Card className="overflow-hidden border border-border/50 hover:border-border transition-colors flex flex-col">
      {/* Thumbnail */}
      <div
        className="relative aspect-[9/16] bg-zinc-900 max-h-[320px] cursor-pointer group"
        onClick={() => window.open(adUrl, '_blank')}
      >
        {ad.video_cover_url ? (
          <img
            src={ad.video_cover_url}
            alt={ad.ad_title || (isTikTok ? 'TikTok Ad' : 'Facebook Ad')}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isTikTok ? (
              <Flame className="w-8 h-8 text-zinc-700" />
            ) : (
              <Facebook className="w-8 h-8 text-zinc-700" />
            )}
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-200">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Duration badge (TikTok only) */}
        {isTikTok && ad.video_duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(ad.video_duration)}
          </div>
        )}

        {/* "New" badge — top-left */}
        {fresh && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-amber-500/90 text-white text-[10px] border-0 px-1.5">
              New
            </Badge>
          </div>
        )}

        {/* CTR badge — top-right (TikTok only) */}
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
        {/* Title / ad copy */}
        {ad.ad_title && (
          <p className="text-sm font-medium text-white line-clamp-2 mb-2">
            {ad.ad_title}
          </p>
        )}

        {/* Stats row */}
        {isTikTok ? (
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
        ) : (
          <div className="flex items-center gap-3 text-xs text-zinc-400 mb-2">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-400" />
              {daysRunning}d running
            </span>
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-zinc-500" />
              {ad.brand_name ?? 'Facebook'}
            </span>
          </div>
        )}

        {/* Niche tag (TikTok) / platform badge (Facebook) */}
        {isTikTok ? (
          <Badge
            variant="outline"
            className="text-[10px] w-fit mb-3 text-zinc-400 border-zinc-700"
          >
            {ad.niche}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-[10px] w-fit mb-3 text-blue-400 border-blue-900"
          >
            Facebook Ads
          </Badge>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button className="flex-1" size="sm" onClick={onClone}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            {isTikTok ? 'Clone This Ad' : 'View Ad'}
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
          <Button
            variant="outline"
            size="sm"
            className={`px-2.5 ${isSaved ? 'text-amber-400 border-amber-400/40' : ''}`}
            onClick={onToggleSave}
          >
            {isSaved ? (
              <BookmarkCheck className="w-3.5 h-3.5" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
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
