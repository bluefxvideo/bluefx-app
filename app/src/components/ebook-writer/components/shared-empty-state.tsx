'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LucideIcon } from 'lucide-react';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { useRouter } from 'next/navigation';

interface SharedEbookEmptyStateProps {
  icon: LucideIcon;
  title: string;
  message?: string;
  backTo: 'topic' | 'title' | 'outline' | 'content';
}

/**
 * Shared empty state component for ebook writer tabs
 * Eliminates duplicate "No X Selected" cards
 */
export function SharedEbookEmptyState({ 
  icon: Icon, 
  title, 
  message,
  backTo 
}: SharedEbookEmptyStateProps) {
  const router = useRouter();
  const { setActiveTab } = useEbookWriterStore();

  const backToConfig = {
    topic: { label: 'Back to Topic', path: '/dashboard/ebook-writer' },
    title: { label: 'Back to Title', path: '/dashboard/ebook-writer/title' },
    outline: { label: 'Back to Outline', path: '/dashboard/ebook-writer/outline' },
    content: { label: 'Back to Content', path: '/dashboard/ebook-writer/content' }
  };

  const config = backToConfig[backTo];

  const handleBack = () => {
    setActiveTab(backTo);
    router.push(config.path);
  };

  return (
    <div className="h-full flex items-center justify-center">
      <Card className="max-w-md text-center">
        <CardContent className="pt-6">
          <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium mb-2">{title}</h3>
          {message && (
            <p className="text-sm text-muted-foreground mb-4">{message}</p>
          )}
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {config.label}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}