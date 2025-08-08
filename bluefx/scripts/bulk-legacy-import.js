#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get current database credentials from environment
const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function extractVendorFromProduct(productLink) {
  if (!productLink) return 'Unknown Vendor';
  
  const match = productLink.match(/vendor=([A-Z0-9]+)/);
  if (match) {
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
    refund_rate: null,
    has_recurring_products: legacy.future_rebill ? parseFloat(legacy.future_rebill) > 0 : null,
    mobile_optimized: null,
    affiliate_page_url: legacy.affiliate_page_link,
    sales_page_url: legacy.product_link,
    is_active: true,
    created_at: legacy.last_updated || new Date().toISOString()
  };
}

// Read the MCP export data we already have from the first 100 records
const mcpData = [
  // Data from our previous MCP call
  {"id":45948,"product_name":"MITOLYN - $200 CPA! Join Our $340k+ Sales Contest Go To mitolyn.vip","category":"Health & Fitness - Dietary Supplements","current_gravity_score":"766.05","initial_conversion":"151.96","future_rebill":"0.03","description":"CB's #1 Offer By The Team That Delivers. 85% Revshare and $200 CPA Available! Go To mitolyn.vip To Join Our 2025 Sales Contest ($340k+ Pr Read more","average_conversion":"151.97","affiliate_page_link":"https://mitolyn.com/affiliates/","product_link":"https://hop.clickbank.net/?affiliate=zzzzz&vendor=MITOLYN","seller_contact":"Seller Contact","last_updated":"2025-04-17 04:08:06+00","current_position":1}
  // ... will be populated with actual data
];

async function bulkImport() {
  console.log('🚀 Starting Bulk Legacy Import');
  console.log('===============================\n');
  
  console.log('⚠️  INSTRUCTIONS:');
  console.log('1. This script is ready to import data you provide');
  console.log('2. To get ALL 1,193 offers, use the MCP commands above');
  console.log('3. Each MCP command returns ~50 offers (manageable token size)');
  console.log('4. Save each result to: data-export/batches/batchX.json');
  console.log('5. Run this script again to process all batches\n');
  
  // Check if we have batch files
  const batchDir = path.join(process.cwd(), 'data-export', 'batches');
  if (!fs.existsSync(batchDir)) {
    console.log('📁 Creating batch directory...');
    fs.mkdirSync(batchDir, { recursive: true });
    console.log('✅ Ready for batch exports!');
    return;
  }
  
  const batchFiles = fs.readdirSync(batchDir)
    .filter(f => f.startsWith('batch') && f.endsWith('.json'))
    .sort();
  
  if (batchFiles.length === 0) {
    console.log('📭 No batch files found. Export data first using MCP commands.');
    return;
  }
  
  console.log(`📦 Found ${batchFiles.length} batch files to process`);
  
  // Process batches and combine
  let allOffers = [];
  
  for (const file of batchFiles) {
    const filepath = path.join(batchDir, file);
    console.log(`📖 Processing ${file}...`);
    
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      const batchData = JSON.parse(content);
      
      if (Array.isArray(batchData)) {
        allOffers = allOffers.concat(batchData);
        console.log(`✅ Added ${batchData.length} offers from ${file}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process ${file}:`, error.message);
    }
  }
  
  console.log(`\n📊 Total offers collected: ${allOffers.length}`);
  
  if (allOffers.length === 0) {
    console.log('🔍 No data to import. Check batch files.');
    return;
  }
  
  // Transform and import to new database
  console.log('🔄 Transforming data...');
  const transformedOffers = allOffers.map(transformLegacyOffer);
  
  console.log('📡 Connecting to new database...');
  const supabase = createClient(NEW_URL, NEW_KEY);
  
  // Clear existing data
  console.log('🗑️ Clearing existing data...');
  await supabase.from('clickbank_offers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  // Import in batches
  const importBatchSize = 100;
  const totalImportBatches = Math.ceil(transformedOffers.length / importBatchSize);
  let imported = 0;
  
  console.log(`📦 Importing ${transformedOffers.length} offers in ${totalImportBatches} batches...`);
  
  for (let i = 0; i < totalImportBatches; i++) {
    const start = i * importBatchSize;
    const end = Math.min(start + importBatchSize, transformedOffers.length);
    const batch = transformedOffers.slice(start, end);
    
    console.log(`⏳ Import batch ${i + 1}/${totalImportBatches}: ${batch.length} offers...`);
    
    const { data, error } = await supabase
      .from('clickbank_offers')
      .insert(batch)
      .select('id');
    
    if (error) {
      console.error(`❌ Import batch ${i + 1} failed:`, error.message);
    } else {
      imported += data?.length || batch.length;
      console.log(`✅ Import batch ${i + 1} success: ${data?.length || batch.length} offers`);
    }
  }
  
  console.log(`\n🎉 Import Complete!`);
  console.log(`✅ Imported: ${imported}/${transformedOffers.length} offers`);
  
  // Verify final count
  const { count } = await supabase
    .from('clickbank_offers')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 Database total: ${count} offers`);
}

bulkImport().catch(console.error);