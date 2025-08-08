const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Current database connection  
const currentSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function importCSVHistory() {
  try {
    console.log('📂 Reading CSV file...');
    
    const csvPath = '/Users/admin/bluefx-ai/Score History.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    const header = lines[0];
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    console.log(`📊 Found ${dataLines.length} data rows`);
    console.log('📋 Header:', header);
    
    // Parse CSV data
    const csvData = dataLines.map(line => {
      const [id, product_name, gravity_score, position, recorded_at] = line.split(',');
      return {
        product_name: product_name?.replace(/"/g, ''), // Remove quotes
        gravity_score: parseFloat(gravity_score),
        recorded_at: recorded_at?.replace(/"/g, ''),
        position: parseInt(position)
      };
    }).filter(row => row.product_name && !isNaN(row.gravity_score));
    
    console.log(`✅ Parsed ${csvData.length} valid records`);
    console.log('📋 Sample:', csvData[0]);
    
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
    const unmatchedProducts = new Set();
    
    currentOffers.forEach(offer => {
      const title = offer.title.toLowerCase().trim();
      const vendor = offer.vendor_name.toLowerCase().trim();
      
      csvData.forEach(historical => {
        const productName = historical.product_name.toLowerCase().trim();
        
        // Multiple matching strategies
        if (
          // Exact title match
          title === productName ||
          // Title contains product name
          title.includes(productName) ||
          // Product name contains title
          productName.includes(title) ||
          // Match first significant word
          (title.split(' ')[0].length > 3 && productName.includes(title.split(' ')[0])) ||
          (productName.split(' ')[0].length > 3 && title.includes(productName.split(' ')[0])) ||
          // Vendor name match
          productName.includes(vendor)
        ) {
          productMapping[historical.product_name] = offer.clickbank_id;
        }
      });
    });
    
    // Track unmatched products
    csvData.forEach(record => {
      if (!productMapping[record.product_name]) {
        unmatchedProducts.add(record.product_name);
      }
    });
    
    console.log(`🔗 Mapped ${Object.keys(productMapping).length} products`);
    console.log(`❓ ${unmatchedProducts.size} products couldn't be matched`);
    
    if (unmatchedProducts.size > 0) {
      console.log('Top unmatched products:', Array.from(unmatchedProducts).slice(0, 10));
    }
    
    // Clear existing clickbank_history data first
    console.log('🗑️ Clearing existing clickbank_history data...');
    const { error: deleteError } = await currentSupabase
      .from('clickbank_history')
      .delete()
      .neq('id', 'impossible-value'); // Delete all records
    
    if (deleteError) {
      console.error('❌ Error clearing existing data:', deleteError);
      return;
    }
    
    // Group CSV data by product and create trend records
    const productTrends = {};
    
    csvData.forEach(record => {
      const clickbankId = productMapping[record.product_name];
      if (!clickbankId) return;
      
      if (!productTrends[clickbankId]) {
        productTrends[clickbankId] = {
          clickbank_id: clickbankId,
          daily_data: [],
          max_gravity: 0,
          min_gravity: Infinity,
          total_gravity: 0,
          count: 0
        };
      }
      
      const trend = productTrends[clickbankId];
      trend.daily_data.push({
        gravity_score: record.gravity_score,
        recorded_at: record.recorded_at,
        position: record.position
      });
      
      trend.max_gravity = Math.max(trend.max_gravity, record.gravity_score);
      trend.min_gravity = Math.min(trend.min_gravity, record.gravity_score);
      trend.total_gravity += record.gravity_score;
      trend.count++;
    });
    
    // Calculate averages and prepare for insertion
    const historicalRecords = Object.values(productTrends).map(trend => {
      const avg_gravity = trend.total_gravity / trend.count;
      const first_score = trend.daily_data[0]?.gravity_score || 0;
      const last_score = trend.daily_data[trend.daily_data.length - 1]?.gravity_score || 0;
      const gravity_change = last_score - first_score;
      
      return {
        clickbank_id: trend.clickbank_id,
        max_gravity: trend.max_gravity,
        min_gravity: trend.min_gravity,
        avg_gravity: avg_gravity,
        gravity_change: gravity_change,
        data_points: trend.count,
        daily_data: JSON.stringify(trend.daily_data), // Store actual daily data as JSON
        first_recorded: trend.daily_data[0]?.recorded_at,
        last_recorded: trend.daily_data[trend.daily_data.length - 1]?.recorded_at
      };
    });
    
    console.log(`📈 Prepared ${historicalRecords.length} trend records with real daily data`);
    
    // Insert in batches
    const batchSize = 100;
    let imported = 0;
    let failed = 0;
    
    for (let i = 0; i < historicalRecords.length; i += batchSize) {
      const batch = historicalRecords.slice(i, i + batchSize);
      
      const { error } = await currentSupabase
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
    console.log(`✅ Successfully imported: ${imported} products with real daily data`);
    console.log(`❌ Failed: ${failed} records`);
    console.log(`🎯 Total CSV records processed: ${csvData.length}`);
    console.log(`📈 Products with matched data: ${historicalRecords.length}`);
  } catch (error) {
    console.error('💥 Critical error:', error);
  }
}

importCSVHistory();