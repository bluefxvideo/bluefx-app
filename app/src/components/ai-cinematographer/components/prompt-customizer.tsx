'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  X,
  Upload,
  Plus,
  Sparkles,
  User,
  Package,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AssetReference {
  id: string;
  file: File;
  preview: string;
  label: string;
  type: 'character' | 'product' | 'environment' | 'other';
  description?: string;
}

export interface PromptCustomizerProps {
  originalPrompt: string;
  customizedPrompt: string;
  onPromptChange: (prompt: string) => void;
  assets: AssetReference[];
  onAssetsChange: (assets: AssetReference[]) => void;
  onRewriteWithAI: (instruction: string) => Promise<void>;
  isRewriting?: boolean;
  disabled?: boolean;
}

const ASSET_TYPES = [
  { id: 'character', label: 'Character/Face', icon: User },
  { id: 'product', label: 'Product', icon: Package },
  { id: 'environment', label: 'Environment', icon: ImageIcon },
  { id: 'other', label: 'Other', icon: ImageIcon },
] as const;

const MAX_ASSETS = 8;

export function PromptCustomizer({
  originalPrompt,
  customizedPrompt,
  onPromptChange,
  assets,
  onAssetsChange,
  onRewriteWithAI,
  isRewriting = false,
  disabled = false,
}: PromptCustomizerProps) {
  const [chatInput, setChatInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedAssetType, setSelectedAssetType] = useState<AssetReference['type']>('character');
  const [assetLabel, setAssetLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasChanges = customizedPrompt !== originalPrompt;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    const newAsset: AssetReference = {
      id: `asset-${Date.now()}`,
      file,
      preview: URL.createObjectURL(file),
      label: assetLabel || `My ${selectedAssetType}`,
      type: selectedAssetType,
    };

    onAssetsChange([...assets, newAsset]);
    setAssetLabel('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAsset = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      URL.revokeObjectURL(asset.preview);
    }
    onAssetsChange(assets.filter(a => a.id !== assetId));
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isRewriting) return;

    await onRewriteWithAI(chatInput);
    setChatInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  };

  const resetToOriginal = () => {
    onPromptChange(originalPrompt);
  };

  // Generate suggested instructions based on uploaded assets
  const getSuggestedInstructions = (): string[] => {
    const suggestions: string[] = [];

    const characters = assets.filter(a => a.type === 'character');
    const products = assets.filter(a => a.type === 'product');

    if (characters.length > 0) {
      suggestions.push(`Use "${characters[0].label}" as the main character throughout all frames`);
    }
    if (products.length > 0) {
      suggestions.push(`Replace any products shown with "${products[0].label}"`);
    }
    if (assets.length > 0) {
      suggestions.push('Make all characters consistent across frames using my uploaded references');
    }

    return suggestions;
  };

  const suggestedInstructions = getSuggestedInstructions();

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h4 className="font-medium">Customize Your Storyboard</h4>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {isExpanded && (
        <>
          {/* Asset Upload Section */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload your own images to replace generic characters or products in the storyboard.
            </p>

            {/* Upload Controls */}
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Asset Label</label>
                <Input
                  placeholder="e.g., My Face, Blue Label Cream..."
                  value={assetLabel}
                  onChange={(e) => setAssetLabel(e.target.value)}
                  disabled={disabled || assets.length >= MAX_ASSETS}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Type</label>
                <select
                  value={selectedAssetType}
                  onChange={(e) => setSelectedAssetType(e.target.value as AssetReference['type'])}
                  disabled={disabled || assets.length >= MAX_ASSETS}
                  className="h-9 px-3 rounded-md border bg-background text-sm"
                >
                  {ASSET_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || assets.length >= MAX_ASSETS}
                className="h-9"
              >
                <Upload className="w-4 h-4 mr-1" />
                Upload
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Uploaded Assets Grid */}
            {assets.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {assets.map((asset) => {
                  const TypeIcon = ASSET_TYPES.find(t => t.id === asset.type)?.icon || ImageIcon;
                  return (
                    <div
                      key={asset.id}
                      className="relative rounded-lg overflow-hidden border bg-muted/30 group"
                    >
                      <img
                        src={asset.preview}
                        alt={asset.label}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-1">
                        <div className="flex items-center gap-1">
                          <TypeIcon className="w-3 h-3 text-white/70" />
                          <span className="text-[10px] text-white truncate">{asset.label}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-5 w-5 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeAsset(asset.id)}
                        disabled={disabled}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Chat Section */}
          <div className="space-y-3 pt-3 border-t">
            <p className="text-sm text-muted-foreground">
              Tell the AI how to modify your prompt. It will rewrite it to incorporate your assets.
            </p>

            {/* Suggested Instructions */}
            {suggestedInstructions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestedInstructions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setChatInput(suggestion)}
                    disabled={disabled || isRewriting}
                    className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Chat Input */}
            <div className="flex gap-2">
              <Textarea
                placeholder="e.g., Replace the main character with my face, use my product instead of the generic cream..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled || isRewriting}
                className="min-h-[60px] resize-none"
              />
              <Button
                onClick={handleChatSubmit}
                disabled={disabled || isRewriting || !chatInput.trim()}
                size="icon"
                className="h-[60px] w-[60px]"
              >
                {isRewriting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Modified Prompt Preview */}
          {hasChanges && (
            <div className="space-y-2 pt-3 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-600">Modified Prompt</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetToOriginal}
                  disabled={disabled}
                  className="text-xs h-7"
                >
                  Reset to Original
                </Button>
              </div>
              <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-sm max-h-[150px] overflow-y-auto">
                {customizedPrompt}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
