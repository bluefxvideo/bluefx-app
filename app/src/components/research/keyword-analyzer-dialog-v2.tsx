'use client';

import React, { useEffect, useRef } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat } from '@ai-sdk/react';
import { cn } from '@/lib/utils';

interface Keyword {
  id: string;
  keyword: string;
  search_volume: number | null;
  difficulty_score: number | null;
  competition_level: string | null;
  cost_per_click: number | null;
  trend_status?: string;
  search_intent?: string;
}

interface KeywordAnalyzerDialogProps {
  keyword: Keyword | null;
  isOpen: boolean;
  onClose: () => void;
}

export function KeywordAnalyzerDialogV2({
  keyword,
  isOpen,
  onClose,
}: KeywordAnalyzerDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input = '',
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    append,
  } = useChat({
    api: '/api/keyword-analysis',
    body: {
      keyword: keyword ? {
        keyword: keyword.keyword,
        search_volume: keyword.search_volume,
        difficulty_score: keyword.difficulty_score,
        competition_level: keyword.competition_level,
        cost_per_click: keyword.cost_per_click,
        trend_status: keyword.trend_status,
        search_intent: keyword.search_intent,
      } : null,
    },
  });

  // Reset and trigger initial analysis when dialog opens
  useEffect(() => {
    if (isOpen && keyword) {
      // Clear messages and trigger initial analysis
      setMessages([]);
      // Trigger initial analysis with an empty user message
      setTimeout(() => {
        append({
          role: 'user',
          content: 'Analyze this keyword',
        });
      }, 100);
    }
  }, [isOpen, keyword]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!keyword) return null;

  // Format message content with markdown-like styling
  const formatMessage = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      // Headers
      if (line.match(/^#{1,3}\s/)) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^#+\s/, '');
        const className = level === 1 ? 'text-lg font-bold' : level === 2 ? 'text-md font-semibold' : 'text-sm font-semibold';
        return <h3 key={i} className={cn(className, 'mt-3 mb-2')}>{text}</h3>;
      }

      // Bold text
      if (line.includes('**')) {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={i} className="mb-2">
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        );
      }

      // Lists
      if (line.match(/^\d+\.\s/) || line.match(/^[-*]\s/)) {
        const text = line.replace(/^(\d+\.|-|\*)\s/, '');
        return (
          <li key={i} className="ml-4 mb-1">
            {text}
          </li>
        );
      }

      // Regular paragraphs
      if (line.trim()) {
        return <p key={i} className="mb-2">{line}</p>;
      }

      return null;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Keyword Analysis: {keyword.keyword}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6" ref={scrollRef}>
          <div className="py-4 space-y-4">
            {messages.length === 0 && isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Analyzing keyword...</p>
                </div>
              </div>
            )}

            {messages
              .filter((message) =>
                // Hide the initial trigger message
                !(message.role === 'user' && message.content === 'Analyze this keyword')
              )
              .map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-4 py-3',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.role === 'user' ? (
                      <p>{message.content}</p>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {formatMessage(message.content)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {isLoading && messages.length > 0 && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <form
          onSubmit={handleSubmit}
          className="px-6 py-4 border-t shrink-0"
        >
          <div className="flex gap-2">
            <Input
              value={input || ''}
              onChange={handleInputChange || (() => {})}
              placeholder="Ask a follow-up question..."
              disabled={isLoading}
              className="flex-1"
              readOnly={!handleInputChange}
            />
            <Button
              type="submit"
              disabled={isLoading || !input?.trim()}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}