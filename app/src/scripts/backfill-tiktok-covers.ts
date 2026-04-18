/**
 * Back-fill TikTok Winning-Ad Thumbnails
 *
 * Problem: rows in `winning_ads` where platform='tiktok' often store a raw
 * `p16-sign-va.tiktokcdn.com/...` URL in `video_cover_url`. These URLs are
 * signed + geo-gated by Akamai (403 from non-TikTok IPs and/or after the
 * signature expires). The scraper already tries to copy the cover into
 * Supabase Storage at `images/winning-ads/tiktok/<id>.jpg`, but silently
 * falls back to the raw URL when the fetch fails (e.g. cookies expired
 * during that run). Those rows then show broken thumbnails forever.
 *
 * This one-shot script iterates those rows, re-fetches the cover server-side
 * using the current `TIKTOK_CC_COOKIES` session, uploads to Storage, and
 * updates the row. Safe to re-run — uses upsert + only touches rows that
 * still point outside the Supabase host.
 *
 * How to run:
 *   cd app
 *   npx tsx src/scripts/backfill-tiktok-covers.ts          # real run
 *   npx tsx src/scripts/backfill-tiktok-covers.ts --dry    # dry run, no writes
 *
 * Required env (reads from app/.env.local automatically via dotenv):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TIKTOK_CC_COOKIES   (JSON array of {name,value} — refresh if stale)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load env from app/.env.local regardless of CWD
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '..', 'app', '.env.local') });

const DRY_RUN = process.argv.includes('--dry');
const STORAGE_BUCKET = 'images';
const STORAGE_FOLDER = 'winning-ads/tiktok';
const SUPABASE_HOST = 'ihzcmpngyjxraxzmckiv.supabase.co';
const BATCH_SIZE = 50;
const BETWEEN_REQUESTS_MS = 250;

function buildCookieHeader(): string {
  try {
    const raw = process.env.TIKTOK_CC_COOKIES || '[]';
    const parsed = JSON.parse(raw) as Array<{ name: string; value: string }>;
    return parsed.map((c) => `${c.name}=${c.value}`).join('; ');
  } catch {
    return '';
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const cookieHeader = buildCookieHeader();
  if (!cookieHeader) {
    console.warn('⚠️  TIKTOK_CC_COOKIES is empty/invalid — fetches will likely 403.');
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(`${DRY_RUN ? '🧪 DRY RUN — ' : '▶️  '}Back-fill starting…`);

  // Pull all TikTok rows whose cover is NOT on Supabase Storage.
  // Using a range loop so we can page through without fighting row-limit defaults.
  let from = 0;
  let done = 0;
  let ok = 0;
  let failed = 0;
  let skipped = 0;
  const failures: Array<{ id: number; material_id: string; reason: string }> = [];

  while (true) {
    const { data: rows, error } = await supabase
      .from('winning_ads')
      .select('id, tiktok_material_id, video_cover_url')
      .eq('platform', 'tiktok')
      .not('video_cover_url', 'is', null)
      .not('video_cover_url', 'ilike', `%${SUPABASE_HOST}%`)
      .order('id', { ascending: true })
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.error('❌ Query failed:', error.message);
      process.exit(2);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      done++;
      const { id, tiktok_material_id, video_cover_url } = row;
      if (!tiktok_material_id || !video_cover_url) {
        skipped++;
        continue;
      }

      try {
        const res = await fetch(video_cover_url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://ads.tiktok.com/',
            Origin: 'https://ads.tiktok.com',
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          failed++;
          failures.push({ id, material_id: tiktok_material_id, reason: `fetch ${res.status}` });
          console.warn(`  ✗ [${id}] fetch ${res.status} for ${tiktok_material_id}`);
          continue;
        }

        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        const filePath = `${STORAGE_FOLDER}/${tiktok_material_id}.${ext}`;
        const buffer = Buffer.from(await res.arrayBuffer());

        if (DRY_RUN) {
          console.log(`  ~ [${id}] would upload ${buffer.byteLength} bytes → ${filePath}`);
          ok++;
        } else {
          const { error: upErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, buffer, { contentType, upsert: true });
          if (upErr) {
            failed++;
            failures.push({ id, material_id: tiktok_material_id, reason: `upload: ${upErr.message}` });
            console.warn(`  ✗ [${id}] upload failed: ${upErr.message}`);
            continue;
          }
          const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
          const { error: updErr } = await supabase
            .from('winning_ads')
            .update({ video_cover_url: pub.publicUrl })
            .eq('id', id);
          if (updErr) {
            failed++;
            failures.push({ id, material_id: tiktok_material_id, reason: `db update: ${updErr.message}` });
            console.warn(`  ✗ [${id}] DB update failed: ${updErr.message}`);
            continue;
          }
          ok++;
          console.log(`  ✓ [${id}] ${tiktok_material_id} → storage`);
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        failures.push({ id, material_id: tiktok_material_id, reason: msg });
        console.warn(`  ✗ [${id}] error: ${msg}`);
      }

      if (BETWEEN_REQUESTS_MS > 0) {
        await new Promise((r) => setTimeout(r, BETWEEN_REQUESTS_MS));
      }
    }

    from += BATCH_SIZE;
    // Safety stop for runaway
    if (done > 50_000) break;
  }

  console.log('');
  console.log(`📊 Summary (${DRY_RUN ? 'dry run' : 'real run'})`);
  console.log(`   scanned: ${done}`);
  console.log(`   ok:      ${ok}`);
  console.log(`   failed:  ${failed}`);
  console.log(`   skipped: ${skipped}`);
  if (failures.length > 0 && failures.length <= 20) {
    console.log('');
    console.log('Failures:');
    for (const f of failures) {
      console.log(`   [${f.id}] ${f.material_id} — ${f.reason}`);
    }
  } else if (failures.length > 20) {
    console.log(`   (first 20 failures)`);
    for (const f of failures.slice(0, 20)) {
      console.log(`   [${f.id}] ${f.material_id} — ${f.reason}`);
    }
    console.log(`   …and ${failures.length - 20} more`);
  }

  if (failed > 0 && !DRY_RUN) {
    console.log('');
    console.log(`ℹ️  For rows that 403'd, the CDN signature has likely expired past what cookies can recover.`);
    console.log(`   Those rows will keep showing broken thumbnails until the next scrape pulls fresh URLs.`);
    console.log(`   Consider setting is_active=false on those rows if you want to hide them.`);
  }
}

main().catch((err) => {
  console.error('💥 Fatal:', err);
  process.exit(3);
});
