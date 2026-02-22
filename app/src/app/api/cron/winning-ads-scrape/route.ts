import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/supabase/server';
import { ApifyClient } from 'apify-client';
import { NICHE_MAP, calculateCloneScore } from '@/lib/winning-ads/constants';

/**
 * Winning Ads Scrape Cron Job
 *
 * Runs every 3 days to scrape top-performing TikTok ads from TikTok Creative Center
 * via the Apify doliz/tiktok-creative-center-scraper actor.
 *
 * For each niche, it fetches the top 50 ads sorted by likes and upserts them
 * into the winning_ads table with calculated clone scores.
 *
 * Required env vars:
 * - APIFY_API_TOKEN: Apify API token
 * - TIKTOK_CC_COOKIES: TikTok Creative Center session cookies
 * - CRON_SECRET_TOKEN: Secret for authenticating cron requests
 */

const APIFY_ACTOR_ID = 'ELdgImFK68BFni8ni';
const ADS_PER_NICHE = 50;

interface ApifyAdResult {
  ad_title?: string;
  brand_name?: string;
  id: string;
  like?: number;
  comment?: number;
  share?: number;
  ctr?: number;
  cost?: number;
  industry_key?: string;
  objective_key?: string;
  video_info?: {
    vid?: string;
    duration?: number;
    cover?: string;
    video_url?: {
      '720p'?: string;
    };
    width?: number;
    height?: number;
  };
  analytics?: {
    country_code?: string[];
    landing_page?: string;
    keyword_list?: string[];
    source?: string;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      console.warn('Unauthorized winning-ads-scrape cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apifyToken = process.env.APIFY_API_TOKEN;
    const cookies = process.env.TIKTOK_CC_COOKIES;

    if (!apifyToken) {
      return NextResponse.json(
        { success: false, error: 'APIFY_API_TOKEN not configured' },
        { status: 500 }
      );
    }

    if (!cookies) {
      return NextResponse.json(
        { success: false, error: 'TIKTOK_CC_COOKIES not configured' },
        { status: 500 }
      );
    }

    const client = new ApifyClient({ token: apifyToken });
    const supabase = createAdminClient();

    let totalAds = 0;
    let totalErrors = 0;
    const nicheResults: Array<{ niche: string; ads: number; error?: string }> = [];

    // Process each niche sequentially to avoid rate limits
    for (const [nicheSlug, nicheConfig] of Object.entries(NICHE_MAP)) {
      try {
        console.log(`Scraping niche: ${nicheConfig.displayName}`);

        // Use the first industry key for the primary query
        const primaryIndustryKey = nicheConfig.industryKeys[0];

        const runInput = {
          target: 'top_ads_dashboard',
          cookies,
          dashboard_keyword: '',
          dashboard_region: ['US'],
          dashboard_industry: [primaryIndustryKey],
          dashboard_objective: [],
          dashboard_period: '30',
          dashboard_ad_language: ['en'],
          dashboard_ad_format: '',
          dashboard_likes: '',
          dashboard_sort_by: 'like',
          dashboard_page: 1,
          dashboard_limit: ADS_PER_NICHE,
        };

        const run = await client.actor(APIFY_ACTOR_ID).call(runInput, {
          waitSecs: 120,
        });

        if (!run?.defaultDatasetId) {
          nicheResults.push({
            niche: nicheConfig.displayName,
            ads: 0,
            error: 'No dataset returned from Apify',
          });
          totalErrors++;
          continue;
        }

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0) {
          nicheResults.push({
            niche: nicheConfig.displayName,
            ads: 0,
            error: 'No ads returned',
          });
          continue;
        }

        // Process and upsert ads
        const now = new Date().toISOString();
        let nicheAdCount = 0;

        for (const rawItem of items) {
          const item = rawItem as ApifyAdResult;
          if (!item.id) continue;

          const likes = item.like ?? 0;
          const comments = item.comment ?? 0;
          const shares = item.share ?? 0;
          const ctr = item.ctr ?? 0;
          const videoDuration = item.video_info?.duration ?? 0;
          const objective = item.objective_key ?? '';

          const cloneScore = calculateCloneScore({
            likes,
            comments,
            shares,
            ctr,
            video_duration: videoDuration,
            objective,
            date_scraped: now,
          });

          const adRecord = {
            tiktok_material_id: item.id,
            ad_title: item.ad_title ?? null,
            brand_name: item.brand_name ?? null,
            niche: nicheConfig.displayName,
            industry_key: item.industry_key ?? primaryIndustryKey,
            likes,
            comments,
            shares,
            ctr,
            cost_level: item.cost ?? null,
            objective,
            video_duration: videoDuration,
            video_cover_url: item.video_info?.cover ?? null,
            video_url: item.video_info?.video_url?.['720p'] ?? null,
            video_width: item.video_info?.width ?? null,
            video_height: item.video_info?.height ?? null,
            landing_page: item.analytics?.landing_page ?? null,
            country_codes: item.analytics?.country_code ?? [],
            keywords: item.analytics?.keyword_list ?? [],
            clone_score: cloneScore,
            date_scraped: now,
            is_active: true,
            updated_at: now,
          };

          const { error: upsertError } = await supabase
            .from('winning_ads')
            .upsert(adRecord, {
              onConflict: 'tiktok_material_id',
            });

          if (upsertError) {
            console.error(`Failed to upsert ad ${item.id}:`, upsertError);
            totalErrors++;
          } else {
            nicheAdCount++;
          }
        }

        totalAds += nicheAdCount;
        nicheResults.push({
          niche: nicheConfig.displayName,
          ads: nicheAdCount,
        });

        console.log(
          `Scraped ${nicheAdCount} ads for ${nicheConfig.displayName}`
        );
      } catch (nicheError) {
        const errorMsg =
          nicheError instanceof Error ? nicheError.message : 'Unknown error';
        console.error(
          `Failed to scrape niche ${nicheConfig.displayName}:`,
          nicheError
        );
        nicheResults.push({
          niche: nicheConfig.displayName,
          ads: 0,
          error: errorMsg,
        });
        totalErrors++;
      }
    }

    // Deactivate old ads that haven't been updated in 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    await supabase
      .from('winning_ads')
      .update({ is_active: false })
      .lt('updated_at', fourteenDaysAgo.toISOString());

    const processingTime = Date.now() - startTime;
    console.log(
      `Winning ads scrape completed in ${processingTime}ms: ` +
        `${totalAds} ads scraped, ${totalErrors} errors`
    );

    return NextResponse.json({
      success: true,
      message: 'Winning ads scrape completed',
      stats: {
        total_ads: totalAds,
        total_errors: totalErrors,
        niches_processed: nicheResults.length,
        processing_time_ms: processingTime,
      },
      niche_results: nicheResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Winning ads scrape cron failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Winning ads scrape failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
