'use client';

import { useEffect } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Dashboard error boundary — a tool page that throws during render shows this
 * instead of blanking the whole dashboard. The sidebar/layout stays intact.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] render error:', error);
  }, [error]);

  return (
    <div className="h-full min-h-[60vh] flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-red-500" />
      </div>
      <h2 className="text-lg font-semibold">This tool hit an unexpected error</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        The rest of the app is fine — try reloading this tool. If it keeps happening, contact support
        {error?.digest ? ` and mention error code ${error.digest}` : ''}.
      </p>
      <div className="flex gap-3 mt-2">
        <Button onClick={reset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Try again
        </Button>
        <Button variant="outline" onClick={() => { window.location.href = '/dashboard'; }}>
          <Home className="w-4 h-4 mr-2" />
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
