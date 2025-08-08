#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get current database credentials
const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
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

function transformCSVToOffer(csvRow, headers) {
  const data = {};
  headers.forEach((header, index) => {
    data[header] = csvRow[index] || null;
  });
  
  const categoryParts = data.category?.split(' - ') || [];
  const vendorMatch = data.product_link?.match(/vendor=([A-Z0-9]+)/);
  
  return {
    clickbank_id: vendorMatch ? vendorMatch[1] : `CB${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    title: data.product_name,
    description: data.description,
    category: categoryParts[0]?.trim() || 'Uncategorized',
    subcategory: categoryParts[1]?.trim() || null,
    vendor_name: vendorMatch ? vendorMatch[1].charAt(0) + vendorMatch[1].slice(1).toLowerCase() : 'Unknown',
    gravity_score: parseFloat(data.current_gravity_score || '0'),
    commission_rate: data.initial_conversion ? Math.min(parseFloat(data.initial_conversion) / 100, 1.0) : null,
    average_dollar_per_sale: data.average_conversion ? parseFloat(data.average_conversion) : null,
    initial_dollar_per_sale: data.future_rebill ? parseFloat(data.future_rebill) : null,
    refund_rate: null,
    has_recurring_products: data.future_rebill ? parseFloat(data.future_rebill) > 0 : null,
    mobile_optimized: null,
    affiliate_page_url: data.affiliate_page_link,
    sales_page_url: data.product_link,
    is_active: true,
    created_at: data.last_updated || new Date().toISOString()
  };
}

async function importFromCSV() {
  console.log('🔄 Importing ALL Legacy Offers from CSV');
  console.log('=======================================\n');
  
  const csvPath = '/Users/admin/bluefx-ai/legacy/BlueFx AI Offers.csv';
  
  if (!fs.existsSync(csvPath)) {
    console.log('❌ CSV file not found!');
    console.log('📋 Steps to get your data:');
    console.log('1. Go to: https://app.supabase.com/project/trjkxgkbkyzthrgkbwfe');
    console.log('2. Navigate to Table Editor → clickbank_offers');
    console.log('3. Click Export → CSV');
    console.log('4. Save as: data-export/legacy-offers.csv');
    console.log('5. Run this script again');
    return;
  }
  
  console.log('📁 Reading CSV file...');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file appears to be empty or invalid');
  }
  
  const headers = parseCSVLine(lines[0]);
  const dataRows = lines.slice(1).map(line => parseCSVLine(line));
  
  console.log(`📊 Found ${dataRows.length} offers in CSV`);
  console.log(`📋 Headers: ${headers.join(', ')}`);
  
  // Transform data
  console.log('🔄 Transforming data...');
  const transformedOffers = dataRows.map(row => transformCSVToOffer(row, headers));
  
  // Connect to new database
  console.log('📡 Connecting to new database...');
  if (!NEW_URL || !NEW_KEY) {
    throw new Error('Missing Supabase credentials');
  }
  
  const supabase = createClient(NEW_URL, NEW_KEY);
  
  // Clear existing data
  console.log('🗑️ Clearing existing data...');
  await supabase.from('clickbank_offers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  // Import in batches
  const batchSize = 100;
  const totalBatches = Math.ceil(transformedOffers.length / batchSize);
  let imported = 0;
  let failed = 0;
  
  console.log(`📦 Importing in ${totalBatches} batches...`);
  
  for (let i = 0; i < totalBatches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, transformedOffers.length);
    const batch = transformedOffers.slice(start, end);
    
    console.log(`⏳ Batch ${i + 1}/${totalBatches}: ${batch.length} offers...`);
    
    try {
      const { data, error } = await supabase
        .from('clickbank_offers')
        .insert(batch)
        .select('id');
      
      if (error) {
        console.error(`❌ Batch ${i + 1} failed:`, error.message);
        failed += batch.length;
      } else {
        imported += data?.length || batch.length;
        console.log(`✅ Batch ${i + 1} success: ${data?.length || batch.length} offers`);
      }
    } catch (error) {
      console.error(`❌ Batch ${i + 1} exception:`, error.message);
      failed += batch.length;
    }
    
    const progress = ((i + 1) / totalBatches * 100).toFixed(1);
    console.log(`📈 Progress: ${progress}%\n`);
  }
  
  // Final verification
  const { count } = await supabase
    .from('clickbank_offers')
    .select('*', { count: 'exact', head: true });
  
  console.log('🎉 Import Complete!');
  console.log(`✅ Imported: ${imported}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Database total: ${count}`);
  console.log(`📈 Success rate: ${((imported / (imported + failed)) * 100).toFixed(1)}%`);
}

importFromCSV().catch(console.error);