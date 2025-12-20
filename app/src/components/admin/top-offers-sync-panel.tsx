'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { createClient } from '@/app/supabase/client';

interface ClickBankOffer {
  'Product Name': string;
  'Sales Page URL': string;
  'Product Image'?: string;
  'Category': string;
  'Subcategory'?: string;
  'Description'?: string;
  'Affiliate Page URL'?: string;
  'Contact Email'?: string;
  'Average Dollar Per Conversion': string;
  'Conversion Rate (CVR)': string;
  'Earnings Per Click (EPC)': string;
  'Gravity': string;
  'Rank': string;
}

export function TopOffersSyncPanel() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [jsonInput, setJsonInput] = useState('');

  const extractVendorId = (url: string): string => {
    const match = url.match(/vendor=([A-Za-z0-9]+)/i);
    return match ? match[1].toUpperCase() : '';
  };

  const parseNumber = (value: string | undefined): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/[$%,]/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const handleSync = async () => {
    if (!jsonInput.trim()) {
      setResult({ success: false, message: 'Please paste JSON data first' });
      return;
    }

    setIsSyncing(true);
    setResult(null);

    try {
      // Parse JSON
      let offers: ClickBankOffer[];
      try {
        offers = JSON.parse(jsonInput);
      } catch {
        setResult({ success: false, message: 'Invalid JSON format' });
        setIsSyncing(false);
        return;
      }

      if (!Array.isArray(offers) || offers.length === 0) {
        setResult({ success: false, message: 'JSON must be an array of offers' });
        setIsSyncing(false);
        return;
      }

      const supabase = createClient();
      const today = new Date().toISOString();

      // Process each offer
      const processedOffers = offers.map((offer) => {
        const vendorId = extractVendorId(offer['Sales Page URL']) ||
          offer['Product Name'].toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 20);

        return {
          clickbank_id: vendorId,
          title: offer['Product Name'],
          description: offer['Description'] || null,
          category: offer['Category'] || 'Unknown',
          subcategory: offer['Subcategory'] || null,
          vendor_name: offer['Contact Email']?.split('@')[0] || vendorId,
          gravity_score: parseNumber(offer['Gravity']) || 0,
          average_dollar_per_sale: parseNumber(offer['Average Dollar Per Conversion']),
          commission_rate: parseNumber(offer['Conversion Rate (CVR)']),
          affiliate_page_url: offer['Affiliate Page URL'] || null,
          sales_page_url: offer['Sales Page URL'] || null,
          image_url: offer['Product Image'] || null,
          is_active: true,
          last_updated_at: today,
        };
      });

      // Step 1: Delete all existing offers
      const { error: deleteError } = await supabase
        .from('clickbank_offers')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) {
        console.error('Delete error:', deleteError);
        setResult({ success: false, message: `Delete failed: ${deleteError.message}` });
        setIsSyncing(false);
        return;
      }

      // Step 2: Insert all new offers
      const { error: insertError } = await supabase
        .from('clickbank_offers')
        .insert(processedOffers);

      if (insertError) {
        console.error('Insert error:', insertError);
        setResult({ success: false, message: `Insert failed: ${insertError.message}` });
        setIsSyncing(false);
        return;
      }

      // Step 3: Update history for each offer
      let historyUpdated = 0;
      for (const offer of processedOffers) {
        const gravityPoint = {
          gravity_score: offer.gravity_score,
          recorded_at: today,
          date: new Date().toLocaleDateString()
        };

        // Check if history exists
        const { data: existingHistory } = await supabase
          .from('clickbank_history')
          .select('id, daily_data')
          .eq('clickbank_id', offer.clickbank_id)
          .single();

        if (existingHistory) {
          // Append to existing history
          let dailyData = existingHistory.daily_data || [];
          if (typeof dailyData === 'string') {
            try { dailyData = JSON.parse(dailyData); } catch { dailyData = []; }
          }
          dailyData.push(gravityPoint);

          await supabase
            .from('clickbank_history')
            .update({ daily_data: dailyData })
            .eq('id', existingHistory.id);
        } else {
          // Create new history record
          await supabase
            .from('clickbank_history')
            .insert({
              clickbank_id: offer.clickbank_id,
              daily_data: [gravityPoint]
            });
        }
        historyUpdated++;
      }

      setResult({
        success: true,
        message: `Synced ${processedOffers.length} offers. Updated ${historyUpdated} history records.`
      });
      setJsonInput('');

    } catch (err) {
      console.error('Sync error:', err);
      setResult({
        success: false,
        message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }

    setIsSyncing(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sync Top Offers (JSON)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste the JSON array from your ClickBank export. This will replace all existing offers and update the gravity history.
          </p>

          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='Paste JSON here...
Example:
[
  {
    "Product Name": "MITOLYN",
    "Sales Page URL": "https://hop.clickbank.net/?vendor=MITOLYN",
    "Category": "Health & Fitness",
    "Gravity": "287.9",
    ...
  }
]'
            className="w-full h-64 p-3 font-mono text-sm border rounded-md bg-background resize-y"
            disabled={isSyncing}
          />

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {jsonInput && (
              <span>
                {(() => {
                  try {
                    const parsed = JSON.parse(jsonInput);
                    return Array.isArray(parsed) ? `${parsed.length} offers detected` : 'Not an array';
                  } catch {
                    return 'Invalid JSON';
                  }
                })()}
              </span>
            )}
          </div>

          <Button
            onClick={handleSync}
            disabled={isSyncing || !jsonInput.trim()}
            className="w-full"
          >
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Offers
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
