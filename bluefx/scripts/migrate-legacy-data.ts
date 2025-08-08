import { createClient as createNewClient } from '@/app/supabase/server';

interface LegacyOffer {
  id: number;
  product_name: string;
  category: string | null;
  current_gravity_score: string | null;
  initial_conversion: string | null;
  future_rebill: string | null;
  description: string | null;
  average_conversion: string | null;
  affiliate_page_link: string | null;
  product_link: string | null;
  seller_contact: string | null;
  last_updated: string | null;
  current_position: number | null;
}

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

function transformLegacyOffer(legacy: LegacyOffer): NewOffer {
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

export async function migrateLegacyOffers(legacyOffers: LegacyOffer[]) {
  console.log('Starting ClickBank offers migration...');
  
  try {
    
    if (!legacyOffers || legacyOffers.length === 0) {
      throw new Error('No legacy offers found');
    }
    
    console.log(`Found ${legacyOffers.length} legacy offers`);
    
    // Transform data
    console.log('Transforming data...');
    const transformedOffers = legacyOffers.map(transformLegacyOffer);
    
    // Clear existing data in new database
    console.log('Clearing existing data in new database...');
    const newClient = await createNewClient();
    await newClient.from('clickbank_offers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Insert in batches (Supabase has 1000 row limit per insert)
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
    
    console.log(`🎉 Migration complete! Imported ${imported} ClickBank offers`);
    
    // Verify import
    const { count } = await newClient
      .from('clickbank_offers')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Verification: ${count} offers now in new database`);
    
    return {
      success: true,
      imported: imported,
      total: count
    };
    
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function migrateLegacyKeywords() {
  console.log('Starting keywords migration...');
  
  try {
    const legacyClient = createLegacyClient();
    const { data: legacyKeywords, error: legacyError } = await legacyClient
      .from('keywords')
      .select('*');
    
    if (legacyError) {
      console.log('No legacy keywords found, skipping keywords migration');
      return { success: true, imported: 0 };
    }
    
    if (!legacyKeywords || legacyKeywords.length === 0) {
      console.log('No keywords to migrate');
      return { success: true, imported: 0 };
    }
    
    const newClient = await createNewClient();
    
    // Transform and insert keywords
    const { error: insertError } = await newClient
      .from('keywords')
      .insert(legacyKeywords.map(keyword => ({
        keyword: keyword.keyword,
        search_volume: keyword.volume,
        difficulty_score: keyword.difficulty,
        cost_per_click: keyword.cpc,
        competition_level: keyword.competition,
        category: keyword.search_intent,
        is_active: true,
        last_checked_at: keyword.last_updated_at || new Date().toISOString()
      })));
    
    if (insertError) {
      throw new Error(`Keywords insert error: ${insertError.message}`);
    }
    
    console.log(`✅ Migrated ${legacyKeywords.length} keywords`);
    
    return {
      success: true,
      imported: legacyKeywords.length
    };
    
  } catch (error) {
    console.error('Keywords migration failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Main migration function
export async function runFullMigration() {
  console.log('🚀 Starting full legacy data migration...');
  
  const results = {
    offers: await migrateLegacyOffers(),
    keywords: await migrateLegacyKeywords()
  };
  
  console.log('\n📊 Migration Summary:');
  console.log(`- ClickBank Offers: ${results.offers.success ? `✅ ${results.offers.imported} imported` : `❌ ${results.offers.error}`}`);
  console.log(`- Keywords: ${results.keywords.success ? `✅ ${results.keywords.imported} imported` : `❌ ${results.keywords.error}`}`);
  
  return results;
}