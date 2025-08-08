#!/usr/bin/env node

// This script generates smaller SQL queries to export all data efficiently
// Run: node scripts/rapid-export.js

console.log('=== RAPID EXPORT COMMANDS ===');
console.log('Copy and run these commands one by one:\n');

const totalOffers = 1193;
const batchSize = 50;
const totalBatches = Math.ceil(totalOffers / batchSize);

console.log('mkdir -p data-export/batches');
console.log('');

for (let i = 0; i < totalBatches; i++) {
  const offset = i * batchSize;
  console.log(`# Batch ${i + 1}/${totalBatches} (records ${offset + 1}-${Math.min(offset + batchSize, totalOffers)})`);
  console.log(`mcp__supabase-legacy__execute_sql "SELECT json_agg(t) FROM (SELECT * FROM clickbank_offers ORDER BY current_gravity_score::float DESC LIMIT ${batchSize} OFFSET ${offset}) t" > data-export/batches/batch${i + 1}.json`);
  console.log('');
}

console.log('# After all batches, combine them:');
console.log('node scripts/combine-all-batches.js');