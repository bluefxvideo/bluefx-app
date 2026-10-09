import { normalizeWebsite } from '@/lib/free-video/website';

/**
 * Reading a reply to the "Can I make you a video?" broadcast (POST /api/free-video/inbound): who sent it, the
 * website in it, and the answer the n8n workflow sends back in the same Gmail thread. Pure functions, no I/O.
 */

/** Mailbox providers: a reply from these says nothing about the sender's own website. */
export const FREE_MAIL = [
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'icloud.com', 'me.com',
  'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.de', 'gmx.net', 'web.de', 'mail.com', 'zoho.com', 'yandex.com',
];

/** Hosts that are never the replier's business site: mailboxes, social links in signatures, our own pages. */
const SKIP_HOSTS = [
  ...FREE_MAIL,
  'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'youtube.com', 'youtu.be', 'tiktok.com',
  'bluefx.net', 'aispartan.com', 'calendly.com', 'mailerlite.com', 'mlsend.com', 'brevo.com', 'sendinblue.com',
  'google.com', 'apple.com', 'microsoft.com', 'aka.ms',
];

const FILE_EXT = /\.(jpe?g|png|gif|webp|svg|pdf|docx?|xlsx?|mp[34]|mov|zip|ics|html?)$/i;

/** Subjects of out-of-office answers and bounces: never a request. */
export const AUTO_REPLY =
  /^(re:\s*)*(out of (the )?office|automatic reply|auto[- ]?reply|autoreply|abwesenheit|undeliver|returned mail|bounce|delivery (status|failure|has failed)|mail delivery|vacation)/i;

export const skippedHost = (host: string) => SKIP_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));

/** The reply's own text: no quoted campaign ("> …", "On … wrote:"), nothing after a signature divider. */
export function ownText(body: string): string {
  const lines: string[] = [];
  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    const t = line.trim();
    if (/^(on .+wrote:|am .+schrieb.*:|-{2,}\s*original message|from:\s.+@)/i.test(t)) break;
    if (/^(--|__+)\s*$/.test(t)) break;
    if (t.startsWith('>')) continue;
    lines.push(line);
  }
  return lines.join('\n');
}

/** The first website in the reply's own text that could be the sender's business, as typed. */
export function findWebsite(text: string): string | null {
  const found =
    ownText(text).match(/\bhttps?:\/\/[^\s<>"')\]]+|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?:\/[^\s<>"')\]]*)?/gi) || [];
  for (const raw of found) {
    const candidate = raw.replace(/[.,;:!?)\]'"]+$/, '');
    if (FILE_EXT.test(candidate.split('?')[0])) continue;
    const site = normalizeWebsite(candidate);
    if (!('domain' in site) || skippedHost(site.domain)) continue;
    return candidate;
  }
  return null;
}

export type InboundMail = { email: string | null; name: string; subject: string; body: string };

/**
 * n8n Gmail (simple: From "Name <a@b>", snippet; full: from.value[{address,name}], text, html), a generic
 * { from, subject, text, html }, or Brevo inbound parse ({ items: [{ From: [{Address, Name}], RawTextBody }] }).
 */
export function parseInbound(payload: unknown): InboundMail {
  const p = (payload ?? {}) as Record<string, any>;
  const item: Record<string, any> = Array.isArray(p.items) && p.items.length ? p.items[0] : p;
  let email: string | null = null;
  let name = '';
  const from = item.From ?? item.from;
  if (Array.isArray(from) && from[0]) {
    email = from[0].Address || from[0].address || from[0].email || null;
    name = from[0].Name || from[0].name || '';
  } else if (typeof from === 'string') {
    const m = from.match(/^\s*(?:"?([^"<]*?)"?\s*)?<?([^\s<>"]+@[^\s<>"]+)>?\s*$/);
    if (m) {
      name = (m[1] || '').trim();
      email = (m[2] || '').trim();
    }
  } else if (from && typeof from === 'object') {
    const v = Array.isArray(from.value) ? from.value[0] : from;
    email = v?.address || v?.Address || v?.email || null;
    name = v?.name || v?.Name || '';
  }
  const text = String(item.RawTextBody || item.text || item.textPlain || item.snippet || '');
  const html = String(item.RawHtmlBody || item.html || item.textHtml || '');
  const body =
    text ||
    html
      .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
  const clean = email ? email.trim().toLowerCase() : null;
  return {
    email: clean && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : null,
    name,
    subject: String(item.Subject || item.subject || ''),
    body,
  };
}

/** Shared mailboxes and company-style From names that are not a person's first name. */
const NOT_A_NAME = new Set([
  'info', 'sales', 'office', 'contact', 'hello', 'hi', 'admin', 'support', 'team', 'mail', 'email', 'enquiries', 'inquiries',
  'service', 'help', 'billing', 'accounts', 'marketing', 'booking', 'bookings', 'reception', 'owner', 'manager', 'the',
]);

/** A first name for the emails: the From name's first word, else a name-looking mailbox, else "there". */
export function firstNameOf(name: string, email: string): string {
  const word = name.replace(/["']/g, '').trim().split(/[\s,]+/)[0] || '';
  const clean = (s: string) =>
    /^\p{L}[\p{L}'-]{1,30}$/u.test(s) && !NOT_A_NAME.has(s.toLowerCase()) ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
  return clean(word) || clean(email.split('@')[0].split(/[._+-]/)[0] || '') || 'there';
}

const greet = (first: string) => (first === 'there' ? 'Hey there,' : `Hey ${first},`);

/** The answers sent back in the reply's own Gmail thread, from support@bluefx.net. */
export const INBOUND_REPLY = {
  queued: (first: string, domain: string, link: string) =>
    `${greet(first)}\n\nGot it! Your video ad for ${domain} is being made right now.\n\nYou can watch it come together here:\n${link}\n\nIt's usually ready in about 3 minutes, and I'll email you when it's done.\n\nSzilard`,
  already: (first: string, link: string) =>
    `${greet(first)}\n\nGood news, you already have your free video ad. Here's the link again:\n${link}\n\nSzilard`,
  siteTaken: (first: string, domain: string) =>
    `${greet(first)}\n\nA free video ad for ${domain} was already made for someone at your business (it's one per business). If that wasn't anyone on your team, just reply and let me know and I'll sort it out.\n\nSzilard`,
  cantRead: (first: string, domain: string) =>
    `${greet(first)}\n\nThanks! I tried ${domain} but my tool couldn't read the page. Could you reply with another page of your site that has more text on it, like your About or Services page?\n\nSzilard`,
  notOwnSite: (first: string) =>
    `${greet(first)}\n\nThanks! My tool needs your own business website (it can't use Amazon, Facebook, Google and other big platforms). Could you reply with your website address, like yourbusiness.com?\n\nSzilard`,
};
