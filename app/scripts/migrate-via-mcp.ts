#!/usr/bin/env tsx

import { createClient as createNewClient } from '@/app/supabase/server';

// We'll paste the legacy data here after exporting via MCP
const LEGACY_OFFERS_DATA: any[] = []; // Will be populated

interface NewOffer {
  clickbank_id: string;
  title: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  vendor_name: string;
  gravity_score: number;
  commission_rate: number | null;
  average_dollar_per_sale: number | null;
  initial_dollar_per_sale: number | null;
  refund_rate: number | null;
  has_recurring_products: boolean | null;
  mobile_optimized: boolean | null;
  affiliate_page_url: string | null;
  sales_page_url: string | null;
  is_active: boolean;
  created_at: string;
}

function extractVendorFromProduct(productLink: string | null): string {
  if (!productLink) return 'Unknown Vendor';
  
  const match = productLink.match(/vendor=([A-Z0-9]+)/);
  if (match) {
    return match[1].toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  }
  
  return 'Unknown Vendor';
}

function extractClickBankId(productLink: string | null): string {
  if (!productLink) return `CB${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  const match = productLink.match(/vendor=([A-Z0-9]+)/);
  return match ? match[1] : `CB${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

function parseCategory(category: string | null): { main: string; sub: string | null } {
  if (!category) return { main: 'Uncategorized', sub: null };
  
  const parts = category.split(' - ');
  return {
    main: parts[0]?.trim() || 'Uncategorized',
    sub: parts[1]?.trim() || null
  };
}

function transformLegacyOffer(legacy: any): NewOffer {
  const categoryParts = parseCategory(legacy.category);
  const vendorName = extractVendorFromProduct(legacy.product_link);
  const clickbankId = extractClickBankId(legacy.product_link);
  
  return {
    clickbank_id: clickbankId,
    title: legacy.product_name,
    description: legacy.description,
    category: categoryParts.main,
    subcategory: categoryParts.sub,
    vendor_name: vendorName,
    gravity_score: parseFloat(legacy.current_gravity_score || '0'),
    commission_rate: legacy.initial_conversion ? parseFloat(legacy.initial_conversion) / 100 : null,
    average_dollar_per_sale: legacy.average_conversion ? parseFloat(legacy.average_conversion) : null,
    initial_dollar_per_sale: legacy.future_rebill ? parseFloat(legacy.future_rebill) : null,
    refund_rate: null, // Not available in legacy data
    has_recurring_products: legacy.future_rebill ? parseFloat(legacy.future_rebill) > 0 : null,
    mobile_optimized: null, // Not available in legacy data
    affiliate_page_url: legacy.affiliate_page_link,
    sales_page_url: legacy.product_link,
    is_active: true, // Assume active if in legacy database
    created_at: legacy.last_updated || new Date().toISOString()
  };
}

export async function importOffersToNewDatabase(offers: any[]) {
  console.log(`Importing ${offers.length} offers to new database...`);
  
  try {
    // Transform data
    console.log('Transforming data...');
    const transformedOffers = offers.map(transformLegacyOffer);
    
    // Clear existing data in new database
    console.log('Clearing existing data in new database...');
    const newClient = await createNewClient();
    await newClient.from('clickbank_offers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Insert in batches
    const batchSize = 500;
    let imported = 0;
    
    for (let i = 0; i < transformedOffers.length; i += batchSize) {
      const batch = transformedOffers.slice(i, i + batchSize);
      
      console.log(`Importing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedOffers.length / batchSize)} (${batch.length} offers)...`);
      
      const { error: insertError } = await newClient
        .from('clickbank_offers')
        .insert(batch);
      
      if (insertError) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, insertError);
        throw new Error(`Insert error: ${insertError.message}`);
      }
      
      imported += batch.length;
      console.log(`✅ Imported ${imported}/${transformedOffers.length} offers`);
    }
    
    // Verify import
    const { count } = await newClient
      .from('clickbank_offers')
      .select('*', { count: 'exact', head: true });
    
    console.log(`🎉 Migration complete! ${count} offers now in new database`);
    
    return {
      success: true,
      imported: imported,
      total: count
    };
    
  } catch (error) {
    console.error('Import failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function main() {
  console.log('🔄 BlueFX Legacy Data Migration via MCP');
  console.log('=======================================\n');
  
  if (LEGACY_OFFERS_DATA.length === 0) {
    console.log('❌ No legacy data found. Please export data first using MCP commands.');
    console.log('\nRun these MCP commands first:');
    console.log('1. mcp__supabase-legacy__execute_sql: SELECT * FROM clickbank_offers;');
    console.log('2. Copy the results to LEGACY_OFFERS_DATA array in this script');
    console.log('3. Run this script again');
    process.exit(1);
  }
  
  const result = await importOffersToNewDatabase(LEGACY_OFFERS_DATA);
  
  if (result.success) {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Migration failed:', result.error);
    process.exit(1);
  }
}

main();