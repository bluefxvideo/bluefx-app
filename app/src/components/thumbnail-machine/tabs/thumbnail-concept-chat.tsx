'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Send, Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { cn } from '@/lib/utils';

interface ThumbnailConcept {
  name: string;
  textOverlay: string;
  whyItWorks: string;
  prompt: string;
}

interface ThumbnailConceptChatProps {
  transcript: string;
  videoTitle: string;
  onUsePrompt: (prompt: string, textOverlay?: string) => void;
  referenceImageUrls?: string[];
}

/** Parse Gemini's markdown response into structured concept objects */
function parseConcepts(text: string): ThumbnailConcept[] {
  const concepts: ThumbnailConcept[] = [];

  // Split by concept headers like **Concept 1: Name** or **Concept N: Name**
  const conceptBlocks = text.split(/\*\*Concept\s+\d+:\s*/i).filter(Boolean);

  for (const block of conceptBlocks) {
    // Extract name (everything before the closing **)
    const nameMatch = block.match(/^([^*]+)\*\*/);
    const name = nameMatch ? nameMatch[1].trim() : '';

    // Extract text overlay
    const overlayMatch = block.match(/text\s+overlay:\s*"?([^"\n]+)"?/i);
    const textOverlay = overlayMatch ? overlayMatch[1].trim() : '';

    // Extract why it works
    const whyMatch = block.match(/why\s+it\s+works:\s*([^\n]+)/i);
    const whyItWorks = whyMatch ? whyMatch[1].trim() : '';

    // Extract prompt (can be multi-line, goes until next concept or end)
    const promptMatch = block.match(/prompt:\s*([\s\S]*?)(?=\n\n\*\*|$)/i);
    const prompt = promptMatch ? promptMatch[1].trim() : '';

    if (name && prompt) {
      concepts.push({ name, textOverlay, whyItWorks, prompt });
    }
  }

  return concepts;
}

export function ThumbnailConceptChat({
  transcript,
  videoTitle,
  onUsePrompt,
  referenceImageUrls = [],
}: ThumbnailConceptChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const hasSentInitial = useRef(false);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/thumbnail-concepts' }),
    []
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (err) => {
      console.error('Thumbnail concept chat error:', err);
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Auto-send initial message to get concepts
  useEffect(() => {
    if (!hasSentInitial.current && transcript) {
      hasSentInitial.current = true;
      sendMessage(
        { text: 'Suggest 3 thumbnail concepts for this video.' },
        { body: { transcript, videoTitle, referenceImageUrls } }
      );
    }
  }, [transcript, videoTitle, referenceImageUrls, sendMessage]);

  // Get the latest assistant message and parse concepts from it
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant');

  const latestText = latestAssistantMessage?.parts?.find(
    (p) => p.type === 'text'
  );
  const messageText = latestText?.type === 'text' ? latestText.text : '';
  const concepts = parseConcepts(messageText);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      sendMessage(
        { text: inputValue },
        { body: { transcript, videoTitle, referenceImageUrls } }
      );
      setInputValue('');
    }
  };

  const handleUse = (prompt: string, textOverlay: string, index: number) => {
    onUsePrompt(prompt, textOverlay || undefined);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const quickPrompts = [
    'More dramatic',
    'Add a person',
    'Minimalist style',
    'More colorful',
  ];

  return (
    <div className="space-y-3">
      {/* Loading state */}
      {isLoading && concepts.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Generating thumbnail ideas...</span>
        </div>
      )}

      {/* Concept cards */}
      {concepts.length > 0 && (
        <div className="space-y-2.5">
          {concepts.map((concept, i) => (
            <div
              key={i}
              className="bg-muted/30 rounded-lg border border-border/50 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {i + 1}
                    </span>
                    <h4 className="text-sm font-medium truncate">
                      {concept.name}
                    </h4>
                  </div>
                  {concept.textOverlay && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Text overlay:{' '}
                      <span className="font-medium text-foreground">
                        &ldquo;{concept.textOverlay}&rdquo;
                      </span>
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 text-xs shrink-0',
                    copiedIndex === i
                      ? 'text-green-500'
                      : 'text-primary hover:text-primary'
                  )}
                  onClick={() => handleUse(concept.prompt, concept.textOverlay, i)}
                >
                  {copiedIndex === i ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Used!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Use This
                    </>
                  )}
                </Button>
              </div>
              {concept.whyItWorks && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {concept.whyItWorks}
                </p>
              )}
              <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2 italic">
                {concept.prompt}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Updating indicator */}
      {isLoading && concepts.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Updating concepts...</span>
        </div>
      )}

      {/* Refinement input + quick prompts */}
      {concepts.length > 0 && !isLoading && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((qp) => (
              <Button
                key={qp}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  sendMessage(
                    { text: qp },
                    { body: { transcript, videoTitle, referenceImageUrls } }
                  );
                }}
              >
                {qp}
              </Button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Refine these concepts..."
              className="flex-1 h-9 text-sm"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim()}
              size="sm"
              className="h-9 px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
