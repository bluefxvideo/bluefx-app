'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Clock, History, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { fetchUserLogoHistory, deleteLogoItem, LogoHistoryItem } from '@/actions/tools/get-logo-history';
import Image from 'next/image';
import { HistoryFilters } from '@/components/tools/standard-history-filters';

// Helper function to validate URLs
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

interface HistoryOutputProps {
  refreshTrigger?: number;
  filters?: HistoryFilters;
}

/**
 * Logo History Output - Shows logo generation history in right panel
 * Displays past logo generations with actions and details
 */
export function HistoryOutput({ refreshTrigger, filters }: HistoryOutputProps = {}) {
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const [history, setHistory] = useState<LogoHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<LogoHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());

  // Fetch history on component mount and when refresh is triggered
  useEffect(() => {
    loadHistory();
  }, [refreshTrigger]);

  // Apply filters when history or filters change
  useEffect(() => {
    if (!filters) {
      setFilteredHistory(history);
      return;
    }

    let filtered = [...history];

    // Apply search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.companyName.toLowerCase().includes(searchLower) ||
        item.type.toLowerCase().includes(searchLower)
      );
    }

    // Apply type filter
    if (filters.filterType && filters.filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filters.filterType);
    }

    // Apply date range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          cutoffDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(item => 
        new Date(item.createdAt) >= cutoffDate
      );
    }

    // Apply sort order
    if (filters.sortOrder) {
      switch (filters.sortOrder) {
        case 'oldest':
          filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          break;
        case 'newest':
          filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          break;
        case 'name':
          filtered.sort((a, b) => a.companyName.localeCompare(b.companyName));
          break;
        case 'name_desc':
          filtered.sort((a, b) => b.companyName.localeCompare(a.companyName));
          break;
        case 'type':
          filtered.sort((a, b) => a.type.localeCompare(b.type));
          break;
      }
    }

    setFilteredHistory(filtered);
  }, [history, filters]);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchUserLogoHistory();
      
      if (result.success && result.history) {
        setHistory(result.history);
      } else {
        setError(result.error || 'Failed to load logo history');
      }
    } catch (err) {
      console.error('Error loading logo history:', err);
      setError('Failed to load logo history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    setDeletingItems(prev => new Set([...prev, itemId]));
    
    try {
      const result = await deleteLogoItem(itemId);
      
      if (result.success) {
        // Remove item from local state
        setHistory(prev => prev.filter(item => item.id !== itemId));
        // Close expanded view if this item was selected
        if (selectedHistory === itemId) {
          setSelectedHistory(null);
        }
      } else {
        setError(result.error || 'Failed to delete logo');
      }
    } catch (err) {
      console.error('Error deleting logo:', err);
      setError('Failed to delete logo');
    } finally {
      setDeletingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'logo-design': return 'bg-purple-100 text-purple-600';
      case 'recreate': return 'bg-blue-100 text-blue-600';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading logo history...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-6 max-w-sm text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-destructive font-medium">Failed to load history</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={loadHistory} variant="outline" size="sm">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  // Empty state
  if (history.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed bg-secondary border-muted-foreground/20">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto">
            <History className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="font-medium mb-2">No Logos Yet</h3>
            <p className="text-base text-muted-foreground leading-relaxed">
              Your generated logos will appear here
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // No results after filtering
  if (filteredHistory.length === 0 && history.length > 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed bg-secondary border-muted-foreground/20">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto">
            <History className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="font-medium mb-2">No Results Found</h3>
            <p className="text-base text-muted-foreground leading-relaxed">
              Try adjusting your filters to see more results
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* History Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-hover">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
          {filteredHistory.map((item) => (
            <Card 
              key={item.id} 
              className={`p-3 bg-secondary transition-all duration-200 hover:shadow-md cursor-pointer ${
                selectedHistory === item.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedHistory(selectedHistory === item.id ? null : item.id)}
            >
            <div className="space-y-2">
              {/* Type Badge */}
              <div className="flex items-center justify-between">
                <Badge className={`text-sm ${getTypeColor(item.type)}`}>
                  {item.type.replace('-', ' ')}
                </Badge>
                <span className="text-sm text-muted-foreground">{item.credits}c</span>
              </div>
              
              {/* Company Name */}
              <p className="font-medium text-base leading-tight line-clamp-2">{item.companyName}</p>
              
              {/* Date */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatDate(item.createdAt)}</span>
              </div>

              {/* Logo Preview */}
              <div className="aspect-square bg-muted rounded overflow-hidden relative">
                {item.logoUrl && isValidUrl(item.logoUrl) ? (
                  <Image
                    src={item.logoUrl}
                    alt={item.companyName}
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                    <span className="text-base text-muted-foreground">No Preview</span>
                  </div>
                )}
              </div>

              {/* Expanded Actions */}
              {selectedHistory === item.id && (
                <div className="pt-2 border-t space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Logo Design
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="sm" className="h-6 px-2 justify-start">
                      <Eye className="w-3 h-3 mr-1" />
                      <span className="text-sm">View</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 px-2 justify-start">
                      <Download className="w-3 h-3 mr-1" />
                      <span className="text-sm">Download</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      disabled={deletingItems.has(item.id)}
                    >
                      {deletingItems.has(item.id) ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3 mr-1" />
                      )}
                      <span className="text-sm">Delete</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
        </div>
      </div>

      {/* Summary Footer */}
      <Card className="mt-4 p-3 bg-secondary">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold text-primary">
              {filteredHistory.length}{history.length !== filteredHistory.length && <span className="text-sm text-muted-foreground">/{history.length}</span>}
            </p>
            <p className="text-sm text-muted-foreground">Logos</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{filteredHistory.reduce((acc, item) => acc + item.credits, 0)}</p>
            <p className="text-sm text-muted-foreground">Credits Used</p>
          </div>
          <div>
            <p className="text-lg font-semibold">
              {filteredHistory.length}
            </p>
            <p className="text-sm text-muted-foreground">Assets Created</p>
          </div>
        </div>
      </Card>
    </div>
  );
}