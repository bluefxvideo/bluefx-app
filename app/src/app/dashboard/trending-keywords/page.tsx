'use client';

import { Search, TrendingUp, BarChart3, Target, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { FullWidthToolLayout } from '@/components/tools/full-width-tool-layout';
import { getTrendingKeywords, searchKeywords } from '@/actions/research/trending-keywords';
import { toast } from 'sonner';

interface Keyword {
  id: string;
  keyword: string;
  search_volume: number | null;
  difficulty_score: number | null;
  competition_level: string | null;
  cost_per_click: number | null;
  current_rank: number | null;
  target_rank: number | null;
  target_page_url: string | null;
  category: string | null;
  is_active: boolean | null;
  last_checked_at: string | null;
}

export default function TrendingKeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('search_volume');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;

  const loadKeywords = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getTrendingKeywords({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        sort_by: sortBy as 'search_volume' | 'difficulty_score' | 'cost_per_click',
        limit: 50
      });
      
      if (result.success) {
        setKeywords((result.data || []).map(keyword => ({
          ...keyword,
          target_page_url: null // Add missing field with default value
        })));
        setTotalCount(result.total_count || 0);
      } else {
        toast.error(result.error || 'Failed to load keywords');
      }
    } catch (_error) {
      toast.error('Failed to load trending keywords');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, sortBy]);

  useEffect(() => {
    loadKeywords();
  }, [selectedCategory, sortBy, loadKeywords]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await searchKeywords(searchQuery);
      
      if (result.success) {
        setKeywords((result.data || []).map(keyword => ({
          ...keyword,
          target_page_url: null // Add missing field with default value
        })));
        setTotalCount(result.total_count || 0);
        setCurrentPage(1); // Reset to first page on search
        toast.success(`Found ${result.data?.length || 0} keywords`);
      } else {
        toast.error(result.error || 'Search failed');
      }
    } catch (_error) {
      toast.error('Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getDifficultyColor = (score: number | null) => {
    if (!score) return 'bg-gray-500';
    if (score <= 30) return 'bg-green-500';
    if (score <= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getDifficultyLabel = (score: number | null) => {
    if (!score) return 'Unknown';
    if (score <= 30) return 'Easy';
    if (score <= 60) return 'Medium';
    return 'Hard';
  };

  const formatSearchVolume = (volume: number | null) => {
    if (!volume) return 'N/A';
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  return (
    <StandardToolPage
      icon={Search}
      title="Trending Keywords"
      description="Discover high-performing keywords for better SEO rankings"
      iconGradient="bg-primary"
    >
      <FullWidthToolLayout>
        {/* Filter Bar - Horizontal */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Search Input */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search for keywords or topics..."
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
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="lifestyle">Lifestyle</SelectItem>
                <SelectItem value="education">Education</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="search_volume">Search Volume</SelectItem>
                <SelectItem value="difficulty_score">Difficulty</SelectItem>
                <SelectItem value="cost_per_click">Cost per Click</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              onClick={handleSearch} 
              className="bg-primary"
              size="sm"
            >
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
            <Button 
              onClick={loadKeywords} 
              variant="outline"
              size="sm"
            >
              Refresh
            </Button>
          </div>
          
          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold">{keywords.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Easy:</span>
              <span className="font-bold">
                {keywords.filter(k => (k.difficulty_score || 100) <= 30).length}
              </span>
            </div>
          </div>
        </div>
        
        {/* Results Panel - Full Width */}
        <div className="h-full overflow-y-auto scrollbar-hover">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Keyword Results</h2>
              <Badge variant="outline">{keywords.length} found</Badge>
            </div>
            
            {isLoading ? (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          <div className="flex items-center">
                            Keyword
                            <BarChart3 className="ml-1 h-4 w-4" />
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          <div className="flex items-center">
                            Search Volume
                            <TrendingUp className="ml-1 h-4 w-4" />
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          <div className="flex items-center">
                            Difficulty
                            <Target className="ml-1 h-4 w-4" />
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Trend
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          <div className="flex items-center">
                            CPC ($)
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Competition
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {[...Array(10)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded-full mr-2"></div>
                              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
                            </div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 mt-1"></div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded mr-1"></div>
                              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-10"></div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : keywords.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Keywords Found</h3>
                <p className="text-muted-foreground">
                  Search for keywords to start your research
                </p>
              </div>
            ) : (
              /* Keywords Table */
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/70">
                          <div className="flex items-center">
                            Keyword
                            <BarChart3 className="ml-1 h-4 w-4" />
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/70">
                          <div className="flex items-center">
                            Search Volume
                            <TrendingUp className="ml-1 h-4 w-4" />
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/70">
                          <div className="flex items-center">
                            Difficulty
                            <Target className="ml-1 h-4 w-4" />
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Trend
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/70">
                          <div className="flex items-center">
                            CPC ($)
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Competition
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {keywords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((keyword) => (
                        <tr
                          key={keyword.id}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-foreground">
                              {keyword.keyword}
                            </div>
                            {keyword.category && (
                              <div className="text-sm text-muted-foreground">
                                {keyword.category}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-foreground">
                            <div className="font-medium">
                              {formatSearchVolume(keyword.search_volume)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              monthly searches
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-2 w-24 bg-muted rounded-full overflow-hidden mr-2">
                                <div
                                  className={`h-full transition-all duration-500 ${getDifficultyColor(keyword.difficulty_score)}`}
                                  style={{ 
                                    width: `${keyword.difficulty_score || 0}%` 
                                  }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium">
                                {keyword.difficulty_score || 'N/A'}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {getDifficultyLabel(keyword.difficulty_score)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex items-center text-primary">
                                <TrendingUp className="h-4 w-4 mr-1" />
                                <span className="text-sm font-medium">Rising</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-foreground">
                            <div className="font-medium">
                              {keyword.cost_per_click ? `$${keyword.cost_per_click.toFixed(2)}` : 'N/A'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              avg cost
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge 
                              variant={
                                keyword.competition_level === 'high' ? 'destructive' :
                                keyword.competition_level === 'medium' ? 'secondary' : 'default'
                              }
                              className="text-xs"
                            >
                              {keyword.competition_level || 'Low'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:text-primary/80"
                              >
                                Analyze
                              </Button>
                              <Button
                                variant="ghost" 
                                size="sm"
                                className="text-primary hover:text-primary/80"
                              >
                                Track
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {keywords.length > itemsPerPage && (
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, keywords.length)} of {keywords.length} keywords
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
                        {Array.from({ length: Math.ceil(keywords.length / itemsPerPage) }).map((_, i) => {
                          const page = i + 1;
                          if (
                            page === 1 ||
                            page === Math.ceil(keywords.length / itemsPerPage) ||
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
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(keywords.length / itemsPerPage), prev + 1))}
                        disabled={currentPage === Math.ceil(keywords.length / itemsPerPage)}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </FullWidthToolLayout>
    </StandardToolPage>
  );
}