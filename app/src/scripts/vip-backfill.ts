/**
 * VIP backfill (owner 2026-11-07, lib/free-video/vip.ts): scores every finished lead that has no VIP mark yet, from the
 * website text its video job saved, and saves the mark. Then each lead's past actions (bought AI Media Machine or a
 * website plan, paid for the clean video, clicked Let's talk or a website plan) can make it VIP, as they would live.
 * NO email goes to anyone. About a third of a cent per lead (one Gemini Flash call).
 *
 * Run from app/:
 *   npx tsx src/scripts/vip-backfill.ts                       # dry run: scores and prints, saves nothing
 *   VIP_BACKFILL_OK=1 npx tsx src/scripts/vip-backfill.ts     # saves the marks
 *   npx tsx src/scripts/vip-backfill.ts --limit 10            # the 10 newest unscored leads only
 *   npx tsx src/scripts/vip-backfill.ts --domain bloompainting.net,254-poop.com
 *   npx tsx src/scripts/vip-backfill.ts --json out.json       # also writes every result to a file
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../.env.local') });

async function main() {
  const { createAdminClient } = await import('@/app/supabase/server');
  const { asLead, eventsTable, leadsTable } = await import('@/lib/free-video/leads');
  const { isOwnTest, promotes, saveMark, scoreLead } = await import('@/lib/free-video/vip');
  const { jobsTable } = await import('@/lib/smart-video/jobs');
  const { fromBusinessSite } = await import('@/lib/smart-video/sources');
  const { safeFetch } = await import('@/lib/free-video/safe-fetch');
  const { asMaterial } = await import('@/lib/free-video/website');
  type VipAction = import('@/lib/free-video/vip').VipAction;
  type VipMark = import('@/lib/free-video/vip').VipMark;
  type FreeVideoLead = import('@/types/free-video').FreeVideoLead;

  const save = process.env.VIP_BACKFILL_OK === '1';
  const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const limit = Number(arg('--limit')) || Infinity;
  // --save-from <file> (with VIP_BACKFILL_OK=1): saves the marks of an earlier dry run's --json file, without scoring
  // again, for every lead that still has no mark. What was reviewed is what is saved.
  const saveFrom = arg('--save-from');
  if (saveFrom) {
    if (!save) throw new Error('--save-from needs VIP_BACKFILL_OK=1');
    const { readFileSync } = await import('node:fs');
    const rows = JSON.parse(readFileSync(saveFrom, 'utf8')) as Array<{ id: string; ref: string | null; mark: VipMark | null }>;
    const scored = new Set(
      (await all<{ lead_id: string }>((from, to) => eventsTable().select('lead_id').eq('event', 'vip_scored').range(from, to))).map((row) => row.lead_id)
    );
    let saved = 0;
    for (const row of rows) {
      if (!row.mark || scored.has(row.id)) continue;
      await saveMark({ id: row.id, ref: row.ref }, row.mark);
      saved++;
    }
    console.log(`Saved ${saved} marks from ${saveFrom} (${rows.filter((row) => row.mark?.vip).length} VIP in the file).`);
    return;
  }
  const onlyDomains = arg('--domain')?.split(',').map((d) => d.trim().toLowerCase());
  const jsonOut = arg('--json');

  /** Every row of a query, 1,000 at a time. */
  async function all<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await query(from, from + 999);
      if (error) throw new Error(error.message);
      const page = (data ?? []) as T[];
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  }

  const leads = (
    await all<Record<string, unknown>>((from, to) =>
      leadsTable().select('*').in('status', ['done', 'held']).neq('source', 'test').order('created_at', { ascending: false }).range(from, to)
    )
  )
    .map(asLead)
    .filter((lead: FreeVideoLead) => !isOwnTest(lead) && (!onlyDomains || onlyDomains.includes(lead.website_domain)));
  const marks = new Map<string, VipMark>();
  for (const row of await all<{ lead_id: string; meta: VipMark }>((from, to) =>
    eventsTable().select('lead_id, meta').eq('event', 'vip_scored').order('at', { ascending: true }).range(from, to)
  )) {
    marks.set(row.lead_id, row.meta); // ascending, so the newest mark stays
  }
  const actions = new Map<string, VipAction[]>();
  const addAction = (leadId: string, action: VipAction) => actions.set(leadId, [...(actions.get(leadId) ?? []), action]);
  for (const row of await all<{ lead_id: string | null; event: string }>((from, to) =>
    eventsTable().select('lead_id, event').in('event', ['website_purchase', 'service_paid', 'website_checkout', 'website_interest']).range(from, to)
  )) {
    if (!row.lead_id) continue;
    if (row.event === 'website_purchase') addAction(row.lead_id, { kind: 'bought', label: 'bought a website plan' });
    if (row.event === 'service_paid') addAction(row.lead_id, { kind: 'paid', amount: 99, label: 'paid for Unlimited Video Ads' });
    if (row.event === 'website_checkout') addAction(row.lead_id, { kind: 'checkout', label: 'clicked to start a website plan' });
    if (row.event === 'website_interest') addAction(row.lead_id, { kind: 'talk', label: "clicked Let's talk" });
  }
  // AI Media Machine sales by a lead's email at any time (the live cron links only the last 3 days' sales; same fields).
  const buyers = new Set<string>();
  for (const sale of await all<{ processor: string; event_type: string; vendor: string | null; cb_email: string | null; fs_email: string | null }>((from, to) =>
    (createAdminClient() as any)
      .from('webhook_events')
      .select('processor, event_type, vendor:payload->>vendor, cb_email:payload->customer->>email, fs_email:payload->>customerEmail')
      .in('processor', ['clickbank', 'fastspring'])
      .in('event_type', ['SALE', 'SUBSCRIPTION'])
      .range(from, to)
  )) {
    const aimm = (sale.processor === 'clickbank' && sale.event_type === 'SALE' && sale.vendor === 'bluefx02') || (sale.processor === 'fastspring' && sale.event_type === 'SUBSCRIPTION');
    const email = String(sale.cb_email || sale.fs_email || '').trim().toLowerCase();
    if (aimm && email.includes('@')) buyers.add(email);
  }
  for (const lead of leads) {
    if (lead.bought_at || buyers.has(lead.email.trim().toLowerCase())) addAction(lead.id, { kind: 'bought', label: 'bought AI Media Machine' });
    if (!['none', 'refunded'].includes(lead.unlock_status)) {
      addAction(lead.id, { kind: 'paid', amount: lead.unlock_amount, label: `paid $${Math.round(lead.unlock_amount || 49)} for their clean video` });
    }
  }

  /** The website text the lead's video job saved, else the site read once more. */
  async function siteTextOf(lead: FreeVideoLead): Promise<string | null> {
    const ids = [...new Set([lead.job_id, ...(lead.job_ids || [])].filter(Boolean))] as string[];
    if (ids.length) {
      const { data } = await jobsTable().select('id, updated_at, brief:plan->>brief').in('id', ids).order('updated_at', { ascending: false });
      const saved = ((data ?? []) as Array<{ brief: string | null }>).find((row) => row.brief && row.brief.length > 200);
      if (saved?.brief) return saved.brief;
    }
    try {
      return asMaterial((await fromBusinessSite(lead.website_url, safeFetch)).brief);
    } catch {
      return null;
    }
  }

  const todo = leads.filter((lead) => !marks.has(lead.id)).slice(0, limit);
  console.log(`${leads.length} finished leads, ${marks.size} already scored, scoring ${todo.length}${save ? '' : ' (DRY RUN: nothing is saved)'}`);
  const fresh = new Map<string, VipMark>();
  let failed = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < todo.length) {
        const lead = todo[next++];
        const text = await siteTextOf(lead);
        const mark = text ? await scoreLead(lead, text, 'backfill') : null;
        if (!mark) {
          failed++;
          console.log(`  ✗ ${lead.website_domain}: ${text ? 'not scored' : 'no website text'}`);
          continue;
        }
        fresh.set(lead.id, mark);
        marks.set(lead.id, mark);
        console.log(`  ${mark.vip ? '⭐' : '·'} ${lead.website_domain}: ${mark.facts.business} | ${mark.facts.industry} | ${mark.facts.value} | ${mark.reasons.slice(1).join('; ') || 'no signs'}${mark.never ? ` | never: ${mark.never}` : ''}${mark.needsPurchase ? ` | only if they buy: ${mark.needsPurchase}` : ''}`);
      }
    })
  );

  // Past actions, as they would have counted live: the first one that promotes a lead that is not VIP.
  const promoted = new Map<string, VipMark>();
  for (const lead of leads) {
    const mark = marks.get(lead.id);
    if (!mark || mark.vip) continue;
    const action = (actions.get(lead.id) ?? []).find((a) => promotes(mark, a));
    if (!action) continue;
    const vipMark: VipMark = { ...mark, vip: true, source: 'action', action: action.label, reasons: [...mark.reasons, `${action.label} (before the VIP check existed)`] };
    promoted.set(lead.id, vipMark);
    marks.set(lead.id, vipMark);
  }

  if (save) {
    for (const lead of leads) {
      const first = fresh.get(lead.id);
      if (first) await saveMark(lead, first);
      const after = promoted.get(lead.id);
      if (after) await saveMark(lead, after);
    }
  }

  const vips = leads.filter((lead) => marks.get(lead.id)?.vip);
  console.log(`\n${vips.length} VIP leads of ${leads.length} (${fresh.size} scored now, ${failed} not scored, ${promoted.size} made VIP by a past action)${save ? ', saved' : ', DRY RUN'}:`);
  for (const lead of vips) {
    const mark = marks.get(lead.id)!;
    console.log(`  ${lead.created_at.slice(0, 10)}  ${mark.facts.business} (${lead.website_domain}): ${mark.reasons.join('; ')}`);
  }
  if (jsonOut) {
    writeFileSync(
      jsonOut,
      JSON.stringify(
        leads.map((lead) => ({ id: lead.id, created: lead.created_at, domain: lead.website_domain, email: lead.email, ref: lead.ref, mark: marks.get(lead.id) ?? null })),
        null,
        1
      )
    );
    console.log(`Every result: ${jsonOut}`);
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
