'use client';

import { DollarSign, TrendingUp, TrendingDown, ExternalLink, ArrowUp, ArrowDown, RefreshCw, Search, Info, BarChart3, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { FullWidthToolLayout } from '@/components/tools/full-width-tool-layout';
import { getTopOffers, searchOffers, getOfferCategories } from '@/actions/research/top-offers';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
    daily_data?: Record<string, unknown>;
  }[];
}

export default function TopOffersPage() {
  const [offers, setOffers] = useState<ClickBankOffer[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [filterType, setFilterType] = useState<string>('All Offers');
  const [sortBy, setSortBy] = useState<string>('gravity_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);
  const [selectedOffer, setSelectedOffer] = useState<ClickBankOffer | null>(null);
  const [offerHistory, setOfferHistory] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadOffers = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    
    try {
      const offset = (currentPage - 1) * pageSize;
      const result = await getTopOffers({
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        sort_by: sortBy as 'gravity_score' | 'commission_rate' | 'average_dollar_per_sale',
        limit: pageSize,
        offset: offset
      });
      
      if (result.success) {
        let filteredOffers = result.data || [];
        
        // Apply filter type
        switch (filterType) {
          case 'High Gravity':
            filteredOffers = filteredOffers.filter(o => o.gravity_score >= 100);
            break;
          case 'High Converting':
            filteredOffers = filteredOffers.filter(o => (o.commission_rate || 0) >= 0.5);
            break;
          case 'Recurring Revenue':
            filteredOffers = filteredOffers.filter(o => o.has_recurring_products);
            break;
          case 'Trending Up':
            filteredOffers = filteredOffers.filter(o => 
              o.clickbank_history?.[0]?.gravity_change && o.clickbank_history[0].gravity_change > 0
            );
            break;
          case 'Trending Down':
            filteredOffers = filteredOffers.filter(o => 
              o.clickbank_history?.[0]?.gravity_change && o.clickbank_history[0].gravity_change < 0
            );
            break;
        }
        
        setOffers(filteredOffers);
        setTotalCount(result.total_count || 0);
      } else {
        toast.error(result.error || 'Failed to load offers');
      }
    } catch (_error) {
      toast.error('Failed to load top offers');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, sortBy, currentPage, pageSize, filterType]);

  const loadCategories = async () => {
    try {
      const result = await getOfferCategories();
      if (result.success) {
        setCategories(['All', ...(result.data || [])]);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadOffers();
  }, [currentPage, pageSize, sortBy, sortDirection, filterType, loadOffers]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadOffers(true);
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await searchOffers(searchQuery);
      
      if (result.success) {
        setOffers(result.data || []);
        setTotalCount(result.data?.length || 0);
        setCurrentPage(1);
      } else {
        toast.error(result.error || 'Search failed');
      }
    } catch (_error) {
      toast.error('Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSortChange = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setFilterType('All Offers');
    setSortBy('gravity_score');
    setSortDirection('desc');
    setCurrentPage(1);
  };

  const handleOfferSelect = (offer: ClickBankOffer) => {
    setSelectedOffer(offer);
    // Load offer history if needed
  };

  const closeOfferDetail = () => {
    setSelectedOffer(null);
    setOfferHistory(null);
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return `$${amount.toFixed(2)}`;
  };

  const formatPercentage = (rate: number | null) => {
    if (!rate) return 'N/A';
    return `${(rate * 100).toFixed(0)}%`;
  };

  const getTrendIndicator = (change?: number) => {
    if (!change && change !== 0) return null;
    
    if (change > 0) {
      return (
        <span className="flex items-center text-green-600">
          <TrendingUp className="h-4 w-4 mr-1" />
          <span>+{change.toFixed(1)}</span>
        </span>
      );
    } else if (change < 0) {
      return (
        <span className="flex items-center text-red-600">
          <TrendingDown className="h-4 w-4 mr-1" />
          <span>{change.toFixed(1)}</span>
        </span>
      );
    } else {
      return (
        <span className="flex items-center text-gray-600">
          <span>No change</span>
        </span>
      );
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <StandardToolPage
      icon={DollarSign}
      title="Top Offers"
      description="Find the best affiliate offers and promotions in your niche"
      iconGradient="bg-primary"
    >
      <FullWidthToolLayout>
        {/* Filter Bar - Horizontal */}
        <div className="space-y-4">
          {/* Search Row */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Search Input */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by product name or description..."
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
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={(value) => { setSortBy(value); setCurrentPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gravity_score">Gravity Score</SelectItem>
                  <SelectItem value="commission_rate">Commission Rate</SelectItem>
                  <SelectItem value="average_dollar_per_sale">Average Sale</SelectItem>
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
                onClick={handleClearSearch} 
                variant="outline"
                size="sm"
              >
                Clear
              </Button>
              <Button 
                onClick={() => loadOffers(true)} 
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
            
            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Total:</span>
                <span className="font-bold">{totalCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span className="text-muted-foreground">Page:</span>
                <span className="font-bold">{currentPage}/{totalPages}</span>
              </div>
            </div>
          </div>

          {/* Quick Filters Row */}
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => { setFilterType('All Offers'); setCurrentPage(1); }}
              variant={filterType === 'All Offers' ? 'default' : 'outline'}
              size="sm"
            >
              All Offers
            </Button>
            <Button 
              onClick={() => { setFilterType('High Gravity'); setCurrentPage(1); }}
              variant={filterType === 'High Gravity' ? 'default' : 'outline'}
              size="sm"
            >
              High Gravity
            </Button>
            <Button 
              onClick={() => { setFilterType('Trending Up'); setCurrentPage(1); }}
              variant={filterType === 'Trending Up' ? 'default' : 'outline'}
              size="sm"
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              Trending Up
            </Button>
            <Button 
              onClick={() => { setFilterType('Trending Down'); setCurrentPage(1); }}
              variant={filterType === 'Trending Down' ? 'default' : 'outline'}
              size="sm"
            >
              <TrendingDown className="w-3 h-3 mr-1" />
              Trending Down
            </Button>
            <Button 
              onClick={() => { setFilterType('Recurring Revenue'); setCurrentPage(1); }}
              variant={filterType === 'Recurring Revenue' ? 'default' : 'outline'}
              size="sm"
            >
              Recurring
            </Button>
            {filterType !== 'All Offers' && (
              <Badge variant="secondary" className="ml-2">Active: {filterType}</Badge>
            )}
          </div>
        </div>

        
        {/* Results Panel - Full Width */}
        <div className="h-full overflow-y-auto scrollbar-hover">
          <div className="space-y-4">
            
            {isLoading ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-card border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Gravity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Rebill</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Sale</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Trend</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {[...Array(8)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-start">
                              <div>
                                <div className="h-4 bg-muted rounded w-48 mb-2"></div>
                                <div className="h-3 bg-muted rounded w-24 mb-1"></div>
                                <div className="h-3 bg-muted rounded w-16"></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="h-6 bg-muted rounded w-20"></div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-4 bg-muted rounded w-12 mr-2"></div>
                              <div className="h-3 bg-muted rounded w-8"></div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="h-4 bg-muted rounded w-12"></div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="h-4 bg-muted rounded w-16"></div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="h-8 bg-muted rounded w-16"></div>
                              <div className="h-6 bg-muted rounded w-8"></div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <div className="h-6 bg-muted rounded w-12"></div>
                              <div className="h-6 bg-muted rounded w-6"></div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : offers.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Offers Found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-card border-b border-border">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Product
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Gravity
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Commission
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Avg Sale
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Trend
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-card divide-y divide-border">
                        {offers.map((offer) => (
                          <tr 
                            key={offer.id}
                            className="hover:"
                            onClick={() => handleOfferSelect(offer)}
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-start">
                                <div>
                                  <div className="text-base font-medium text-gray-900 dark:text-white line-clamp-2 max-w-[300px]" title={offer.title}>
                                    {offer.title}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    by {offer.vendor_name}
                                  </div>
                                  <div className="text-xs text-gray-400 dark:text-gray-500">
                                    ID: {offer.clickbank_id}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <Badge variant="outline" className="text-xs">
                                {offer.category}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="text-sm font-bold text-green-600">
                                  {offer.gravity_score?.toFixed(1) || 'N/A'}
                                </div>
                                {offer.clickbank_history?.[0]?.gravity_change && (
                                  <div className="ml-2">
                                    {getTrendIndicator(offer.clickbank_history[0].gravity_change)}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
                                {formatPercentage(offer.commission_rate)}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                {formatCurrency(offer.average_dollar_per_sale)}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {offer.clickbank_history?.[0] && (
                                <div className="w-24 h-12">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={
                                      offer.clickbank_history[0].daily_data?.slice(-7).map((point: any) => ({
                                        value: point.gravity_score || 0,
                                        date: point.date
                                      })) || [
                                        { value: offer.clickbank_history[0].min_gravity || 0 },
                                        { value: offer.gravity_score || 0 }
                                      ]
                                    }>
                                      <Line 
                                        type="monotone" 
                                        dataKey="value" 
                                        stroke={offer.clickbank_history[0].gravity_change >= 0 ? '#10b981' : '#ef4444'}
                                        strokeWidth={2}
                                        dot={false}
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              )}
                              <div className="flex gap-1 mt-1">
                                {offer.mobile_optimized && (
                                  <Badge variant="secondary" className="text-xs">Mobile</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(`https://hop.clickbank.net/?affiliate=${offer.clickbank_id}`);
                                    toast.success('Link copied!');
                                  }}
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                                >
                                  Copy Link
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const url = offer.affiliate_page_url || offer.sales_page_url;
                                    if (url) window.open(url, '_blank');
                                  }}
                                  className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} offers
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
                        {Array.from({ length: totalPages }).map((_, i) => {
                          const page = i + 1;
                          if (
                            page === 1 ||
                            page === totalPages ||
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
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
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
      
      {/* Offer Detail Modal */}
      {selectedOffer && (
        <Dialog open={!!selectedOffer} onOpenChange={() => closeOfferDetail()}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedOffer.title}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Badge>{selectedOffer.category}</Badge>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = selectedOffer.affiliate_page_url || selectedOffer.sales_page_url;
                        if (url) window.open(url, '_blank');
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit Page
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://hop.clickbank.net/?affiliate=${selectedOffer.clickbank_id}`);
                        toast.success('Link copied!');
                      }}
                    >
                      Copy Link
                    </Button>
                  </div>
                </div>
                
                {selectedOffer.description && (
                  <p className="text-muted-foreground mb-4">
                    {selectedOffer.description}
                  </p>
                )}
              </div>

              {/* Performance Metrics */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Gravity Score</div>
                    <div className="text-2xl font-bold">
                      {selectedOffer.gravity_score?.toFixed(1) || 'N/A'}
                    </div>
                  </Card>
                  
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Commission</div>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {formatPercentage(selectedOffer.commission_rate)}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Avg Sale</div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(selectedOffer.average_dollar_per_sale)}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Refund Rate</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatPercentage(selectedOffer.refund_rate)}
                    </div>
                  </Card>
                </div>
              </div>

              {/* Trend Data with Chart */}
              {selectedOffer.clickbank_history?.[0] && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Gravity Score History</h3>
                  
                  {/* Main Chart */}
                  <Card className="p-4 mb-4">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={(() => {
                            const hist = selectedOffer.clickbank_history[0];
                            // Try to use daily data if available
                            if (hist.daily_data) {
                              try {
                                let dailyData = hist.daily_data;
                                while (typeof dailyData === 'string') {
                                  dailyData = JSON.parse(dailyData);
                                }
                                
                                if (Array.isArray(dailyData) && dailyData.length > 0) {
                                  return dailyData
                                    .filter((point: any) => point.gravity_score && point.recorded_at)
                                    .map((point: any) => ({
                                      date: format(new Date(point.recorded_at), 'MMM d'),
                                      gravity: point.gravity_score
                                    }))
                                    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                }
                              } catch {
                                // Fall through to default data
                              }
                            }
                            
                            // Fallback to interpolated data
                            const points = [];
                            const numPoints = 7; // Show 7 data points
                            const minGrav = hist.min_gravity || selectedOffer.gravity_score;
                            const maxGrav = hist.max_gravity || selectedOffer.gravity_score;
                            const gravityChange = hist.gravity_change || 0;
                            
                            for (let i = 0; i < numPoints; i++) {
                              const progress = i / (numPoints - 1);
                              const baseValue = gravityChange > 0 
                                ? minGrav + (maxGrav - minGrav) * progress
                                : gravityChange < 0
                                  ? maxGrav - (maxGrav - minGrav) * progress
                                  : selectedOffer.gravity_score;
                              
                              const daysAgo = numPoints - i - 1;
                              const date = new Date();
                              date.setDate(date.getDate() - daysAgo);
                              
                              points.push({
                                date: format(date, 'MMM d'),
                                gravity: Math.max(0, baseValue)
                              });
                            }
                            
                            return points;
                          })()}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                          <XAxis 
                            dataKey="date"
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                          />
                          <YAxis 
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                            domain={['dataMin', 'dataMax']}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                              border: 'none',
                              borderRadius: '8px',
                              color: '#ffffff'
                            }}
                            formatter={(value: any) => [`${value?.toFixed(1)}`, 'Gravity']}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="gravity" 
                            stroke="#3b82f6"
                            strokeWidth={3}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* Statistics */}
                  <Card className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Data Points</div>
                        <div className="font-medium">{selectedOffer.clickbank_history[0].data_points}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Min Gravity</div>
                        <div className="font-medium">{selectedOffer.clickbank_history[0].min_gravity?.toFixed(1)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Max Gravity</div>
                        <div className="font-medium">{selectedOffer.clickbank_history[0].max_gravity?.toFixed(1)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Change</div>
                        <div className="font-medium">
                          {getTrendIndicator(selectedOffer.clickbank_history[0].gravity_change)}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Features */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Features</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedOffer.has_recurring_products && (
                    <Badge variant="secondary">Recurring Revenue</Badge>
                  )}
                  {selectedOffer.mobile_optimized && (
                    <Badge variant="secondary">Mobile Optimized</Badge>
                  )}
                  <Badge variant="outline">{selectedOffer.vendor_name}</Badge>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </StandardToolPage>
  );
}