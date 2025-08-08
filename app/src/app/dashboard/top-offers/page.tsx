'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DollarSign, TrendingUp, ExternalLink, Award, Percent, Users, ArrowUp, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getTopOffers, searchOffers, getOfferCategories } from '@/actions/research/top-offers';
import { toast } from 'sonner';
import { UniformToolLayout } from '@/components/tools/uniform-tool-layout';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, CartesianGrid } from 'recharts';

interface ClickBankOffer {
  id: string;
  clickbank_id: string;
  title: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  vendor_name: string;
  gravity_score: number;
  commission_rate: number | null;
  average_dollar_per_sale: number | null;
  initial_dollar_per_sale: number | null;
  refund_rate: number | null;
  has_recurring_products: boolean | null;
  mobile_optimized: boolean | null;
  affiliate_page_url: string | null;
  sales_page_url: string | null;
  is_active: boolean | null;
  created_at: string | null;
  // Historical trend data
  clickbank_history?: {
    max_gravity: number;
    min_gravity: number;
    avg_gravity: number;
    gravity_change: number;
    data_points: number;
    daily_data?: any;
  }[];
}

export default function TopOffersPage() {
  const [offers, setOffers] = useState<ClickBankOffer[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('gravity_score');
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState<'current' | 'weekly' | 'monthly'>('current');
  const PAGE_SIZE = 50;

  useEffect(() => {
    loadOffers(true);
    loadCategories();
  }, [selectedCategory, sortBy]);

  // Infinite scroll effect
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.scrollTop + target.clientHeight >= target.scrollHeight - 100) {
        if (!isLoadingMore && hasMore) {
          loadOffers(false);
        }
      }
    };

    const scrollContainer = document.querySelector('.offers-scroll-container');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [isLoadingMore, hasMore]);

  const loadOffers = async (reset = true) => {
    if (reset) {
      setIsLoading(true);
      setCurrentPage(0);
      setOffers([]);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const page = reset ? 0 : currentPage + 1;
      const result = await getTopOffers({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        sort_by: sortBy as 'gravity_score' | 'commission_rate' | 'average_dollar_per_sale',
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE
      });
      
      if (result.success) {
        const newOffers = result.data || [];
        setTotalCount(result.total_count || 0);
        
        if (reset) {
          setOffers(newOffers);
        } else {
          setOffers(prev => [...prev, ...newOffers]);
        }
        
        setCurrentPage(page);
        setHasMore(newOffers.length === PAGE_SIZE && ((page + 1) * PAGE_SIZE) < (result.total_count || 0));
        
        // Show scroll-to-top after first batch is loaded
        if (!reset && page > 0) {
          setShowScrollTop(true);
        }
      } else {
        toast.error(result.error || 'Failed to load offers');
      }
    } catch (error) {
      toast.error('Failed to load top offers');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };


  const loadCategories = async () => {
    try {
      const result = await getOfferCategories();
      if (result.success) {
        setCategories(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await searchOffers(searchQuery);
      
      if (result.success) {
        setOffers(result.data || []);
        toast.success(`Found ${result.data?.length || 0} offers`);
      } else {
        toast.error(result.error || 'Search failed');
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getGravityColor = (score: number) => {
    if (score >= 100) return 'bg-red-500';
    if (score >= 50) return 'bg-orange-500';
    if (score >= 20) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getGravityLabel = (score: number) => {
    if (score >= 100) return 'Hot';
    if (score >= 50) return 'Popular';
    if (score >= 20) return 'Active';
    return 'New';
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return `$${amount.toFixed(2)}`;
  };

  const formatPercentage = (rate: number | null) => {
    if (!rate) return 'N/A';
    return `${(rate * 100).toFixed(0)}%`;
  };

  const getChartData = (offer: ClickBankOffer, timeframe: 'current' | 'weekly' | 'monthly') => {
    const hist = offer.clickbank_history?.[0];
    if (!hist) return { data: [], stats: null };

    // Use real daily data if available
    if (hist.daily_data) {
      try {
        let dailyData = hist.daily_data;
        while (typeof dailyData === 'string') {
          dailyData = JSON.parse(dailyData);
        }
        
        if (Array.isArray(dailyData) && dailyData.length > 0) {
          const allData = dailyData
            .filter(point => point.gravity_score && point.recorded_at)
            .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
          
          let selectedData = [];
          
          if (timeframe === 'current') {
            // Last 7 days (not 30)
            selectedData = allData.slice(-7);
            // Take 3 points: start, middle, end of last 7 days
            if (selectedData.length >= 3) {
              selectedData = [
                selectedData[0],
                selectedData[Math.floor(selectedData.length / 2)],
                selectedData[selectedData.length - 1]
              ];
            }
          } else if (timeframe === 'weekly') {
            // Group by weeks, take 4 points over last 4 weeks
            const weeksToShow = 4;
            const dataPerWeek = Math.floor(allData.length / weeksToShow);
            
            for (let i = 0; i < weeksToShow; i++) {
              const weekIndex = i * dataPerWeek;
              if (weekIndex < allData.length) {
                selectedData.push(allData[weekIndex]);
              }
            }
          } else {
            // Monthly: 3 points over 3 months
            const monthsToShow = 3;
            const dataPerMonth = Math.floor(allData.length / monthsToShow);
            
            for (let i = 0; i < monthsToShow; i++) {
              const monthIndex = i * dataPerMonth;
              if (monthIndex < allData.length) {
                selectedData.push(allData[monthIndex]);
              }
            }
          }
          
          if (selectedData.length > 0) {
            const chartData = selectedData.map(point => ({ value: point.gravity_score, date: point.recorded_at }));
            
            // Calculate stats for this timeframe
            const values = selectedData.map(p => p.gravity_score);
            const maxValue = Math.max(...values);
            const minValue = Math.min(...values);
            const firstValue = values[0];
            const lastValue = values[values.length - 1];
            const change = lastValue - firstValue;
            
            return {
              data: chartData,
              stats: {
                dataPoints: selectedData.length,
                maxGravity: maxValue,
                minGravity: minValue,
                gravityChange: change,
                isPositive: change >= 0
              }
            };
          }
        }
      } catch {
        // Silent fallback
      }
    }
    
    // Fallback to interpolated data
    const gravityChange = hist.gravity_change || 0;
    const minGrav = hist.min_gravity || offer.gravity_score;
    const maxGrav = hist.max_gravity || offer.gravity_score;
    
    const points = [];
    const numPoints = timeframe === 'current' ? 3 : timeframe === 'weekly' ? 4 : 3;
    
    for (let i = 0; i < numPoints; i++) {
      const progress = i / (numPoints - 1);
      const baseValue = gravityChange > 0 
        ? minGrav + (maxGrav - minGrav) * progress
        : gravityChange < -10 
          ? maxGrav - (maxGrav - minGrav) * progress
          : offer.gravity_score;
      
      const variation = (Math.sin(i * 0.5) + Math.cos(i * 0.3)) * baseValue * 0.02;
      points.push({ value: Math.max(0, baseValue + variation), date: `Point ${i + 1}` });
    }
    
    return {
      data: points,
      stats: {
        dataPoints: hist.data_points,
        maxGravity: hist.max_gravity,
        minGravity: hist.min_gravity,
        gravityChange: gravityChange,
        isPositive: gravityChange >= 0
      }
    };
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
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Top Offers</h1>
                  <p className="text-sm text-muted-foreground">
                    Find high-converting ClickBank affiliate offers
                  </p>
                </div>
              </div>
              
              <div className="border-t border-border/50"></div>
                {/* Search Input */}
                <div className="space-y-4">
                  <h3 className="font-medium">Offer Research</h3>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search offers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-10"
                    />
                  </div>
                  <Button 
                    onClick={handleSearch} 
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Search Offers
                  </Button>
                </div>

                {/* Filters */}
                <div className="space-y-4">
                  <h3 className="font-medium">Filters</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Category Filter */}
                    <div>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map(category => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sort Filter */}
                    <div>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gravity_score">Gravity Score</SelectItem>
                          <SelectItem value="commission_rate">Commission Rate</SelectItem>
                          <SelectItem value="average_dollar_per_sale">Average Sale</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Performance Insights */}
                <div className="space-y-4">
                  <h3 className="font-medium">Performance</h3>
                  <div className="space-y-3">
                    <Card className="p-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">High Performers</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {offers.filter(o => o.gravity_score >= 50).length}
                          </p>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-3 bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800/50">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <div>
                          <p className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">Recurring</p>
                          <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                            {offers.filter(o => o.has_recurring_products).length}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="space-y-4">
                  <h3 className="font-medium">Quick Stats</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="p-3 bg-gray-50 dark:bg-gray-800/30">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-lg font-bold">{totalCount.toLocaleString()}</p>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-3 bg-gray-50 dark:bg-gray-800/30">
                      <div className="flex items-center gap-2">
                        <Percent className="w-4 h-4 text-cyan-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Avg Com</p>
                          <p className="text-lg font-bold">
                            {offers.length > 0 ? 
                              Math.round((offers.reduce((sum, o) => sum + (o.commission_rate || 0), 0) / offers.length) * 100) : 0}%
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
              
              {/* Right Panel - Offers List */}
              <div className="h-full overflow-y-auto scrollbar-hover offers-scroll-container">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-lg font-semibold">ClickBank Offers</h2>
                    <Badge variant="outline">{totalCount.toLocaleString()} total • {offers.length} loaded</Badge>
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
                  ) : offers.length === 0 ? (
                    <div className="text-center py-12">
                      <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Offers Found</h3>
                      <p className="text-muted-foreground">
                        Search for offers to discover top products
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {offers.map((offer) => (
                        <Card key={offer.id} className="p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800/40">
                          <div className="space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold text-sm line-clamp-2">
                                  {offer.title}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                  by {offer.vendor_name}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  className={`${getGravityColor(offer.gravity_score)} text-white text-xs`}
                                >
                                  {getGravityLabel(offer.gravity_score)}
                                </Badge>
                              </div>
                            </div>
                            
                            {/* Description */}
                            {offer.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {offer.description}
                              </p>
                            )}
                            
                            {/* Metrics Grid + Chart Section */}
                            <div className="flex gap-4">
                              {/* Metrics Grid - 70% */}
                              <div className="flex-[0.7]">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Gravity:</span>
                                    <span className="font-medium ml-2">
                                      {offer.gravity_score.toFixed(1)}
                                    </span>
                                  </div>
                                  
                                  <div>
                                    <span className="text-muted-foreground">Commission:</span>
                                    <span className="font-medium ml-2">
                                      {formatPercentage(offer.commission_rate)}
                                    </span>
                                  </div>
                                  
                                  <div>
                                    <span className="text-muted-foreground">Avg Sale:</span>
                                    <span className="font-medium ml-2">
                                      {formatCurrency(offer.average_dollar_per_sale)}
                                    </span>
                                  </div>
                                  
                                  <div>
                                    <span className="text-muted-foreground">Refund:</span>
                                    <span className="font-medium ml-2">
                                      {formatPercentage(offer.refund_rate)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Trend Chart Card - 30% */}
                              <div className="flex-[0.3]">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <div className="h-16 flex items-center cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/30 transition-colors relative group rounded-lg p-1">
                                      {/* Hover chart icon */}
                                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <BarChart3 className="w-3 h-3 text-muted-foreground" />
                                      </div>
                                      <div className="w-full h-20 mt-6">
                                        {offer.clickbank_history?.[0] ? (
                                          (() => {
                                            const miniChartResult = getChartData(offer, 'current');
                                            const isPositive = miniChartResult.stats?.isPositive ?? false;
                                            
                                            return (
                                              <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={miniChartResult.data} style={{ cursor: 'pointer' }}>
                                                  <CartesianGrid 
                                                    strokeDasharray="0" 
                                                    stroke="#374151" 
                                                    strokeWidth={0.5}
                                                    vertical={true}
                                                    horizontal={false}
                                                  />
                                                  <XAxis 
                                                    axisLine={{ stroke: '#374151', strokeWidth: 0.5 }}
                                                    tickLine={false}
                                                    tick={false}
                                                  />
                                                  <YAxis 
                                                    domain={['dataMin', 'dataMax']} 
                                                    width={30}
                                                    tick={{ fontSize: 8, fill: '#9ca3af' }}
                                                    axisLine={{ stroke: '#374151', strokeWidth: 0.5 }}
                                                    tickLine={false}
                                                    tickCount={2}
                                                  />
                                                  <Tooltip 
                                                    content={({ active, payload }) => {
                                                      if (active && payload && payload.length) {
                                                        return (
                                                          <div className="bg-black/80 text-white px-2 py-1 rounded text-xs font-medium">
                                                            {payload[0].value?.toFixed(1)}
                                                          </div>
                                                        );
                                                      }
                                                      return null;
                                                    }}
                                                  />
                                                  <Line 
                                                    type="linear" 
                                                    dataKey="value" 
                                                    stroke={isPositive ? '#10b981' : '#ef4444'}
                                                    strokeWidth={2}
                                                    dot={{ fill: isPositive ? '#10b981' : '#ef4444', strokeWidth: 0, r: 3 }}
                                                    activeDot={false}
                                                    fill={isPositive ? '#10b981' : '#ef4444'}
                                                    fillOpacity={0.1}
                                                  />
                                                </LineChart>
                                              </ResponsiveContainer>
                                            );
                                          })()
                                        ) : (
                                          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                                            No trend data
                                          </div>
                                        )}
                                      </div>
                                      
                                    </div>
                                  </DialogTrigger>
                                  
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5" />
                                        {offer.title} - Gravity Trend Analysis
                                      </DialogTitle>
                                    </DialogHeader>
                                    
                                    {/* Time Period Controls & Links */}
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex gap-2">
                                      <Button
                                        variant={chartTimeframe === 'current' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setChartTimeframe('current')}
                                      >
                                        Current (7d)
                                      </Button>
                                      <Button
                                        variant={chartTimeframe === 'weekly' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setChartTimeframe('weekly')}
                                      >
                                        Weekly
                                      </Button>
                                        <Button
                                          variant={chartTimeframe === 'monthly' ? 'default' : 'outline'}
                                          size="sm"
                                          onClick={() => setChartTimeframe('monthly')}
                                        >
                                          Monthly
                                        </Button>
                                      </div>
                                      
                                      <div className="flex gap-2">
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => {
                                            const affiliateUrl = `https://hop.clickbank.net/?affiliate=${offer.clickbank_id}`;
                                            navigator.clipboard.writeText(affiliateUrl);
                                            toast.success('Affiliate link copied to clipboard!');
                                          }}
                                        >
                                          Get Link
                                        </Button>
                                        {(offer.sales_page_url || offer.affiliate_page_url) && (
                                          <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => {
                                              const url = offer.sales_page_url || offer.affiliate_page_url;
                                              if (url) {
                                                window.open(url, '_blank', 'noopener,noreferrer');
                                              }
                                            }}
                                          >
                                            <ExternalLink className="w-4 h-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Expanded Chart */}
                                    <div className="h-80 w-full">
                                      {(() => {
                                        const chartResult = getChartData(offer, chartTimeframe);
                                        const isPositive = chartResult.stats?.isPositive ?? false;
                                        
                                        return (
                                          <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartResult.data}>
                                              <YAxis domain={['dataMin', 'dataMax']} />
                                              <Line 
                                                type="linear" 
                                                dataKey="value" 
                                                stroke={isPositive ? '#10b981' : '#ef4444'}
                                                strokeWidth={3}
                                                dot={{ fill: isPositive ? '#10b981' : '#ef4444', strokeWidth: 0, r: 4 }}
                                                fill={isPositive ? '#10b981' : '#ef4444'}
                                                fillOpacity={0.1}
                                                label={{ 
                                                  fontSize: 12, 
                                                  fill: '#ffffff', 
                                                  offset: 15,
                                                  style: { 
                                                    textShadow: '0 0 4px rgba(0,0,0,0.9)',
                                                    fontWeight: '600'
                                                  }
                                                }}
                                              />
                                            </LineChart>
                                          </ResponsiveContainer>
                                        );
                                      })()}
                                    </div>
                                    
                                    {/* Chart Stats */}
                                    <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                                      {(() => {
                                        const chartResult = getChartData(offer, chartTimeframe);
                                        const stats = chartResult.stats;
                                        
                                        return (
                                          <>
                                            <div className="text-center">
                                              <p className="text-sm text-muted-foreground">Data Points</p>
                                              <p className="text-lg font-semibold">{stats?.dataPoints || 0}</p>
                                            </div>
                                            <div className="text-center">
                                              <p className="text-sm text-muted-foreground">Max Gravity</p>
                                              <p className="text-lg font-semibold">{stats?.maxGravity?.toFixed(1) || 'N/A'}</p>
                                            </div>
                                            <div className="text-center">
                                              <p className="text-sm text-muted-foreground">Min Gravity</p>
                                              <p className="text-lg font-semibold">{stats?.minGravity?.toFixed(1) || 'N/A'}</p>
                                            </div>
                                            <div className="text-center">
                                              <p className="text-sm text-muted-foreground">Change</p>
                                              <p className={`text-lg font-semibold ${stats?.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                                {stats?.isPositive ? '+' : ''}{stats?.gravityChange?.toFixed(1) || 'N/A'}
                                              </p>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </div>
                            
                            {/* Features & Actions */}
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap gap-1">
                                {offer.has_recurring_products && (
                                  <Badge variant="secondary" className="text-xs">
                                    Recurring
                                  </Badge>
                                )}
                                {offer.mobile_optimized && (
                                  <Badge variant="secondary" className="text-xs">
                                    Mobile
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {offer.category}
                                </Badge>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    const affiliateUrl = `https://hop.clickbank.net/?affiliate=${offer.clickbank_id}`;
                                    navigator.clipboard.writeText(affiliateUrl);
                                    toast.success('Affiliate link copied to clipboard!');
                                  }}
                                >
                                  Get Link
                                </Button>
                                {(offer.sales_page_url || offer.affiliate_page_url) && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      const url = offer.sales_page_url || offer.affiliate_page_url;
                                      if (url) {
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                      }
                                    }}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                      
                      {/* Load More Section */}
                      {hasMore && (
                        <div className="flex justify-center pt-4">
                          <Button 
                            onClick={() => loadOffers(false)}
                            disabled={isLoadingMore}
                            variant="outline"
                            className="w-full"
                          >
                            {isLoadingMore ? (
                              <>
                                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
                                Loading more...
                              </>
                            ) : (
                              <>
                                <TrendingUp className="w-4 h-4 mr-2" />
                                Load More Offers ({totalCount - offers.length} remaining)
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      
                      {!hasMore && offers.length > 0 && (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          \u2728 All {totalCount.toLocaleString()} offers loaded
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </UniformToolLayout>
        </div>
      </div>
      
      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <Button
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-110 transition-all duration-300 shadow-lg z-50"
          onClick={() => {
            const scrollContainer = document.querySelector('.offers-scroll-container');
            if (scrollContainer) {
              scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          <ArrowUp className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}