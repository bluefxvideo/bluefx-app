'use client';

import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface UnifiedEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onFocusPrompt?: () => void;
}

/**
 * Unified Empty State Component
 * Follows the Simplified Professional design pattern
 * Consistent styling across all tools and tabs
 */
export function UnifiedEmptyState({ 
  icon: Icon, 
  title, 
  description, 
  onFocusPrompt 
}: UnifiedEmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card 
        className="p-8 max-w-sm text-center space-y-4 border-dashed bg-secondary/30 border-muted-foreground/10 cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={onFocusPrompt}
      >
        <div className="w-16 h-16 bg-muted/60 rounded-xl flex items-center justify-center mx-auto border border-border/30">
          <Icon className="w-7 h-7 text-muted-foreground" />
        </div>
        
        <div>
          <h3 className="font-medium mb-2 text-foreground/80">{title}</h3>
          <p className="text-sm text-muted-foreground/70 leading-relaxed">
            {description}
          </p>
        </div>
      </Card>
    </div>
  );
}