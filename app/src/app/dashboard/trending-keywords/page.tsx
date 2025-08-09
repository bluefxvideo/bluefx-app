'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, TrendingUp, BarChart3, DollarSign, Target, ExternalLink } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { getTrendingKeywords, searchKeywords } from '@/actions/research/trending-keywords';
import { toast } from 'sonner';
import { UniformToolLayout } from '@/components/tools/uniform-tool-layout';

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
    <div className="h-full flex flex-col">
      {/* Professional Workspace Container */}
      <div className="flex-1 overflow-hidden m-3 ml-0">
        <div className="h-full bg-card rounded-2xl p-6">
          <UniformToolLayout>
            {/* Left Panel - Branding, Search & Filters */}
            <div className="h-full space-y-6 overflow-y-auto scrollbar-hover">
              {/* Tool Branding */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Trending Keywords</h1>
                  <p className="text-sm text-muted-foreground">
                    Discover high-performing keywords for better SEO rankings
                  </p>
                </div>
              </div>
              
              <div className="border-t border-border/50"></div>
                {/* Search Input */}
                <div className="space-y-4">
                  <h3 className="font-medium">Keyword Research</h3>
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
                  <Button 
                    onClick={handleSearch} 
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Search Keywords
                  </Button>
                </div>

                {/* Filters */}
                <div className="space-y-4">
                  <h3 className="font-medium">Filters</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Category</label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger>
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
                    </div>
                    
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Sort By</label>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="search_volume">Search Volume</SelectItem>
                          <SelectItem value="difficulty_score">Difficulty</SelectItem>
                          <SelectItem value="cost_per_click">Cost per Click</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="space-y-4">
                  <h3 className="font-medium">Quick Stats</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="p-3 bg-gray-50 dark:bg-gray-800/30">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-lg font-bold">{keywords.length}</p>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-3 bg-gray-50 dark:bg-gray-800/30">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Easy</p>
                          <p className="text-lg font-bold">
                            {keywords.filter(k => (k.difficulty_score || 100) <= 30).length}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
              
              {/* Right Panel - Results */}
              <div className="h-full overflow-y-auto scrollbar-hover">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <h2 className="text-lg font-semibold">Keyword Results</h2>
                    <Badge variant="outline">{keywords.length} found</Badge>
                  </div>
                  
                  {isLoading ? (
                    <div className="space-y-4">
                      {[...Array(8)].map((_, i) => (
                        <Card key={i} className="p-4 animate-pulse">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                          <div className="flex gap-2">
                            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : keywords.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Keywords Found</h3>
                      <p className="text-muted-foreground">
                        Search for keywords to start your research
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {keywords.map((keyword) => (
                        <Card key={keyword.id} className="p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800/40">
                          <div className="space-y-3">
                            {/* Keyword Header */}
                            <div className="flex items-start justify-between">
                              <h3 className="font-semibold">{keyword.keyword}</h3>
                              <Badge 
                                className={`${getDifficultyColor(keyword.difficulty_score)} text-white text-xs`}
                              >
                                {getDifficultyLabel(keyword.difficulty_score)}
                              </Badge>
                            </div>
                            
                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="flex items-center gap-1">
                                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Volume:</span>
                                <span className="font-medium">{formatSearchVolume(keyword.search_volume)}</span>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <DollarSign className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">CPC:</span>
                                <span className="font-medium">
                                  {keyword.cost_per_click ? `$${keyword.cost_per_click.toFixed(2)}` : 'N/A'}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <Target className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Rank:</span>
                                <span className="font-medium">
                                  {keyword.current_rank || 'Unranked'}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Target:</span>
                                <span className="font-medium">
                                  {keyword.target_rank || 'Not set'}
                                </span>
                              </div>
                            </div>
                            
                            {/* Category & Actions */}
                            <div className="flex items-center justify-between">
                              {keyword.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {keyword.category}
                                </Badge>
                              )}
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                  Track
                                </Button>
                                {keyword.target_page_url && (
                                  <Button variant="outline" size="sm">
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </UniformToolLayout>
        </div>
      </div>
    </div>
  );
}