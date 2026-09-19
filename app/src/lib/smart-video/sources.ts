/**
 * Smart Video — turns a listing or product link into a brief + photo list,
 * so "paste a link" works the same way as "paste text and upload files".
 */

export interface LinkSource {
  brief: string;
  imageUrls: string[];
}

const MAX_PHOTOS = 12; // the first photos of a listing are the agent's best; more only costs director tokens

async function runActor(actor: string, input: unknown): Promise<any[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('Apify API token not configured');
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=240`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(280_000),
  });
  if (!res.ok) throw new Error(`Scrape failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const items = await res.json();
  if (!Array.isArray(items) || !items.length) throw new Error('The page returned no data');
  return items;
}

const lines = (rows: (string | false | null | undefined)[]) => rows.filter(Boolean).join('\n');

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
    home.mls?.name && `Listed by: ${home.mls.name}`,
    home.description && `\nDescription:\n${home.description}`,
  ]);
  const imageUrls = (home.listingPhotos || []).map((p: { url?: string }) => p.url).filter(Boolean).slice(0, MAX_PHOTOS);
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
    product.aiReviewsSummary?.text && `\nWhat customers say: ${product.aiReviewsSummary.text}`,
    `\nSold on Amazon: ${product.url}`,
  ]);
  return { brief, imageUrls: (product.highResolutionImages || []).slice(0, MAX_PHOTOS) };
}

export function fromLink(url: string): Promise<LinkSource> {
  if (/zillow\.com/i.test(url)) return fromZillow(url);
  if (/amazon\.|amzn\./i.test(url)) return fromAmazon(url);
  throw new Error('Only Zillow and Amazon links are supported so far');
}
