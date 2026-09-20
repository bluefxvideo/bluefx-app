/**
 * Marketplace links arrive wrapped in tracking parameters (an Amazon search
 * result link is often over 700 characters). Only the product or listing
 * itself matters, so the link is reduced to that before it is checked or used.
 */
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
  // Everything else (Zillow included): the page itself, without query string or fragment.
  return `${url.origin}${url.pathname}`;
}
