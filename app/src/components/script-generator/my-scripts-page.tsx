'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Search,
  Star,
  Trash2,
  Copy,
  Check,
  Loader2,
  Filter,
  Film,
  Mic,
  UserRound,
  ArrowLeft
} from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SavedScript, SCRIPT_TYPES, getScriptTypeLabel, isVideoScriptType, ScriptType } from '@/lib/affiliate-toolkit/types';
import {
  fetchSavedScripts,
  toggleScriptFavorite,
  deleteSavedScript
} from '@/actions/tools/affiliate-script-generator';

export function MyScriptsPage() {
  const router = useRouter();

  // State
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load scripts
  const loadScripts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchSavedScripts({
        search: searchQuery || undefined,
        scriptType: selectedType !== 'all' ? selectedType : undefined,
        favoritesOnly: showFavoritesOnly
      });

      if (result.success && result.scripts) {
        setScripts(result.scripts);
      } else {
        setError(result.error || 'Failed to load scripts');
      }
    } catch (err) {
      setError('Failed to load scripts');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedType, showFavoritesOnly]);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  // Toggle favorite
  const handleToggleFavorite = async (id: string) => {
    try {
      const result = await toggleScriptFavorite(id);
      if (result.success) {
        setScripts(prev => prev.map(s =>
          s.id === id ? { ...s, is_favorite: result.is_favorite! } : s
        ));
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Delete script
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this script? This cannot be undone.')) return;

    setDeletingId(id);
    try {
      const result = await deleteSavedScript(id);
      if (result.success) {
        setScripts(prev => prev.filter(s => s.id !== id));
        if (expandedScript === id) setExpandedScript(null);
      }
    } catch (err) {
      console.error('Failed to delete script:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Copy to clipboard
  const handleCopy = async (script: SavedScript) => {
    try {
      await navigator.clipboard.writeText(script.content);
      setCopiedId(script.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Navigate to video tools with script pre-loaded
  const goToScriptToVideo = (content: string) => {
    localStorage.setItem('prefill_script', content);
    router.push('/dashboard/script-to-video');
  };

  const goToTalkingAvatar = (content: string) => {
    localStorage.setItem('prefill_script', content);
    router.push('/dashboard/talking-avatar');
  };

  const goToVoiceOver = (content: string) => {
    localStorage.setItem('prefill_script', content);
    router.push('/dashboard/voice-over');
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <StandardToolPage
      icon={FileText}
      title="My Scripts"
      description="Your saved affiliate marketing scripts"
      iconGradient="bg-primary"
      toolName="My Scripts"
    >
      <div className="h-full flex flex-col p-4 md:p-6">
        {/* Back Button */}
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/script-generator')}
            className="gap-2 text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Script Generator
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search scripts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>

          {/* Script Type Filter */}
          <div className="w-full md:w-[200px]">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="bg-card border-border">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {SCRIPT_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Favorites Toggle */}
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className="gap-2"
          >
            <Star className={cn("w-4 h-4", showFavoritesOnly && "fill-current")} />
            Favorites
          </Button>
        </div>

        {/* Scripts List */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <Button onClick={loadScripts}>Try Again</Button>
              </div>
            </div>
          ) : scripts.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-500 mb-2">No scripts found</p>
                <p className="text-zinc-600 text-sm">
                  {searchQuery || selectedType !== 'all' || showFavoritesOnly
                    ? 'Try adjusting your filters'
                    : 'Generate scripts to see them here'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {scripts.map((script) => (
                <Card
                  key={script.id}
                  className={cn(
                    "bg-card border-border transition-all cursor-pointer hover:border-primary/50",
                    expandedScript === script.id && "border-primary"
                  )}
                  onClick={() => setExpandedScript(expandedScript === script.id ? null : script.id)}
                >
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                            {getScriptTypeLabel(script.script_type)}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {formatDate(script.created_at)}
                          </span>
                        </div>
                        <h4 className="font-medium text-white truncate">{script.offer_name}</h4>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleFavorite(script.id)}
                        >
                          <Star className={cn(
                            "w-4 h-4",
                            script.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-zinc-500"
                          )} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopy(script)}
                        >
                          {copiedId === script.id ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-zinc-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => handleDelete(script.id)}
                          disabled={deletingId === script.id}
                        >
                          {deletingId === script.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Preview */}
                    <p className={cn(
                      "text-sm text-zinc-400",
                      expandedScript !== script.id && "line-clamp-2"
                    )}>
                      {script.content}
                    </p>

                    {/* Expanded Content */}
                    {expandedScript === script.id && (
                      <div className="mt-4 pt-4 border-t border-border" onClick={(e) => e.stopPropagation()}>
                        {/* Full Script */}
                        <div className="bg-secondary/50 rounded-lg p-4 mb-4 max-h-[400px] overflow-auto">
                          <pre className="whitespace-pre-wrap text-sm text-zinc-300 font-mono">
                            {script.content}
                          </pre>
                        </div>

                        {/* Video Tool Buttons */}
                        {isVideoScriptType(script.script_type) && (
                          <div className="flex flex-wrap gap-2">
                            <Label className="w-full text-sm font-medium text-zinc-300 mb-1">
                              Send to Video Tool
                            </Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goToScriptToVideo(script.content)}
                              className="gap-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                            >
                              <Film className="w-4 h-4" />
                              Script to Video
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goToTalkingAvatar(script.content)}
                              className="gap-2 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                            >
                              <UserRound className="w-4 h-4" />
                              Talking Avatar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goToVoiceOver(script.content)}
                              className="gap-2 border-green-500/50 text-green-400 hover:bg-green-500/10"
                            >
                              <Mic className="w-4 h-4" />
                              Voice Over
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </StandardToolPage>
  );
}
