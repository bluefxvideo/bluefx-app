'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookOpen, FileText, Sparkles, ArrowRight, MoreVertical, RotateCcw, TrendingUp } from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import type { UploadedDocument } from '@/actions/tools/ebook-document-handler';

interface TopicPreviewProps {
  topic: string;
  documents: UploadedDocument[];
}

// Popular affiliate marketing topics
const popularTopics = [
  {
    title: 'Passive Income with Affiliate Marketing',
    description: 'Learn how to build sustainable passive income streams through affiliate marketing',
    icon: TrendingUp,
    gradient: 'from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20',
    borderColor: 'border-green-200 dark:border-green-800',
    iconColor: 'text-green-500'
  },
  {
    title: 'Content Creation Mastery for Affiliates',
    description: 'Master the art of creating engaging content that converts',
    icon: FileText,
    gradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-500'
  },
  {
    title: 'Social Media Affiliate Domination',
    description: 'Leverage social media platforms to maximize your affiliate earnings',
    icon: Sparkles,
    gradient: 'from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    iconColor: 'text-purple-500'
  },
  {
    title: 'Email Marketing for Affiliate Success',
    description: 'Build and monetize your email list for affiliate marketing success',
    icon: ArrowRight,
    gradient: 'from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    iconColor: 'text-orange-500'
  },
  {
    title: 'YouTube Affiliate Mastery',
    description: 'Create profitable YouTube content that drives affiliate sales',
    icon: BookOpen,
    gradient: 'from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20',
    borderColor: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-500'
  },
  {
    title: 'Affiliate SEO Blueprint',
    description: 'Master SEO strategies to rank your affiliate content',
    icon: TrendingUp,
    gradient: 'from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    iconColor: 'text-indigo-500'
  }
];

export function TopicPreview({ topic = '', documents = [] }: TopicPreviewProps) {
  const hasContent = topic && topic.trim().length > 0;
  const { setActiveTab, clearCurrentProject, setTopic, generateTitles } = useEbookWriterStore();

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

  const handleTopicSelect = async (topicTitle: string) => {
    // Update topic in store
    setTopic(topicTitle);
    
    // Generate titles automatically after selecting popular topic
    try {
      await generateTitles(topicTitle);
      setActiveTab('title');
      
      // Navigate to title tab
      window.location.href = '/dashboard/ebook-writer/title';
    } catch (error) {
      console.error('Error generating titles:', error);
    }
  };

  // Three-dot menu for actions
  const actionsMenu = hasContent ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleStartOver} className="text-destructive">
          <RotateCcw className="mr-2 h-4 w-4" />
          Start Over
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;
  
  // Show popular topics when no topic selected
  if (!hasContent) {
    return (
      <OutputPanelShell 
        title="Popular Topics" 
        status="idle"
      >
        <div className="p-4 space-y-3">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Start with a Popular Topic
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click any topic to automatically generate titles and get started
            </p>
          </div>
          
          <div className="space-y-3">
            {popularTopics.map((topic, index) => {
              const IconComponent = topic.icon;
              return (
                <Card 
                  key={index}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] bg-gradient-to-br ${topic.gradient} ${topic.borderColor}`}
                  onClick={() => handleTopicSelect(topic.title)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <IconComponent className={`h-5 w-5 ${topic.iconColor} flex-shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 leading-tight">
                          {topic.title}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {topic.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </OutputPanelShell>
    );
  }
  
  return (
    <OutputPanelShell title="Ebook Preview" status="ready" actions={actionsMenu}>
      <div className="space-y-4 p-4">
        {/* Topic Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Topic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {topic}
            </p>
            {documents.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {documents.length} reference document{documents.length > 1 ? 's' : ''} uploaded
                </span>
              </div>
            )}
          </CardContent>
        </Card>


      </div>
    </OutputPanelShell>
  );
}