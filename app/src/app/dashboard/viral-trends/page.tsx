'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Hash, Heart, Share2, Eye, Calendar, ExternalLink, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getViralTrends, searchTrends, analyzeTrendPotential } from '@/actions/research/viral-trends';
import { toast } from 'sonner';
import { UniformToolLayout } from '@/components/tools/uniform-tool-layout';

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
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadTrends();
  }, [selectedPlatform, selectedCategory]);

  const loadTrends = async () => {
    setIsLoading(true);
    try {
      const result = await getViralTrends({
        platform: selectedPlatform === 'all' ? undefined : selectedPlatform,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        limit: 50
      });
      
      if (result.success) {
        setTrends(result.data || []);
      } else {
        toast.error(result.error || 'Failed to load viral trends');
      }
    } catch (error) {
      toast.error('Failed to load viral trends');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await searchTrends(searchQuery);
      
      if (result.success) {
        setTrends(result.data || []);
        toast.success(`Found ${result.data?.length || 0} trending topics`);
      } else {
        toast.error(result.error || 'Search failed');
      }
    } catch (error) {
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
    switch (platform.toLowerCase()) {
      case 'tiktok': return <TrendingUp className={iconClass} />;
      case 'instagram': return <Heart className={iconClass} />;
      case 'twitter': return <Share2 className={iconClass} />;
      case 'youtube': return <Eye className={iconClass} />;
      default: return <TrendingUp className={iconClass} />;
    }
  };

  const formatEngagement = (score: number) => {
    if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`;
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
    return score.toString();
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
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Viral Trends</h1>
                  <p className="text-sm text-muted-foreground">
                    Discover trending content across social platforms
                  </p>
                </div>
              </div>
              
              <div className="border-t border-border/50"></div>
                {/* Search Input */}
                <div className="space-y-4">
                  <h3 className="font-medium">Trend Analysis</h3>
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
                  <Button 
                    onClick={handleSearch} 
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Analyze Trends
                  </Button>
                </div>

                {/* Platform Filter */}
                <div className="space-y-4">
                  <h3 className="font-medium">Platform</h3>
                  <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                    <SelectTrigger>
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="twitter">Twitter</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category Filter */}
                <div className="space-y-4">
                  <h3 className="font-medium">Category</h3>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
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

                {/* Trending Hashtags Preview */}
                <div className="space-y-4">
                  <h3 className="font-medium">Hot Hashtags</h3>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(trends.flatMap(t => t.hashtags))).slice(0, 8).map((hashtag, index) => (
                      <Badge 
                        key={index} 
                        variant="outline" 
                        className="cursor-pointer hover:bg-purple-50 transition-colors text-xs"
                        onClick={() => setSearchQuery(hashtag)}
                      >
                        <Hash className="w-3 h-3 mr-1" />
                        {hashtag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="space-y-4">
                  <h3 className="font-medium">Analytics</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="p-3 bg-gray-50 dark:bg-gray-800/30">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-red-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Viral</p>
                          <p className="text-lg font-bold">
                            {trends.filter(t => t.viral_potential >= 80).length}
                          </p>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-3 bg-gray-50 dark:bg-gray-800/30">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Avg Eng</p>
                          <p className="text-lg font-bold">
                            {trends.length > 0 ? Math.round(trends.reduce((sum, t) => sum + t.engagement_score, 0) / trends.length / 1000) : 0}K
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
              
              {/* Right Panel - Trending Content */}
              <div className="h-full overflow-y-auto scrollbar-hover">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-500" />
                    <h2 className="text-lg font-semibold">Viral Content</h2>
                    <Badge variant="outline">{trends.length} trends</Badge>
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
                  ) : trends.length === 0 ? (
                    <div className="text-center py-12">
                      <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Trends Found</h3>
                      <p className="text-muted-foreground">
                        Search for topics to discover trending content
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {trends.map((trend) => (
                        <Card key={trend.id} className="p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800/40">
                          <div className="space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {getPlatformIcon(trend.platform)}
                                <Badge variant="outline" className="text-xs">
                                  {trend.platform}
                                </Badge>
                              </div>
                              <Badge 
                                className={`${getViralityColor(trend.viral_potential)} text-white text-xs`}
                              >
                                {getViralityLabel(trend.viral_potential)}
                              </Badge>
                            </div>
                            
                            {/* Content Preview */}
                            <p className="text-sm font-medium line-clamp-2">
                              {trend.content}
                            </p>
                            
                            {/* Hashtags */}
                            <div className="flex flex-wrap gap-1">
                              {trend.hashtags.slice(0, 3).map((hashtag, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  <Hash className="w-3 h-3 mr-1" />
                                  {hashtag}
                                </Badge>
                              ))}
                              {trend.hashtags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{trend.hashtags.length - 3}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Metrics */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Engagement:</span>
                                <span className="font-medium ml-2">
                                  {formatEngagement(trend.engagement_score)}
                                </span>
                              </div>
                              
                              <div>
                                <span className="text-muted-foreground">Strength:</span>
                                <span className="font-medium ml-2">
                                  {trend.trend_strength}%
                                </span>
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                              <Button variant="outline" size="sm" className="flex-1">
                                Use in Content
                              </Button>
                              {trend.source_url && (
                                <Button variant="outline" size="sm">
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              )}
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