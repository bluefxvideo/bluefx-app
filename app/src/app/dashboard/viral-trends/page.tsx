'use client';

import { TrendingUp, Hash, Heart, Share2, Eye, ExternalLink, Zap, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { FullWidthToolLayout } from '@/components/tools/full-width-tool-layout';
import { getViralTrends, searchTrends } from '@/actions/research/viral-trends';
import { toast } from 'sonner';

interface ViralTrend {
  id: string;
  content: string;
  platform: string;
  hashtags: string[];
  engagement_score: number;
  viral_potential: number;
  trend_strength: number;
  category: string;
  source_url?: string;
  created_at: string;
}

export default function ViralTrendsPage() {
  const [trends, setTrends] = useState<ViralTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 12;

  const loadTrends = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getViralTrends({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        limit: 50
      });
      
      if (result.success) {
        setTrends(result.data || []);
        setTotalCount(result.data?.length || 0);
      } else {
        toast.error(result.error || 'Failed to load viral trends');
      }
    } catch (_error) {
      toast.error('Failed to load viral trends');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadTrends();
  }, [selectedCategory, loadTrends]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await searchTrends(searchQuery);
      
      if (result.success) {
        setTrends(result.data || []);
        setTotalCount(result.data?.length || 0);
        setCurrentPage(1); // Reset to first page on search
        toast.success(`Found ${result.data?.length || 0} trending topics`);
      } else {
        toast.error(result.error || 'Search failed');
      }
    } catch (_error) {
      toast.error('Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getViralityColor = (score: number) => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 60) return 'bg-orange-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getViralityLabel = (score: number) => {
    if (score >= 80) return 'Viral';
    if (score >= 60) return 'Hot';
    if (score >= 40) return 'Rising';
    return 'Emerging';
  };

  const getPlatformIcon = (platform: string) => {
    const iconClass = "w-4 h-4";
    // Always return YouTube icon since we're YouTube-focused
    return <Eye className={iconClass} />;
  };

  const formatEngagement = (score: number) => {
    if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`;
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
    return score.toString();
  };

  return (
    <StandardToolPage
      icon={TrendingUp}
      title="Viral Trends"
      description="Discover trending content across social platforms"
      iconGradient="bg-primary"
    >
      <FullWidthToolLayout>
        {/* Filter Bar - Horizontal */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Search Input */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search trending topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="entertainment">Entertainment</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="lifestyle">Lifestyle</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="news">News</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex gap-2">
            <Button 
              onClick={() => setFilterType('all')} 
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
            >
              All
            </Button>
            <Button 
              onClick={() => setFilterType('trending')} 
              variant={filterType === 'trending' ? 'default' : 'outline'}
              size="sm"
            >
              Trending Now
            </Button>
            <Button 
              onClick={() => setFilterType('viral')} 
              variant={filterType === 'viral' ? 'default' : 'outline'}
              size="sm"
            >
              Most Viral
            </Button>
            <Button 
              onClick={() => setFilterType('recent')} 
              variant={filterType === 'recent' ? 'default' : 'outline'}
              size="sm"
            >
              Recent Added
            </Button>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              onClick={handleSearch} 
              className="bg-primary"
              size="sm"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Search
            </Button>
            <Button 
              onClick={loadTrends} 
              variant="outline"
              size="sm"
            >
              Refresh
            </Button>
          </div>
          
          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4 text-red-500" />
              <span className="text-muted-foreground">Viral:</span>
              <span className="font-bold">{trends.filter(t => t.viral_potential >= 80).length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4 text-green-500" />
              <span className="text-muted-foreground">Avg Eng:</span>
              <span className="font-bold">
                {trends.length > 0 ? Math.round(trends.reduce((sum, t) => sum + t.engagement_score, 0) / trends.length / 1000) : 0}K
              </span>
            </div>
          </div>
        </div>
              
        
        {/* Results Panel - Full Width */}
        <div className="h-full overflow-y-auto scrollbar-hover">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Viral Content</h2>
              <Badge variant="outline">{trends.length} trends</Badge>
            </div>
                  
            
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bg-card rounded-lg shadow-md overflow-hidden animate-pulse">
                    {/* Video Thumbnail Section */}
                    <div className="h-48 bg-muted relative">
                      {/* Platform Badge */}
                      <div className="absolute top-2 left-2">
                        <div className="h-6 bg-muted rounded w-16"></div>
                      </div>
                      {/* Virality Badge */}
                      <div className="absolute top-2 right-2">
                        <div className="h-6 bg-muted rounded w-12"></div>
                      </div>
                      {/* Category Badge */}
                      <div className="absolute bottom-2 right-2">
                        <div className="h-6 bg-muted rounded w-20"></div>
                      </div>
                    </div>
                    
                    {/* Content Section */}
                    <div className="p-4">
                      {/* Title */}
                      <div className="h-5 bg-muted rounded w-full mb-2"></div>
                      <div className="h-5 bg-muted rounded w-3/4 mb-4"></div>
                      
                      {/* Creator Info */}
                      <div className="h-3 bg-muted rounded w-24 mb-3"></div>
                      
                      {/* Hashtags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        <div className="h-6 bg-muted rounded w-16"></div>
                        <div className="h-6 bg-muted rounded w-20"></div>
                        <div className="h-6 bg-muted rounded w-14"></div>
                        <div className="h-6 bg-muted rounded w-18"></div>
                      </div>
                      
                      {/* Engagement Metrics */}
                      <div className="flex justify-between text-sm mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="h-4 bg-muted rounded w-12"></div>
                          <div className="h-4 bg-muted rounded w-10"></div>
                          <div className="h-4 bg-muted rounded w-10"></div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <div className="h-8 bg-muted rounded flex-1"></div>
                        <div className="h-8 bg-muted rounded w-8"></div>
                        <div className="h-8 bg-muted rounded w-12"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : trends.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Trends Found</h3>
                <p className="text-muted-foreground">
                  Search for topics to discover trending content
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trends.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((trend) => (
                  <div
                    key={trend.id}
                    className="bg-card rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Video Thumbnail Section */}
                    <div className="h-48 bg-gray-300 dark:bg-gray-700 relative group">
                      {trend.source_url ? (
                        <a
                          href={trend.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-full"
                        >
                          {/* YouTube Thumbnail */}
                          <img
                            src={`https://img.youtube.com/vi/${trend.id}/maxresdefault.jpg`}
                            alt={trend.content}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              // Fallback to default thumbnail if maxres fails
                              e.currentTarget.src = `https://img.youtube.com/vi/${trend.id}/hqdefault.jpg`;
                            }}
                          />
                          {/* Duration Overlay */}
                          <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded">
                            {trend.duration || '0:00'}
                          </div>
                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-40 transition-opacity duration-300"></div>
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="bg-white dark:bg-gray-800 p-2 rounded-full">
                              <div className="w-8 h-8 text-red-600 flex items-center justify-center">
                                <div className="w-0 h-0 border-l-[12px] border-l-red-600 border-y-[8px] border-y-transparent ml-1"></div>
                              </div>
                            </div>
                          </div>
                        </a>
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <div className="text-gray-500 dark:text-gray-400 text-center">
                            <Eye className="w-16 h-16 mx-auto mb-2 opacity-60" />
                            <p className="text-sm">YouTube Video</p>
                          </div>
                        </div>
                      )}
                      
                      {/* YouTube Badge */}
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-red-600 text-white text-xs border-0">
                          <div className="flex items-center gap-1">
                            {getPlatformIcon('youtube')}
                            YouTube
                          </div>
                        </Badge>
                      </div>
                      
                      {/* Engagement Badge */}
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-green-600 text-white text-xs border-0">
                          {trend.engagement_score ? `${Math.round(trend.engagement_score / 1000)}K views` : 'Viral'}
                        </Badge>
                      </div>
                      
                      {/* Category Badge */}
                      <div className="absolute bottom-2 right-2">
                        <Badge className="bg-blue-600 text-white text-xs border-0">
                          {trend.category}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Content Section */}
                    <div className="p-4">
                      {/* Title */}
                      <h3 className="text-lg font-bold line-clamp-2 mb-2">
                        {trend.content}
                      </h3>
                      
                      {/* Creator Info */}
                      <div className="flex items-center text-sm text-muted-foreground mb-3">
                        <span className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                          @{trend.creator || 'Unknown Creator'}
                        </span>
                        <span className="mx-2">•</span>
                        <span>{new Date(trend.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {trend.hashtags?.slice(0, 4).map((hashtag, index) => (
                          <span
                            key={index}
                            className="inline-block px-2 py-1 text-xs bg-muted rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
                            onClick={() => setSearchQuery(hashtag)}
                          >
                            {hashtag}
                          </span>
                        ))}
                        {trend.hashtags && trend.hashtags.length > 4 && (
                          <span className="inline-block px-2 py-1 text-xs bg-muted rounded-full">
                            +{trend.hashtags.length - 4} more
                          </span>
                        )}
                      </div>
                      
                      {/* Engagement Metrics */}
                      <div className="flex justify-between text-sm text-muted-foreground mb-4">
                        <div className="flex items-center space-x-4">
                          <span className="flex items-center">
                            <Eye className="w-4 h-4 mr-1" />
                            {trend.views || formatEngagement(trend.engagement_score)}
                          </span>
                          <span className="flex items-center">
                            <Heart className="w-4 h-4 mr-1" />
                            {trend.likes || Math.round((trend.engagement_score || 0) * 0.1)}
                          </span>
                          <span className="flex items-center">
                            <Share2 className="w-4 h-4 mr-1" />
                            {trend.comments || Math.round((trend.engagement_score || 0) * 0.02)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex justify-between">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              if (trend.source_url) {
                                navigator.clipboard.writeText(trend.source_url);
                                toast.success('Link copied!');
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                          >
                            Share
                          </button>
                        </div>
                        {trend.source_url && (
                          <a
                            href={trend.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                          >
                            Watch
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                </div>
                
                {/* Pagination */}
                {trends.length > itemsPerPage && (
                  <div className="flex items-center justify-between px-6 py-4 mt-6 bg-card rounded-lg border">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, trends.length)} of {trends.length} trends
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.ceil(trends.length / itemsPerPage) }).map((_, i) => {
                          const page = i + 1;
                          if (
                            page === 1 ||
                            page === Math.ceil(trends.length / itemsPerPage) ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <Button
                                key={page}
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                                className="w-8 h-8 p-0"
                              >
                                {page}
                              </Button>
                            );
                          } else if (
                            page === currentPage - 2 ||
                            page === currentPage + 2
                          ) {
                            return <span key={page} className="text-muted-foreground">...</span>;
                          }
                          return null;
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(trends.length / itemsPerPage), prev + 1))}
                        disabled={currentPage === Math.ceil(trends.length / itemsPerPage)}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </FullWidthToolLayout>
    </StandardToolPage>
  );
}