const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

require('dotenv').config();

const currentSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function parseCSVLine(line) {
  // Handle CSV with potential commas in quoted fields
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

async function importCSVRobust() {
  try {
    console.log('📂 Reading CSV with robust parsing...');
    
    const csvPath = '/Users/admin/bluefx-ai/Score History.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    const dataLines = lines.slice(1);
    
    console.log(`📊 Processing ${dataLines.length} rows...`);
    
    // Get current offers for mapping
    const { data: currentOffers } = await currentSupabase
      .from('clickbank_offers')
      .select('clickbank_id, title, vendor_name');
    
    // Create faster lookup maps
    const offerTitleMap = new Map();
    const offerKeywordMap = new Map();
    
    currentOffers.forEach(offer => {
      const title = offer.title.toLowerCase().trim();
      offerTitleMap.set(title, offer.clickbank_id);
      
      // Create keyword mapping for fuzzy matching
      const keywords = title.split(' ').filter(word => word.length > 3);
      keywords.forEach(keyword => {
        if (!offerKeywordMap.has(keyword)) {
          offerKeywordMap.set(keyword, []);
        }
        offerKeywordMap.get(keyword).push(offer.clickbank_id);
      });
    });
    
    const productTrends = {};
    let validRows = 0;
    let invalidRows = 0;
    
    // Process in chunks
    for (let i = 0; i < dataLines.length; i += 5000) {
      const chunk = dataLines.slice(i, i + 5000);
      
      chunk.forEach((line, idx) => {
        try {
          const parts = parseCSVLine(line);
          
          if (parts.length < 5) {
            invalidRows++;
            return;
          }
          
          const product_name = parts[1]?.replace(/"/g, '').trim();
          const gravity_score = parseFloat(parts[2]);
          const recorded_at = parts[4]?.replace(/"/g, '').replace(/\r$/, '').trim();
          
          // Validate data
          if (!product_name || isNaN(gravity_score) || !recorded_at) {
            invalidRows++;
            return;
          }
          
          // Validate timestamp format
          if (!recorded_at.match(/^\d{4}-\d{2}-\d{2}/)) {
            invalidRows++;
            return;
          }
          
          // Find clickbank_id
          let clickbankId = offerTitleMap.get(product_name.toLowerCase());
          
          if (!clickbankId) {
            // Try keyword matching
            const keywords = product_name.toLowerCase().split(' ').filter(w => w.length > 3);
            for (const keyword of keywords) {
              const candidates = offerKeywordMap.get(keyword);
              if (candidates && candidates.length > 0) {
                clickbankId = candidates[0]; // Take first match
                break;
              }
            }
          }
          
          if (!clickbankId) {
            invalidRows++;
            return;
          }
          
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
          validRows++;
          
        } catch (error) {
          invalidRows++;
        }
      });
      
      console.log(`⏳ Processed ${Math.min(i + 5000, dataLines.length)}/${dataLines.length} rows`);
    }
    
    console.log(`✅ Valid rows: ${validRows}, Invalid rows: ${invalidRows}`);
    console.log(`🎯 Products with data: ${Object.keys(productTrends).length}`);
    
    // Get existing records to avoid duplicates
    const { data: existingRecords } = await currentSupabase
      .from('clickbank_history')
      .select('clickbank_id');
    
    const existingIds = new Set(existingRecords?.map(r => r.clickbank_id) || []);
    
    // Prepare new records (skip existing ones)
    const newRecords = Object.values(productTrends)
      .filter(trend => !existingIds.has(trend.clickbank_id))
      .map(trend => {
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
    
    console.log(`📈 New records to import: ${newRecords.length}`);
    console.log(`⏭️ Skipping existing records: ${existingIds.size}`);
    
    if (newRecords.length === 0) {
      console.log('✅ All products already have historical data!');
      return;
    }
    
    // Insert new records
    const batchSize = 50;
    let imported = 0;
    
    for (let i = 0; i < newRecords.length; i += batchSize) {
      const batch = newRecords.slice(i, i + batchSize);
      
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
    
    console.log(`\n🎉 Additional Import Complete!`);
    console.log(`✅ New products imported: ${imported}`);
    console.log(`📊 Total products with real data: ${existingIds.size + imported}`);
    
  } catch (error) {
    console.error('💥 Critical error:', error);
  }
}

importCSVRobust();