/**
 * The AI Media Machine offer under the finished free video ad. Owner 2026-10-08: the whole lifetime page here was "too
 * much info, too many directions"; the first focused version was "much better, but it still needs work and clarity,
 * ask alex hormozi". So the page reads in his order: the promise (more video ads like the one above), how the next
 * video ad gets made (three steps, almost no effort), proof (video ads made with the AI Media Machine), then one offer
 * box (what you get, the price against a freelancer, the birthday price, the real deadline, the guarantee), the
 * founder, five questions, one last button.
 *
 * One number everywhere: 10 video ads a month. A free video ad opens with an AI presenter (runner.ts presenter: true),
 * and in the AI Media Machine that is PHANTOM_CREDITS + PHANTOM_PRESENTER_CREDITS = 60 of the 600 monthly credits;
 * without a presenter it is 12 (the FAQ says so). The deadline is real: a buyer gets this video ad clean and ready to
 * change only while its working files exist (cleanup.ts editableUntil). The freelancer price is the owner's own
 * estimate from bluefx.net/video-ad ($600 to $1,500 per video ad). No timer, no reviews, BlueFX since 2009.
 */
import { PHANTOM_CREDITS, PHANTOM_PRESENTER_CREDITS, PHANTOM_REVISION_CREDITS } from '@/lib/smart-video/pricing';
import { EXAMPLE_VIDEOS } from './copy';
import { LIFETIME_MONTHLY_CREDITS, OFFER, VIDEO_ADS_LIKE_FREE_PER_MONTH, VIDEO_ADS_PER_MONTH } from './offer';

const MEDIA = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/aimm';

const usd = (price: string) => Number(price.replace(/\D/g, ''));

/** Video ads a month like the free one (with its AI presenter), and without a presenter. */
const WITH_PRESENTER = VIDEO_ADS_LIKE_FREE_PER_MONTH;
const WITHOUT_PRESENTER = VIDEO_ADS_PER_MONTH;
const FIRST_YEAR = WITH_PRESENTER * 12;
/** $297 over the first year's 120 video ads, to the nearest 50 cents: about $2.50 each. */
const PER_VIDEO_AD = `$${(Math.round((usd(OFFER.now) / FIRST_YEAR) * 2) / 2).toFixed(2)}`;
/** The low end of what a freelancer charges for one video ad (the owner's comparison on bluefx.net/video-ad). */
const FREELANCER = '$600';

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

/** "November 7": the deadline as a date (UTC, so the server and the browser print the same day). */
export const deadlineDate = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

export const SALES_PAGE = {
  /** The id the short offer's link beside the video ad jumps to. */
  anchor: 'everything-you-get',
  bridge: {
    kicker: (domain: string) => `The AI Media Machine made the video ad above for ${domain} in a few minutes.`,
    title: (domain: string) => `Make ${WITH_PRESENTER} more video ads for ${domain} every month`,
    text: (domain: string) =>
      `People stop noticing an ad after they've seen the same ad a few times. A fresh video ad every week keeps ${domain} in front of your customers.`,
  },
  steps: {
    title: 'How the next video ad gets made',
    items: [
      { title: 'Paste a link', text: 'Your website or a product page. A few lines about an offer, or a few photos, work too.' },
      { title: 'The AI Media Machine makes the video ad', text: 'The script, the presenter, the voice-over, the music and the pictures, in a few minutes.' },
      { title: 'Post the video ad', text: 'Vertical for Reels and TikTok, horizontal for YouTube and Facebook, ready to download.' },
    ],
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
    items: [LINK_ADS.pizza, WALL[1], LINK_ADS.listing, WALL[5], LINK_ADS.welder, WALL[6], WALL[0], WALL[2], WALL[3], WALL[4], WALL[7], WALL[8]],
    wideTitle: 'Also made with the AI Media Machine',
    wide: [
      { video: `${MEDIA}/wide-1.mp4`, poster: `${MEDIA}/wide-1.jpg`, label: 'Cinematic AI product ad' },
      { video: `${MEDIA}/wide-2.mp4`, poster: `${MEDIA}/wide-2.jpg`, label: 'Cinematic AI brand ad' },
    ],
    wideNote: 'Made on a laptop in an afternoon, with no camera crew, no actors and no studio.',
  },
  offer: {
    title: 'Everything you get',
    /** The first line only while this video ad can still go into a buyer's account clean (editableUntil). */
    items: (domain: string, withThisVideoAd: boolean) => [
      ...(withThisVideoAd ? [`This video ad for ${domain}, without the watermark and ready to change, in your account`] : []),
      `${WITH_PRESENTER} new video ads every month, for life`,
      'Changes to any video ad: type what to change, like the music, a photo, a line of the script or the voice',
      '12 more AI tools: talking avatars with 200+ presenters, voice-overs in 57 voices or your own cloned voice, music, thumbnails and logos',
      'Daily YouTube tutorials, a private community and help from me',
    ],
    compare: [
      `A freelancer charges ${FREELANCER} or more for one video ad.`,
      `Here, ${FIRST_YEAR} video ads in the first year cost ${OFFER.now} once: about ${PER_VIDEO_AD} a video ad.`,
    ],
    tag: '40th birthday price',
    was: OFFER.was,
    now: OFFER.now,
    unit: 'one payment',
    why: `I turned 40 this year, so the lifetime license is ${OFFER.off}.`,
    deadline: (date: string) =>
      `Buy by ${date} and this video ad goes into your account without the watermark, ready to change. After ${date} the project files of this video ad are deleted.`,
    guarantee: '30-day money-back guarantee: email me within 30 days for any reason and you get every cent back.',
    fine: 'Secure checkout by ClickBank.',
  },
  founder: {
    photo: `${MEDIA}/founder.jpg`,
    name: 'Szilard Gyorfi',
    role: 'Founder of BlueFX, making videos for businesses since 2009',
    text: "I've spent over $60,000 of my own money on Facebook ads, testing what gets people to click, watch and buy. The AI Media Machine is the same system I use every day.",
    risk: 'You risk nothing. I risk my reputation built over 18 years and 36,000 customers.',
    facts: ['18 years in marketing', '$60K+ of my own money spent testing video ads', '36,000+ customers'],
  },
  faq: {
    title: 'Questions',
    items: (date: string | null) => [
      {
        q: 'What happens to my free video ad?',
        a: date
          ? `Buy by ${date} with the email you used here, and this video ad shows up in your AI Media Machine within about 10 minutes, without the watermark, ready to change. Bought with another email? Come back to this page and use the link under the offer beside your video ad.`
          : 'The project files of a free video ad are kept for 30 days, and that time has passed, so this video ad goes into your account as it is. Every new video ad you make in the AI Media Machine comes without the watermark.',
      },
      {
        q: 'How many video ads can I make?',
        a: `${LIFETIME_MONTHLY_CREDITS} credits arrive every month. A video ad with an AI presenter, like yours, takes ${PHANTOM_CREDITS + PHANTOM_PRESENTER_CREDITS} credits: ${WITH_PRESENTER} video ads a month. Without the presenter a video ad takes ${PHANTOM_CREDITS}: ${WITHOUT_PRESENTER} a month. A change to a video ad takes ${PHANTOM_REVISION_CREDITS}.`,
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
