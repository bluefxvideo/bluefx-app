/**
 * Backfill TikTok cover images into Supabase Storage.
 *
 * Run once from the app/ directory:
 *   node scripts/backfill-tiktok-covers.mjs
 *
 * For each TikTok winning ad whose video_cover_url is still a TikTokCDN URL
 * (p*-sign*.tiktokcdn.com), this script downloads the image server-side
 * (using TIKTOK_CC_COOKIES for auth) and re-uploads it to Supabase Storage.
 * It then updates the winning_ads row with the permanent Supabase URL.
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load env
const envRaw = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx < 0) continue;
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let cookieHeader = '';
try {
  const cookies = JSON.parse(env.TIKTOK_CC_COOKIES || '[]');
  cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
} catch { /* no cookies */ }

const BATCH = 20;

async function run() {
  // Fetch all TikTok ads still using a TikTok CDN URL
  const { data: ads, error } = await supabase
    .from('winning_ads')
    .select('id, tiktok_material_id, video_cover_url')
    .eq('platform', 'tiktok')
    .like('video_cover_url', '%tiktokcdn.com%');

  if (error) { console.error('Fetch error:', error); process.exit(1); }
  console.log(`Found ${ads.length} ads to backfill`);

  let ok = 0, fail = 0;

  for (let i = 0; i < ads.length; i += BATCH) {
    const batch = ads.slice(i, i + BATCH);
    await Promise.all(batch.map(async (ad) => {
      try {
        const res = await fetch(ad.video_cover_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://ads.tiktok.com/',
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
        });

        if (!res.ok) {
          console.warn(`  ${ad.tiktok_material_id} → HTTP ${res.status}`);
          fail++;
          return;
        }

        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        const buf = await res.arrayBuffer();
        const path = `winning-ads/tiktok/${ad.tiktok_material_id}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from('images')
          .upload(path, buf, { contentType, upsert: true });

        if (upErr) {
          console.warn(`  ${ad.tiktok_material_id} upload failed:`, upErr.message);
          fail++;
          return;
        }

        const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
        const { error: upd } = await supabase
          .from('winning_ads')
          .update({ video_cover_url: pub.publicUrl })
          .eq('id', ad.id);

        if (upd) { console.warn(`  ${ad.tiktok_material_id} DB update failed:`, upd.message); fail++; }
        else { ok++; }
      } catch (e) {
        console.warn(`  ${ad.tiktok_material_id} error:`, e.message);
        fail++;
      }
    }));
    console.log(`  [${Math.min(i + BATCH, ads.length)}/${ads.length}] ok=${ok} fail=${fail}`);
    // Small delay between batches
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone. ok=${ok} fail=${fail}`);
}

run();
