import { getDoneLeadByEmail, getLeadByToken, eventsTable, recordEvent } from '@/lib/free-video/leads';
import { ALERT_FROM, isLive, SITE_URL } from '@/lib/free-video/config';
import { readUnlockOrder } from '@/lib/free-video/unlock';
import { planPriceLine, WEBSITE_PLAN_MARKER, websitePlanByKey, websitePlanOfProducts } from '@/lib/free-video/website-plans';
import { displayDomain } from '@/lib/free-video/website';
import type { FreeVideoLead } from '@/types/free-video';

/**
 * Website demos (owner 2026-11-03): a personal video for one lead about a new homepage we drew up for their business.
 * The owner recorded one take; per lead, the background shows their current site, then the new homepage mock
 * (website-demos/_tools/make_video.py). The page is /v/<token>/website: the video, a "Let's talk" button that opens
 * the owner's calendar, and his email. The owner also calls the people who click (Dylan Power's warm call).
 *
 * The demo itself is a 'website_demo' event on the lead (meta: video, poster, business), written by the upload script,
 * so there is no new table. The newest one wins. The page's own events: website_play, website_plans (the plans came into view, no email), website_watched (most of the
 * video seen), website_interest (Let's talk / Book a call) and website_checkout (a plan's "Yes, start my new website",
 * meta.plan). The owner gets an email at the first watched and the first interest of each lead, and at the first checkout
 * click of each lead and plan. A paid plan (FastSpring webhook) is a website_purchase event and an email to the owner.
 * Nothing is stored or emailed for the owner's own browser (internal visit).
 */

export interface WebsiteDemo {
  video: string;
  poster: string | null;
  /** The top screen of their site today and of the new homepage (owner 2026-11-03), when published. */
  before: string | null;
  after: string | null;
  /** The business name the page greets ("I made this for VTV Conversions"). */
  business: string;
}

export const WEBSITE_EVENTS = ['website_play', 'website_plans', 'website_watched', 'website_interest', 'website_checkout'] as const;
export type WebsiteEvent = (typeof WEBSITE_EVENTS)[number];

/** The lead's newest demo, or null when there is none. Throws on a database error. */
export async function websiteDemoOf(leadId: string): Promise<WebsiteDemo | null> {
  const { data, error } = await eventsTable()
    .select('meta')
    .eq('lead_id', leadId)
    .eq('event', 'website_demo')
    .order('at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`website_demo not read: ${error.message}`);
  const meta = (data as Array<{ meta: Record<string, unknown> | null }> | null)?.[0]?.meta;
  if (!meta || typeof meta.video !== 'string' || !meta.video.startsWith('https://')) return null;
  return {
    video: meta.video,
    poster: typeof meta.poster === 'string' && meta.poster.startsWith('https://') ? meta.poster : null,
    before: typeof meta.before === 'string' && meta.before.startsWith('https://') ? meta.before : null,
    after: typeof meta.after === 'string' && meta.after.startsWith('https://') ? meta.after : null,
    business: typeof meta.business === 'string' && meta.business.trim() ? meta.business.trim() : '',
  };
}

/** True when the lead already has this event (so the owner is emailed once per lead and kind). Never throws. */
async function hasEvent(leadId: string, event: string, plan?: string): Promise<boolean> {
  try {
    let query = eventsTable().select('id').eq('lead_id', leadId).eq('event', event);
    if (plan) query = query.eq('meta->>plan', plan);
    const { data } = await query.limit(1);
    return Boolean((data as unknown[] | null)?.length);
  } catch {
    return true; // when in doubt, no second email
  }
}

/** The owner's inboxes for website leads: they matter more than routine funnel alerts. */
const WEBSITE_ALERT_TO = ['contact@bluefx.net', 'support@bluefx.net'];

async function emailOwner(subject: string, text: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ [website-demo] BREVO_API_KEY not set, no owner email:', subject);
    return;
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: ALERT_FROM, to: WEBSITE_ALERT_TO.map((email) => ({ email })), subject, textContent: text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error('❌ [website-demo] Owner email failed:', res.status, (await res.text().catch(() => '')).slice(0, 200));
  } catch (error) {
    console.error('❌ [website-demo] Owner email failed:', error);
  }
}

/**
 * One event from the lead's page. website_watched and website_interest email the owner the first time for each lead,
 * website_checkout the first time for each lead and plan (plan = a WEBSITE_PLANS key). Never throws.
 */
export async function recordWebsiteEvent(lead: FreeVideoLead, demo: WebsiteDemo, event: WebsiteEvent, visitorId: string | null, planKey: string | null = null): Promise<void> {
  const plan = event === 'website_checkout' ? websitePlanByKey(planKey || '') : null;
  if (event === 'website_checkout' && !plan) return;
  const first = event === 'website_play' || event === 'website_plans' ? false : !(await hasEvent(lead.id, event, plan?.key));
  await recordEvent({ event, leadId: lead.id, visitorId, placement: 'website', ref: lead.ref, meta: plan ? { plan: plan.key } : null });
  if (!first) return;
  const who = `${lead.first_name || 'Someone'} (${demo.business || displayDomain(lead.website_domain)}, ${lead.email})`;
  const page = `${SITE_URL}/v/${lead.view_token}/website?internal=1`;
  if (plan) {
    await emailOwner(
      `Website lead: ${lead.first_name || lead.email} clicked Yes, start my new website (${plan.name})`,
      [
        `${who} clicked "Yes, start my new website" on the ${plan.name} plan (${planPriceLine(plan)}), so the FastSpring checkout opened for them.`,
        '',
        'You get another email when they pay. If no sale comes in, call them today (Dylan: warm leads go cold fast).',
        `Their website: https://${lead.website_domain}`,
        `Their page: ${page}`,
      ].join('\n'),
    );
  } else if (event === 'website_interest') {
    await emailOwner(
      `Website lead: ${lead.first_name || lead.email} clicked Let's talk, call now`,
      [
        `${who} clicked "Let's talk" on their website video page (your calendar opened for them; Calendly emails you if they book).`,
        '',
        'Call them now (Dylan: warm leads go cold fast). Their number is on their website / Google listing.',
        `Their website: https://${lead.website_domain}`,
        `Their page: ${page}`,
      ].join('\n'),
    );
  } else {
    await emailOwner(
      `Website lead: ${lead.first_name || lead.email} watched their video`,
      [`${who} watched most of their website video.`, '', 'Good moment for a call or a short reply in their thread.', `Their page: ${page}`].join('\n'),
    );
  }
}

/**
 * A paid website plan (a FastSpring path containing WEBSITE_PLAN_MARKER), after the webhook has logged it (its
 * done-for-you branch: no app user, plan or credit change). Only order.completed, once per order (the caller passes only
 * a newly logged event). The lead is found by the order's tag freeVideoLead, else by the buyer's email. The owner is
 * emailed every sale (a FastSpring test order on the live server too, marked as a test); a real one is also a
 * website_purchase event on the lead. Never throws: the order itself is already logged.
 */
export async function handleWebsitePlanOrder(eventType: string, data: unknown): Promise<void> {
  if (eventType !== 'order.completed') return;
  try {
    const order = readUnlockOrder(data);
    if (!order.products.some((path) => path.toLowerCase().includes(WEBSITE_PLAN_MARKER))) return;
    const plan = websitePlanOfProducts(order.products);
    const test = order.live === false;
    const lead = (order.token ? await getLeadByToken(order.token) : null) ?? (order.email ? await getDoneLeadByEmail(order.email) : null);
    const demo = lead ? await websiteDemoOf(lead.id).catch(() => null) : null;
    const business = demo?.business || (lead ? displayDomain(lead.website_domain) : '');
    const name = lead?.first_name || order.email || 'Someone';
    if (lead && !(test && isLive())) {
      await recordEvent({ event: 'website_purchase', leadId: lead.id, placement: 'website', ref: lead.ref, meta: { order: order.id, plan: plan?.key ?? null, amount: order.amount, currency: order.currency } });
    }
    await emailOwner(
      `${test ? '[TEST ORDER] ' : ''}Website SOLD: ${name}${business ? ` (${business})` : ''} bought ${plan?.name ?? 'a website plan'}`,
      [
        `${name}${business ? ` (${business})` : ''} paid for ${plan ? `${plan.name}, ${planPriceLine(plan)}` : order.products.join(', ')}.`,
        `FastSpring order: ${order.id ?? '?'}${order.amount !== null ? `, ${order.amount} ${order.currency ?? ''}` : ''}`,
        `Buyer email: ${order.email ?? lead?.email ?? '?'}`,
        lead ? `Their website: https://${lead.website_domain}` : 'No free video lead matches this order (no tag, no lead with the buyer\'s email).',
        lead ? `Their page: ${SITE_URL}/v/${lead.view_token}/website?internal=1` : '',
        '',
        'Next: welcome them and start the full website (What happens next, step 2).',
      ].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n'),
    );
    console.log(`✅ [website-demo] Website plan order ${order.id} (${plan?.key ?? order.products.join(',')})${lead ? ` for ${lead.website_domain}` : ''}: owner emailed`);
  } catch (error) {
    console.error('❌ [website-demo] Website plan order follow-up failed:', error);
  }
}
