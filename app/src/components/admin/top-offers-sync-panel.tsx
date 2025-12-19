'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2,
  Trash2,
  RefreshCw,
  Upload,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Eye,
} from 'lucide-react';
import {
  getTopOffersStats,
  cleanupOldOffers,
  syncFromGoogleSheetUrl,
  previewGoogleSheetData,
  type SyncResult,
} from '@/actions/admin/top-offers-sync';

export function TopOffersSyncPanel() {
  const [stats, setStats] = useState<{
    totalOffers: number;
    activeOffers: number;
    top200Count: number;
    oldestOffer: string | null;
    newestOffer: string | null;
  } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const [googleSheetUrl, setGoogleSheetUrl] = useState(
    'https://docs.google.com/spreadsheets/d/1Hke-Hi8ssoEMwsZh4Ml40DMP3cybBI5WeaeKKiS4h84/edit'
  );

  const [result, setResult] = useState<SyncResult | null>(null);
  const [preview, setPreview] = useState<{
    totalRows: number;
    sampleRows: Array<{ name: string; category: string; gravity: number }>;
    columns: string[];
  } | null>(null);

  const loadStats = async () => {
    setIsLoadingStats(true);
    const response = await getTopOffersStats();
    if (response.success && response.data) {
      setStats(response.data);
    }
    setIsLoadingStats(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleCleanup = async () => {
    if (!confirm('This will delete all offers outside the top 200 by gravity score. Are you sure?')) {
      return;
    }

    setIsCleaningUp(true);
    setResult(null);
    const response = await cleanupOldOffers();
    setResult(response);
    setIsCleaningUp(false);

    // Reload stats
    await loadStats();
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    setPreview(null);
    setResult(null);

    const response = await previewGoogleSheetData(googleSheetUrl);
    if (response.success && response.data) {
      setPreview(response.data);
    } else {
      setResult({ success: false, message: response.error || 'Failed to preview' });
    }
    setIsPreviewing(false);
  };

  const handleSync = async () => {
    if (!confirm('This will sync data from the Google Sheet. Existing offers with the same name will be updated. Continue?')) {
      return;
    }

    setIsSyncing(true);
    setResult(null);
    const response = await syncFromGoogleSheetUrl(googleSheetUrl);
    setResult(response);
    setIsSyncing(false);

    // Reload stats
    await loadStats();
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Offers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.totalOffers ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Offers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.activeOffers ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Oldest Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : stats?.oldestOffer ? (
                new Date(stats.oldestOffer).toLocaleDateString()
              ) : (
                'N/A'
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Newest Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : stats?.newestOffer ? (
                new Date(stats.newestOffer).toLocaleDateString()
              ) : (
                'N/A'
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cleanup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Cleanup Old Data
          </CardTitle>
          <CardDescription>
            Remove offers outside the current top 200 by gravity score to keep the database clean.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats && stats.totalOffers > 200 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Data Outside Top 200</AlertTitle>
              <AlertDescription>
                There are {stats.totalOffers - 200} offers that are outside the top 200 by gravity score.
                These can be safely removed.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleCleanup}
            disabled={isCleaningUp || (stats?.totalOffers ?? 0) <= 200}
            variant="destructive"
          >
            {isCleaningUp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cleaning up...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Offers Outside Top 200
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Google Sheet Sync Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Sync from Google Sheet
          </CardTitle>
          <CardDescription>
            Import ClickBank offers from your Thunderbit scraper Google Sheet.
            The sheet must be publicly accessible (anyone with the link can view).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={googleSheetUrl}
              onChange={(e) => setGoogleSheetUrl(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" asChild>
              <a href={googleSheetUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={handlePreview} disabled={isPreviewing || !googleSheetUrl} variant="outline">
              {isPreviewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Data
                </>
              )}
            </Button>

            <Button onClick={handleSync} disabled={isSyncing || !googleSheetUrl}>
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
          </div>

          {/* Preview Data */}
          {preview && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Preview</h4>
                <Badge variant="secondary">{preview.totalRows} rows found</Badge>
              </div>

              <div className="text-sm text-muted-foreground">
                Columns: {preview.columns.join(', ')}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Sample data (first 5 rows):</div>
                <div className="space-y-1">
                  {preview.sampleRows.map((row, i) => (
                    <div key={i} className="text-sm bg-muted rounded px-2 py-1 flex justify-between">
                      <span className="truncate flex-1">{row.name}</span>
                      <span className="text-muted-foreground ml-2">{row.category}</span>
                      <Badge variant="outline" className="ml-2">
                        G: {row.gravity.toFixed(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result Alert */}
      {result && (
        <Alert variant={result.success ? 'default' : 'destructive'}>
          {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <AlertTitle>{result.success ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription>
            <p>{result.message}</p>
            {result.details && (
              <div className="mt-2 text-sm">
                {result.details.inserted !== undefined && (
                  <Badge variant="secondary" className="mr-2">
                    {result.details.inserted} inserted
                  </Badge>
                )}
                {result.details.updated !== undefined && (
                  <Badge variant="secondary" className="mr-2">
                    {result.details.updated} updated
                  </Badge>
                )}
                {result.details.deleted !== undefined && (
                  <Badge variant="secondary" className="mr-2">
                    {result.details.deleted} deleted
                  </Badge>
                )}
                {result.details.skipped !== undefined && result.details.skipped > 0 && (
                  <Badge variant="outline" className="mr-2">
                    {result.details.skipped} skipped
                  </Badge>
                )}
                {result.details.errors && result.details.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-destructive">Errors:</p>
                    <ul className="list-disc list-inside text-xs">
                      {result.details.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How to use</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Make sure your Google Sheet is publicly accessible (Share → Anyone with the link)</p>
          <p>2. The sheet should have these columns: Product Name, Sales Page URL, Category, Subcategory, Description, Affiliate Page URL, Contact Email, Average Dollar Per Conversion, Conversion Rate, EPC, Gravity, Rank</p>
          <p>3. Click &quot;Preview Data&quot; to verify the data looks correct</p>
          <p>4. Click &quot;Sync Now&quot; to import/update the offers</p>
          <p>5. Use &quot;Delete Offers Outside Top 200&quot; to clean up old data</p>
        </CardContent>
      </Card>
    </div>
  );
}
