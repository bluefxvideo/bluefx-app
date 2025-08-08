const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
// Load legacy environment variables manually
const legacyEnv = {
  SUPABASE_URL: 'https://trjkxgkbkyzthrgkbwfe.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyamt4Z2tia3l6dGhyZ2tid2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1NDIzNzIsImV4cCI6MjA1ODExODM3Mn0.6IByqyY3tcNUxF509FCfXX0EaI7GDzE3IRFdCbs5z8k'
};

// Load current environment variables
require('dotenv').config();

// Legacy database connection
const legacySupabase = createClient(
  legacyEnv.SUPABASE_URL,
  legacyEnv.SUPABASE_ANON_KEY
);

// Current database connection  
const currentSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function importHistoricalData() {
  try {
    console.log('🔍 Checking legacy database connection...');
    
    // First, let's see what tables exist
    const { data: tables, error: tablesError } = await legacySupabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tablesError) {
      console.log('❌ Cannot access table list, trying direct table access...');
    } else {
      console.log('📋 Available tables:', tables.map(t => t.table_name));
    }
    
    // Check offer_trend_analysis table for historical data
    console.log('🔍 Checking offer_trend_analysis table...');
    const { data: trendData, error: trendError } = await legacySupabase
      .from('offer_trend_analysis')
      .select('*')
      .limit(10);
    
    if (trendError) {
      console.error('❌ Error accessing offer_trend_analysis:', trendError);
      return;
    }
    
    if (!trendData || trendData.length === 0) {
      console.log('❌ offer_trend_analysis table is empty');
      return;
    }
    
    console.log(`📊 Found ${trendData.length} trend analysis records`);
    console.log('📋 Sample trend record:', trendData[0]);
    console.log('🔑 Available fields:', Object.keys(trendData[0]));
    
    // Now get the full dataset
    const { data: allTrendData, error: allTrendError } = await legacySupabase
      .from('offer_trend_analysis')
      .select('*');
    
    if (allTrendError) {
      console.error('❌ Error fetching all trend data:', allTrendError);
      return;
    }
    
    const historicalData = allTrendData;
    
    if (!historicalData || historicalData.length === 0) {
      console.log('❌ No historical data found in any table');
      console.log('🔍 Checking legacy clickbank_offers table for timestamp fields...');
      
      const { data: legacyOffers, error: legacyError } = await legacySupabase
        .from('clickbank_offers')
        .select('*')
        .limit(3);
      
      if (legacyError) {
        console.log('❌ Cannot access legacy offers:', legacyError.message);
      } else if (legacyOffers?.length > 0) {
        console.log('📋 Legacy offer sample:', legacyOffers[0]);
        console.log('🔑 Available fields:', Object.keys(legacyOffers[0]));
      }
      return;
    }
    
    console.log(`📊 Found ${historicalData?.length || 0} historical records`);
    if (historicalData?.length > 0) {
      console.log('Sample record:', historicalData[0]);
    }
    
    // Get current offers to match product names
    const { data: currentOffers, error: offersError } = await currentSupabase
      .from('clickbank_offers')
      .select('clickbank_id, title, vendor_name');
    
    if (offersError) {
      console.error('❌ Error fetching current offers:', offersError);
      return;
    }
    
    console.log(`📋 Found ${currentOffers.length} current offers`);
    
    // Create mapping from product names to clickbank_ids
    const productMapping = {};
    currentOffers.forEach(offer => {
      // Try multiple matching strategies
      const title = offer.title.toLowerCase();
      const vendor = offer.vendor_name.toLowerCase();
      
      historicalData.forEach(historical => {
        const productName = historical.product_name.toLowerCase();
        
        // Match by title similarity or vendor name
        if (title.includes(productName.split(' ')[0]) || 
            productName.includes(title.split(' ')[0]) ||
            productName.includes(vendor)) {
          productMapping[historical.product_name] = offer.clickbank_id;
        }
      });
    });
    
    console.log(`🔗 Mapped ${Object.keys(productMapping).length} products`);
    
    // Prepare trend data for insertion
    const historicalRecords = historicalData
      .filter(record => productMapping[record.product_name])
      .map(record => ({
        clickbank_id: productMapping[record.product_name],
        max_gravity: record.max_gravity,
        min_gravity: record.min_gravity,
        avg_gravity: record.avg_gravity,
        gravity_change: record.gravity_change,
        data_points: record.data_points,
        first_recorded: record.first_recorded,
        last_recorded: record.last_recorded
      }));
    
    console.log(`📈 Prepared ${historicalRecords.length} historical records for import`);
    
    console.log('✅ Skipping table creation - using Supabase migration instead');
    
    // Insert historical data in batches
    const batchSize = 1000;
    let imported = 0;
    let failed = 0;
    
    for (let i = 0; i < historicalRecords.length; i += batchSize) {
      const batch = historicalRecords.slice(i, i + batchSize);
      
      const { data, error } = await currentSupabase
        .from('clickbank_history')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error);
        failed += batch.length;
      } else {
        imported += batch.length;
        console.log(`✅ Imported batch ${Math.floor(i/batchSize) + 1}: ${batch.length} records`);
      }
    }
    
    console.log(`\n📊 Import Summary:`);
    console.log(`✅ Successfully imported: ${imported} historical records`);
    console.log(`❌ Failed: ${failed} records`);
    console.log(`🎯 Total processed: ${historicalRecords.length} records`);
    
  } catch (error) {
    console.error('💥 Critical error:', error);
  }
}

// Run the import
importHistoricalData();