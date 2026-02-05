'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Copy,
  Check,
  ExternalLink,
  Video,
  Megaphone,
  GraduationCap,
  Share2,
  Mail,
  FileText,
  Star
} from 'lucide-react';
import { toast } from 'sonner';
import type { Prompt, PromptCategory } from '@/lib/prompt-library/types';

interface PromptDetailDialogProps {
  prompt: Prompt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryIcons: Record<PromptCategory, React.ReactNode> = {
  video_scripts: <Video className="w-4 h-4" />,
  marketing: <Megaphone className="w-4 h-4" />,
  educational: <GraduationCap className="w-4 h-4" />,
  social_media: <Share2 className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  general: <FileText className="w-4 h-4" />,
};

const categoryLabels: Record<PromptCategory, string> = {
  video_scripts: 'Video Scripts',
  marketing: 'Marketing',
  educational: 'Educational',
  social_media: 'Social Media',
  email: 'Email',
  general: 'General',
};

export function PromptDetailDialog({
  prompt,
  open,
  onOpenChange,
}: PromptDetailDialogProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  if (!prompt) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.prompt_text);
      setCopied(true);
      toast.success('Prompt copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy prompt');
    }
  };

  const handleUseInScriptGenerator = () => {
    const encodedPrompt = encodeURIComponent(prompt.prompt_text);
    router.push(`/dashboard/script-generator?prompt=${encodedPrompt}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <DialogTitle className="text-xl">{prompt.title}</DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  {categoryIcons[prompt.category]}
                  {categoryLabels[prompt.category]}
                </Badge>
                {prompt.is_featured && (
                  <Badge className="flex items-center gap-1 bg-amber-500 hover:bg-amber-500">
                    <Star className="w-3 h-3 fill-current" />
                    Featured
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Description */}
          {prompt.description && (
            <p className="text-muted-foreground">{prompt.description}</p>
          )}

          {/* Use case */}
          {prompt.use_case && (
            <div className="text-sm">
              <span className="font-medium">Use case:</span>{' '}
              <span className="text-primary">{prompt.use_case}</span>
            </div>
          )}

          {/* Tags */}
          {prompt.tags && prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {prompt.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Prompt text */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Prompt</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <ScrollArea className="h-[300px] rounded-lg border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap text-sm font-mono">
                {prompt.prompt_text}
              </pre>
            </ScrollArea>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy to Clipboard
              </>
            )}
          </Button>
          <Button
            className="flex-1"
            onClick={handleUseInScriptGenerator}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Use in Script Generator
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
