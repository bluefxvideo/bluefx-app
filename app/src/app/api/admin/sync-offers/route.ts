'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/app/supabase/server';

/**
 * Parse a number from string, returning null if invalid
 */
function parseNum(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[$%,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse CSV line handling quoted values with commas inside
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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function POST(request: NextRequest) {
  try {
    // Get CSV data from request body
    const { csvData } = await request.json();

    console.log('API: syncOffers called, data length:', csvData?.length || 0);

    if (!csvData || typeof csvData !== 'string') {
      return NextResponse.json({ success: false, message: 'No CSV data provided' }, { status: 400 });
    }

    // Check auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    // Check admin
    if (user.email !== 'contact@bluefx.net') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
      }
    }

    const lines = csvData.trim().split('\n');
    console.log('Lines count:', lines.length);

    if (lines.length < 2) {
      return NextResponse.json({ success: false, message: 'No data rows found' }, { status: 400 });
    }

    // Parse header (first line)
    const headers = parseCSVLine(lines[0]);
    console.log('Headers found:', headers);

    // Find column indices
    const cols = {
      productName: headers.indexOf('Product Name'),
      salesPageUrl: headers.indexOf('Sales Page URL'),
      category: headers.indexOf('Category'),
      subcategory: headers.indexOf('Subcategory'),
      description: headers.indexOf('Description'),
      affiliatePageUrl: headers.indexOf('Affiliate Page URL'),
      contactEmail: headers.indexOf('Contact Email'),
      avgDollarPerConversion: headers.indexOf('Average Dollar Per Conversion'),
      cvr: headers.indexOf('Conversion Rate (CVR)'),
      gravity: headers.indexOf('Gravity'),
    };

    console.log('Column indices:', cols);

    if (cols.productName === -1 || cols.category === -1 || cols.gravity === -1) {
      return NextResponse.json({
        success: false,
        message: `Missing required columns. Found: ${headers.join(', ')}`
      }, { status: 400 });
    }

    // Parse data rows
    const seenIds = new Set<string>();
    const offers: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);
      const productName = values[cols.productName]?.trim();
      if (!productName) continue;

      const salesPageUrl = values[cols.salesPageUrl] || '';

      // Extract vendor ID from hop.clickbank.net URL
      const vendorMatch = salesPageUrl.match(/vendor=([A-Za-z0-9]+)/i);
      const clickbankId = vendorMatch ? vendorMatch[1].toUpperCase() : productName.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 20);

      // Skip duplicates
      if (seenIds.has(clickbankId)) continue;
      seenIds.add(clickbankId);

      offers.push({
        clickbank_id: clickbankId,
        title: productName,
        description: values[cols.description] || null,
        category: values[cols.category] || 'Unknown',
        subcategory: values[cols.subcategory] || null,
        vendor_name: values[cols.contactEmail]?.split('@')[0] || clickbankId,
        gravity_score: parseNum(values[cols.gravity]) || 0,
        average_dollar_per_sale: parseNum(values[cols.avgDollarPerConversion]),
        commission_rate: parseNum(values[cols.cvr]),
        affiliate_page_url: values[cols.affiliatePageUrl] || null,
        sales_page_url: salesPageUrl || null,
        is_active: true,
        last_updated_at: new Date().toISOString(),
      });
    }

    console.log('Offers parsed:', offers.length);

    if (offers.length === 0) {
      return NextResponse.json({ success: false, message: 'No valid offers found in CSV' }, { status: 400 });
    }

    console.log('First offer:', JSON.stringify(offers[0], null, 2));

    const adminClient = createAdminClient();

    // Delete all existing
    console.log('Deleting existing offers...');
    await adminClient.from('clickbank_offers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert new
    console.log('Inserting', offers.length, 'offers...');
    const { error } = await adminClient.from('clickbank_offers').insert(offers);

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ success: false, message: `Insert failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${offers.length} offers successfully!`
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
