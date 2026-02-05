'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Copy,
  Eye,
  Star,
  Pencil,
  Trash2,
  Video,
  Megaphone,
  GraduationCap,
  Share2,
  Mail,
  FileText
} from 'lucide-react';
import type { Prompt, PromptCategory } from '@/lib/prompt-library/types';

interface PromptCardProps {
  prompt: Prompt;
  isAdmin?: boolean;
  onView: (prompt: Prompt) => void;
  onCopy: (prompt: Prompt) => void;
  onEdit?: (prompt: Prompt) => void;
  onDelete?: (prompt: Prompt) => void;
}

const categoryIcons: Record<PromptCategory, React.ReactNode> = {
  video_scripts: <Video className="w-3 h-3" />,
  marketing: <Megaphone className="w-3 h-3" />,
  educational: <GraduationCap className="w-3 h-3" />,
  social_media: <Share2 className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
  general: <FileText className="w-3 h-3" />,
};

const categoryLabels: Record<PromptCategory, string> = {
  video_scripts: 'Video Scripts',
  marketing: 'Marketing',
  educational: 'Educational',
  social_media: 'Social Media',
  email: 'Email',
  general: 'General',
};

export function PromptCard({
  prompt,
  isAdmin,
  onView,
  onCopy,
  onEdit,
  onDelete,
}: PromptCardProps) {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Header with category and featured badge */}
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
            {categoryIcons[prompt.category]}
            {categoryLabels[prompt.category]}
          </Badge>
          {prompt.is_featured && (
            <Badge variant="default" className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-500">
              <Star className="w-3 h-3 fill-current" />
              Featured
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-base line-clamp-1">{prompt.title}</h3>

        {/* Description */}
        {prompt.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {prompt.description}
          </p>
        )}

        {/* Use case */}
        {prompt.use_case && (
          <p className="text-xs text-primary/80">
            Use case: {prompt.use_case}
          </p>
        )}

        {/* Tags */}
        {prompt.tags && prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {prompt.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {prompt.tags.length > 3 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{prompt.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onCopy(prompt)}
          >
            <Copy className="w-4 h-4 mr-1" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onView(prompt)}
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex gap-2 pt-1 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => onEdit?.(prompt)}
            >
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-xs text-destructive hover:text-destructive"
              onClick={() => onDelete?.(prompt)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
