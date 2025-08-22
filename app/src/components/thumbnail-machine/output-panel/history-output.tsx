'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Clock, History, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { fetchUserThumbnailHistory, deleteHistoryItem, ThumbnailHistoryItem } from '@/actions/tools/get-thumbnail-history';
import Image from 'next/image';
import { HistoryFilters } from '@/components/tools/standard-history-filters';

interface HistoryOutputProps {
  refreshTrigger?: number; // Change this value to trigger a refresh
  filters?: HistoryFilters;
}

/**
 * History Output - Shows generation history in right panel
 * Displays past generations with actions and details
 */
export function HistoryOutput({ refreshTrigger, filters }: HistoryOutputProps = {}) {
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const [history, setHistory] = useState<ThumbnailHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<ThumbnailHistoryItem[]>([]);
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
        item.prompt.toLowerCase().includes(searchLower) ||
        item.type.toLowerCase().includes(searchLower) ||
        item.titles?.some(title => title.toLowerCase().includes(searchLower))
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
          filtered.sort((a, b) => a.prompt.localeCompare(b.prompt));
          break;
        case 'name_desc':
          filtered.sort((a, b) => b.prompt.localeCompare(a.prompt));
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
      const result = await fetchUserThumbnailHistory();
      
      if (result.success && result.history) {
        setHistory(result.history);
      } else {
        setError(result.error || 'Failed to load history');
      }
    } catch (err) {
      console.error('Error loading history:', err);
      setError('Failed to load history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    setDeletingItems(prev => new Set([...prev, itemId]));
    
    try {
      const result = await deleteHistoryItem(itemId);
      
      if (result.success) {
        // Remove item from local state
        setHistory(prev => prev.filter(item => item.id !== itemId));
        // Close expanded view if this item was selected
        if (selectedHistory === itemId) {
          setSelectedHistory(null);
        }
      } else {
        setError(result.error || 'Failed to delete item');
      }
    } catch (err) {
      console.error('Error deleting item:', err);
      setError('Failed to delete item');
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
      case 'thumbnail': return 'bg-blue-100 text-blue-600';
      case 'face-swap': return 'bg-blue-100 text-blue-700';
      case 'recreate': return 'bg-blue-100 text-blue-600';
      case 'titles': return 'bg-yellow-100 text-yellow-700';
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
          <p className="text-muted-foreground">Loading history...</p>
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
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
          <History className="w-12 h-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-medium mb-2">No History Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your generated thumbnails and titles will appear here
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
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
          <History className="w-12 h-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-medium mb-2">No Results Found</h3>
            <p className="text-sm text-muted-foreground">
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
              
              {/* Prompt Preview */}
              <p className="font-medium text-base leading-tight line-clamp-2">{item.prompt}</p>
              
              {/* Date */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatDate(item.createdAt)}</span>
              </div>

              {/* Content Preview */}
              {item.type === 'titles' ? (
                /* Title Preview - Single Title */
                <div className="bg-muted/50 p-2 rounded">
                  <p className="text-base line-clamp-2">{item.titles?.[0]}</p>
                  {(item.titles?.length || 0) > 1 && (
                    <p className="text-sm text-muted-foreground mt-1">+{(item.titles?.length || 0) - 1} more</p>
                  )}
                </div>
              ) : (
                /* Single Thumbnail Preview */
                <div className="aspect-video bg-muted rounded overflow-hidden relative">
                  {item.thumbnails && item.thumbnails[0] ? (
                    <Image
                      src={item.thumbnails[0]}
                      alt={item.prompt}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                      <span className="text-base text-muted-foreground">{item.thumbnails?.length || 0} images</span>
                    </div>
                  )}
                  {item.thumbnails && item.thumbnails.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      +{item.thumbnails.length - 1} more
                    </div>
                  )}
                </div>
              )}

              {/* Expanded Actions */}
              {selectedHistory === item.id && (
                <div className="pt-2 border-t space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {item.type === 'titles' 
                      ? `${item.titles?.length || 0} titles`
                      : `${item.thumbnails?.length || 0} images`
                    }
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
            <p className="text-sm text-muted-foreground">Generations</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{filteredHistory.reduce((acc, item) => acc + item.credits, 0)}</p>
            <p className="text-sm text-muted-foreground">Credits Used</p>
          </div>
          <div>
            <p className="text-lg font-semibold">
              {filteredHistory.reduce((acc, item) => 
                acc + (item.thumbnails?.length || 0) + (item.titles?.length || 0), 0
              )}
            </p>
            <p className="text-sm text-muted-foreground">Assets Created</p>
          </div>
        </div>
      </Card>
    </div>
  );
}