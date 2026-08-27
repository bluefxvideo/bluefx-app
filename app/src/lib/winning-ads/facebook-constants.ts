/**
 * Facebook Ads Library — broad keyword search terms used by the scraper.
 *
 * Facebook Ad Library has no industry-category system (unlike TikTok Creative Center),
 * so discovery works by keyword search. These broad commercial terms span many niches
 * and together produce a diverse pool of long-running (i.e. "winning") active US ads.
 */
export const FACEBOOK_SEARCH_TERMS = [
  'shop now',
  'limited offer',
  'free shipping',
  'weight loss',
  'skincare',
  'supplement',
  'online course',
  'invest',
  'real estate',
  'app download',
  'sale today',
  'home decor',
  'fashion',
  'meal kit',
  'crypto',
  'insurance',
  'fitness',
  'software',
  // Health-offer terms requested by users: GLP-1 telehealth + ClickBank-style offers
  'GLP-1',
  'semaglutide',
  'telehealth',
  'blood sugar support',
  'prostate health',
  'metabolism booster',
  // Affiliate / ClickBank-style verticals
  'make money online',
  'side hustle',
  'passive income',
  'manifestation',
  'keto',
  'joint pain relief',
  'hair growth',
  'testosterone booster',
  'tinnitus',
  'survival gear',
];

/**
 * Calculate a "clone score" for a Facebook ad.
 * Since engagement metrics are not publicly available, we use days-running
 * as the performance proxy: if an advertiser keeps paying for an ad, it works.
 */
export function calculateFacebookCloneScore(adDeliveryStartDate: string): number {
  const days = Math.floor(
    (Date.now() - new Date(adDeliveryStartDate).getTime()) / 86_400_000
  );
  return Math.min(Math.max(days, 0) * 20, 9999);
}
