'use client';

import { useState, useMemo } from 'react';
import { Send, Loader2, Sparkles, Plus, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { cn } from '@/lib/utils';

interface LyricsAssistantProps {
  onInsertLyrics: (lyrics: string) => void;
  currentLyrics: string;
  musicStyle: string;
}

export function LyricsAssistant({
  onInsertLyrics,
  currentLyrics,
  musicStyle,
}: LyricsAssistantProps) {
  const [inputValue, setInputValue] = useState('');

  // Create transport with custom API endpoint
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/lyrics-assistant' }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    onError: (err) => {
      console.error('Lyrics assistant error:', err);
    },
    onFinish: () => {
      // Message complete
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      sendMessage(
        { text: inputValue },
        { body: { musicStyle, currentLyrics } }
      );
      setInputValue('');
    }
  };

  const handleInsert = (text: string) => {
    // Clean the text - remove any markdown formatting
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^```[\s\S]*?```$/gm, '')
      .trim();

    onInsertLyrics(cleanText);
  };

  const isLoading = status === 'streaming' || status === 'submitted';

  // Quick prompts for common requests
  const quickPrompts = [
    { label: 'Write a verse', prompt: 'Write a verse for this song' },
    { label: 'Write a chorus', prompt: 'Write a catchy chorus' },
    { label: 'Add a bridge', prompt: 'Write a bridge section' },
  ];

  return (
    <div className="flex flex-col h-full bg-muted/30 rounded-lg border border-border/50">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Wand2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">AI Lyrics Assistant</span>
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && (
        <div className="px-3 py-3 space-y-2 border-b border-border/30">
          <p className="text-xs text-muted-foreground">Quick start:</p>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((qp) => (
              <Button
                key={qp.label}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  sendMessage(
                    { text: qp.prompt },
                    { body: { musicStyle, currentLyrics } }
                  );
                }}
                disabled={isLoading}
              >
                {qp.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2 space-y-3">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-6">
              <Sparkles className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Describe what you want to write
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                &quot;Write a verse about heartbreak&quot;
              </p>
            </div>
          )}

          {messages.map((message) => {
            // Find the text part (AI SDK v5 has step-start at parts[0] for assistant messages)
            const textPart = message.parts?.find(part => part.type === 'text');
            const messageText = textPart?.type === 'text' ? textPart.text : '';
            const isUser = message.role === 'user';

            return (
              <div
                key={message.id}
                className={cn(
                  'text-sm',
                  isUser ? 'text-right' : ''
                )}
              >
                {isUser ? (
                  <div className="inline-block bg-primary text-primary-foreground rounded-lg px-3 py-2 max-w-[90%]">
                    {messageText}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-background rounded-lg px-3 py-2 border border-border/50">
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {messageText}
                      </pre>
                    </div>
                    {messageText && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary hover:text-primary"
                        onClick={() => handleInsert(messageText)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Insert into lyrics
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Writing...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Describe what to write..."
            disabled={isLoading}
            className="flex-1 h-9 text-sm"
          />
          <Button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            size="sm"
            className="h-9 px-3"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-1.5">
          Try: &quot;make line 2 more emotional&quot; or &quot;add a pre-chorus&quot;
        </p>
      </form>
    </div>
  );
}
