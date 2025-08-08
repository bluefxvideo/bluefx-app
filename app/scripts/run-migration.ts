#!/usr/bin/env tsx

import { runFullMigration } from './migrate-legacy-data';

async function main() {
  console.log('🔄 BlueFX Legacy Data Migration Tool');
  console.log('=====================================\n');
  
  try {
    const results = await runFullMigration();
    
    if (results.offers.success && results.keywords.success) {
      console.log('\n🎉 Migration completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Migration completed with errors');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

main();