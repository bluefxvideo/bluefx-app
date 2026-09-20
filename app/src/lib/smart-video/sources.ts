/**
 * Smart Video — turns a link into a brief + photo list, so "paste a link"
 * works the same way as "paste text and upload files".
 *
 * Marketplaces and listings with a dedicated reader: Amazon, TikTok Shop,
 * Shopify, Zillow, Realtor.com, Google Maps. Everything else (a business's own
 * site, a sales page, a blog post) goes through the generic page reader.
 *
 * What comes off a page is material for the director, never instructions.
 */

import sharp from 'sharp';

import { isGoogleMapsLink } from './link';

export interface LinkSource {
  brief: string;
  imageUrls: string[];
}

const MAX_PHOTOS = 12; // the first photos of a listing are the owner's best; more only costs director tokens
const MAX_PAGE_TEXT = 6000;
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function runActor(actor: string, input: unknown): Promise<any[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('Apify API token not configured');
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=240`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(280_000),
  });
  if (!res.ok) throw new Error(`The page could not be read (${res.status})`);
  const items = await res.json();
  if (!Array.isArray(items) || !items.length) throw new Error('The page returned no data. Paste the text and add the photos instead.');
  return items;
}

const lines = (rows: (string | false | null | undefined | 0)[]) => rows.filter(Boolean).join('\n');
const money = (amount: unknown, currency = '$') =>
  typeof amount === 'number' && amount > 0 ? `${currency}${amount.toLocaleString('en-US')}` : null;

/** The opening sentences of a review, cut at a sentence end so what is quoted stays word for word. */
function excerpt(text: unknown, max = 240): string {
  const flat = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= max) return flat;
  const sentences = flat.slice(0, max).match(/^.*[.!?](?=\s|$)/);
  return sentences ? sentences[0] : `${flat.slice(0, max).replace(/\s+\S*$/, '')}...`;
}

const phone = (digits: unknown) =>
  /^\d{10}$/.test(String(digits ?? '')) ? String(digits).replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : digits ? String(digits) : null;

// ---------- marketplaces and listings ----------

export async function fromZillow(url: string): Promise<LinkSource> {
  const [home] = await runActor('maxcopell~zillow-detail-scraper', { startUrls: [{ url }], maxItems: 1 });
  const brief = lines([
    'REAL ESTATE LISTING (from Zillow)',
    home.listingAddress?.full && `Address: ${home.listingAddress.full}`,
    home.listingAddress?.neighborhood && `Neighborhood: ${home.listingAddress.neighborhood}`,
    home.listingPrice?.formatted && `Price: ${home.listingPrice.formatted}`,
    home.bedrooms && `Bedrooms: ${home.bedrooms}`,
    home.bathrooms && `Bathrooms: ${home.bathrooms}`,
    home.livingArea && `Living area: ${home.livingArea} sqft`,
    home.lotArea?.formatted && `Lot: ${home.lotArea.formatted}`,
    home.yearBuilt && `Year built: ${home.yearBuilt}`,
    home.homeType && `Type: ${String(home.homeType).replace(/_/g, ' ').toLowerCase()}`,
    home.description && `\nDescription:\n${home.description}`,
    // Zillow's data carries no agent contact (mls.name is the MLS board, e.g. "MIAMI", not a person).
    '\nAgent contact: not on the page. Use only a contact the client gives in their note.',
  ]);
  const imageUrls = (home.listingPhotos || [])
    .map((p: { url?: string }) => p.url)
    .filter(Boolean)
    .slice(0, MAX_PHOTOS);
  return { brief, imageUrls };
}

export async function fromRealtor(url: string): Promise<LinkSource> {
  const [home] = await runActor('memo23~realtor-search-cheerio', { startUrls: [{ url }], maxItems: 1 });
  const place = [home.address_line, home.address_city, home.address_state_code || home.address_state, home.address_postal_code]
    .filter(Boolean)
    .join(', ');
  const brief = lines([
    'REAL ESTATE LISTING (from Realtor.com)',
    place && `Address: ${place}`,
    money(Number(home.list_price)) && `Price: ${money(Number(home.list_price))}`,
    home.beds && `Bedrooms: ${home.beds}`,
    home.baths && `Bathrooms: ${home.baths}`,
    home.sqft && `Living area: ${home.sqft} sqft`,
    home.lot_sqft && `Lot: ${home.lot_sqft} sqft`,
    home.year_built && `Year built: ${home.year_built}`,
    (home.property_type || home.type) && `Type: ${String(home.property_type || home.type).replace(/_/g, ' ')}`,
    home.description_text && `\nDescription:\n${home.description_text}`,
    home.primary_agent_name
      ? `\nListed by (shown on the page): ${[home.primary_agent_name, home.primary_office_name, phone(home.primary_agent_phone || home.contactPhone)].filter(Boolean).join(', ')}. A contact in the client's note replaces this one.`
      : '\nAgent contact: use only a contact the client gives in their note.',
  ]);
  const imageUrls = (Array.isArray(home.photo_urls) ? home.photo_urls : [])
    .filter((u: unknown) => typeof u === 'string' && u.startsWith('http'))
    .slice(0, MAX_PHOTOS);
  return { brief, imageUrls };
}

export async function fromAmazon(url: string): Promise<LinkSource> {
  const [product] = await runActor('junglee~amazon-crawler', {
    categoryOrProductUrls: [{ url }],
    maxItemsPerStartUrl: 1,
    scrapeProductDetails: true,
  });
  const price = product.price?.value ? `${product.price.currency || '$'}${product.price.value}` : null;
  const listPrice = product.listPrice?.value ? `${product.listPrice.currency || '$'}${product.listPrice.value}` : null;
  const brief = lines([
    'PRODUCT (from Amazon)',
    `Name: ${product.title}`,
    product.brand && `Brand: ${product.brand}`,
    price && `Price: ${price}`,
    listPrice && listPrice !== price && `List price: ${listPrice}`,
    product.stars && `Rating: ${product.stars} stars from ${product.reviewsCount} reviews`,
    product.monthlyPurchaseVolume && `Sales: ${product.monthlyPurchaseVolume}`,
    product.features?.length && `\nFeatures:\n- ${product.features.join('\n- ')}`,
    product.aiReviewsSummary?.text &&
      `\nSummary of customer reviews (a summary, NOT a quotation from anyone): ${product.aiReviewsSummary.text}`,
    `\nSold on Amazon: ${product.url}`,
  ]);
  return { brief, imageUrls: (product.highResolutionImages || []).slice(0, MAX_PHOTOS) };
}

const TIKTOK_STORES = ['US', 'GB', 'SG', 'MY', 'TH', 'VN', 'PH', 'ID', 'MX', 'JP'];

export async function fromTikTokShop(url: string): Promise<LinkSource> {
  const productId = (link: string) => /\/(?:pdp|product)\/(?:[^/?#]+\/)?(\d{15,22})/.exec(link)?.[1];
  let resolved = url;
  if (!productId(resolved)) {
    // A share link (vm.tiktok.com/..., tiktok.com/t/...) only redirects to the product page.
    const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'follow', signal: AbortSignal.timeout(20_000) }).catch(
      () => null,
    );
    resolved = res?.url || url;
  }
  const id = productId(resolved);
  if (!id)
    throw new Error(
      'That TikTok link is not a TikTok Shop product page. Open the product in TikTok Shop, press Share, and paste that link.',
    );
  const page = new URL(resolved);
  const store = (page.searchParams.get('region') || /^\/([a-z]{2})\//i.exec(page.pathname)?.[1] || 'US').toUpperCase();

  const [product] = await runActor('trakk~tiktok-shop-search-scraper', {
    mode: 'product_details',
    region: TIKTOK_STORES.includes(store) ? store : 'US',
    productIds: [id],
    maxItems: 1,
    maxReviews: 5,
    htmlReport: false,
  });
  if (product.detailStatus && product.detailStatus !== 'success')
    throw new Error('TikTok Shop would not show that product. Paste its text and add the photos instead.');

  const symbol = product.currencySymbol || '$';
  const reviews = (Array.isArray(product.reviews) ? product.reviews : [])
    .map((r: any) => ({
      text: r.text || r.reviewText || r.content,
      who: r.reviewerName || r.userName || r.author,
      stars: r.rating || r.stars,
    }))
    .filter((r: { text?: string; stars?: number }) => r.text && (r.stars ?? 5) >= 4)
    .slice(0, 5);
  const specs =
    product.properties && typeof product.properties === 'object'
      ? Object.entries(product.properties)
          .filter(([key]) => !/prop 65|warning|batter/i.test(key))
          .slice(0, 10)
      : [];
  const brief = lines([
    'PRODUCT (from TikTok Shop)',
    `Name: ${product.title}`,
    product.sellerName && `Seller: ${product.sellerName}`,
    product.currentPrice && `Price: ${symbol}${product.currentPrice}`,
    product.originalPrice > product.currentPrice &&
      `Original price: ${symbol}${product.originalPrice}${product.discountPercent ? ` (${product.discountPercent}% off)` : ''}`,
    product.rating && `Rating: ${product.rating} stars from ${product.reviewCount} reviews`,
    product.soldCount && `Sold: ${product.soldCount}`,
    product.freeShipping === true && !product.shippingFee && 'Free shipping',
    product.options &&
      Object.keys(product.options).length > 0 &&
      `Options: ${Object.entries(product.options)
        .map(([name, values]) => `${name}: ${(values as string[]).join(', ')}`)
        .join('; ')}`,
    product.description && `\nDescription:\n${String(product.description).slice(0, 2500)}`,
    specs.length > 0 && `\nDetails:\n${specs.map(([key, value]) => `- ${key}: ${value}`).join('\n')}`,
    reviews.length > 0 &&
      `\nReal customer reviews (word for word; may be quoted with the name given):\n${reviews.map((r: any) => `- "${excerpt(r.text)}" ${r.who ? `— ${r.who}` : ''}${r.stars ? ` (${r.stars} stars)` : ''}`).join('\n')}`,
    '\nSold on TikTok Shop.',
  ]);
  const images: unknown[] = [product.fullImageUrls, product.imageUrls].find((list) => Array.isArray(list) && list.length) || [
    product.imageUrl,
  ];
  return {
    brief,
    imageUrls: [...new Set(images.filter((u): u is string => typeof u === 'string' && u.startsWith('http')))].slice(0, MAX_PHOTOS),
  };
}

/** Every Shopify product page has its data behind `<product url>.js`. Returns null when the page is not Shopify. */
async function fromShopify(url: string): Promise<LinkSource | null> {
  const page = new URL(url);
  const handle = /\/products\/([^/?#]+)/.exec(page.pathname)?.[1];
  if (!handle) return null;
  const res = await fetch(`${page.origin}/products/${handle}.js`, {
    headers: { 'User-Agent': BROWSER_UA },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  // Served as JSON or as text/javascript depending on the shop; any other site answers with an HTML page here.
  const product = await res.json().catch(() => null);
  if (!product?.title || !Array.isArray(product.variants)) return null;

  // The .js endpoint gives prices in cents without a currency; the page itself names the currency.
  const html = await fetchHtml(url).catch(() => '');
  const currency =
    /property="og:price:currency" content="([A-Z]{3})"/.exec(html)?.[1] || /"currency":"([A-Z]{3})"/.exec(html)?.[1] || 'USD';
  const symbol = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$' }[currency] || `${currency} `;
  const cents = (value: unknown) => (typeof value === 'number' && value > 0 ? `${symbol}${(value / 100).toFixed(2)}` : null);
  const brief = lines([
    `PRODUCT (from the online shop ${page.hostname.replace(/^www\./, '')})`,
    `Name: ${product.title}`,
    meta(html, 'og:site_name') && `Shop: ${meta(html, 'og:site_name')}`,
    cents(product.price) && `Price: ${cents(product.price)}`,
    cents(product.compare_at_price) && product.compare_at_price > product.price && `Was: ${cents(product.compare_at_price)}`,
    product.type && `Category: ${product.type}`,
    product.variants.length > 1 &&
      `Options: ${product.variants
        .slice(0, 8)
        .map((v: { title: string }) => v.title)
        .join(', ')}`,
    product.description && `\nDescription:\n${htmlToText(product.description).slice(0, 3000)}`,
    `\nSold at: ${page.hostname.replace(/^www\./, '')}`,
  ]);
  const imageUrls = (product.images || []).map((src: string) => (src.startsWith('//') ? `https:${src}` : src)).slice(0, MAX_PHOTOS);
  return { brief, imageUrls };
}

export async function fromGoogleMaps(url: string): Promise<LinkSource> {
  const [place] = await runActor('compass~crawler-google-places', {
    startUrls: [{ url }],
    maxCrawledPlacesPerSearch: 1,
    maxImages: 10,
    maxReviews: 8,
    reviewsSort: 'mostRelevant',
    language: 'en',
    scrapePlaceDetailPage: true,
  });
  // A link Google cannot resolve still returns a row, filled with nothing.
  if (!place.address && !place.phone)
    throw new Error('Google Maps did not recognise that link. Open the business on Google Maps, press Share, and paste that link.');
  const hours = (Array.isArray(place.openingHours) ? place.openingHours : [])
    .map((h: { day: string; hours: string }) => `${h.day}: ${h.hours}`)
    .join('; ');
  const reviews = (Array.isArray(place.reviews) ? place.reviews : [])
    .filter((r: { text?: string; stars?: number }) => r.text && (r.stars ?? 5) >= 4)
    .slice(0, 5);
  const brief = lines([
    'LOCAL BUSINESS (from its Google Maps listing)',
    `Name: ${place.title}`,
    place.categoryName && `Category: ${place.categoryName}`,
    place.address && `Address: ${place.address}`,
    place.phone && `Phone: ${place.phone}`,
    place.website && `Website: ${place.website}`,
    hours && `Opening hours: ${hours}`,
    place.totalScore && `Google rating: ${place.totalScore} stars from ${place.reviewsCount} reviews`,
    place.description && `\nAbout: ${place.description}`,
    reviews.length > 0 &&
      `\nReal customer reviews from Google (word for word; may be quoted with the first name given):\n${reviews.map((r: any) => `- "${excerpt(r.text)}" — ${r.name || 'a customer'} (${r.stars} stars)`).join('\n')}`,
  ]);
  const imageUrls = [
    ...new Set([place.imageUrl, ...(place.imageUrls || [])].filter((u) => typeof u === 'string' && u.startsWith('http'))),
  ].slice(0, MAX_PHOTOS);
  return { brief, imageUrls };
}

// ---------- any other page: a business site, a sales page, a blog post ----------

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`The page answered ${res.status}`);
  return res.text();
}

const decode = (text: string) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));

function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|form|iframe|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(h[1-6])[^>]*>/gi, '\n\n## ')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/(p|div|section|article|h[1-6]|li|tr|br)>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/^\s*(-|##)\s*$/gm, '')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function meta(html: string, key: string): string {
  for (const tag of html.match(/<meta\s[^>]*>/gi) || []) {
    if (!new RegExp(`(?:property|name)=["']${key}["']`, 'i').test(tag)) continue;
    // The value may hold the other kind of quote ("Joe's Pizza"), so it ends at the quote it started with.
    const content = /\scontent=(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    if (content) return decode(content[1] ?? content[2] ?? '').trim();
  }
  return '';
}

// Facts a site states about itself in structured data: the most reliable source for price, phone, address, rating.
function structuredFacts(html: string): { facts: string[]; type: string } {
  const facts: string[] = [];
  let type = '';
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const nodes = (Array.isArray(data) ? data : [data]).flatMap((node: any) =>
      node && Array.isArray(node['@graph']) ? node['@graph'] : [node],
    );
    for (const node of nodes as any[]) {
      if (!node || typeof node !== 'object') continue;
      const kind = String(Array.isArray(node['@type']) ? node['@type'][0] : node['@type'] || '');
      if (/Article|BlogPosting|NewsArticle/.test(kind)) type = type || 'article';
      if (/Product/.test(kind)) type = 'product';
      if (/LocalBusiness|Restaurant|Store|Organization|Dentist|Church|MedicalBusiness/.test(kind) && !type) type = 'business';
      if (/Event/.test(kind)) type = type || 'event';
      const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
      const address =
        node.address && typeof node.address === 'object'
          ? [node.address.streetAddress, node.address.addressLocality, node.address.addressRegion, node.address.postalCode]
              .filter(Boolean)
              .join(', ')
          : node.address;
      facts.push(
        ...[
          node.name && /Product|LocalBusiness|Restaurant|Store|Organization|Event/.test(kind) && `${kind} name: ${node.name}`,
          offer?.price && `Price: ${offer.priceCurrency || ''} ${offer.price}`.trim(),
          node.aggregateRating?.ratingValue &&
            `Rating: ${node.aggregateRating.ratingValue} from ${node.aggregateRating.reviewCount || node.aggregateRating.ratingCount || '?'} reviews`,
          node.telephone && `Phone: ${node.telephone}`,
          node.email && `Email: ${node.email}`,
          address && `Address: ${address}`,
          node.startDate && `Starts: ${node.startDate}`,
          node.author?.name && /Article|BlogPosting/.test(kind) && `Author: ${node.author.name}`,
        ].filter((fact): fact is string => Boolean(fact)),
      );
    }
  }
  return { facts: [...new Set(facts)].slice(0, 14), type };
}

function pageImages(html: string, base: URL): string[] {
  const found: string[] = [];
  const add = (raw?: string) => {
    if (!raw) return;
    const candidate = decode(raw.trim().split(/\s+/)[0]);
    if (!candidate || candidate.startsWith('data:')) return;
    try {
      const absolute = new URL(candidate, base).href;
      if (/\.(svg|gif|ico)(\?|$)/i.test(absolute)) return;
      if (/sprite|icon|pixel|tracking|avatar|emoji|badge|flag|spinner|placeholder|1x1|gravatar/i.test(absolute)) return;
      found.push(absolute);
    } catch {
      /* not a URL */
    }
  };
  add(meta(html, 'og:image'));
  for (const tag of html.match(/<img[^>]+>/gi) || []) {
    const srcset = /\ssrcset=["']([^"']+)["']/i.exec(tag)?.[1];
    // The last srcset entry is the largest rendition.
    add(srcset ? srcset.split(',').pop() : undefined);
    add(/\s(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i.exec(tag)?.[1]);
  }
  return [...new Set(found)].slice(0, 16);
}

export async function fromWebsite(url: string): Promise<LinkSource> {
  const base = new URL(url);
  const html = await fetchHtml(url).catch(() => {
    throw new Error('That page could not be opened. Paste its text and add the photos instead.');
  });
  const { facts, type } = structuredFacts(html);
  // An <article> tag proves nothing: site builders wrap ordinary sections in it.
  const pageType = type || (meta(html, 'og:type') === 'article' ? 'article' : 'page');
  const phones = [...new Set([...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map((m) => decodeURIComponent(m[1]).trim()))].slice(0, 2);
  const emails = [...new Set([...html.matchAll(/href=["']mailto:([^"'?]+)/gi)].map((m) => m[1].trim()))].slice(0, 2);
  const mainPart = /<main[\s\S]*<\/main>/i.exec(html)?.[0];
  const articlePart = /<article[\s\S]*<\/article>/i.exec(html)?.[0];
  const text = htmlToText(
    (pageType === 'article' ? articlePart || mainPart : mainPart || articlePart) || /<body[\s\S]*<\/body>/i.exec(html)?.[0] || html,
  );
  if (text.length < 250 && !facts.length) {
    throw new Error(
      'That page shows almost no text to a reader like this one (it may need a login or be built entirely in the browser). Paste its text and add the photos instead.',
    );
  }

  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '').trim();
  const shortUrl = `${base.hostname.replace(/^www\./, '')}${base.pathname.length > 1 && base.pathname.length < 40 ? base.pathname.replace(/\/$/, '') : ''}`;
  const brief = lines([
    pageType === 'article'
      ? `BLOG POST / ARTICLE (from ${base.hostname}). Make a short video that delivers its most useful points and sends viewers to read the full post at ${shortUrl}.`
      : `WEB PAGE (${pageType}) from ${base.hostname}. Address to show viewers: ${shortUrl}`,
    meta(html, 'og:site_name') && `Site: ${meta(html, 'og:site_name')}`,
    (meta(html, 'og:title') || title) && `Page title: ${meta(html, 'og:title') || title}`,
    (meta(html, 'og:description') || meta(html, 'description')) && `Summary: ${meta(html, 'og:description') || meta(html, 'description')}`,
    phones.length > 0 && `Phone on the page: ${phones.join(', ')}`,
    emails.length > 0 && `Email on the page: ${emails.join(', ')}`,
    facts.length > 0 && `\nFacts the page states about itself:\n- ${facts.join('\n- ')}`,
    `\nText of the page:\n${text.slice(0, MAX_PAGE_TEXT)}`,
  ]);
  return { brief, imageUrls: pageImages(html, base) };
}

/**
 * Downloads a link's photos. A page's <img> tags include icons, payment badges and thin banners:
 * anything too small or too stretched to fill a video frame is dropped. One failed download never fails the job.
 */
export async function downloadLinkPhotos(imageUrls: string[]): Promise<{ filename: string; data: Buffer }[]> {
  const photos = await Promise.all(
    imageUrls.map(async (url): Promise<Buffer | null> => {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(30_000) });
        if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return null;
        const data = Buffer.from(await res.arrayBuffer());
        const { width = 0, height = 0 } = await sharp(data).metadata();
        if (Math.min(width, height) < 400 || Math.max(width, height) / Math.min(width, height) > 2.6) return null;
        return data;
      } catch {
        return null;
      }
    }),
  );
  return photos
    .filter((data): data is Buffer => Boolean(data))
    .slice(0, MAX_PHOTOS)
    .map((data, i) => ({ filename: `link-${String(i + 1).padStart(2, '0')}.jpg`, data }));
}

export async function fromLink(url: string): Promise<LinkSource> {
  const page = new URL(url);
  const host = page.hostname;
  if (/zillow\.com$/i.test(host)) return fromZillow(url);
  if (/realtor\.com$/i.test(host)) return fromRealtor(url);
  if (/amazon\.|amzn\./i.test(host)) return fromAmazon(url);
  if (/tiktok\.com$/i.test(host)) return fromTikTokShop(url);
  if (isGoogleMapsLink(page)) return fromGoogleMaps(url);
  return (await fromShopify(url)) || fromWebsite(url);
}
