'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookOpen, FileText, Sparkles, ArrowRight, MoreVertical, RotateCcw, TrendingUp, Loader2 } from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { UploadedDocument } from '@/actions/tools/ebook-document-handler';
import { getPopularTopics, type PopularTopic } from '@/actions/research/popular-topics';

interface TopicPreviewProps {
  topic: string;
  documents: UploadedDocument[];
}

// Icon mapping for visual variety
const getTopicIcon = (index: number) => {
  const icons = [TrendingUp, FileText, Sparkles, ArrowRight, BookOpen];
  return icons[index % icons.length];
};

export function TopicPreview({ topic = '', documents = [] }: TopicPreviewProps) {
  const router = useRouter();
  const { setActiveTab, clearCurrentProject, setTopic, generateTitles } = useEbookWriterStore();
  const [popularTopics, setPopularTopics] = useState<PopularTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch popular topics from Perplexity API
  useEffect(() => {
    const fetchPopularTopics = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await getPopularTopics({
          category: 'digital marketing and online business',
          limit: 10,
          freshness: 'trending'
        });

        if (response.success && response.data) {
          setPopularTopics(response.data);
        } else {
          setError(response.error || 'Failed to load popular topics');
        }
      } catch (err) {
        console.error('Error fetching popular topics:', err);
        setError('Failed to load popular topics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPopularTopics();
  }, []);

  const handleStartOver = async () => {
    if (confirm('Are you sure you want to start over? This will clear all progress and delete your session.')) {
      try {
        // Get user ID from Supabase
        const { createClient } = await import('@/app/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          await clearCurrentProject(user.id);
          setActiveTab('topic');
          window.location.href = '/dashboard/ebook-writer';
        } else {
          console.warn('No user found for clearing session');
        }
      } catch (error) {
        console.error('Error starting over:', error);
      }
    }
  };

  const handleTopicSelect = (topicTitle: string) => {
    // Update topic in store first
    setTopic(topicTitle);
    
    // Set active tab
    setActiveTab('title');
    
    // Navigate to title tab using router
    router.push('/dashboard/ebook-writer/title');
  };

  return (
    <OutputPanelShell 
      title="Popular Topics" 
      status={isLoading ? 'loading' : error ? 'error' : 'ready'}
    >
      {isLoading ? (
        <div className="p-8 flex items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p>Loading trending topics...</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          <div className="space-y-2">
            {popularTopics.map((topicItem, index) => {
              const Icon = getTopicIcon(index);
              return (
                <div 
                  key={topicItem.id} 
                  className="p-4 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 border-border group"
                  onClick={() => handleTopicSelect(topicItem.title)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 border-gray-300 group-hover:border-primary">
                      {/* Empty radio button - could add selected state logic later */}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed font-medium">
                        {topicItem.title}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </OutputPanelShell>
  );
}