#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// New database credentials
const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function extractVendorFromProduct(productLink) {
  if (!productLink) return 'Unknown Vendor';
  
  const match = productLink.match(/vendor=([A-Z0-9]+)/);
  if (match) {
    // Convert to readable format: MITOLYN -> Mitolyn
    return match[1].charAt(0) + match[1].slice(1).toLowerCase();
  }
  
  return 'Unknown Vendor';
}

function extractClickBankId(productLink) {
  if (!productLink) return `CB${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  const match = productLink.match(/vendor=([A-Z0-9]+)/);
  return match ? match[1] : `CB${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

function parseCategory(category) {
  if (!category) return { main: 'Uncategorized', sub: null };
  
  const parts = category.split(' - ');
  return {
    main: parts[0]?.trim() || 'Uncategorized',
    sub: parts[1]?.trim() || null
  };
}

function transformLegacyOffer(legacy) {
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
    commission_rate: legacy.initial_conversion ? Math.min(parseFloat(legacy.initial_conversion) / 100, 1.0) : null,
    average_dollar_per_sale: legacy.average_conversion ? parseFloat(legacy.average_conversion) : null,
    initial_dollar_per_sale: legacy.future_rebill ? parseFloat(legacy.future_rebill) : null,
    refund_rate: null, // Not available in legacy
    has_recurring_products: legacy.future_rebill ? parseFloat(legacy.future_rebill) > 0 : null,
    mobile_optimized: null, // Not available in legacy
    affiliate_page_url: legacy.affiliate_page_link,
    sales_page_url: legacy.product_link,
    is_active: true,
    created_at: legacy.last_updated || new Date().toISOString()
  };
}

async function importOffers(filename) {
  console.log('🔄 Importing ClickBank Offers to New Database');
  console.log('=============================================\n');
  
  try {
    if (!NEW_URL || !NEW_KEY) {
      throw new Error('Missing Supabase credentials. Check environment variables.');
    }
    
    const newClient = createClient(NEW_URL, NEW_KEY);
    
    // Read the exported JSON file
    const exportDir = path.join(process.cwd(), 'data-export');
    let filepath;
    
    if (filename) {
      filepath = path.join(exportDir, filename);
    } else {
      // Find the most recent export file
      const files = fs.readdirSync(exportDir)
        .filter(f => f.startsWith('legacy-clickbank-offers-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (files.length === 0) {
        throw new Error('No export files found. Run export script first.');
      }
      
      filepath = path.join(exportDir, files[0]);
    }
    
    console.log(`📁 Reading data from: ${path.basename(filepath)}`);
    
    if (!fs.existsSync(filepath)) {
      throw new Error(`Export file not found: ${filepath}`);
    }
    
    const legacyOffers = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    console.log(`📊 Found ${legacyOffers.length} offers to import`);
    
    // Transform data
    console.log('🔄 Transforming legacy data...');
    const transformedOffers = legacyOffers.map(transformLegacyOffer);
    
    // Clear existing data (except our sample data)
    console.log('🗑️ Clearing existing data...');
    const { error: deleteError } = await newClient
      .from('clickbank_offers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      console.warn('Delete warning:', deleteError.message);
    }
    
    // Import in batches (Supabase limit: 1000 rows per insert)
    const batchSize = 500;
    const totalBatches = Math.ceil(transformedOffers.length / batchSize);
    let imported = 0;
    let failed = 0;
    
    console.log(`📦 Importing in ${totalBatches} batches of ${batchSize}...`);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, transformedOffers.length);
      const batch = transformedOffers.slice(start, end);
      
      console.log(`⏳ Batch ${i + 1}/${totalBatches}: Importing ${batch.length} offers...`);
      
      try {
        const { data, error: insertError } = await newClient
          .from('clickbank_offers')
          .insert(batch)
          .select('id');
        
        if (insertError) {
          console.error(`❌ Batch ${i + 1} failed:`, insertError.message);
          failed += batch.length;
        } else {
          imported += data?.length || batch.length;
          console.log(`✅ Batch ${i + 1} success: ${data?.length || batch.length} offers imported`);
        }
      } catch (batchError) {
        console.error(`❌ Batch ${i + 1} exception:`, batchError.message);
        failed += batch.length;
      }
      
      // Progress update
      const progress = ((i + 1) / totalBatches * 100).toFixed(1);
      console.log(`📈 Progress: ${progress}% (${imported} imported, ${failed} failed)\n`);
    }
    
    // Final verification
    console.log('🔍 Verifying import...');
    const { count: finalCount, error: countError } = await newClient
      .from('clickbank_offers')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.warn('Count verification failed:', countError.message);
    }
    
    console.log('\n🎉 Import Complete!');
    console.log('==================');
    console.log(`✅ Successfully imported: ${imported}`);
    console.log(`❌ Failed imports: ${failed}`);
    console.log(`📊 Total in database: ${finalCount || 'Unknown'}`);
    console.log(`📈 Success rate: ${((imported / (imported + failed)) * 100).toFixed(1)}%`);
    
    return {
      success: true,
      imported,
      failed,
      total: finalCount
    };
    
  } catch (error) {
    console.error('💥 Import failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  const filename = process.argv[2]; // Optional filename parameter
  const result = await importOffers(filename);
  
  if (result.success) {
    console.log('\n🚀 Ready to test Top Offers with full dataset!');
    process.exit(0);
  } else {
    console.log(`\n💥 Import failed: ${result.error}`);
    process.exit(1);
  }
}

main();