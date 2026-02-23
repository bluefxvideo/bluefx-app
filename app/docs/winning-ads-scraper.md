# Winning Ads Finder — Ops Guide

## Overview

The Winning Ads Finder scrapes top-performing TikTok ads from the TikTok Creative Center via Apify, stores them in Supabase, and surfaces them in the dashboard at `/dashboard/winning-ads`.

---

## Architecture

| Layer | Details |
|---|---|
| Scraper | Apify actor `ELdgImFK68BFni8ni` (`doliz/tiktok-creative-center-scraper`) |
| Schedule | Cron job every 3 days via `/api/cron/winning-ads-scrape` |
| Database | `winning_ads` table in Supabase (shared, not per-user) |
| Niche config | `app/src/lib/winning-ads/constants.ts` |

---

## Required Env Vars

```
APIFY_API_TOKEN=...
TIKTOK_CC_COOKIES=...   # Fresh TikTok CC session cookies (expire periodically)
CRON_SECRET_TOKEN=...   # Optional — if set, cron requires Bearer auth header
```

---

## Adding or Fixing a Niche

### 1. Find the industry key

Open the TikTok Creative Center industry key reference:
```
https://raw.githubusercontent.com/lofe-w/tiktok-creative-center-scraper-public/refs/heads/main/options/dashboard_industry.json
```

**Critical: use sub-category keys, not top-level parent keys.**

Top-level parent keys (e.g. `13000000000` for Finance, `22000000000` for Fashion) return 0 results. Always use the leaf-level numeric keys (e.g. `13102000000`, `22110000000`).

### 2. Update constants.ts

Edit `app/src/lib/winning-ads/constants.ts`:

```ts
'your-niche-slug': {
  displayName: 'Your Niche Name',
  industryKeys: ['13102000000', '13116000000'],  // sub-category keys
},
```

### 3. Run a targeted scrape (without waiting for cron)

Use the script below from the `app/` directory (requires `apify-client` and `@supabase/supabase-js` in node_modules):

```js
// scrape-niche.mjs  (run with: node scrape-niche.mjs)
import { ApifyClient } from 'apify-client';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(l => {
  if (l && !l.startsWith('#')) {
    const idx = l.indexOf('=');
    if (idx > 0) env[l.slice(0,idx)] = l.slice(idx+1).trim();
  }
});

const ACTOR_ID = 'ELdgImFK68BFni8ni';
const client = new ApifyClient({ token: env.APIFY_API_TOKEN });
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const NICHE_NAME = 'Real Estate';          // must match displayName exactly
const INDUSTRY_KEYS = ['24100000000'];     // keys to try

const allMaterials = [];

for (const key of INDUSTRY_KEYS) {
  console.log(`Trying key ${key}...`);
  await new Promise(r => setTimeout(r, 5000)); // always wait between calls
  const run = await client.actor(ACTOR_ID).call({
    target: 'top_ads_dashboard',
    cookies: env.TIKTOK_CC_COOKIES,
    dashboard_keyword: '',
    dashboard_region: ['US'],
    dashboard_industry: [key],
    dashboard_objective: [],
    dashboard_period: '30',
    dashboard_ad_language: ['en'],
    dashboard_likes: [],           // must be array, not string
    dashboard_sort_by: 'like',
    dashboard_page: 1,
    dashboard_limit: 20,           // max is 20
  }, { waitSecs: 120 });

  if (!run?.defaultDatasetId) continue;
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  for (const rawItem of (items || [])) {
    // Response shape: { code: 0, data: { materials: [...] } }
    if (rawItem.code === 0 && rawItem.data?.materials?.length) {
      allMaterials.push(...rawItem.data.materials);
    }
  }
  console.log(`  ${allMaterials.length} materials so far`);
}

const now = new Date().toISOString();
let saved = 0;
for (const item of allMaterials) {
  if (!item.id) continue;
  const likes = item.like ?? 0, comments = item.comment ?? 0;
  const shares = item.share ?? 0, ctr = item.ctr ?? 0;
  const { error } = await supabase.from('winning_ads').upsert({
    tiktok_material_id: item.id,
    ad_title: item.ad_title ?? null,
    brand_name: item.brand_name ?? null,
    niche: NICHE_NAME,
    industry_key: item.industry_key ?? INDUSTRY_KEYS[0],
    likes, comments, shares, ctr,
    cost_level: item.cost ?? null,
    objective: item.objective_key ?? '',
    video_duration: item.video_info?.duration ?? 0,
    video_cover_url: item.video_info?.cover ?? null,
    video_url: item.video_info?.video_url?.['720p'] ?? null,
    video_width: item.video_info?.width ?? null,
    video_height: item.video_info?.height ?? null,
    landing_page: item.analytics?.landing_page ?? null,
    country_codes: item.analytics?.country_code ?? [],
    keywords: item.analytics?.keyword_list ?? [],
    clone_score: Math.round(likes + comments*3 + shares*5 + ctr*1000),
    date_scraped: now,
    is_active: true,
    updated_at: now,
  }, { onConflict: 'tiktok_material_id' });
  if (!error) saved++;
}
console.log(`Saved ${saved} ads for ${NICHE_NAME}`);
```

**Always delete the script after use** — it contains env var reads and shouldn't sit in the repo.

---

## Common Issues

### Niche shows (0) ads

1. **Wrong industry key** — top-level parent keys return 0. Use sub-category keys.
2. **Rate limiting** — TikTok throttles aggressively. Wait 5–6 seconds between Apify calls. If all calls hit "Requests made too frequently", wait 10–15 minutes and retry.
3. **Cookies expired** — `TIKTOK_CC_COOKIES` needs refreshing (see below).

### Refreshing TikTok CC Cookies

1. Open [TikTok Creative Center](https://ads.tiktok.com/business/creativecenter/topads/pc/en) in Chrome
2. Log in with the TikTok business account
3. Open DevTools → Application → Cookies → `ads.tiktok.com`
4. Export all cookies in the format the Apify actor expects (JSON array of `{name, value, domain, ...}`)
5. Update `TIKTOK_CC_COOKIES` in Vercel env vars and in `.env.local`

### Apify actor input errors

The actor is strict about input types:
- `dashboard_likes` must be an **array** (`[]`), not a string
- `dashboard_limit` max is **20**
- `dashboard_ad_format` must be `"1"`, `"2"`, or **omitted entirely** (empty string causes error)

### Apify response shape

Each item in the dataset is a wrapper object:
```json
{ "code": 0, "msg": "OK", "data": { "materials": [ ...ads ] } }
```
Do NOT iterate items directly as ads — iterate `item.data.materials`.

---

## Supabase Migration Sync Issues

When local migration filenames have the same timestamp prefix, the CLI gets confused. Fix:

```bash
# Mark a local-only migration as already applied on remote
supabase migration repair --status applied 20251127 --linked

# Check current state
supabase migration list --linked

# Apply only new pending migrations
supabase migration up --linked
```

If a migration fails because objects already exist (policies, triggers), wrap `CREATE POLICY` / `CREATE TRIGGER` statements in idempotent guards:

```sql
-- For policies:
DO $$ BEGIN
  CREATE POLICY "my policy" ON my_table FOR SELECT USING (...);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- For triggers:
DROP TRIGGER IF EXISTS my_trigger ON my_table;
CREATE TRIGGER my_trigger ...
```

**Never use `--include-all` flag** unless you've already made migrations idempotent — it will try to re-apply already-applied migrations and fail on duplicate objects.

---

## Cron Schedule

The production cron runs every 3 days. It's configured in `vercel.json` (or similar). To trigger manually:

```bash
# Trigger via API (no token needed if CRON_SECRET_TOKEN is unset)
curl https://app.bluefx.net/api/cron/winning-ads-scrape

# Or with token:
curl -H "Authorization: Bearer YOUR_TOKEN" https://app.bluefx.net/api/cron/winning-ads-scrape
```

The cron scrapes 3 pages × all industry keys per niche. Ads not updated in 14 days are automatically deactivated (`is_active = false`).
