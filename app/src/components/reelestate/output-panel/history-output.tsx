'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, Video, Calendar, ImageIcon } from 'lucide-react';
import type { ReelEstateListingRow } from '@/types/reelestate';

interface HistoryOutputProps {
  listings: ReelEstateListingRow[];
  isLoading: boolean;
  onRefresh: () => void;
  onLoadProject: (listing: ReelEstateListingRow) => void;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-destructive/20 text-destructive',
  draft: 'bg-muted text-muted-foreground',
  generating_clips: 'bg-blue-500/20 text-blue-400',
  analyzing: 'bg-blue-500/20 text-blue-400',
  scripting: 'bg-blue-500/20 text-blue-400',
};

export function HistoryOutput({ listings, isLoading, onRefresh, onLoadProject }: HistoryOutputProps) {
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  if (isLoading && listings.length === 0) {
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

      {listings.length === 0 ? (
        <div className="text-center py-12">
          <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No projects yet</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {listings.map((listing) => (
            <button
              key={listing.id}
              type="button"
              onClick={() => onLoadProject(listing)}
              className="w-full text-left p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/20 transition-all"
            >
              <div className="flex items-start gap-3">
                {/* Thumbnail */}
                {listing.photo_urls?.[0] ? (
                  <div className="shrink-0 w-16 h-12 rounded overflow-hidden">
                    <img
                      src={listing.photo_urls[0]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="shrink-0 w-16 h-12 rounded bg-muted flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {listing.listing_data?.address || listing.zillow_url || 'Manual Upload'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-4 ${STATUS_COLORS[listing.status] || ''}`}
                    >
                      {listing.status.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(listing.created_at).toLocaleDateString()}
                    </span>
                    {listing.photo_urls?.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {listing.photo_urls.length} photos
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
