'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Library as LibraryIcon,
  Loader2,
  Download,
  Video,
  Image as ImageIcon,
  Music,
  Mic,
  UserRound,
  Palette,
  ExternalLink,
} from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getLibraryItems, type LibraryItem, type LibraryItemType } from '@/actions/library';

type Filter = 'all' | 'videos' | 'images' | 'audio';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'videos', label: 'Videos' },
  { id: 'images', label: 'Images' },
  { id: 'audio', label: 'Audio' },
];

const TYPE_META: Record<LibraryItemType, { label: string; icon: typeof Video; group: Filter }> = {
  video: { label: 'Video', icon: Video, group: 'videos' },
  avatar: { label: 'AI Avatar', icon: UserRound, group: 'videos' },
  image: { label: 'Image', icon: ImageIcon, group: 'images' },
  logo: { label: 'Logo', icon: Palette, group: 'images' },
  thumbnail: { label: 'Thumbnail', icon: ImageIcon, group: 'images' },
  music: { label: 'Music', icon: Music, group: 'audio' },
  voice: { label: 'Voice', icon: Mic, group: 'audio' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ItemCard({ item }: { item: LibraryItem }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const isImage = meta.group === 'images';
  const isVideo = meta.group === 'videos';

  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      {/* Preview */}
      <div className="relative aspect-video bg-muted/40 flex items-center justify-center overflow-hidden">
        {item.draft ? (
          // Generated but never rendered/exported — no media file exists yet.
          <Link
            href={item.tool_route}
            className="flex flex-col items-center gap-2 text-zinc-400 hover:text-foreground transition-colors"
          >
            <Icon className="w-8 h-8" />
            <span className="text-xs font-medium">Finish in editor to render</span>
          </Link>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail_url || item.url} alt={item.title} className="w-full h-full object-cover" />
        ) : isVideo ? (
          item.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <video src={item.url} className="w-full h-full object-cover" preload="metadata" muted />
          )
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <Icon className="w-8 h-8" />
            <audio src={item.url} controls className="w-44 h-8" preload="none" />
          </div>
        )}
        <span className="absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white flex items-center gap-1">
          <Icon className="w-3 h-3" />
          {item.draft ? 'Draft' : meta.label}
        </span>
        {!item.draft && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            download
            aria-label={`Download ${meta.label.toLowerCase()}`}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-lg p-1.5"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Meta */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-medium leading-snug line-clamp-2">{item.title}</p>
        <div className="mt-auto pt-1 flex items-center justify-between text-xs text-zinc-400">
          <span>{formatDate(item.created_at)}</span>
          <Link
            href={item.tool_route}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {item.tool_name}
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    getLibraryItems().then((res) => {
      if (res.success && res.items) setItems(res.items);
      else setError(res.error || 'Failed to load your library.');
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => TYPE_META[i.type].group === filter)),
    [items, filter]
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: items.length, videos: 0, images: 0, audio: 0 };
    for (const i of items) c[TYPE_META[i.type].group]++;
    return c;
  }, [items]);

  return (
    <StandardToolPage
      icon={LibraryIcon}
      title="My Library"
      description="Everything you've created, in one place"
      iconGradient="bg-primary"
      toolName="My Library"
    >
      <div className="h-full overflow-y-auto p-4 lg:p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                filter === f.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-zinc-400 border-border hover:text-foreground'
              )}
            >
              {f.label}
              {counts[f.id] > 0 && <span className="ml-1.5 text-xs opacity-70">{counts[f.id]}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="h-64 flex items-center justify-center text-sm text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400 text-center">
            <LibraryIcon className="w-10 h-10" />
            <p className="text-sm">
              {items.length === 0
                ? 'Nothing here yet — everything you create will show up automatically.'
                : 'No items match this filter.'}
            </p>
            {items.length === 0 && (
              <Button asChild size="sm">
                <Link href="/dashboard/ai-cinematographer">Create your first video</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </StandardToolPage>
  );
}

export default LibraryPage;
