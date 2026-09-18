'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getRoughcutDownloadUrl, type RoughcutEditor } from '@/actions/tools/video-roughcut';
import { isStalePageError } from '@/lib/stale-page';

interface DownloadXmlButtonProps {
  jobId: string;
  /** Premiere and DaVinci Resolve each get their own XML. */
  editor?: RoughcutEditor;
  label?: string;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline';
  className?: string;
}

/**
 * Downloads the XML through a short-lived signed link. The storage bucket is private,
 * and the link carries a download filename, so the browser saves the file instead of
 * opening it in a tab.
 */
export function DownloadXmlButton({
  jobId,
  editor = 'premiere',
  label = 'Download Premiere XML',
  size = 'default',
  variant = 'default',
  className,
}: DownloadXmlButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const res = await getRoughcutDownloadUrl(jobId, editor);
      if (!res.success || !res.url) {
        toast.error(res.error || 'Could not create the download link', { duration: 12000 });
        return;
      }
      window.location.assign(res.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (isStalePageError(message)) {
        toast.error('This page is out of date', { description: 'Reload the page and try again.', duration: 15000 });
      } else {
        toast.error('Could not create the download link', message ? { description: message } : undefined);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={busy} size={size} variant={variant} className={className}>
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
      {label}
    </Button>
  );
}
