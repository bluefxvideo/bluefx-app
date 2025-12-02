'use client';

import { useState, useEffect } from 'react';
import { FileText, Video, Film, Mail, Layout, Share2, Target, Pencil, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AffiliateOffer, ScriptType, SCRIPT_TYPES } from '@/lib/affiliate-toolkit/types';
import { fetchOffers, generateScript, refineScript } from '@/lib/affiliate-toolkit/service';

// Icon mapping for script types
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Video,
  Film,
  Mail,
  Layout,
  Share2,
  Target,
  Pencil
};

export function ScriptGeneratorPage() {
  // State
  const [offers, setOffers] = useState<AffiliateOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<AffiliateOffer | null>(null);
  const [selectedScriptType, setSelectedScriptType] = useState<ScriptType | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [refinementInput, setRefinementInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load offers on mount
  useEffect(() => {
    async function loadOffers() {
      try {
        const data = await fetchOffers();
        setOffers(data);
        if (data.length > 0) {
          setSelectedOffer(data[0]);
        }
      } catch (err) {
        setError('Failed to load offers');
        console.error(err);
      } finally {
        setIsLoadingOffers(false);
      }
    }
    loadOffers();
  }, []);

  // Handle generation
  const handleGenerate = async () => {
    if (!selectedOffer || !selectedScriptType) return;

    setIsGenerating(true);
    setError(null);

    try {
      const script = await generateScript(
        selectedOffer,
        selectedScriptType,
        selectedScriptType === 'custom' ? customPrompt : undefined
      );
      setGeneratedScript(script);
    } catch (err) {
      setError('Failed to generate script. Please try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle refinement
  const handleRefine = async () => {
    if (!generatedScript || !refinementInput.trim()) return;

    setIsRefining(true);
    setError(null);

    try {
      const refined = await refineScript(generatedScript, refinementInput);
      setGeneratedScript(refined);
      setRefinementInput('');
    } catch (err) {
      setError('Failed to refine script. Please try again.');
      console.error(err);
    } finally {
      setIsRefining(false);
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (!generatedScript) return;

    try {
      await navigator.clipboard.writeText(generatedScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Input Panel
  const inputPanel = (
    <div className="h-full flex flex-col space-y-6">
      {/* Offer Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-zinc-300">Select Offer</Label>
        <Select
          value={selectedOffer?.id || ''}
          onValueChange={(value) => {
            const offer = offers.find(o => o.id === value);
            setSelectedOffer(offer || null);
          }}
          disabled={isLoadingOffers}
        >
          <SelectTrigger className="w-full bg-card border-border">
            <SelectValue placeholder={isLoadingOffers ? "Loading offers..." : "Select an offer"} />
          </SelectTrigger>
          <SelectContent>
            {offers.map((offer) => (
              <SelectItem key={offer.id} value={offer.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{offer.name}</span>
                  {offer.niche && (
                    <span className="text-xs text-zinc-500">{offer.niche}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Offer Preview */}
        {selectedOffer && (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <p className="text-xs text-zinc-500 mb-1">Offer Details:</p>
              <p className="text-sm text-zinc-300 line-clamp-3">
                {selectedOffer.offer_content || 'No description available'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Script Type Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-zinc-300">Script Type</Label>
        <div className="grid grid-cols-1 gap-2">
          {SCRIPT_TYPES.map((type) => {
            const IconComponent = ICON_MAP[type.icon] || FileText;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedScriptType(type.id)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-all text-left",
                  selectedScriptType === type.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-border/80"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                  selectedScriptType === type.id ? "bg-primary" : "bg-secondary"
                )}>
                  <IconComponent className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium text-sm",
                    selectedScriptType === type.id ? "text-white" : "text-zinc-300"
                  )}>
                    {type.name}
                  </p>
                  <p className="text-xs text-zinc-500 line-clamp-1">
                    {type.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Prompt (only shown when custom is selected) */}
      {selectedScriptType === 'custom' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-zinc-300">Custom Prompt</Label>
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Describe what kind of content you want to generate..."
            className="min-h-[100px] bg-card border-border resize-none"
          />
        </div>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={!selectedOffer || !selectedScriptType || isGenerating || (selectedScriptType === 'custom' && !customPrompt.trim())}
        className="w-full bg-primary hover:bg-primary/90"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Generate Script
          </>
        )}
      </Button>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );

  // Output Panel
  const outputPanel = (
    <div className="h-full flex flex-col">
      {/* Output Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Generated Script</h3>
        {generatedScript && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </Button>
        )}
      </div>

      {/* Output Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {generatedScript ? (
          <div className="bg-card border border-border rounded-lg p-4">
            <pre className="whitespace-pre-wrap text-sm text-zinc-300 font-mono">
              {generatedScript}
            </pre>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center bg-card/50 border border-border/50 rounded-lg">
            <div className="text-center p-8">
              <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-500">
                Select an offer and script type, then click Generate to create your script.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Refinement Section */}
      {generatedScript && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <Label className="text-sm font-medium text-zinc-300">Refine Output</Label>
          <div className="flex gap-2">
            <Textarea
              value={refinementInput}
              onChange={(e) => setRefinementInput(e.target.value)}
              placeholder="Enter refinement instructions (e.g., 'Make it shorter', 'Add more urgency', 'Change the tone to be more casual')"
              className="flex-1 min-h-[60px] bg-card border-border resize-none"
            />
            <Button
              onClick={handleRefine}
              disabled={!refinementInput.trim() || isRefining}
              className="shrink-0"
            >
              {isRefining ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <StandardToolPage
      icon={FileText}
      title="Script Generator"
      description="Generate affiliate marketing scripts powered by AI"
      iconGradient="bg-primary"
      toolName="Script Generator"
    >
      <StandardToolLayout>
        {[
          <div key="input" className="h-full overflow-auto">
            {inputPanel}
          </div>,
          <div key="output" className="h-full">
            {outputPanel}
          </div>
        ]}
      </StandardToolLayout>
    </StandardToolPage>
  );
}
