'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, RotateCcw, MessageSquare, X } from 'lucide-react';

interface PromptRefinerProps {
  prompt: string;
  onPromptChange: (newPrompt: string) => void;
  disabled?: boolean;
}

// Quick refinement suggestions
const QUICK_SUGGESTIONS = [
  'Replace the product with my own product',
  'Change the main character to match my brand',
  'Make the setting more modern and minimal',
  'Adjust the color palette to warmer tones',
];

export function PromptRefiner({ prompt, onPromptChange, disabled = false }: PromptRefinerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [originalPrompt] = useState(prompt);
  const [currentPrompt, setCurrentPrompt] = useState(prompt);

  const handleRefine = async () => {
    if (!chatInput.trim() || isRefining) return;

    setIsRefining(true);
    try {
      const response = await fetch('/api/prompt-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: currentPrompt,
          instruction: chatInput,
        }),
      });

      const data = await response.json();

      if (data.success && data.refinedPrompt) {
        setCurrentPrompt(data.refinedPrompt);
        onPromptChange(data.refinedPrompt);
        setChatInput('');
      } else {
        console.error('Failed to refine prompt:', data.error);
      }
    } catch (error) {
      console.error('Error refining prompt:', error);
    } finally {
      setIsRefining(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRefine();
    }
  };

  const handleReset = () => {
    setCurrentPrompt(originalPrompt);
    onPromptChange(originalPrompt);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setChatInput(suggestion);
  };

  const hasChanges = currentPrompt !== originalPrompt;

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        <MessageSquare className="w-3 h-3 mr-1" />
        Customize with AI
      </Button>
    );
  }

  return (
    <div className="mt-3 p-3 bg-secondary/30 rounded-lg border border-border/50 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300 flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          AI Prompt Customizer
        </span>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={disabled || isRefining}
              className="h-6 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-6 w-6 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_SUGGESTIONS.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => handleSuggestionClick(suggestion)}
            disabled={disabled || isRefining}
            className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Chat input */}
      <div className="flex gap-2">
        <Textarea
          placeholder="e.g., Change the energy drink to my protein shake called MuscleMax..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isRefining}
          className="min-h-[50px] max-h-[100px] resize-none text-xs"
        />
        <Button
          onClick={handleRefine}
          disabled={disabled || isRefining || !chatInput.trim()}
          size="icon"
          className="h-[50px] w-[50px] shrink-0"
        >
          {isRefining ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Modified indicator */}
      {hasChanges && (
        <p className="text-[10px] text-green-400">
          Prompt modified. Changes will be used when sending to Storyboard.
        </p>
      )}
    </div>
  );
}
