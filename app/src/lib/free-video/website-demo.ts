import { eventsTable, recordEvent } from '@/lib/free-video/leads';
import { ALERT_FROM, SITE_URL } from '@/lib/free-video/config';
import { displayDomain } from '@/lib/free-video/website';
import type { FreeVideoLead } from '@/types/free-video';

/**
 * Website demos (owner 2026-11-03): a personal video for one lead about a new homepage we drew up for their business.
 * The owner recorded one take; per lead, the background shows their current site, then the new homepage mock
 * (website-demos/_tools/make_video.py). The page is /v/<token>/website: the video, a "Let's talk" button that opens
 * the owner's calendar, and his email. The owner also calls the people who click (Dylan Power's warm call).
 *
 * The demo itself is a 'website_demo' event on the lead (meta: video, poster, business), written by the upload script,
 * so there is no new table. The newest one wins. The page's own events: website_play, website_watched (most of the
 * video seen) and website_interest (the Let's talk button). The owner gets an email at the first watched and the first interest
 * of each lead. Nothing is stored or emailed for the owner's own browser (internal visit).
 */

export interface WebsiteDemo {
  video: string;
  poster: string | null;
  /** The top screen of their site today and of the new homepage (owner 2026-11-03), when published. */
  before: string | null;
  after: string | null;
  /** Their business phone from their own website, pre-filled in the calendar's phone question (they can change it). */
  phone: string | null;
  /** The business name the page greets ("I made this for VTV Conversions"). */
  business: string;
}

export const WEBSITE_EVENTS = ['website_play', 'website_watched', 'website_interest'] as const;
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
    phone: typeof meta.phone === 'string' && /^[+\d][\d\s().-]{6,24}$/.test(meta.phone) ? meta.phone : null,
    business: typeof meta.business === 'string' && meta.business.trim() ? meta.business.trim() : '',
  };
}

/** True when the lead already has this event (so the owner is emailed once per lead and kind). Never throws. */
async function hasEvent(leadId: string, event: string): Promise<boolean> {
  try {
    const { data } = await eventsTable().select('id').eq('lead_id', leadId).eq('event', event).limit(1);
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
 * One event from the lead's page. website_watched and website_interest email the owner the first time for each lead.
 * Never throws.
 */
export async function recordWebsiteEvent(lead: FreeVideoLead, demo: WebsiteDemo, event: WebsiteEvent, visitorId: string | null): Promise<void> {
  const first = event === 'website_play' ? false : !(await hasEvent(lead.id, event));
  await recordEvent({ event, leadId: lead.id, visitorId, placement: 'website', ref: lead.ref });
  if (!first) return;
  const who = `${lead.first_name || 'Someone'} (${demo.business || displayDomain(lead.website_domain)}, ${lead.email})`;
  const page = `${SITE_URL}/v/${lead.view_token}/website?internal=1`;
  if (event === 'website_interest') {
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
