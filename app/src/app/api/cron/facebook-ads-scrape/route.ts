import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/supabase/server';
import { ApifyClient } from 'apify-client';
import { FACEBOOK_SEARCH_TERMS } from '@/lib/winning-ads/facebook-constants';

/**
 * Facebook Ads Scrape Cron Job
 *
 * Runs every 3 days to scrape long-running active Facebook ads via Apify.
 * Uses the curious_coder/facebook-ads-library-scraper actor which scrapes
 * the public Facebook Ad Library. No cookies required.
 *
 * Input: Facebook Ad Library search URLs (one per keyword).
 * Clone score = days_running × 20 (longer-running ad = more profitable).
 * date_scraped stores the ad's start_date so "days running" is accurate in the UI.
 *
 * Required env vars:
 * - APIFY_API_TOKEN
 * - CRON_SECRET_TOKEN (optional)
 */

const ACTOR_ID = 'curious_coder/facebook-ads-library-scraper';
const ADS_PER_TERM = 20;
const STORAGE_BUCKET = 'images';
const STORAGE_FOLDER = 'winning-ads';

/**
 * Download image from a (temporary) URL and persist it to Supabase storage.
 * Returns the permanent public URL, or null on failure.
 */
async function persistImage(
  supabase: ReturnType<typeof createAdminClient>,
  sourceUrl: string,
  adId: string,
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const filePath = `${STORAGE_FOLDER}/fb_${adId}.${ext}`;
    const buffer = Buffer.from(await res.arrayBuffer());

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, { contentType, upsert: true });

    if (error) {
      console.error(`Storage upload failed for ${adId}:`, error.message);
      return null;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  } catch {
    return null;
  }
}

interface FbAdCard {
  body?: string;
  link_url?: string;
  original_image_url?: string;
  resized_image_url?: string;
  video_hd_url?: string;
  video_sd_url?: string;
  video_preview_image_url?: string;
}

interface FbAdSnapshot {
  body?: { text?: string } | string;
  title?: string;
  link_url?: string;
  cards?: FbAdCard[];
  images?: Array<{ original_image_url?: string }>;
  videos?: Array<{ video_hd_url?: string; video_sd_url?: string }>;
}

interface FbAdItem {
  ad_archive_id?: string;
  page_name?: string;
  is_active?: boolean;
  start_date?: number; // Unix seconds
  publisher_platform?: string[];
  snapshot?: FbAdSnapshot;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      return NextResponse.json(
        { success: false, error: 'APIFY_API_TOKEN not configured' },
        { status: 500 }
      );
    }

    const client = new ApifyClient({ token: apifyToken });
    const supabase = createAdminClient();

    let totalAds = 0;
    let totalErrors = 0;
    const termResults: Array<{ term: string; ads: number; error?: string }> = [];

    for (const searchTerm of FACEBOOK_SEARCH_TERMS) {
      try {
        console.log(`Scraping Facebook ads for: "${searchTerm}"`);

        const fbUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${encodeURIComponent(searchTerm)}&search_type=keyword_unordered`;

        const run = await client.actor(ACTOR_ID).call(
          { urls: [{ url: fbUrl }], maxItems: ADS_PER_TERM },
          { waitSecs: 180 }
        );

        if (!run?.defaultDatasetId) {
          termResults.push({ term: searchTerm, ads: 0, error: 'No dataset returned' });
          totalErrors++;
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items?.length) {
          termResults.push({ term: searchTerm, ads: 0, error: 'Empty dataset' });
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }

        const now = new Date().toISOString();
        let termAdCount = 0;

        for (const rawItem of items) {
          const item = rawItem as unknown as FbAdItem;

          if (!item.ad_archive_id) continue;
          if (item.is_active === false) continue;

          // start_date is Unix seconds → convert to ISO
          const startDateIso = item.start_date
            ? new Date(item.start_date * 1000).toISOString()
            : null;

          const days = startDateIso
            ? Math.floor((Date.now() - new Date(startDateIso).getTime()) / 86_400_000)
            : 0;
          const cloneScore = Math.min(Math.max(days, 0) * 20, 9999);

          const snap = item.snapshot ?? {};
          const cards = snap.cards ?? [];

          const adTitle =
            (typeof snap.body === 'object' ? snap.body?.text : snap.body) ??
            cards[0]?.body ??
            snap.title ??
            null;

          const rawCoverUrl =
            cards.find((c) => c.video_preview_image_url)?.video_preview_image_url ??
            cards.find((c) => c.original_image_url)?.original_image_url ??
            null;

          const videoUrl =
            cards.find((c) => c.video_hd_url)?.video_hd_url ??
            cards.find((c) => c.video_sd_url)?.video_sd_url ??
            null;

          // Persist cover image to Supabase storage (FB CDN URLs expire)
          const coverUrl = rawCoverUrl
            ? (await persistImage(supabase, rawCoverUrl, item.ad_archive_id!)) ?? rawCoverUrl
            : null;

          const landingPage = snap.link_url ?? cards[0]?.link_url ?? null;

          const adRecord = {
            tiktok_material_id: String(item.ad_archive_id),
            platform: 'facebook',
            ad_title: adTitle ? String(adTitle).slice(0, 500) : null,
            brand_name: item.page_name ?? null,
            niche: 'General',
            industry_key: searchTerm,
            likes: 0,
            comments: 0,
            shares: 0,
            ctr: 0,
            cost_level: null,
            objective: '',
            video_duration: null,
            video_cover_url: coverUrl,
            video_url: videoUrl,
            video_width: null,
            video_height: null,
            landing_page: landingPage,
            country_codes: ['US'],
            keywords: [searchTerm],
            clone_score: cloneScore,
            // Store ad start date so "days running" in the UI reflects how long the ad has run
            date_scraped: startDateIso ?? now,
            is_active: true,
            updated_at: now,
          };

          const { error: upsertError } = await supabase
            .from('winning_ads')
            .upsert(adRecord, { onConflict: 'platform,tiktok_material_id' });

          if (upsertError) {
            console.error(`Failed to upsert FB ad ${item.ad_archive_id}:`, upsertError);
            totalErrors++;
          } else {
            termAdCount++;
          }
        }

        totalAds += termAdCount;
        termResults.push({ term: searchTerm, ads: termAdCount });
        console.log(`  Saved ${termAdCount} ads`);

        await new Promise((r) => setTimeout(r, 3000));
      } catch (termError) {
        const errorMsg = termError instanceof Error ? termError.message : 'Unknown error';
        console.error(`Failed to scrape "${searchTerm}":`, termError);
        termResults.push({ term: searchTerm, ads: 0, error: errorMsg });
        totalErrors++;
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    // Deactivate Facebook ads not updated in 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    await supabase
      .from('winning_ads')
      .update({ is_active: false })
      .eq('platform', 'facebook')
      .lt('updated_at', fourteenDaysAgo.toISOString());

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Facebook ads scrape completed',
      stats: {
        total_ads: totalAds,
        total_errors: totalErrors,
        terms_processed: termResults.length,
        processing_time_ms: processingTime,
      },
      term_results: termResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Facebook ads scrape cron failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Facebook ads scrape failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
