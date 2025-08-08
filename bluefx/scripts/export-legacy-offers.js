#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Legacy database credentials
const LEGACY_URL = 'https://trjkxgkbkyzthrgkbwfe.supabase.co';
const LEGACY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyamt4Z2tia3l6dGhyZ2tid2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1NDIzNzIsImV4cCI6MjA1ODExODM3Mn0.6IByqyY3tcNUxF509FCfXX0EaI7GDzE3IRFdCbs5z8k';

async function exportLegacyOffers() {
  console.log('🔄 Exporting Legacy ClickBank Offers');
  console.log('====================================\n');
  
  try {
    const legacyClient = createClient(LEGACY_URL, LEGACY_KEY);
    
    console.log('📡 Connecting to legacy database...');
    
    // Get total count first
    const { count, error: countError } = await legacyClient
      .from('clickbank_offers')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      throw new Error(`Count error: ${countError.message}`);
    }
    
    console.log(`📊 Found ${count} total offers in legacy database`);
    
    // Export in batches to handle large dataset
    const batchSize = 1000;
    const totalBatches = Math.ceil(count / batchSize);
    let allOffers = [];
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const start = batch * batchSize;
      console.log(`📦 Exporting batch ${batch + 1}/${totalBatches} (records ${start + 1}-${Math.min(start + batchSize, count)})...`);
      
      const { data, error } = await legacyClient
        .from('clickbank_offers')
        .select('*')
        .order('id')
        .range(start, start + batchSize - 1);
      
      if (error) {
        throw new Error(`Batch ${batch + 1} error: ${error.message}`);
      }
      
      allOffers = allOffers.concat(data || []);
      console.log(`✅ Exported ${allOffers.length}/${count} offers`);
    }
    
    // Save to JSON file
    const exportDir = path.join(process.cwd(), 'data-export');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `legacy-clickbank-offers-${timestamp}.json`;
    const filepath = path.join(exportDir, filename);
    
    console.log(`💾 Saving to ${filename}...`);
    fs.writeFileSync(filepath, JSON.stringify(allOffers, null, 2));
    
    console.log(`🎉 Export complete!`);
    console.log(`📁 File: ${filepath}`);
    console.log(`📊 Records: ${allOffers.length}`);
    console.log(`💾 Size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`);
    
    // Create a sample for testing
    const sampleFilepath = path.join(exportDir, `sample-offers-${timestamp}.json`);
    const sample = allOffers.slice(0, 20);
    fs.writeFileSync(sampleFilepath, JSON.stringify(sample, null, 2));
    console.log(`📝 Sample file created: ${sampleFilepath} (${sample.length} records)`);
    
    return {
      success: true,
      filepath,
      sampleFilepath,
      totalRecords: allOffers.length
    };
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  const result = await exportLegacyOffers();
  
  if (result.success) {
    console.log('\n🚀 Next Steps:');
    console.log('1. Review the exported JSON file');
    console.log('2. Run the import script: npm run import-offers');
    console.log('3. Test the Top Offers UI with full dataset');
    process.exit(0);
  } else {
    console.log(`\n💥 Export failed: ${result.error}`);
    process.exit(1);
  }
}

main();