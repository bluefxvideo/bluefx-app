'use server';

import { createClient, createAdminClient } from '@/app/supabase/server';

export interface SyncResult {
  success: boolean;
  message: string;
  details?: {
    deleted?: number;
    inserted?: number;
    updated?: number;
    skipped?: number;
    errors?: string[];
  };
}

/**
 * Check if the current user is an admin
 */
async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return false;

  // Check by email first (for contact@bluefx.net)
  if (user.email === 'contact@bluefx.net') return true;

  // Check by role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin';
}

/**
 * Get current stats about the clickbank_offers table
 */
export async function getTopOffersStats(): Promise<{
  success: boolean;
  data?: {
    totalOffers: number;
    activeOffers: number;
    top200Count: number;
    oldestOffer: string | null;
    newestOffer: string | null;
  };
  error?: string;
}> {
  try {
    if (!await isAdmin()) {
      return { success: false, error: 'Admin access required' };
    }

    const adminClient = createAdminClient();

    // Get total count
    const { count: totalOffers } = await adminClient
      .from('clickbank_offers')
      .select('*', { count: 'exact', head: true });

    // Get active count
    const { count: activeOffers } = await adminClient
      .from('clickbank_offers')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get top 200 by gravity
    const { data: top200 } = await adminClient
      .from('clickbank_offers')
      .select('id')
      .order('gravity_score', { ascending: false })
      .limit(200);

    // Get oldest and newest
    const { data: oldest } = await adminClient
      .from('clickbank_offers')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    const { data: newest } = await adminClient
      .from('clickbank_offers')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return {
      success: true,
      data: {
        totalOffers: totalOffers || 0,
        activeOffers: activeOffers || 0,
        top200Count: top200?.length || 0,
        oldestOffer: oldest?.created_at || null,
        newestOffer: newest?.created_at || null,
      }
    };
  } catch (error) {
    console.error('Error getting top offers stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Clean up old offers - keep only top 200 by gravity score
 */
export async function cleanupOldOffers(): Promise<SyncResult> {
  try {
    if (!await isAdmin()) {
      return { success: false, message: 'Admin access required' };
    }

    const adminClient = createAdminClient();

    // Get top 200 IDs by gravity score
    const { data: top200, error: top200Error } = await adminClient
      .from('clickbank_offers')
      .select('id')
      .order('gravity_score', { ascending: false })
      .limit(200);

    if (top200Error) {
      return { success: false, message: `Failed to fetch top 200: ${top200Error.message}` };
    }

    const top200Ids = top200?.map(o => o.id) || [];

    if (top200Ids.length === 0) {
      return {
        success: true,
        message: 'No offers to keep - table may be empty',
        details: { deleted: 0 }
      };
    }

    // Count how many will be deleted
    const { count: totalCount } = await adminClient
      .from('clickbank_offers')
      .select('*', { count: 'exact', head: true });

    const toDelete = (totalCount || 0) - top200Ids.length;

    if (toDelete <= 0) {
      return {
        success: true,
        message: 'No offers to delete - all offers are in top 200',
        details: { deleted: 0 }
      };
    }

    // Delete offers NOT in top 200
    const { error: deleteError } = await adminClient
      .from('clickbank_offers')
      .delete()
      .not('id', 'in', `(${top200Ids.join(',')})`);

    if (deleteError) {
      return { success: false, message: `Failed to delete old offers: ${deleteError.message}` };
    }

    // Also clean up orphaned history records
    const { error: historyDeleteError } = await adminClient
      .from('clickbank_history')
      .delete()
      .not('clickbank_id', 'in', `(${top200?.map(o => `'${o.id}'`).join(',')})`);

    if (historyDeleteError) {
      console.warn('Failed to clean up history records:', historyDeleteError);
    }

    return {
      success: true,
      message: `Successfully cleaned up ${toDelete} old offers. Kept top 200 by gravity score.`,
      details: { deleted: toDelete }
    };
  } catch (error) {
    console.error('Error cleaning up old offers:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

interface GoogleSheetRow {
  'Product Name': string;
  'Sales Page URL': string;
  'Product Image'?: string;
  'Category': string;
  'Subcategory'?: string;
  'Description'?: string;
  'Affiliate Page URL'?: string;
  'Contact Email'?: string;
  'Average Dollar Per Conversion'?: string;
  'Conversion Rate (CVR)'?: string;
  'Earnings Per Click (EPC)'?: string;
  'Gravity': string;
  'Rank'?: string;
}

/**
 * Parse Google Sheet CSV data
 */
function parseCSV(csvText: string): GoogleSheetRow[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  const rows: GoogleSheetRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: any = {};

    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });

    // Only include rows with required fields
    if (row['Product Name'] && row['Category'] && row['Gravity']) {
      rows.push(row as GoogleSheetRow);
    }
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Generate a clickbank_id from product name
 * ClickBank IDs are typically uppercase alphanumeric
 */
function generateClickbankId(productName: string): string {
  return productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 20) || 'UNKNOWN';
}

/**
 * Parse a number from string, returning null if invalid
 */
function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  // Remove $ and % signs, commas
  const cleaned = value.replace(/[$%,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Sync offers from Google Sheet CSV data
 * Fast batch upsert - updates by title match
 */
export async function syncFromGoogleSheet(csvData: string): Promise<SyncResult> {
  try {
    if (!await isAdmin()) {
      return { success: false, message: 'Admin access required' };
    }

    const rows = parseCSV(csvData);

    if (rows.length === 0) {
      return { success: false, message: 'No valid data found in CSV' };
    }

    const adminClient = createAdminClient();

    // Build all offer data at once
    const offers = rows
      .filter(row => row['Product Name']?.trim())
      .map(row => {
        const productName = row['Product Name'].trim();
        return {
          clickbank_id: generateClickbankId(productName),
          title: productName,
          description: row['Description'] || null,
          category: row['Category'] || 'Unknown',
          subcategory: row['Subcategory'] || null,
          vendor_name: row['Contact Email']?.split('@')[0] || 'Unknown',
          gravity_score: parseNumber(row['Gravity']) || 0,
          average_dollar_per_sale: parseNumber(row['Average Dollar Per Conversion']),
          commission_rate: parseNumber(row['Conversion Rate (CVR)']),
          affiliate_page_url: row['Affiliate Page URL'] || null,
          sales_page_url: row['Sales Page URL'] || null,
          is_active: true,
          last_updated_at: new Date().toISOString(),
        };
      });

    // Single batch upsert - update on clickbank_id conflict
    const { error } = await adminClient
      .from('clickbank_offers')
      .upsert(offers, {
        onConflict: 'clickbank_id',
        ignoreDuplicates: false
      });

    if (error) {
      return { success: false, message: `Sync failed: ${error.message}` };
    }

    return {
      success: true,
      message: `Synced ${offers.length} offers`
    };
  } catch (error) {
    console.error('Error syncing from Google Sheet:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch CSV from Google Sheet and sync
 * Google Sheet URL format: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
 * CSV export format: https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv
 */
export async function syncFromGoogleSheetUrl(sheetUrl: string): Promise<SyncResult> {
  try {
    if (!await isAdmin()) {
      return { success: false, message: 'Admin access required' };
    }

    // Extract sheet ID and convert to CSV export URL
    const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      return { success: false, message: 'Invalid Google Sheet URL' };
    }

    const sheetId = sheetIdMatch[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    // Fetch CSV data
    const response = await fetch(csvUrl);
    if (!response.ok) {
      return {
        success: false,
        message: `Failed to fetch Google Sheet: ${response.statusText}. Make sure the sheet is publicly accessible.`
      };
    }

    const csvData = await response.text();

    // Now sync the data
    return await syncFromGoogleSheet(csvData);
  } catch (error) {
    console.error('Error fetching Google Sheet:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch Google Sheet'
    };
  }
}

/**
 * Get preview of what would be synced from Google Sheet
 */
export async function previewGoogleSheetData(sheetUrl: string): Promise<{
  success: boolean;
  data?: {
    totalRows: number;
    sampleRows: Array<{ name: string; category: string; gravity: number }>;
    columns: string[];
  };
  error?: string;
}> {
  try {
    if (!await isAdmin()) {
      return { success: false, error: 'Admin access required' };
    }

    // Extract sheet ID and convert to CSV export URL
    const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      return { success: false, error: 'Invalid Google Sheet URL' };
    }

    const sheetId = sheetIdMatch[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    // Fetch CSV data
    const response = await fetch(csvUrl);
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch Google Sheet: ${response.statusText}. Make sure the sheet is publicly accessible.`
      };
    }

    const csvData = await response.text();
    const rows = parseCSV(csvData);

    // Get columns from first row
    const firstLine = csvData.split('\n')[0];
    const columns = parseCSVLine(firstLine).map(c => c.trim());

    return {
      success: true,
      data: {
        totalRows: rows.length,
        sampleRows: rows.slice(0, 5).map(row => ({
          name: row['Product Name'],
          category: row['Category'],
          gravity: parseNumber(row['Gravity']) || 0
        })),
        columns
      }
    };
  } catch (error) {
    console.error('Error previewing Google Sheet:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to preview Google Sheet'
    };
  }
}
