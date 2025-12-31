'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Video, Film, Mail, Layout, Share2, Target, Pencil, Copy, Check, Loader2, RefreshCw, Settings, Zap, Calendar, Mic, UserRound, Briefcase, Library, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AffiliateOffer, LibraryProduct, UserBusinessOffer, ScriptType, SCRIPT_TYPES } from '@/lib/affiliate-toolkit/types';
import { fetchAllOffersForContentGenerator, generateScript, refineScript } from '@/lib/affiliate-toolkit/service';
import { createClient } from '@/app/supabase/client';

// Icon mapping for script types
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Video,
  Film,
  Mail,
  Layout,
  Share2,
  Target,
  Pencil,
  Zap,
  Calendar
};

// Extended offer type to track source
type OfferWithSource = (LibraryProduct | UserBusinessOffer) & { source: 'library' | 'business' };

// Conversation message type for chat history
interface ConversationMessage {
  role: 'assistant' | 'user';
  content: string;
}

export function ScriptGeneratorPage() {
  const router = useRouter();

  // State
  const [libraryProducts, setLibraryProducts] = useState<LibraryProduct[]>([]);
  const [userOffers, setUserOffers] = useState<UserBusinessOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<OfferWithSource | null>(null);
  const [selectedScriptType, setSelectedScriptType] = useState<ScriptType | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [refinementInput, setRefinementInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setIsAdmin(profile?.role === 'admin');
      }
    }
    checkAdmin();
  }, []);

  // Load offers on mount
  useEffect(() => {
    async function loadOffers() {
      try {
        const { libraryProducts: library, userOffers: user } = await fetchAllOffersForContentGenerator();
        setLibraryProducts(library);
        setUserOffers(user);

        // Auto-select first user offer if available, otherwise first library product
        if (user.length > 0) {
          setSelectedOffer({ ...user[0], source: 'business' });
        } else if (library.length > 0) {
          setSelectedOffer({ ...library[0], source: 'library' });
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
    setConversationHistory([]); // Reset conversation on new generation

    try {
      const script = await generateScript(
        selectedOffer,
        selectedScriptType,
        selectedScriptType === 'custom' ? customPrompt : undefined
      );
      setGeneratedScript(script);
      // Initialize conversation with first AI response
      setConversationHistory([{ role: 'assistant', content: script }]);
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

    const userRequest = refinementInput.trim();

    // Add user's refinement request to conversation history
    setConversationHistory(prev => [...prev, { role: 'user', content: userRequest }]);
    setRefinementInput('');
    setIsRefining(true);
    setError(null);

    try {
      const refined = await refineScript(generatedScript, userRequest);
      setGeneratedScript(refined);
      // Add AI response to conversation history
      setConversationHistory(prev => [...prev, { role: 'assistant', content: refined }]);
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

  // Check if current script type is video-related
  const isVideoScriptType = (type: ScriptType | null): boolean => {
    return type === 'short_video' || type === 'long_video' || type === 'hooks';
  };

  // Navigate to video tools with script pre-loaded
  const goToScriptToVideo = () => {
    if (!generatedScript) return;
    localStorage.setItem('prefill_script', generatedScript);
    router.push('/dashboard/script-to-video');
  };

  const goToTalkingAvatar = () => {
    if (!generatedScript) return;
    localStorage.setItem('prefill_script', generatedScript);
    router.push('/dashboard/talking-avatar');
  };

  const goToVoiceOver = () => {
    if (!generatedScript) return;
    localStorage.setItem('prefill_script', generatedScript);
    router.push('/dashboard/voice-over');
  };

  // Input Panel
  const inputPanel = (
    <div className="h-full flex flex-col space-y-6">
      {/* Offer Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-zinc-300">Select Offer</Label>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/script-generator/manage-offers')}
              className="h-7 px-2 text-xs text-zinc-400 hover:text-white gap-1"
            >
              <Settings className="w-3 h-3" />
              Manage Offers
            </Button>
          )}
        </div>
        <Select
          value={selectedOffer ? `${selectedOffer.source}:${selectedOffer.id}` : ''}
          onValueChange={(value) => {
            const [source, id] = value.split(':') as ['library' | 'business', string];
            if (source === 'library') {
              const product = libraryProducts.find(p => p.id === id);
              if (product) setSelectedOffer({ ...product, source: 'library' });
            } else {
              const offer = userOffers.find(o => o.id === id);
              if (offer) setSelectedOffer({ ...offer, source: 'business' });
            }
          }}
          disabled={isLoadingOffers}
        >
          <SelectTrigger className="w-full bg-card border-border">
            <SelectValue placeholder={isLoadingOffers ? "Loading offers..." : "Select a product"} />
          </SelectTrigger>
          <SelectContent>
            {/* User's Business Offers */}
            {userOffers.length > 0 && (
              <SelectGroup>
                <SelectLabel className="flex items-center gap-2 text-primary">
                  <Briefcase className="w-3 h-3" />
                  My Products
                </SelectLabel>
                {userOffers.map((offer) => (
                  <SelectItem key={`business:${offer.id}`} value={`business:${offer.id}`}>
                    <div className="flex flex-col">
                      <span className="font-medium">{offer.name}</span>
                      {offer.niche && (
                        <span className="text-xs text-zinc-500">{offer.niche}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {/* Library Products */}
            {libraryProducts.length > 0 && (
              <SelectGroup>
                <SelectLabel className="flex items-center gap-2 text-blue-400">
                  <Library className="w-3 h-3" />
                  Affiliate Products
                </SelectLabel>
                {libraryProducts.map((product) => (
                  <SelectItem key={`library:${product.id}`} value={`library:${product.id}`}>
                    <div className="flex flex-col">
                      <span className="font-medium">{product.name}</span>
                      {product.niche && (
                        <span className="text-xs text-zinc-500">{product.niche}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {/* Empty state */}
            {userOffers.length === 0 && libraryProducts.length === 0 && (
              <div className="p-4 text-center text-zinc-500 text-sm">
                No products available
              </div>
            )}
          </SelectContent>
        </Select>

        {/* Offer Preview */}
        {selectedOffer && (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-zinc-500">Product Details:</p>
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  selectedOffer.source === 'business'
                    ? "bg-primary/20 text-primary"
                    : "bg-blue-500/20 text-blue-400"
                )}>
                  {selectedOffer.source === 'business' ? 'My Product' : 'Library'}
                </span>
              </div>
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

      {/* Output Content - Conversation History */}
      <div className="flex-1 min-h-0 overflow-auto">
        {conversationHistory.length > 0 ? (
          <div className="space-y-4">
            {conversationHistory.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-lg p-4",
                  msg.role === 'assistant'
                    ? "bg-card border border-border"
                    : "bg-primary/10 border border-primary/30"
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  {msg.role === 'assistant' ? (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-zinc-300" />
                    </div>
                  )}
                  <span className="text-xs font-medium text-zinc-400">
                    {msg.role === 'assistant' ? 'AI Response' : 'Your Refinement Request'}
                  </span>
                </div>
                <div className="prose prose-sm prose-invert max-w-none prose-p:text-zinc-300 prose-headings:text-white prose-strong:text-white prose-li:text-zinc-300">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {isRefining && (
              <div className="rounded-lg p-4 bg-card border border-border">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-zinc-400">Refining your script...</span>
                </div>
              </div>
            )}
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

      {/* Video Tool Buttons - Only show for video script types */}
      {conversationHistory.length > 0 && isVideoScriptType(selectedScriptType) && (
        <div className="mt-4 pt-4 border-t border-border">
          <Label className="text-sm font-medium text-zinc-300 mb-3 block">Send to Video Tool</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToScriptToVideo}
              className="gap-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
            >
              <Film className="w-4 h-4" />
              Script to Video
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToTalkingAvatar}
              className="gap-2 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
            >
              <UserRound className="w-4 h-4" />
              Talking Avatar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToVoiceOver}
              className="gap-2 border-green-500/50 text-green-400 hover:bg-green-500/10"
            >
              <Mic className="w-4 h-4" />
              Voice Over
            </Button>
          </div>
        </div>
      )}

      {/* Refinement Section */}
      {conversationHistory.length > 0 && (
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
