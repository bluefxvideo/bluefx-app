/**
 * The AI Media Machine offer under the finished free video ad. Owner 2026-10-08, after the whole lifetime page was
 * ported here (commit 6fc5e29): "too much info, too many directions and not connecting strongly with the initial
 * result we gave them ... look at this page as alex hormozi". So: one buyer (a business owner holding a video ad), one
 * problem (one video ad wears out), one offer, one button label. Their video ad and their domain carry the page; the
 * stack prices each piece (the clean video ad at the $99 it sold for, 144 a year at that price, the other tools at
 * what they rent for); then the birthday price, video ads the AI Media Machine made from a link, the guarantee with
 * the owner's face, five questions, one last button. Lines reused from the lifetime page and the E3 email where they
 * say the same thing. No timer, no reviews, BlueFX since 2009 (owner: "2009 is ok").
 */
import { PHANTOM_CREDITS, PHANTOM_REVISION_CREDITS } from '@/lib/smart-video/pricing';
import { STYLE_NAMES } from '@/lib/smart-video/types';
import { EXAMPLE_VIDEOS } from './copy';
import { LIFETIME_MONTHLY_CREDITS, OFFER, UNLOCK, VIDEO_ADS_PER_MONTH } from './offer';

const MEDIA = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/aimm';

const usd = (price: string) => Number(price.replace(/\D/g, ''));
const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;

/** What the 12 other tools rent for elsewhere per month, as the lifetime page's "Everything You Own" table lists them. */
const TOOLS_MONTHLY = [59, 99, 100, 29, 28, 10, 11, 10, 49, 20, 30, 15].reduce((sum, price) => sum + price, 0);
const VIDEO_ADS_PER_YEAR = VIDEO_ADS_PER_MONTH * 12;
/** 144 video ads at the $99 the clean video ad sold for. */
const VIDEO_ADS_VALUE = VIDEO_ADS_PER_YEAR * usd(UNLOCK.price);
const FIRST_YEAR_VALUE = usd(UNLOCK.price) + VIDEO_ADS_VALUE + TOOLS_MONTHLY * 12;
const LOOKS = STYLE_NAMES.join(', ').replace(/, (\w+)$/, ' or $1');

/** The landing page's examples the AI Media Machine made from a link (EXAMPLE_VIDEOS), by id. */
const LINK_ADS = Object.fromEntries(EXAMPLE_VIDEOS.ads.map((ad) => [ad.id, { video: ad.video, poster: ad.poster, label: ad.name }])) as Record<
  (typeof EXAMPLE_VIDEOS.ads)[number]['id'],
  { video: string; poster: string; label: string }
>;
/** The 9 vertical videos at the top of the lifetime page, in its order (copies of ~/Downloads/lifetime-page-videos). */
const WALL = [
  'Cooking video',
  'AI creator',
  'Product demo',
  'Testimonial ad',
  'Recipe video',
  'Cinematic product ad',
  'Skincare ad',
  'Baking video',
  'Phone-style ad',
].map((label, index) => ({ video: `${MEDIA}/wall-${index + 1}.mp4`, poster: `${MEDIA}/wall-${index + 1}.jpg`, label }));

export const SALES_PAGE = {
  /** The id the short offer's link beside the video ad jumps to. */
  anchor: 'everything-you-get',
  bridge: {
    kicker: 'The AI Media Machine made the video ad above in a few minutes.',
    title: (domain: string) => `Make ${VIDEO_ADS_PER_MONTH} more video ads for ${domain} every month`,
    text: (domain: string) =>
      `People stop noticing an ad after they've seen the same ad a few times. A fresh video ad every week keeps ${domain} in front of your customers, and with the AI Media Machine the next video ad takes a few minutes: paste a link, type a few lines about an offer or add a few photos.`,
  },
  stack: {
    title: 'Everything you get with the AI Media Machine',
    items: (domain: string) => [
      {
        title: `Your video ad for ${domain}, without the watermark`,
        text: 'The video ad shows up in your AI Media Machine account within about 10 minutes, ready to post.',
        value: UNLOCK.price,
      },
      {
        title: 'Any change to that video ad',
        text: 'Type what to change, like the music, a photo, a line of the script or the voice, and the new version is ready in a few minutes.',
        value: 'included',
      },
      {
        title: `${VIDEO_ADS_PER_MONTH} new video ads every month, for life`,
        text: `${VIDEO_ADS_PER_YEAR} video ads a year, made from a website, a product page, a few lines about an offer or a few photos, ready to post on Facebook, Instagram, TikTok and YouTube.`,
        value: `${money(VIDEO_ADS_VALUE)} a year`,
        note: `${VIDEO_ADS_PER_YEAR} video ads at ${UNLOCK.price} each`,
      },
      {
        title: `${STYLE_NAMES.length} looks, 2 sizes and an AI presenter`,
        text: `Pick ${LOOKS}, vertical for Reels and TikTok or horizontal for YouTube, and add an AI presenter who speaks your script when you want a face in the video ad.`,
        value: 'included',
      },
      {
        title: '12 more AI tools',
        text: 'Talking AI avatars with 200+ presenters, voice-overs in 57 voices or your own cloned voice, music for every video ad, thumbnails and logos.',
        value: `${money(TOOLS_MONTHLY * 12)} a year`,
        note: `what the same tools rent for elsewhere, ${money(TOOLS_MONTHLY)} a month`,
      },
      {
        title: 'Help from a real person',
        text: 'Daily YouTube tutorials, a private community and support from me, not a chatbot.',
        value: 'included',
      },
    ],
    total: ['Total value in the first year', money(FIRST_YEAR_VALUE)],
  },
  price: {
    tag: '40th Birthday Deal',
    was: ['Lifetime license', OFFER.was],
    now: `Just ${OFFER.now}`,
    line: 'One payment. Everything above, forever.',
    why: `I turned 40 this year, so for my birthday the lifetime license is ${OFFER.off}: ${OFFER.now}, once.`,
    fine: '30-day money-back guarantee. Secure checkout by ClickBank.',
  },
  proof: {
    title: 'Video ads made with the AI Media Machine',
    text: 'Tap a video ad for the sound.',
    soundOn: 'Turn the sound on',
    soundOff: 'Turn the sound off',
    previous: 'Earlier video ads',
    next: 'More video ads',
    /**
     * The landing page's Phantom renders (made from a link, no watermark) between the vertical videos from the top of
     * the lifetime page (owner 2026-10-08: "lets have the ai mm videos from the top also in the examples showing, those
     * are very cool"), so a phone's first two tiles show one of each. The reel's studio-made ads stay off.
     */
    items: [
      LINK_ADS.pizza,
      WALL[1],
      LINK_ADS.listing,
      WALL[5],
      LINK_ADS.welder,
      WALL[6],
      WALL[0],
      WALL[2],
      WALL[3],
      WALL[4],
      WALL[7],
      WALL[8],
    ],
    wideTitle: 'Also made with the AI Media Machine',
    wide: [
      { video: `${MEDIA}/wide-1.mp4`, poster: `${MEDIA}/wide-1.jpg`, label: 'Cinematic AI product ad' },
      { video: `${MEDIA}/wide-2.mp4`, poster: `${MEDIA}/wide-2.jpg`, label: 'Cinematic AI brand ad' },
    ],
    wideNote: 'Made on a laptop in an afternoon, with no camera crew, no actors and no studio.',
  },
  guarantee: {
    title: '30-day money-back guarantee',
    text: [
      "If you don't save time, create content you're proud of, and see the potential, email me within 30 days and I'll refund every cent. There's nothing to cancel, because there's no subscription.",
      'You risk nothing. I risk my reputation built over 18 years and 36,000 customers.',
    ],
    photo: `${MEDIA}/founder.jpg`,
    name: 'Szilard Gyorfi',
    role: 'Founder of BlueFX, making videos for businesses since 2009',
    facts: ['18 years in marketing', '$60K+ of my own money spent testing video ads', '36,000+ customers'],
  },
  faq: {
    title: 'Questions',
    items: [
      {
        q: 'What happens to my free video ad?',
        a: 'Buy with the email you used here, and this video ad shows up in your AI Media Machine within about 10 minutes, without the watermark, ready to change. Bought with another email? Come back to this page and use the link under the offer beside your video ad.',
      },
      {
        q: 'How many video ads can I make?',
        a: `${LIFETIME_MONTHLY_CREDITS} credits arrive every month. A video ad like yours takes ${PHANTOM_CREDITS} credits, so that is ${VIDEO_ADS_PER_MONTH} video ads a month, ${VIDEO_ADS_PER_YEAR} a year. A change to a video ad takes ${PHANTOM_REVISION_CREDITS}.`,
      },
      {
        q: 'Do I need to be technical?',
        a: 'No. If you can paste a link and click a button, you can make video ads with the AI Media Machine. The AI writes the script and makes the voice-over, the pictures and the music.',
      },
      {
        q: 'Is this really one payment?',
        a: `Yes. Pay ${OFFER.now} once and you own the AI Media Machine for life, with ${LIFETIME_MONTHLY_CREDITS} fresh credits every month. There is no subscription, no renewal and nothing to cancel, and you have 30 days to get your money back.`,
      },
      {
        q: 'What if I need more credits?',
        a: 'Your monthly credits cover more than most people use. In a busy month you can add a credit pack, from $9.99, with nothing recurring.',
      },
    ],
  },
  close: {
    title: (domain: string) => `Make the next video ad for ${domain} today`,
    line: `One payment of ${OFFER.now}. Regular price ${OFFER.was}.`,
  },
  /** ClickBank sells the lifetime license, so its retailer notice goes with the offer (as on the lifetime page). */
  legal: {
    support: ['For product support, email ', '. For order support, contact ', 'ClickBank', '.'],
    clickbankUrl: 'https://www.clkbank.com/',
    notes: [
      "ClickBank is the retailer of products on this site. CLICKBANK® is a registered trademark of Click Sales Inc., a Delaware corporation located at 1444 S. Entertainment Ave., Suite 410 Boise, ID 83709, USA and used by permission. ClickBank's role as retailer does not constitute an endorsement, approval or review of these products or any claim, statement or opinion used in promotion of these products.",
      'This site and the products and services offered on this site are not associated, affiliated, endorsed, or sponsored by Youtube or Facebook, nor have they been reviewed tested or certified by Youtube or Facebook.',
    ],
  },
} as const;
