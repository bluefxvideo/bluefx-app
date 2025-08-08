#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Legacy database credentials
const LEGACY_URL = 'https://trjkxgkbkyzthrgkbwfe.supabase.co';
const LEGACY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyamt4Z2tia3l6dGhyZ2tid2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1NDIzNzIsImV4cCI6MjA1ODExODM3Mn0.6IByqyY3tcNUxF509FCfXX0EaI7GDzE3IRFdCbs5z8k';

async function exportAllLegacyOffers() {
  console.log('🔄 Exporting ALL Legacy ClickBank Offers');
  console.log('========================================\n');
  
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
    
    // Export ALL data at once (Supabase can handle up to 1000 records efficiently)
    console.log('📦 Exporting all offers in one batch...');
    
    const { data, error } = await legacyClient
      .from('clickbank_offers')
      .select('*')
      .order('current_gravity_score', { ascending: false });
    
    if (error) {
      throw new Error(`Export error: ${error.message}`);
    }
    
    console.log(`✅ Exported ${data?.length || 0} offers`);
    
    // Save to JSON file
    const exportDir = path.join(process.cwd(), 'data-export');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `all-legacy-offers-${timestamp}.json`;
    const filepath = path.join(exportDir, filename);
    
    console.log(`💾 Saving to ${filename}...`);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    
    console.log(`🎉 Export complete!`);
    console.log(`📁 File: ${filepath}`);
    console.log(`📊 Records: ${data?.length || 0}`);
    console.log(`💾 Size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`);
    
    return {
      success: true,
      filepath,
      totalRecords: data?.length || 0,
      data
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
  const result = await exportAllLegacyOffers();
  
  if (result.success) {
    console.log('\n🚀 Export successful!');
    console.log(`✅ Exported ${result.totalRecords} offers`);
    console.log('\nNext: Run import script to load into new database');
    process.exit(0);
  } else {
    console.log(`\n💥 Export failed: ${result.error}`);
    process.exit(1);
  }
}

main();