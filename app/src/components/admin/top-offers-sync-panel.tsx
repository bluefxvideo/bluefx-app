'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { syncFromPastedData } from '@/actions/admin/top-offers-sync';

export function TopOffersSyncPanel() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pastedData, setPastedData] = useState('');

  const handleSync = async () => {
    if (!pastedData.trim()) {
      setResult({ success: false, message: 'Please paste the data from Google Sheet' });
      return;
    }
    setIsSyncing(true);
    setResult(null);
    const response = await syncFromPastedData(pastedData);
    setResult(response);
    setIsSyncing(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sync Top Offers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Copy all rows from your Google Sheet (including header) and paste below:
          </p>
          <Textarea
            placeholder="Paste tab-separated data from Google Sheet here..."
            value={pastedData}
            onChange={(e) => setPastedData(e.target.value)}
            rows={10}
            className="font-mono text-xs"
          />

          <Button onClick={handleSync} disabled={isSyncing || !pastedData.trim()}>
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Now
              </>
            )}
          </Button>

          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
