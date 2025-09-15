'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import { analyzeKeyword } from '@/actions/research/keyword-analyzer';
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

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface KeywordAnalyzerDialogProps {
  keyword: Keyword | null;
  isOpen: boolean;
  onClose: () => void;
}

// Helper function to render formatted content
const renderFormattedContent = (content: string) => {
  const lines = content.split('\n').filter((line) => line.trim() !== '');
  const elements: React.ReactNode[] = [];
  let currentListType: 'ol' | 'ul' | null = null;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      if (currentListType === 'ol') {
        elements.push(
          <ol
            key={`ol-${elements.length}`}
            className="list-decimal list-inside space-y-1 pl-4 mb-2"
          >
            {listItems}
          </ol>
        );
      } else if (currentListType === 'ul') {
        elements.push(
          <ul
            key={`ul-${elements.length}`}
            className="list-disc list-inside space-y-1 pl-4 mb-2"
          >
            {listItems}
          </ul>
        );
      }
      listItems = [];
      currentListType = null;
    }
  };

  // Helper function to process inline bold text
  const processInlineBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  lines.forEach((line, index) => {
    const key = `line-${index}`;

    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={key} className="text-md font-semibold mt-4 mb-2">
          {line.substring(4)}
        </h3>
      );
    } else if (line.match(/^\*\*.*?\*\*(?:\s*:|$)/)) {
      flushList();
      const headerText = line.replace(/^\*\*(.*?)\*\*\s*:?/, '$1');
      const remainingText = line.replace(/^\*\*(.*?)\*\*\s*:?\s*/, '');
      elements.push(
        <p key={key} className="mb-2">
          <strong className="font-semibold">{headerText}</strong>
          {remainingText && ': ' + processInlineBold(remainingText)}
        </p>
      );
    } else if (line.match(/^\d+\. /)) {
      if (currentListType !== 'ol') {
        flushList();
        currentListType = 'ol';
      }
      const listItemText = line.replace(/^\d+\.\s*/, '');
      listItems.push(<li key={key}>{processInlineBold(listItemText)}</li>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (currentListType !== 'ul') {
        flushList();
        currentListType = 'ul';
      }
      const listItemText = line.replace(/^[\-\*]\s*/, '');
      listItems.push(<li key={key}>{processInlineBold(listItemText)}</li>);
    } else {
      flushList();
      elements.push(
        <p key={key} className="mb-2">
          {processInlineBold(line)}
        </p>
      );
    }
  });

  flushList();
  return <>{elements}</>;
};

export function KeywordAnalyzerDialog({
  keyword,
  isOpen,
  onClose,
}: KeywordAnalyzerDialogProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Reset state when dialog opens or keyword changes
  useEffect(() => {
    if (isOpen && keyword) {
      setMessages([]);
      setNewMessage('');
      setCurrentStreamingMessage('');
      setIsLoading(true);
      // Fetch initial analysis
      handleAnalyzerRequest('');
    } else if (!isOpen) {
      // Clear state when closing
      setMessages([]);
      setCurrentStreamingMessage('');
      setNewMessage('');
    }
  }, [isOpen, keyword]);

  // Auto-scroll
  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamingMessage]);

  const handleAnalyzerRequest = async (userMessage: string) => {
    if (!keyword) return;

    // Add user message if provided
    const updatedMessages = userMessage
      ? [...messages, { role: 'user' as const, content: userMessage }]
      : messages;

    if (userMessage) {
      setMessages(updatedMessages);
      setNewMessage('');
    }

    setIsLoading(true);
    setCurrentStreamingMessage('');

    try {
      // Call the server action
      const response = await analyzeKeyword({
        keyword: {
          keyword: keyword.keyword,
          search_volume: keyword.search_volume,
          difficulty_score: keyword.difficulty_score,
          competition_level: keyword.competition_level,
          cost_per_click: keyword.cost_per_click,
          trend_status: keyword.trend_status,
          search_intent: keyword.search_intent,
        },
        messages: updatedMessages.length > 0 ? updatedMessages : undefined,
      });

      if (response.success && response.content) {
        // Add assistant message
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.content,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Sorry, I encountered an error: ${
              response.error || 'Unknown error'
            }. Please try again.`,
          },
        ]);
      }
    } catch (error) {
      console.error('Analysis request failed:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error. Please try again.`,
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const messageToSend = newMessage.trim();
    if (messageToSend && !isLoading) {
      handleAnalyzerRequest(messageToSend);
    }
  };

  if (!keyword) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Keyword Analysis: {keyword.keyword}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {/* Render messages */}
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-4 py-3',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {message.role === 'assistant' ? (
                    renderFormattedContent(message.content)
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {currentStreamingMessage && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                  {renderFormattedContent(currentStreamingMessage)}
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !currentStreamingMessage && messages.length === 0 && (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* Loading for follow-up */}
            {isLoading && messages.length > 0 && !currentStreamingMessage && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="px-6 py-4 border-t shrink-0"
        >
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Ask a follow-up question..."
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isLoading || !newMessage.trim()}
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