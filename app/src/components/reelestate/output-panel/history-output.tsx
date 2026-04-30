'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, Video, Calendar, ImageIcon, Download, Trash2, Play, ExternalLink } from 'lucide-react';
import type { ReelEstateListingRow, AgentCloneGenerationRow } from '@/types/reelestate';

// Lazy video — only loads <video> when user clicks play
function VideoPreview({ videoUrl, thumbnailUrl, className = '' }: {
  videoUrl: string;
  thumbnailUrl?: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className={`rounded-lg overflow-hidden bg-black ${className}`}>
        <video src={videoUrl} controls autoPlay className="w-full h-full object-contain" />
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-lg overflow-hidden bg-black/80 cursor-pointer group ${className}`}
      onClick={(e) => { e.stopPropagation(); setPlaying(true); }}
    >
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="w-full h-full object-cover opacity-70" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Video className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-white/20 transition-colors">
          <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
        </div>
      </div>
    </div>
  );
}

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
        <div className="grid gap-2">
          {items.map((item) => (
            <HistoryRow
              key={item.data.id}
              item={item}
              onLoadProject={onLoadProject}
              onDeleteGeneration={onDeleteGeneration}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Compact row for each history item
function HistoryRow({ item, onLoadProject, onDeleteGeneration }: {
  item: HistoryItem;
  onLoadProject: (listing: ReelEstateListingRow) => void;
  onDeleteGeneration?: (id: string) => void;
}) {
  if (item.type === 'listing') {
    const d = item.data;
    const hasVideo = !!d.final_video_url;
    const thumbnail = d.photo_urls?.[0];

    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/20 transition-all">
        {/* Thumbnail or video preview */}
        <div className="shrink-0 w-20 h-14 rounded overflow-hidden">
          {hasVideo ? (
            <VideoPreview videoUrl={d.final_video_url!} thumbnailUrl={thumbnail} className="w-20 h-14" />
          ) : thumbnail ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Info */}
        <button
          type="button"
          onClick={() => onLoadProject(d)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="font-medium text-sm truncate">
            {d.name || d.listing_data?.address || d.zillow_url || 'Manual Upload'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${STATUS_COLORS[d.status] || ''}`}>
              {d.status.replace(/_/g, ' ')}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {new Date(d.created_at).toLocaleDateString()}
            </span>
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {hasVideo && (
            <a href={d.final_video_url!} target="_blank" rel="noopener noreferrer" title="Download video">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Download className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onLoadProject(d)} title="Open in editor">
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // Agent Clone item
  const d = item.data;
  const hasVideo = !!d.video_url;
  const thumbnail = d.composite_url;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/20 transition-all">
      {/* Thumbnail or video preview */}
      <div className="shrink-0 w-20 h-14 rounded overflow-hidden">
        {hasVideo ? (
          <VideoPreview videoUrl={d.video_url!} thumbnailUrl={thumbnail || undefined} className="w-20 h-14" />
        ) : thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Video className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {d.prompt.slice(0, 50)}{d.prompt.length > 50 ? '...' : ''}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-purple-500/20 text-purple-400">
            Agent Clone
          </Badge>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${STATUS_COLORS[d.status] || ''}`}>
            {d.status.replace(/_/g, ' ')}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {new Date(d.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {d.composite_url && (
          <a href={d.composite_url} target="_blank" rel="noopener noreferrer" title="Download image">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <ImageIcon className="w-3.5 h-3.5" />
            </Button>
          </a>
        )}
        {hasVideo && (
          <a href={d.video_url!} target="_blank" rel="noopener noreferrer" title="Download video">
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
            onClick={() => onDeleteGeneration(d.id)}
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
