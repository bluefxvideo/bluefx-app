/**
 * Reconcile local subscription/credit state against FastSpring billing truth.
 *
 * WHY: The app only processes the initial trial-activation webhook. The
 * `subscription.charge.completed` (trial->paid) event almost never arrives, so
 * converted/paying customers stay stuck at status='trial' with 100 credits, and
 * the monthly renewal cron never runs on Coolify. This script asks FastSpring
 * what each subscription's REAL state is and (optionally) heals our DB.
 *
 * Run from the app/ directory:
 *   node scripts/reconcile-subscriptions.mjs            # DRY RUN (read-only, default)
 *   node scripts/reconcile-subscriptions.mjs --apply    # writes fixes to Supabase
 *
 * Needs in .env.local (or process env): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, FASTSPRING_USERNAME, FASTSPRING_API_KEY.
 *
 * Scope: only subscriptions with a fastspring_subscription_id. ClickBank/manual
 * subs (no FS id) are listed separately for manual review.
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const FULL_CREDITS = 600;
const CREDIT_PERIOD_DAYS = 30;
const CONCURRENCY = 5;

// ---- env loading (.env.local with process.env fallback) ----
const env = { ...process.env };
try {
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    if (!(k in env)) env[k] = line.slice(idx + 1).trim();
  }
} catch { /* rely on process.env */ }

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const FS_USER = env.FASTSPRING_USERNAME;
const FS_KEY = env.FASTSPRING_API_KEY;

if (!SUPA_URL || !SUPA_KEY) { console.error('Missing Supabase env'); process.exit(1); }
if (!FS_USER || !FS_KEY) {
  console.error('Missing FastSpring API creds (FASTSPRING_USERNAME / FASTSPRING_API_KEY).');
  console.error('Add them to .env.local or run this on the Coolify host where they exist.');
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
const fsAuth = 'Basic ' + Buffer.from(`${FS_USER}:${FS_KEY}`).toString('base64');

async function fsGetSubscription(id) {
  const r = await fetch(`https://api.fastspring.com/subscriptions/${id}`, {
    headers: { Authorization: fsAuth, Accept: 'application/json' },
  });
  if (!r.ok) return { httpError: r.status, body: (await r.text()).slice(0, 200) };
  return await r.json();
}

// classify FastSpring subscription object -> our action
function classify(fs) {
  if (fs.httpError) return fs.httpError === 404 ? 'fs_not_found' : 'fs_error';
  const state = (fs.state || '').toLowerCase();
  const active = fs.active === true;
  if (state === 'trial') return 'still_trial';
  if (active && state === 'active') return 'paying';
  if (active && state === 'overdue') return 'overdue'; // active but last rebill failing — heal only on explicit opt-in
  if (state === 'canceled' && active) return 'canceled_pending'; // canceled but still in paid period
  if (state === 'canceled' || state === 'deactivated' || !active) return 'inactive';
  return 'unknown';
}

async function run() {
  console.log(`MODE: ${APPLY ? '*** APPLY (writes enabled) ***' : 'DRY RUN (read-only)'}`);

  // Pull all subs + credits + profile email
  const { data: subs, error } = await supabase
    .from('user_subscriptions')
    .select('id, user_id, plan_type, status, current_period_start, current_period_end, credits_per_month, fastspring_subscription_id');
  if (error) { console.error('subs query error', error); process.exit(1); }

  const { data: credits } = await supabase
    .from('user_credits')
    .select('user_id, total_credits, used_credits, available_credits, period_end');
  const cmap = new Map(credits.map(c => [c.user_id, c]));

  const { data: profs } = await supabase.from('profiles').select('id, email');
  const emap = new Map(profs.map(p => [p.id, p.email]));

  const now = new Date();
  // Focus: stuck trials (status=trial). Also reconcile active for completeness.
  const stuckTrials = subs.filter(s => s.status === 'trial');
  const withFS = stuckTrials.filter(s => s.fastspring_subscription_id);
  const noFS = stuckTrials.filter(s => !s.fastspring_subscription_id);

  console.log(`\nStuck trials: ${stuckTrials.length} (FS: ${withFS.length}, no-FS/manual/clickbank: ${noFS.length})`);
  console.log('Reconciling the FS ones against FastSpring API...\n');

  const results = [];
  // simple concurrency pool
  let i = 0;
  async function worker() {
    while (i < withFS.length) {
      const idx = i++;
      const s = withFS[idx];
      const fs = await fsGetSubscription(s.fastspring_subscription_id);
      const action = classify(fs);
      results.push({ s, fs, action });
      if (idx === 0 && !fs.httpError) {
        console.log('--- sample FastSpring subscription object (field reference) ---');
        console.log(JSON.stringify({ state: fs.state, active: fs.active, product: fs.product, begin: fs.begin, next: fs.next, nextChargeDate: fs.nextChargeDate, end: fs.end, intervalUnit: fs.intervalUnit, deactivationDate: fs.deactivationDate, canceledDate: fs.canceledDate, price: fs.price }, null, 2));
        console.log('---------------------------------------------------------------\n');
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Tally
  const tally = {};
  for (const r of results) tally[r.action] = (tally[r.action] || 0) + 1;

  // Of the "paying" ones, how many are under-credited (<=100)?
  const payingUnderCredited = results.filter(r => r.action === 'paying' && (cmap.get(r.s.user_id)?.total_credits || 0) <= 100);

  console.log('=== RECONCILIATION TALLY (stuck trials with FS id) ===');
  console.log(JSON.stringify(tally, null, 2));
  console.log(`\nPAYING but stuck at <=100 credits (need upgrade to 600): ${payingUnderCredited.length}`);

  console.log('\n--- PAYING customers to heal (trial->active + 600 credits) ---');
  for (const r of results.filter(x => x.action === 'paying')) {
    const c = cmap.get(r.s.user_id);
    console.log(`${emap.get(r.s.user_id)} | our_status=${r.s.status} our_credits=${c?.total_credits} | FS state=${r.fs.state} active=${r.fs.active} next=${r.fs.nextChargeDate || r.fs.next}`);
  }

  console.log('\n--- INACTIVE / canceled (do NOT upgrade) ---');
  for (const r of results.filter(x => x.action === 'inactive' || x.action === 'canceled_pending')) {
    console.log(`${emap.get(r.s.user_id)} | FS state=${r.fs.state} active=${r.fs.active} (${r.action})`);
  }

  const problems = results.filter(x => ['fs_not_found','fs_error','unknown'].includes(x.action));
  if (problems.length) {
    console.log('\n--- NEEDS MANUAL REVIEW (FS lookup failed / unknown) ---');
    for (const r of problems) console.log(`${emap.get(r.s.user_id)} | sub=${r.s.fastspring_subscription_id} | ${r.action} ${r.fs.httpError || ''} ${r.fs.body || ''}`);
  }

  if (noFS.length) {
    console.log(`\n--- NO FastSpring id (${noFS.length}) — likely ClickBank/manual, reconcile separately ---`);
    for (const s of noFS) console.log(`${emap.get(s.user_id)} | plan=${s.plan_type} credits=${cmap.get(s.user_id)?.total_credits}`);
  }

  // ---- APPLY (only paying + under-credited) ----
  if (APPLY) {
    console.log('\n=== APPLYING fixes to PAYING customers ===');
    let fixed = 0;
    for (const r of results.filter(x => x.action === 'paying')) {
      const uid = r.s.user_id;
      const periodStart = now.toISOString();
      const periodEnd = new Date(now.getTime() + CREDIT_PERIOD_DAYS * 86400000).toISOString();

      const { error: subErr } = await supabase
        .from('user_subscriptions')
        .update({ status: 'active', updated_at: now.toISOString() })
        .eq('id', r.s.id)
        .eq('status', 'trial');
      if (subErr) { console.error(`sub update failed ${uid}:`, subErr.message); continue; }

      // Only top up credits if they are currently below the full allotment for this period.
      const c = cmap.get(uid);
      if ((c?.total_credits || 0) < FULL_CREDITS) {
        const { error: credErr } = await supabase
          .from('user_credits')
          .update({ total_credits: FULL_CREDITS, used_credits: 0, period_start: periodStart, period_end: periodEnd, updated_at: now.toISOString() })
          .eq('user_id', uid);
        if (credErr) { console.error(`credit update failed ${uid}:`, credErr.message); continue; }
      }
      fixed++;
      console.log(`✅ healed ${emap.get(uid)}`);
    }
    console.log(`\nDone. Healed ${fixed} paying customers.`);
  } else {
    console.log('\n(DRY RUN — no writes. Re-run with --apply once counts look right.)');
  }
}

run().catch(e => { console.error(e); process.exit(1); });
