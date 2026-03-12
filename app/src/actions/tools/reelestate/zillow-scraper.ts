'use server';

import { ApifyClient } from 'apify-client';
import type { ZillowListingData, ZillowScrapeResult } from '@/types/reelestate';

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || '',
});

// Apify Zillow scraper actor — extracts listing details + photos
const ZILLOW_ACTOR_ID = 'maxcopell/zillow-detail-scraper';

/**
 * Scrape a Zillow listing URL to extract photos + listing data.
 * Uses Apify's Zillow scraper actor.
 */
export async function scrapeZillowListing(url: string): Promise<ZillowScrapeResult> {
  if (!process.env.APIFY_API_TOKEN) {
    return { success: false, error: 'Apify API token not configured' };
  }

  // Validate Zillow URL
  if (!url.includes('zillow.com')) {
    return { success: false, error: 'Please provide a valid Zillow listing URL' };
  }

  try {
    console.log(`🏠 Scraping Zillow listing: ${url}`);

    const run = await client.actor(ZILLOW_ACTOR_ID).call(
      {
        startUrls: [{ url }],
        maxItems: 1,
      },
      { timeout: 120 },
    );

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      return { success: false, error: 'No listing data found. Check the URL and try again.' };
    }

    const item = items[0] as Record<string, unknown>;
    console.log(`✅ Zillow scrape complete, parsing listing data...`);

    // Parse the Apify output into our format
    const listing = parseZillowData(item);

    if (!listing.photo_urls.length) {
      return { success: false, error: 'No photos found in the listing' };
    }

    console.log(`🖼️ Found ${listing.photo_urls.length} photos for ${listing.address}`);

    return { success: true, listing };
  } catch (error) {
    console.error('❌ Zillow scrape error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scrape listing',
    };
  }
}

/**
 * Parse raw Apify Zillow data into our ZillowListingData format.
 * Handles various field names the actor may return.
 */
function parseZillowData(raw: Record<string, unknown>): ZillowListingData {
  // Extract photos — Apify returns them in originalPhotos/responsivePhotos with mixedSources
  const photos: string[] = [];

  // Helper to extract best URL from a mixedSources photo object
  const extractFromMixedSources = (photo: unknown): string | null => {
    if (!photo || typeof photo !== 'object') return null;
    const p = photo as { mixedSources?: { jpeg?: Array<{ url: string; width?: number }> }; url?: string };
    if (p.mixedSources?.jpeg?.length) {
      // Get highest resolution (last item, sorted by width)
      const best = p.mixedSources.jpeg[p.mixedSources.jpeg.length - 1];
      if (best?.url) return best.url;
    }
    if (p.url) return p.url;
    return null;
  };

  // Try originalPhotos first (highest quality), then responsivePhotos, then photos
  const photoSource = raw.originalPhotos || raw.responsivePhotos || raw.photos;

  if (Array.isArray(photoSource)) {
    for (const photo of photoSource) {
      if (typeof photo === 'string') {
        photos.push(photo);
      } else {
        const url = extractFromMixedSources(photo);
        if (url) photos.push(url);
      }
    }
  } else if (Array.isArray(raw.imgSrc)) {
    photos.push(...(raw.imgSrc as string[]));
  } else if (Array.isArray(raw.images)) {
    for (const img of raw.images) {
      if (typeof img === 'string') photos.push(img);
    }
  }

  // Extract address components
  const address = String(raw.streetAddress || raw.address || raw.addressStreet || '');
  const city = String(raw.city || raw.addressCity || '');
  const state = String(raw.state || raw.addressState || '');
  const zip = String(raw.zipcode || raw.addressZipcode || raw.zip || '');

  // Extract price
  let price = 0;
  const rawPrice = raw.price || raw.unformattedPrice || raw.listPrice;
  if (typeof rawPrice === 'number') {
    price = rawPrice;
  } else if (typeof rawPrice === 'string') {
    price = parseInt(rawPrice.replace(/[^0-9]/g, ''), 10) || 0;
  }

  return {
    address: address || `${city}, ${state} ${zip}`.trim(),
    city,
    state,
    zip,
    price,
    price_formatted: price ? `$${price.toLocaleString()}` : '',
    beds: Number(raw.bedrooms || raw.beds || 0),
    baths: Number(raw.bathrooms || raw.baths || 0),
    sqft: Number(raw.livingArea || raw.sqft || raw.livingAreaValue || 0),
    lot_size: raw.lotSize ? String(raw.lotSize) : undefined,
    year_built: raw.yearBuilt ? Number(raw.yearBuilt) : undefined,
    property_type: String(raw.homeType || raw.propertyType || 'Residential'),
    description: String(raw.description || ''),
    agent_name: raw.attributionInfo
      ? String((raw.attributionInfo as { agentName?: string }).agentName || '')
      : undefined,
    agent_brokerage: raw.attributionInfo
      ? String((raw.attributionInfo as { brokerName?: string }).brokerName || '')
      : undefined,
    photo_urls: photos,
    mls_id: raw.mlsId ? String(raw.mlsId) : undefined,
    status: String(raw.homeStatus || raw.listingStatus || 'For Sale'),
  };
}
