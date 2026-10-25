import { WELCOME_PAGE_HTML } from '@/lib/free-video/welcome-page-html';
import { displayDomain } from '@/lib/free-video/website';
import type { FreeVideoLead } from '@/types/free-video';

/** The thank-you page after an Unlimited Video Ads order, at this address (the popup cart's paid-order redirect goes here). */
export const WELCOME_PATH = '/unlimited-video-ads/welcome';

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * The thank-you page (welcome-page-html.ts, a copy of the ClickBank funnel's last page) for one member: their first
 * name in the thank-you line and their website and email already in the free audit's form. Without a lead (a buyer
 * from the public page) the form starts empty.
 */
export function renderWelcomePage(lead: Pick<FreeVideoLead, 'first_name' | 'website_domain' | 'email'> | null): string {
  const first = lead?.first_name?.trim() || '';
  const slots: Array<[string, string]> = [
    ['{{NAME}}', first ? `, ${esc(first)}` : ''],
    ['{{SITE}}', lead?.website_domain ? esc(displayDomain(lead.website_domain)) : ''],
    ['{{EMAIL}}', lead?.email ? esc(lead.email) : ''],
    // Inside a script: JSON, with < escaped so nothing can close the script tag.
    ['{{FIRST_JS}}', JSON.stringify(first || null).replace(/</g, '\\u003c')],
  ];
  // split/join, not replace(): a $ in a name must never act as a replacement pattern.
  let html = WELCOME_PAGE_HTML;
  for (const [slot, value] of slots) html = html.split(slot).join(value);
  return html;
}
