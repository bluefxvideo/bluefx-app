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
        className="p-8 max-w-sm text-center space-y-4 border-dashed bg-secondary border-muted-foreground/20 cursor-pointer hover:bg-secondary/80 transition-colors"
        onClick={onFocusPrompt}
      >
        <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto">
          <Icon className="w-8 h-8 text-white" />
        </div>
        
        <div>
          <h3 className="font-medium mb-2">{title}</h3>
          <p className="text-base text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </Card>
    </div>
  );
}