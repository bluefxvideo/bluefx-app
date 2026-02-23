/**
 * Niche-to-TikTok industry key mapping for the Winning Ads Finder.
 * Keys from: https://raw.githubusercontent.com/lofe-w/tiktok-creative-center-scraper-public/refs/heads/main/options/dashboard_industry.json
 */

export interface NicheConfig {
  displayName: string;
  industryKeys: string[];
}

export const NICHE_MAP: Record<string, NicheConfig> = {
  'health-supplements': {
    displayName: 'Health & Supplements',
    industryKeys: ['29102000000', '29103000000'],
  },
  'skincare-beauty': {
    displayName: 'Skincare & Beauty',
    industryKeys: ['14103000000', '14104000000', '14000000000'],
  },
  'food-recipe': {
    displayName: 'Food & Recipe',
    industryKeys: ['27100000000', '27104000000'],
  },
  'ecommerce-products': {
    displayName: 'E-Commerce & Products',
    industryKeys: ['30000000000', '30102000000'],
  },
  'finance-investing': {
    displayName: 'Finance & Investing',
    industryKeys: ['13000000000'],
  },
  'real-estate': {
    displayName: 'Real Estate',
    industryKeys: ['24100000000'],
  },
  'apps-software': {
    displayName: 'Apps & Software',
    industryKeys: ['20000000000'],
  },
  'education-courses': {
    displayName: 'Education & Courses',
    industryKeys: ['10000000000'],
  },
  'home-living': {
    displayName: 'Home & Living',
    industryKeys: ['21000000000'],
  },
  'fashion-apparel': {
    displayName: 'Fashion & Apparel',
    industryKeys: ['22000000000'],
  },
};

export const ALL_NICHES = Object.entries(NICHE_MAP).map(([slug, config]) => ({
  slug,
  ...config,
}));

export function getNicheDisplayName(slug: string): string {
  return NICHE_MAP[slug]?.displayName ?? slug;
}

export function getNicheSlug(displayName: string): string | undefined {
  return Object.entries(NICHE_MAP).find(
    ([, config]) => config.displayName === displayName
  )?.[0];
}

/**
 * Calculate clone score for an ad based on engagement metrics.
 */
export function calculateCloneScore(ad: {
  likes: number;
  comments: number;
  shares: number;
  ctr: number;
  video_duration?: number;
  objective?: string;
  date_scraped?: Date | string;
}): number {
  let score = (ad.likes * 1) + (ad.comments * 3) + (ad.shares * 5) + (ad.ctr * 1000);

  // Bonus for short-form content (easier to clone)
  if (ad.video_duration && ad.video_duration < 30) {
    score += 500;
  }

  // Bonus for conversion-focused ads
  if (
    ad.objective &&
    (ad.objective.includes('product_sales') || ad.objective.includes('conversion'))
  ) {
    score += 300;
  }

  // Bonus for fresh/trending ads (scraped within last 7 days)
  if (ad.date_scraped) {
    const scraped = new Date(ad.date_scraped);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    if (scraped > sevenDaysAgo) {
      score += 200;
    }
  }

  return Math.round(score);
}
