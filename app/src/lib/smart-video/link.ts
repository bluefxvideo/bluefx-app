/**
 * Links arrive wrapped in tracking parameters (an Amazon search result link is
 * often over 700 characters). Only the product, listing or page itself
 * matters, so the link is reduced to that before it is checked or used.
 */
const TRACKING = /^(utm_|fbclid$|gclid$|gbraid$|wbraid$|msclkid$|mc_|igshid$|ref$|ref_$|spm$|_ga$|_gl$|srsltid$|ttclid$)/i;

export const isGoogleMapsLink = (url: URL) =>
  /(^|\.)google\.[a-z.]+$/i.test(url.hostname) || /^(maps\.app\.goo\.gl|goo\.gl|g\.page|g\.co)$/i.test(url.hostname);

export function cleanLink(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return text;
  }
  const asin = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i.exec(url.pathname)?.[1];
  if (/amazon\.|amzn\./i.test(url.hostname) && asin) return `${url.origin}/dp/${asin.toUpperCase()}`;
  // A Google Maps link names the place in its path ("data" blob included) or in a few query parameters; the rest is session noise.
  if (isGoogleMapsLink(url)) {
    for (const key of [...url.searchParams.keys()])
      if (!/^(api|query|query_place_id|cid|q|ftid|kgmid)$/.test(key)) url.searchParams.delete(key);
    url.hash = '';
    return url.href;
  }
  // Marketplaces and listings: the page itself, without query string or fragment.
  if (/zillow\.com$|realtor\.com$/i.test(url.hostname)) return `${url.origin}${url.pathname}`;
  // TikTok Shop: the store country can sit in the query (?region=GB).
  if (/tiktok\.com$/i.test(url.hostname)) {
    const region = url.searchParams.get('region');
    return `${url.origin}${url.pathname}${region ? `?region=${region}` : ''}`;
  }
  // Any other site: some pages live in their query (?p=123, ?variant=...), so only tracking parameters go.
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  url.hash = '';
  return url.href;
}

/** What the link is, in plain words, for the page and the library. */
export function describeLink(link: string): string {
  try {
    const url = new URL(link);
    const host = url.hostname.replace(/^www\./, '');
    if (/zillow\.com$/i.test(host)) return 'Zillow listing';
    if (/realtor\.com$/i.test(host)) return 'Realtor.com listing';
    if (/amazon\.|amzn\./i.test(host)) return 'Amazon product';
    if (/tiktok\.com$/i.test(host)) return 'TikTok Shop product';
    if (isGoogleMapsLink(url)) return 'Google Maps business';
    return host;
  } catch {
    return link;
  }
}
