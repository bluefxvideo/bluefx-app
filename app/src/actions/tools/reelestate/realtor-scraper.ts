'use server';

import { ApifyClient } from 'apify-client';
import type { ZillowListingData, ZillowScrapeResult } from '@/types/reelestate';

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || '',
});

// Apify Realtor.com scraper actor — extracts listing details + photos
const REALTOR_ACTOR_ID = 'memo23/realtor-search-cheerio';

/**
 * Scrape a Realtor.com listing URL to extract photos + listing data.
 * Uses Apify's Realtor.com scraper actor.
 */
export async function scrapeRealtorListing(url: string): Promise<ZillowScrapeResult> {
  if (!process.env.APIFY_API_TOKEN) {
    return { success: false, error: 'Apify API token not configured' };
  }

  if (!url.includes('realtor.com')) {
    return { success: false, error: 'Please provide a valid Realtor.com listing URL' };
  }

  try {
    console.log(`🏠 Scraping Realtor.com listing: ${url}`);

    const run = await client.actor(REALTOR_ACTOR_ID).call(
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
    console.log(`✅ Realtor.com scrape complete, parsing listing data...`);

    const listing = parseRealtorData(item);

    if (!listing.photo_urls.length) {
      return { success: false, error: 'No photos found in the listing' };
    }

    console.log(`🖼️ Found ${listing.photo_urls.length} photos for ${listing.address}`);

    return { success: true, listing };
  } catch (error) {
    console.error('❌ Realtor.com scrape error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scrape listing',
    };
  }
}

/**
 * Parse raw Apify Realtor.com data into our ZillowListingData format.
 * Field names match the memo23/realtor-search-cheerio actor output.
 */
function parseRealtorData(raw: Record<string, unknown>): ZillowListingData {
  // Photos — the actor provides a photo_urls array with high-res URLs
  const photos: string[] = [];
  if (Array.isArray(raw.photo_urls)) {
    for (const url of raw.photo_urls) {
      if (typeof url === 'string' && url.startsWith('http')) {
        photos.push(url);
      }
    }
  }

  // Address
  const address = String(raw.address_line || '');
  const city = String(raw.address_city || '');
  const stateCode = String(raw.address_state_code || raw.address_state || '');
  const zip = String(raw.address_postal_code || '');

  // Price
  const price = typeof raw.list_price === 'number' ? raw.list_price : 0;

  // Property type mapping
  const rawType = String(raw.property_type || raw.property_sub_type || '');
  const typeMap: Record<string, string> = {
    single_family: 'Single Family',
    condo: 'Condo',
    townhouse: 'Townhouse',
    multi_family: 'Multi Family',
    land: 'Land',
    mobile: 'Mobile',
  };
  const propertyType = typeMap[rawType] || rawType.replace(/_/g, ' ') || 'Residential';

  // Status mapping
  const rawStatus = String(raw.status || '');
  const statusMap: Record<string, string> = {
    for_sale: 'For Sale',
    for_rent: 'For Rent',
    sold: 'Sold',
    pending: 'Pending',
  };
  const status = statusMap[rawStatus] || rawStatus.replace(/_/g, ' ') || 'For Sale';

  // Agent info
  const agentName = raw.primary_agent_name ? String(raw.primary_agent_name) : undefined;
  const officeName = raw.primary_office_name ? String(raw.primary_office_name) : undefined;

  // Lot size
  const lotSqft = raw.lot_sqft ? Number(raw.lot_sqft) : undefined;
  const lotSize = lotSqft ? `${(lotSqft / 43560).toFixed(2)} acres` : undefined;

  return {
    address: address || `${city}, ${stateCode} ${zip}`.trim(),
    city,
    state: stateCode,
    zip,
    price,
    price_formatted: price ? `$${price.toLocaleString()}` : '',
    beds: Number(raw.beds || 0),
    baths: Number(raw.baths || raw.baths_full || 0),
    sqft: Number(raw.sqft || 0),
    lot_size: lotSize,
    year_built: raw.year_built ? Number(raw.year_built) : undefined,
    property_type: propertyType,
    description: String(raw.description_text || ''),
    agent_name: agentName,
    agent_brokerage: officeName,
    photo_urls: photos,
    mls_id: raw.source_listing_id ? String(raw.source_listing_id) : undefined,
    status,
  };
}
