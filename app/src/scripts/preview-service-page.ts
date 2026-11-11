/** Writes the public Weekly Video Plan page ($99) to a local HTML file for a look (owner 2026-11-11 bigger fonts). */
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../.env.local') });

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error('usage: preview-service-page.ts <out.html>');
  const { renderPublicServicePage } = await import('@/lib/free-video/service-public');
  fs.writeFileSync(out, renderPublicServicePage(99));
  console.log(`✅ ${out}`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
