'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, Video, Calendar, ImageIcon, Download, Trash2 } from 'lucide-react';
import type { ReelEstateListingRow, AgentCloneGenerationRow } from '@/types/reelestate';

type HistoryFilter = 'all' | 'video-maker' | 'agent-clone';

interface HistoryOutputProps {
  listings: ReelEstateListingRow[];
  agentCloneGenerations: AgentCloneGenerationRow[];
  isLoading: boolean;
  onRefresh: () => void;
  onLoadProject: (listing: ReelEstateListingRow) => void;
  onDeleteGeneration?: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20 text-green-400',
  ready: 'bg-green-500/20 text-green-400',
  failed: 'bg-destructive/20 text-destructive',
  draft: 'bg-muted text-muted-foreground',
  generating_clips: 'bg-blue-500/20 text-blue-400',
  analyzing: 'bg-blue-500/20 text-blue-400',
  scripting: 'bg-blue-500/20 text-blue-400',
  composite_ready: 'bg-blue-500/20 text-blue-400',
  compositing: 'bg-yellow-500/20 text-yellow-400',
  animating: 'bg-yellow-500/20 text-yellow-400',
};

type HistoryItem =
  | { type: 'listing'; data: ReelEstateListingRow; date: string }
  | { type: 'agent-clone'; data: AgentCloneGenerationRow; date: string };

export function HistoryOutput({
  listings,
  agentCloneGenerations,
  isLoading,
  onRefresh,
  onLoadProject,
  onDeleteGeneration,
}: HistoryOutputProps) {
  const [filter, setFilter] = useState<HistoryFilter>('all');

  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  const items = useMemo(() => {
    const result: HistoryItem[] = [];

    if (filter !== 'agent-clone') {
      listings.forEach(l => result.push({ type: 'listing', data: l, date: l.created_at }));
    }
    if (filter !== 'video-maker') {
      agentCloneGenerations.forEach(g => result.push({ type: 'agent-clone', data: g, date: g.created_at }));
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [listings, agentCloneGenerations, filter]);

  if (isLoading && listings.length === 0 && agentCloneGenerations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Past Projects</h3>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Type filter */}
      <div className="flex gap-1.5">
        {([
          { value: 'all' as const, label: 'All' },
          { value: 'video-maker' as const, label: 'Video Maker' },
          { value: 'agent-clone' as const, label: 'Agent Clone' },
        ]).map(opt => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7"
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12">
          <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No projects yet</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) =>
            item.type === 'listing' ? (
              <div
                key={item.data.id}
                className="w-full text-left p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/20 transition-all space-y-3"
              >
                {/* Video preview if available */}
                {item.data.final_video_url && (
                  <div className="rounded overflow-hidden bg-black">
                    <video
                      src={item.data.final_video_url}
                      controls
                      className="w-full max-h-48 object-contain"
                      preload="metadata"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onLoadProject(item.data)}
                  className="w-full text-left"
                >
                  <div className="flex items-start gap-3">
                    {!item.data.final_video_url && item.data.photo_urls?.[0] ? (
                      <div className="shrink-0 w-16 h-12 rounded overflow-hidden">
                        <img
                          src={item.data.photo_urls[0]}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : !item.data.final_video_url ? (
                      <div className="shrink-0 w-16 h-12 rounded bg-muted flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      </div>
                    ) : null}

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.data.listing_data?.address || item.data.zillow_url || 'Manual Upload'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 ${STATUS_COLORS[item.data.status] || ''}`}
                        >
                          {item.data.status.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.data.created_at).toLocaleDateString()}
                        </span>
                        {item.data.photo_urls?.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {item.data.photo_urls.length} photos
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Download button */}
                {item.data.final_video_url && (
                  <div className="flex justify-end">
                    <a
                      href={item.data.final_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div
                key={item.data.id}
                className="w-full text-left p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/20 transition-all space-y-3"
              >
                {/* Media preview — video player or composite image */}
                {item.data.video_url ? (
                  <div className="rounded-lg overflow-hidden border border-border/30">
                    <video
                      src={item.data.video_url}
                      controls
                      className="w-full aspect-video object-cover"
                      preload="metadata"
                    />
                  </div>
                ) : item.data.composite_url ? (
                  <div className="rounded-lg overflow-hidden border border-border/30">
                    <img
                      src={item.data.composite_url}
                      alt=""
                      className="w-full aspect-video object-cover"
                    />
                  </div>
                ) : null}

                {/* Info row */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {item.data.prompt.slice(0, 60)}{item.data.prompt.length > 60 ? '...' : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 bg-purple-500/20 text-purple-400"
                      >
                        Agent Clone
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 ${STATUS_COLORS[item.data.status] || ''}`}
                      >
                        {item.data.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.data.created_at).toLocaleDateString()}
                      </span>
                      {item.data.credits_used > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {item.data.credits_used} credits
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {item.data.composite_url && (
                      <a
                        href={item.data.composite_url}
                        download="agent-clone-composite.jpg"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download image"
                      >
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <ImageIcon className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    )}
                    {item.data.video_url && (
                      <a
                        href={item.data.video_url}
                        download="agent-clone-video.mp4"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download video"
                      >
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    )}
                    {onDeleteGeneration && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => onDeleteGeneration(item.data.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
