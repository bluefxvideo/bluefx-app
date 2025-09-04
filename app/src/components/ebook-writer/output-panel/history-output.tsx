'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  History, 
  Book, 
  Clock,
  FileText,
  Calendar,
  Loader2,
  Edit3,
  Download,
  Trash2,
  AlertCircle,
  Eye,
  BookOpen
} from 'lucide-react';
import { createClient } from '@/app/supabase/client';
import { getUserEbookHistory, deleteEbook } from '@/actions/database/ebook-writer-database';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { useRouter } from 'next/navigation';
import type { EbookHistoryFilters } from '../tabs/ebook-history-filters';

interface EbookHistoryItem {
  id: string;
  user_id: string;
  title: string;
  status: 'draft' | 'completed';
  metadata: {
    topic?: string;
    title?: string;
    outline?: any;
    content?: any;
    cover_url?: string;
    cover_metadata?: any;
    current_step?: string;
    generation_progress?: number;
  };
  created_at: string;
  updated_at: string;
}

interface HistoryOutputProps {
  filters?: EbookHistoryFilters;
}

export function HistoryOutput({ filters }: HistoryOutputProps = {}) {
  const router = useRouter();
  const { clearCurrentProject, setActiveTab } = useEbookWriterStore();
  const [ebooks, setEbooks] = useState<EbookHistoryItem[]>([]);
  const [filteredEbooks, setFilteredEbooks] = useState<EbookHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEbook, setSelectedEbook] = useState<string | null>(null);
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());

  // Load ebook history
  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const result = await getUserEbookHistory(user.id);
        if (result.success && result.ebooks) {
          setEbooks(result.ebooks);
        } else {
          setError(result.error || 'Failed to load history');
        }
      }
    } catch (error) {
      console.error('Failed to load ebook history:', error);
      setError('Failed to load history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Apply filters when ebooks or filters change
  useEffect(() => {
    if (!filters) {
      setFilteredEbooks(ebooks);
      return;
    }

    let filtered = [...ebooks];

    // Apply search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        (item.metadata.title || item.title || '').toLowerCase().includes(searchLower) ||
        (item.metadata.topic || '').toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (filters.filterStatus && filters.filterStatus !== 'all') {
      filtered = filtered.filter(item => {
        if (filters.filterStatus === 'completed') {
          return item.status === 'completed' || getProgress(item) >= 100;
        }
        return item.status === filters.filterStatus;
      });
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
        new Date(item.created_at) >= cutoffDate
      );
    }

    // Apply sort order
    if (filters.sortOrder) {
      switch (filters.sortOrder) {
        case 'oldest':
          filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          break;
        case 'newest':
          filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          break;
        case 'name':
          filtered.sort((a, b) => (a.metadata.title || a.title || '').localeCompare(b.metadata.title || b.title || ''));
          break;
        case 'name_desc':
          filtered.sort((a, b) => (b.metadata.title || b.title || '').localeCompare(a.metadata.title || a.title || ''));
          break;
        case 'progress':
          filtered.sort((a, b) => getProgress(b) - getProgress(a));
          break;
      }
    }

    setFilteredEbooks(filtered);
  }, [ebooks, filters]);

  // Continue editing a draft
  const handleContinueEditing = async (ebook: EbookHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Clear current project first
      await clearCurrentProject(user.id);
      
      // Navigate to the appropriate tab based on the ebook's progress
      const nextTab = ebook.metadata.current_step || 'topic';
      setActiveTab(nextTab as any);
      
      // The session will auto-load from the database
      router.push(`/dashboard/ebook-writer/${nextTab}`);
    }
  };

  // Delete an ebook
  const handleDelete = async (ebookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingItems(new Set([...deletingItems, ebookId]));
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const result = await deleteEbook(user.id, ebookId);
        if (result.success) {
          // Reload history
          await loadHistory();
        }
      }
    } catch (error) {
      console.error('Failed to delete ebook:', error);
    } finally {
      setDeletingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(ebookId);
        return newSet;
      });
    }
  };

  // Get progress percentage
  const getProgress = (ebook: EbookHistoryItem) => {
    return ebook.generation_progress || ebook.metadata?.generation_progress || 0;
  };

  // Format date
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

  // Get status color for badge
  const getStatusColor = (ebook: EbookHistoryItem) => {
    const progress = getProgress(ebook);
    if (ebook.status === 'completed' || progress >= 100) {
      return 'bg-green-600';
    }
    if (progress > 50) {
      return 'bg-blue-600';
    }
    return 'bg-gray-600';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading ebook history...</p>
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
  if (ebooks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-8 max-w-sm text-center space-y-4 border-dashed">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-medium mb-2">No Ebooks Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your ebook projects will appear here
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // No results after filtering
  if (filteredEbooks.length === 0 && ebooks.length > 0) {
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
          {filteredEbooks.map((ebook) => (
            <Card 
              key={ebook.id} 
              className={`p-3 bg-secondary transition-all duration-200 hover:shadow-md cursor-pointer ${
                selectedEbook === ebook.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedEbook(selectedEbook === ebook.id ? null : ebook.id)}
            >
              <div className="space-y-2">
                {/* Status Badge and Progress */}
                <div className="flex items-center justify-between">
                  <Badge className={`text-sm ${getStatusColor(ebook)}`}>
                    {ebook.status === 'completed' || getProgress(ebook) >= 100 
                      ? 'Completed' 
                      : `${getProgress(ebook)}% Progress`}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {ebook.metadata.outline?.chapters?.length || 0} chapters
                  </span>
                </div>
                
                {/* Title */}
                <p className="font-medium text-base leading-tight line-clamp-2">
                  {ebook.metadata.title || ebook.title || 'Untitled Ebook'}
                </p>
                
                {/* Topic */}
                {ebook.metadata.topic && (
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    Topic: {ebook.metadata.topic}
                  </p>
                )}
                
                {/* Date */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(ebook.updated_at)}</span>
                </div>

                {/* Cover Preview */}
                {(ebook.cover_image_url || ebook.metadata?.cover_url) ? (
                  <div className="aspect-[3/4] max-h-32 bg-muted rounded overflow-hidden mx-auto">
                    <img 
                      src={ebook.cover_image_url || ebook.metadata?.cover_url} 
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-[3/4] max-h-32 bg-muted rounded flex items-center justify-center mx-auto">
                    <Book className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}

                {/* Expanded Actions */}
                {selectedEbook === ebook.id && (
                  <div className="pt-2 border-t space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Step: {ebook.metadata.current_step || 'topic'}
                    </div>
                    <div className="flex flex-col gap-1">
                      {ebook.status === 'draft' ? (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 justify-start"
                          onClick={(e) => handleContinueEditing(ebook, e)}
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          <span className="text-sm">Continue Editing</span>
                        </Button>
                      ) : (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 justify-start"
                            onClick={(e) => handleContinueEditing(ebook, e)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            <span className="text-sm">View</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 justify-start"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Navigate to export tab
                              setActiveTab('export');
                              router.push('/dashboard/ebook-writer/export');
                            }}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            <span className="text-sm">Export</span>
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDelete(ebook.id, e)}
                        disabled={deletingItems.has(ebook.id)}
                      >
                        {deletingItems.has(ebook.id) ? (
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
              {filteredEbooks.length}
              {ebooks.length !== filteredEbooks.length && (
                <span className="text-sm text-muted-foreground">/{ebooks.length}</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">Ebooks</p>
          </div>
          <div>
            <p className="text-lg font-semibold">
              {filteredEbooks.filter(e => e.status === 'completed' || getProgress(e) >= 100).length}
            </p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
          <div>
            <p className="text-lg font-semibold">
              {filteredEbooks.reduce((acc, ebook) => 
                acc + (ebook.metadata.outline?.chapters?.length || 0), 0
              )}
            </p>
            <p className="text-sm text-muted-foreground">Total Chapters</p>
          </div>
        </div>
      </Card>
    </div>
  );
}