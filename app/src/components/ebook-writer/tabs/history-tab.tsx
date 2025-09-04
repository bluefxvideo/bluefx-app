'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Book, 
  Calendar, 
  Edit3, 
  Download, 
  Trash2,
  Loader2,
  Clock,
  FileText
} from 'lucide-react';
import { createClient } from '@/app/supabase/client';
import { getUserEbookHistory, deleteEbook } from '@/actions/database/ebook-writer-database';
import { TabContentWrapper, TabBody } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { useRouter } from 'next/navigation';

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

export function HistoryTab() {
  const router = useRouter();
  const { clearCurrentProject, setActiveTab } = useEbookWriterStore();
  const [ebooks, setEbooks] = useState<EbookHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load ebook history
  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const result = await getUserEbookHistory(user.id);
        if (result.success && result.ebooks) {
          setEbooks(result.ebooks);
        }
      }
    } catch (error) {
      console.error('Failed to load ebook history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Continue editing a draft
  const handleContinueEditing = async (ebook: EbookHistoryItem) => {
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
  const handleDelete = async (ebookId: string) => {
    setDeletingId(ebookId);
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
      setDeletingId(null);
    }
  };

  // Get status badge
  const getStatusBadge = (ebook: EbookHistoryItem) => {
    const progress = ebook.metadata.generation_progress || 0;
    
    if (ebook.status === 'completed' || progress === 100) {
      return <Badge className="bg-green-600">Completed</Badge>;
    }
    
    const currentStep = ebook.metadata.current_step || 'topic';
    return (
      <Badge variant="secondary">
        {currentStep.charAt(0).toUpperCase() + currentStep.slice(1)} ({progress}%)
      </Badge>
    );
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <TabContentWrapper>
        <TabBody>
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </TabBody>
      </TabContentWrapper>
    );
  }

  return (
    <TabContentWrapper>
      <TabBody>
        <StandardStep
          stepNumber={1}
          title="Your Ebook Projects"
          description={`${ebooks.length} ebook${ebooks.length !== 1 ? 's' : ''} in your history`}
        >
          {ebooks.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Book className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">No Ebooks Yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start creating your first ebook to see it here
                  </p>
                  <Button 
                    onClick={() => {
                      setActiveTab('topic');
                      router.push('/dashboard/ebook-writer');
                    }}
                  >
                    Create New Ebook
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {ebooks.map(ebook => (
                <Card key={ebook.id} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {ebook.metadata.title || ebook.title || 'Untitled Ebook'}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {ebook.metadata.topic && (
                            <span className="block">Topic: {ebook.metadata.topic}</span>
                          )}
                          <span className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            Last updated: {formatDate(ebook.updated_at)}
                          </span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(ebook)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      {/* Cover Preview */}
                      {ebook.metadata.cover_url && (
                        <div className="w-16 h-24 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                          <img 
                            src={ebook.metadata.cover_url} 
                            alt="Cover"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Stats */}
                      <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                        {ebook.metadata.outline?.chapters && (
                          <div>
                            <FileText className="h-4 w-4 inline mr-1 text-muted-foreground" />
                            {ebook.metadata.outline.chapters.length} chapters
                          </div>
                        )}
                        <div>
                          <Calendar className="h-4 w-4 inline mr-1 text-muted-foreground" />
                          Created {formatDate(ebook.created_at)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      {ebook.status === 'draft' ? (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleContinueEditing(ebook)}
                          className="flex-1"
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Continue Editing
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleContinueEditing(ebook)}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          View & Export
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(ebook.id)}
                        disabled={deletingId === ebook.id}
                      >
                        {deletingId === ebook.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </StandardStep>
      </TabBody>
    </TabContentWrapper>
  );
}