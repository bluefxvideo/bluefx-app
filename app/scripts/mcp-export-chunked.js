#!/usr/bin/env node

// This script uses console output to build the export
// Run: node scripts/mcp-export-chunked.js > data-export/legacy-offers-raw.json

const fs = require('fs');
const path = require('path');

console.log('// Use this script with MCP commands to export all legacy data');
console.log('// Commands to run in order:');
console.log('');

// Generate MCP export commands for chunks
const totalOffers = 1193;
const chunkSize = 100;
const totalChunks = Math.ceil(totalOffers / chunkSize);

console.log('// Step 1: Create export directory');
console.log('mkdir -p data-export');
console.log('');

console.log('// Step 2: Export data in chunks using MCP commands');
for (let chunk = 0; chunk < totalChunks; chunk++) {
  const start = chunk * chunkSize;
  const end = Math.min(start + chunkSize - 1, totalOffers - 1);
  
  console.log(`// Chunk ${chunk + 1}/${totalChunks}: Records ${start + 1}-${end + 1}`);
  console.log(`mcp__supabase-legacy__execute_sql "SELECT * FROM clickbank_offers ORDER BY id LIMIT ${chunkSize} OFFSET ${start}" > data-export/chunk-${chunk + 1}.json`);
  console.log('');
}

console.log('// Step 3: Combine chunks into single file');
console.log('// After all chunks are exported, run:');
console.log('node scripts/combine-chunks.js');

// Create the chunk combiner script
const combinerScript = `#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function combineChunks() {
  console.log('🔧 Combining export chunks...');
  
  const exportDir = path.join(process.cwd(), 'data-export');
  const chunkFiles = fs.readdirSync(exportDir)
    .filter(f => f.startsWith('chunk-') && f.endsWith('.json'))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/chunk-(\\d+)/)[1]);
      const bNum = parseInt(b.match(/chunk-(\\d+)/)[1]);
      return aNum - bNum;
    });
  
  console.log(\`📦 Found \${chunkFiles.length} chunk files\`);
  
  let allOffers = [];
  
  for (const file of chunkFiles) {
    const filepath = path.join(exportDir, file);
    console.log(\`📖 Reading \${file}...\`);
    
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      // Parse MCP response format
      const jsonMatch = content.match(/\\[.*\\]/s);
      if (jsonMatch) {
        const chunkData = JSON.parse(jsonMatch[0]);
        allOffers = allOffers.concat(chunkData);
        console.log(\`✅ Added \${chunkData.length} offers from \${file}\`);
      }
    } catch (error) {
      console.error(\`❌ Failed to parse \${file}:\`, error.message);
    }
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(exportDir, \`legacy-clickbank-offers-\${timestamp}.json\`);
  
  console.log(\`💾 Writing \${allOffers.length} offers to \${path.basename(outputFile)}...\`);
  fs.writeFileSync(outputFile, JSON.stringify(allOffers, null, 2));
  
  console.log('🎉 Export complete!');
  console.log(\`📁 File: \${outputFile}\`);
  console.log(\`📊 Total offers: \${allOffers.length}\`);
  
  return outputFile;
}

combineChunks().catch(console.error);
`;

fs.writeFileSync('scripts/combine-chunks.js', combinerScript);
console.log('');
console.log('// Chunk combiner script created: scripts/combine-chunks.js');