/**
 * The ClickBank funnel's block switch, one per affiliate (owner 2026-11-14): a row per nickname the owner set in the
 * admin panel, in free_video_cb_affiliates (migration 20261114000000). No row means active.
 *
 * A blocked affiliate's visitor still fills in the form, but createLead (leads.ts) keeps the request as a 'rejected' lead
 * with the reason CB_BLOCKED_REASON_PREFIX + nickname: no video ad, no MailerLite, and the visitor reads "Today's free
 * video ads are all taken". The lead is kept only so the affiliate report can count it. Blocking also turns away that
 * affiliate's leads still waiting in the queue (rejectQueuedLeadsOf); a video ad already being made finishes.
 *
 * Server only: no 'server-only' import on purpose (the tsx scripts import it). NEVER re-export anything from here in a
 * server-action file. Reading the switch never throws and never blocks by accident: a failed read counts as active.
 */
import { createAdminClient } from '@/app/supabase/server';
import { CB_REF_PREFIX, cbAffiliateNick } from '@/lib/free-video/funnel';

/** The reason on a ClickBank funnel lead turned away because its affiliate is blocked (the admin report counts these). */
export const CB_BLOCKED_REASON_PREFIX = 'Affiliate blocked: ';

export type CbAffiliateStatus = 'active' | 'blocked';

/** One free_video_cb_affiliates row. */
export interface CbAffiliateRow {
  /** Lowercased ClickBank nickname (funnel.ts cbAffiliateNick). */
  nickname: string;
  status: CbAffiliateStatus;
  note: string | null;
  /** Who set the status last (the admin's email). */
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

const ROW_COLUMNS = 'nickname, status, note, updated_by, created_at, updated_at';

/** PostgREST returns at most 1000 rows per read on this project, so longer lists are read in keyset pages. */
const PAGE_ROWS = 1000;

/** How long one answer of the switch is kept per process: the same 20 s as the settings row. */
const BLOCK_CACHE_MS = 20_000;
const blockCache = new Map<string, { at: number; blocked: boolean }>();

// Its own handle on the table. leads.ts imports this file for the switch, so there is no static import back:
// rejectQueuedLeadsOf loads leads.ts when it runs.
const affiliatesTable = () => (createAdminClient() as any).from('free_video_cb_affiliates');

const badNickname = (nick: unknown) => new Error(`Not a ClickBank nickname: ${String(nick).slice(0, 40)}`);

/**
 * True when this affiliate's switch is on 'blocked'. Cached BLOCK_CACHE_MS per nickname. No nickname (a link without a
 * valid ?affiliate=, the owner's own test) is never blocked, and neither is anyone while the table cannot be read.
 */
export async function isAffiliateBlocked(nick: string | null): Promise<boolean> {
  const nickname = cbAffiliateNick(nick);
  if (!nickname) return false;
  const cached = blockCache.get(nickname);
  if (cached && Date.now() - cached.at < BLOCK_CACHE_MS) return cached.blocked;
  try {
    const { data, error } = await affiliatesTable().select('status').eq('nickname', nickname).maybeSingle();
    if (error) throw new Error(error.message);
    const blocked = (data as { status?: string } | null)?.status === 'blocked';
    // Made-up nicknames must not grow the map without limit in the process that serves paying users.
    if (blockCache.size > 5000) blockCache.clear();
    blockCache.set(nickname, { at: Date.now(), blocked });
    return blocked;
  } catch (error) {
    console.warn(`⚠️ [free-video] Block switch of affiliate ${nickname} not read, counted as active:`, String(error).slice(0, 160));
    return false;
  }
}

/** Every saved switch, by nickname. Throws on a database error. */
export async function cbAffiliateRows(): Promise<CbAffiliateRow[]> {
  const rows: CbAffiliateRow[] = [];
  let after: string | null = null;
  for (;;) {
    let query = affiliatesTable().select(ROW_COLUMNS).order('nickname', { ascending: true }).limit(PAGE_ROWS);
    if (after !== null) query = query.gt('nickname', after);
    const { data, error } = await query;
    if (error) throw new Error(`free_video_cb_affiliates not read: ${error.message}`);
    const page = (data ?? []) as CbAffiliateRow[];
    rows.push(...page);
    if (page.length < PAGE_ROWS) return rows;
    after = page[page.length - 1].nickname;
  }
}

/**
 * Sets one affiliate's switch (an upsert on the lowercased nickname; created_at stays from the first time). A note left
 * out keeps the saved one, an empty note clears it. The cached answers go, so this process reads the new state at once.
 * Returns the saved row. Throws on a bad nickname or status, and on a database error.
 */
export async function setAffiliateStatus(
  nick: string,
  status: CbAffiliateStatus,
  opts: { note?: string | null; by?: string | null } = {}
): Promise<CbAffiliateRow> {
  const nickname = cbAffiliateNick(nick);
  if (!nickname) throw badNickname(nick);
  if (status !== 'active' && status !== 'blocked') throw new Error(`Not an affiliate status: ${String(status).slice(0, 20)}`);
  const by = typeof opts.by === 'string' ? opts.by.trim().slice(0, 200) || null : null;
  const row: Record<string, unknown> = { nickname, status, updated_by: by, updated_at: new Date().toISOString() };
  // The column takes at most 500 characters (migration check).
  if (opts.note !== undefined) row.note = typeof opts.note === 'string' ? opts.note.trim().slice(0, 500) || null : null;
  const { data, error } = await affiliatesTable().upsert(row, { onConflict: 'nickname' }).select(ROW_COLUMNS).single();
  blockCache.clear();
  if (error || !data) throw new Error(`Affiliate ${nickname} not saved: ${error?.message ?? 'no row came back'}`);
  console.log(`✅ [free-video] Affiliate ${nickname} set to ${status}${by ? ` by ${by}` : ''}`);
  return data as CbAffiliateRow;
}

/**
 * After a block: this affiliate's ClickBank funnel leads still waiting in the queue are turned away too ('rejected' with
 * the blocked reason), each through the guarded transition from ['queued'] (leads.ts transitionLead), so a lead the
 * queue has just started is left to finish. Returns how many were turned away. Throws on a bad nickname or a failed read.
 */
export async function rejectQueuedLeadsOf(nick: string): Promise<number> {
  const nickname = cbAffiliateNick(nick);
  if (!nickname) throw badNickname(nick);
  const { leadsTable, transitionLead } = await import('@/lib/free-video/leads');
  const ids: string[] = [];
  let after: string | null = null;
  for (;;) {
    let query = leadsTable().select('id').eq('ref', `${CB_REF_PREFIX}${nickname}`).eq('status', 'queued').order('id', { ascending: true }).limit(PAGE_ROWS);
    if (after !== null) query = query.gt('id', after);
    const { data, error } = await query;
    if (error) throw new Error(`Queued leads of affiliate ${nickname} not read: ${error.message}`);
    const page = ((data ?? []) as { id: string }[]).map((lead) => lead.id);
    ids.push(...page);
    if (page.length < PAGE_ROWS) break;
    after = page[page.length - 1];
  }
  const reason = `${CB_BLOCKED_REASON_PREFIX}${nickname}`;
  let rejected = 0;
  // A few at a time: a burst of queued leads must not open hundreds of requests at once.
  for (let i = 0; i < ids.length; i += 10) {
    const moved = await Promise.all(ids.slice(i, i + 10).map((id) => transitionLead(id, { from: ['queued'] }, { status: 'rejected', reason })));
    rejected += moved.filter(Boolean).length;
  }
  if (ids.length) console.log(`⚠️ [free-video] Affiliate ${nickname} blocked: ${rejected} of ${ids.length} queued leads turned away`);
  return rejected;
}
