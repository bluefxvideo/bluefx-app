const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Current database connection  
const currentSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function importCSVHistoryFast() {
  try {
    console.log('📂 Reading CSV file...');
    
    const csvPath = '/Users/admin/bluefx-ai/Score History.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    const dataLines = lines.slice(1); // Skip header
    
    console.log(`📊 Found ${dataLines.length} data rows`);
    
    // Get current offers for mapping (limit processing time)
    const { data: currentOffers, error: offersError } = await currentSupabase
      .from('clickbank_offers')
      .select('clickbank_id, title, vendor_name')
      .limit(1000);
    
    if (offersError) {
      console.error('❌ Error fetching current offers:', offersError);
      return;
    }
    
    console.log(`📋 Found ${currentOffers.length} current offers`);
    
    // Create product mapping (optimized)
    const productMapping = {};
    const offerTitleMap = new Map();
    
    currentOffers.forEach(offer => {
      const titleKey = offer.title.toLowerCase().trim();
      offerTitleMap.set(titleKey, offer.clickbank_id);
      
      // Also map common product name variations
      const firstWord = titleKey.split(' ')[0];
      if (firstWord.length > 3) {
        offerTitleMap.set(firstWord, offer.clickbank_id);
      }
    });
    
    // Process CSV in smaller chunks
    const chunkSize = 10000;
    const productTrends = {};
    let processed = 0;
    
    for (let i = 0; i < dataLines.length; i += chunkSize) {
      const chunk = dataLines.slice(i, i + chunkSize);
      
      chunk.forEach(line => {
        if (!line.trim()) return;
        
        const parts = line.split(',');
        if (parts.length < 5) return;
        
        const product_name = parts[1]?.replace(/"/g, '').trim();
        const gravity_score = parseFloat(parts[2]);
        const recorded_at = parts[4]?.replace(/"/g, '').replace('\r', '').trim();
        
        if (!product_name || isNaN(gravity_score)) return;
        
        // Quick lookup for clickbank_id
        let clickbankId = offerTitleMap.get(product_name.toLowerCase());
        
        if (!clickbankId) {
          // Try partial matches
          for (const [title, id] of offerTitleMap.entries()) {
            if (title.includes(product_name.toLowerCase()) || 
                product_name.toLowerCase().includes(title)) {
              clickbankId = id;
              break;
            }
          }
        }
        
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
          gravity_score,
          recorded_at
        });
        
        trend.max_gravity = Math.max(trend.max_gravity, gravity_score);
        trend.min_gravity = Math.min(trend.min_gravity, gravity_score);
        trend.total_gravity += gravity_score;
        trend.count++;
      });
      
      processed += chunk.length;
      console.log(`⏳ Processed ${processed}/${dataLines.length} rows (${Math.round(processed/dataLines.length*100)}%)`);
    }
    
    console.log(`🎯 Found data for ${Object.keys(productTrends).length} products`);
    
    // Clear existing data
    console.log('🗑️ Clearing existing clickbank_history...');
    await currentSupabase.from('clickbank_history').delete().neq('id', 'impossible');
    
    // Prepare records for insertion
    const records = Object.values(productTrends).map(trend => {
      const avg_gravity = trend.total_gravity / trend.count;
      const first_score = trend.daily_data[0]?.gravity_score || 0;
      const last_score = trend.daily_data[trend.daily_data.length - 1]?.gravity_score || 0;
      const gravity_change = last_score - first_score;
      
      // Sort daily data by date
      trend.daily_data.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
      
      return {
        clickbank_id: trend.clickbank_id,
        max_gravity: trend.max_gravity,
        min_gravity: trend.min_gravity,
        avg_gravity: avg_gravity,
        gravity_change: gravity_change,
        data_points: trend.count,
        daily_data: JSON.stringify(trend.daily_data),
        first_recorded: trend.daily_data[0]?.recorded_at,
        last_recorded: trend.daily_data[trend.daily_data.length - 1]?.recorded_at
      };
    });
    
    console.log(`📈 Prepared ${records.length} products with real daily data`);
    
    // Insert in batches
    const batchSize = 50;
    let imported = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { error } = await currentSupabase
        .from('clickbank_history')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error);
      } else {
        imported += batch.length;
        console.log(`✅ Imported batch ${Math.floor(i/batchSize) + 1}: ${batch.length} products`);
      }
    }
    
    console.log(`\n🎉 Import Complete!`);
    console.log(`✅ Products with real data: ${imported}`);
    console.log(`📊 Total CSV records processed: ${processed}`);
    console.log(`📈 Average data points per product: ${Math.round(Object.values(productTrends).reduce((sum, t) => sum + t.count, 0) / Object.keys(productTrends).length)}`);
    
  } catch (error) {
    console.error('💥 Critical error:', error);
  }
}

importCSVHistoryFast();