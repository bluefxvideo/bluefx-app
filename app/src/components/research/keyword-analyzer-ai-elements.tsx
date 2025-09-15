'use client';

import React, { useEffect, useState } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat } from '@ai-sdk/react';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

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

interface KeywordAnalyzerAIElementsProps {
  keyword: Keyword | null;
  isOpen: boolean;
  onClose: () => void;
}

export function KeywordAnalyzerAIElements({
  keyword,
  isOpen,
  onClose,
}: KeywordAnalyzerAIElementsProps) {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    api: '/api/chat',
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // Trigger initial analysis when dialog opens
  useEffect(() => {
    if (isOpen && keyword && messages.length === 0) {
      console.log('Triggering initial analysis for keyword:', keyword.keyword);
      // Send initial message to trigger analysis
      sendMessage(
        {
          text: 'Please provide a comprehensive analysis of this keyword.',
        },
        {
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
        }
      );
    }
  }, [isOpen, keyword?.id]); // Use keyword.id to track when a new keyword is selected

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(
        { text: input },
        {
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
        }
      );
      setInput('');
    }
  };

  const isLoading = status === 'loading';

  if (!keyword) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Keyword Analysis: {keyword.keyword}
          </DialogTitle>
          <DialogDescription className="sr-only">
            AI-powered analysis of the keyword {keyword.keyword}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {messages.length === 0 && isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Analyzing keyword...</p>
                </div>
              </div>
            )}

            {messages.map((message) => {
              // Skip the initial trigger message
              const messageText = message.parts?.[0]?.type === 'text' ? message.parts[0].text : '';
              if (message.role === 'user' &&
                  messageText.includes('Please provide a comprehensive analysis')) {
                return null;
              }

              return (
                <Message
                  key={message.id}
                  from={message.role as 'user' | 'assistant'}
                  className={cn(
                    message.role === 'user' && 'flex-row-reverse'
                  )}
                >
                  <MessageContent
                    className={cn(
                      'max-w-[100%] break-words',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <div className={cn(
                      "overflow-hidden",
                      message.role === 'assistant' && "prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-pre:overflow-x-auto"
                    )}>
                      {message.parts?.map((part, i) => {
                        if (part.type === 'text') {
                          return message.role === 'assistant' ? (
                            <ReactMarkdown key={i}>{part.text}</ReactMarkdown>
                          ) : (
                            <p key={i}>{part.text}</p>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </MessageContent>
                </Message>
              );
            })}

            {isLoading && messages.length > 0 && (
              <Message from="assistant">
                <MessageContent className="bg-muted max-w-[85%]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </MessageContent>
              </Message>
            )}
          </div>
        </ScrollArea>

        <form
          onSubmit={handleSubmit}
          className="px-6 py-4 border-t shrink-0"
        >
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a follow-up question..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
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