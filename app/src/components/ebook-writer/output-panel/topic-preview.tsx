'use client';

import { useRouter } from 'next/navigation';
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
  },
  {
    title: 'Amazon Affiliate Marketing Guide',
    description: 'Complete guide to earning with Amazon Associates program',
    icon: Sparkles,
    gradient: 'from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    iconColor: 'text-yellow-500'
  },
  {
    title: 'High-Ticket Affiliate Marketing',
    description: 'Promote premium products for maximum commission earnings',
    icon: TrendingUp,
    gradient: 'from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    iconColor: 'text-emerald-500'
  },
  {
    title: 'Affiliate Marketing for Beginners',
    description: 'Step-by-step guide to start your affiliate marketing journey',
    icon: BookOpen,
    gradient: 'from-slate-50 to-gray-50 dark:from-slate-950/20 dark:to-gray-950/20',
    borderColor: 'border-slate-200 dark:border-slate-800',
    iconColor: 'text-slate-500'
  },
  {
    title: 'Conversion Rate Optimization for Affiliates',
    description: 'Maximize your affiliate earnings through better conversions',
    icon: ArrowRight,
    gradient: 'from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20',
    borderColor: 'border-rose-200 dark:border-rose-800',
    iconColor: 'text-rose-500'
  }
];

export function TopicPreview({ topic = '', documents = [] }: TopicPreviewProps) {
  const router = useRouter();
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
      status="ready"
    >
        <div className="p-4 space-y-2">
          <div className="space-y-2">
            {popularTopics.map((topic, index) => (
              <div 
                key={index} 
                className="p-4 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 border-border"
                onClick={() => handleTopicSelect(topic.title)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 border-gray-300">
                    {/* Empty radio button - could add selected state logic later */}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed font-medium">
                      {topic.title}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </OutputPanelShell>
    );
}