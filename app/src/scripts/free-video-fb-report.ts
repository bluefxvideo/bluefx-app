/**
 * The daily numbers of the free video ad's Facebook test (owner 2026-10-08: "Report daily: spend, cost per free video
 * request, $99 unlocks, lifetime sales"). Read only: nothing is written anywhere.
 *
 * A lead from the ads carries ref fb-<placement> (the ad's URL parameter ref=fb-{{placement}}, e.g. fb-Facebook_Mobile_Feed or
 * fb-Instagram_Reels), so the requests split by placement from our own records: a placement with clicks but no requests is
 * where cheap junk clicks come from. Days are Ads Manager days in
 * the ad account's time zone (TZ below), so the spend Ads Manager shows for a day and the requests of that day match.
 * Spend is not in our database: pass it from Ads Manager with --spend (that day) and --spend-total (since --start).
 * Lifetime sales are the sweep's attribution (bought_at: a ClickBank or FastSpring sale to the lead's email after the
 * request); a buyer who paid with another email shows only in ClickBank's TID report (tid fv...).
 *
 * Run from app/:  npx tsx src/scripts/free-video-fb-report.ts [--day=2026-10-09] [--start=2026-10-09] [--spend=41.20] [--spend-total=41.20] [--json]
 *   --day    default: yesterday in TZ
 *   --start  the test's first day (default 2026-10-09)
 */
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../.env.local') });

/** The ad account's time zone (Ads Manager → Settings). */
const TZ = 'America/Los_Angeles';
const DEFAULT_START = '2026-10-09';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const money = (n: number) => `$${n.toFixed(2)}`;

/** The UTC instant of 00:00 on a calendar day in TZ. */
function startOfDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 12);
  // the offset of TZ at noon that day (PT is -7 or -8)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  const offset = local - guess;
  return new Date(Date.UTC(y, m - 1, d) - offset);
}

const nextDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

function yesterday(): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

interface LeadRow {
  id: string;
  created_at: string;
  ref: string | null;
  status: string;
  email: string;
  unlock_status: string;
  unlock_amount: number | null;
  unlocked_at: string | null;
  bought_at: string | null;
  sale_ref: string | null;
}

async function main(): Promise<void> {
  const { leadsTable, eventsTable } = await import('@/lib/free-video/leads');
  const { OWNER_TEST_EMAILS } = await import('@/lib/free-video/config');
  const day = arg('day') ?? yesterday();
  const start = arg('start') ?? DEFAULT_START;
  const spend = arg('spend') ? Number(arg('spend')) : null;
  const spendTotal = arg('spend-total') ? Number(arg('spend-total')) : null;
  const from = startOfDay(day).toISOString();
  const to = startOfDay(nextDay(day)).toISOString();
  const testFrom = startOfDay(start).toISOString();

  const { data, error } = await leadsTable()
    .select('id, created_at, ref, status, email, unlock_status, unlock_amount, unlocked_at, bought_at, sale_ref')
    .like('ref', 'fb-%')
    .neq('source', 'test')
    .gte('created_at', testFrom)
    .limit(5000);
  if (error) throw new Error(error.message);
  const leads = ((data ?? []) as LeadRow[]).filter((l) => !OWNER_TEST_EMAILS.includes(l.email));
  const inDay = (iso: string | null) => Boolean(iso && iso >= from && iso < to);
  const placementOf = (l: LeadRow) => (l.ref ?? '').replace(/^fb-/, '') || 'unknown';
  const paid = (l: LeadRow) => ['paid', 'rendering', 'ready', 'failed'].includes(l.unlock_status);

  const summarize = (rows: LeadRow[], window: (l: LeadRow, field: 'created_at' | 'unlocked_at' | 'bought_at') => boolean) => {
    const requests = rows.filter((l) => window(l, 'created_at') && l.status !== 'rejected');
    const unreadable = rows.filter((l) => window(l, 'created_at') && l.status === 'rejected');
    const unlocks = rows.filter((l) => paid(l) && window(l, 'unlocked_at'));
    const sales = rows.filter((l) => window(l, 'bought_at'));
    const byPlacement: Record<string, number> = {};
    for (const l of requests) byPlacement[placementOf(l)] = (byPlacement[placementOf(l)] ?? 0) + 1;
    return {
      requests: requests.length,
      unreadable: unreadable.length,
      videosMade: requests.filter((l) => l.status === 'done').length,
      unlocks: unlocks.length,
      unlockRevenue: unlocks.reduce((n, l) => n + Number(l.unlock_amount ?? 0), 0),
      lifetimeSales: sales.length,
      saleRefs: sales.map((l) => l.sale_ref),
      byPlacement,
    };
  };
  const dayNumbers = summarize(leads, (l, f) => inDay(l[f]));
  const total = summarize(leads, (l, f) => Boolean(l[f] && (l[f] as string) >= testFrom));

  // What Facebook got from our server that day (meta.ts leaves one 'capi' row per send).
  const { data: capiRows, error: capiError } = await eventsTable().select('meta').eq('event', 'capi').gte('at', from).lt('at', to).limit(5000);
  if (capiError) throw new Error(capiError.message);
  const capi: Record<string, { ok: number; failed: number }> = {};
  for (const row of (capiRows ?? []) as { meta: { name?: string; ok?: boolean; test?: boolean } | null }[]) {
    if (!row.meta?.name || row.meta.test) continue;
    capi[row.meta.name] ??= { ok: 0, failed: 0 };
    capi[row.meta.name][row.meta.ok ? 'ok' : 'failed']++;
  }

  const perRequest = (s: number | null, n: number) => (s === null ? 'spend not given' : n ? `${money(s / n)} each` : `${money(s)} spent, no request yet`);
  const label = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00Z`));
  const lines = [
    `Facebook test, ${label} (Pacific day)`,
    `Spend: ${spend === null ? 'not given' : money(spend)}`,
    `Free video requests from the ads: ${dayNumbers.requests}, ${perRequest(spend, dayNumbers.requests)}`,
    ...(Object.keys(dayNumbers.byPlacement).length ? [`  by placement: ${Object.entries(dayNumbers.byPlacement).map(([where, n]) => `${where} ${n}`).join(', ')}`] : []),
    ...(dayNumbers.unreadable ? [`Websites we could not read (no video ad made): ${dayNumbers.unreadable}`] : []),
    `$99 unlocks: ${dayNumbers.unlocks}${dayNumbers.unlocks ? ` (${money(dayNumbers.unlockRevenue)})` : ''}`,
    `Lifetime sales: ${dayNumbers.lifetimeSales}${dayNumbers.lifetimeSales ? ` (${dayNumbers.saleRefs.join(', ')})` : ''}`,
    `Sent to Facebook by our server: ${Object.entries(capi).map(([name, c]) => `${c.ok} ${name}${c.failed ? ` (${c.failed} refused)` : ''}`).join(', ') || 'nothing'}`,
    `Since ${start}: ${spendTotal === null ? '' : `${money(spendTotal)} spent, `}${total.requests} requests${spendTotal === null ? '' : ` (${perRequest(spendTotal, total.requests)})`}, ${total.videosMade} video ads made, ${total.unlocks} unlocks, ${total.lifetimeSales} lifetime sales`,
  ];
  if (process.argv.includes('--json')) console.log(JSON.stringify({ day, start, spend, spendTotal, dayNumbers, total, capi }, null, 1));
  else console.log(lines.join('\n'));
}

main().catch((error) => {
  console.error('❌', error);
  process.exit(1);
});
