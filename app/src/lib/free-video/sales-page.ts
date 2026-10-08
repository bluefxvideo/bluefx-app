/**
 * The AI Media Machine offer under the finished free video ad. Owner 2026-10-08: the whole lifetime page here was "too
 * much info, too many directions"; then "it still needs work and clarity, ask alex hormozi"; then "rethink, ask alex
 * to review the page". The page now reads: the outcome first ("Want more customers from social media?"), how the next
 * video ad gets made (three steps), video ads made with the AI Media Machine, then one offer box: what you get, the
 * 3-day bonus named and valued (shown in full once, a short reminder elsewhere), a freelancer against the AI Media
 * Machine in money and time, the birthday price, one button, what happens after the click, the guarantee; then the
 * founder, five questions, the last button.
 *
 * One number everywhere: 10 video ads a month. A free video ad opens with an AI presenter (runner.ts presenter: true),
 * and in the AI Media Machine that is PHANTOM_CREDITS + PHANTOM_PRESENTER_CREDITS = 60 of the 600 monthly credits;
 * without a presenter it is 12 (the FAQ says so). The deadline is real: the 3-day bonus (offer.ts CLEAN_COPY_HOURS),
 * enforced in claim.ts, shown as the day and hour in the visitor's own time. The bonus is valued at the $99 the clean
 * video ad sold for. The freelancer numbers are the owner's own (bluefx.net/video-ad, the lifetime page). The examples
 * row is exactly the lifetime page's 9 vertical videos, in its order. No timer, no reviews, BlueFX since 2009.
 */
import { PHANTOM_CREDITS, PHANTOM_PRESENTER_CREDITS, PHANTOM_REVISION_CREDITS } from '@/lib/smart-video/pricing';
import { CLEAN_COPY_HOURS, LIFETIME_MONTHLY_CREDITS, OFFER, UNLOCK, VIDEO_ADS_LIKE_FREE_PER_MONTH, VIDEO_ADS_PER_MONTH } from './offer';

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

/**
 * The 9 vertical videos at the top of the lifetime page, in its order (copies of ~/Downloads/lifetime-page-videos). The
 * labels are for screen readers only: the lifetime page shows the videos without captions.
 */
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

/**
 * "Saturday, October 11 at 2:15 PM": the bonus deadline in the visitor's own time zone. Only the browser knows that zone,
 * so the page prints it after it starts (useDeadline), never on the server.
 */
export const deadlineLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

const BONUS_DAYS = CLEAN_COPY_HOURS / 24;

export const SALES_PAGE = {
  /** The id the short offer's link beside the video ad jumps to. */
  anchor: 'everything-you-get',
  bridge: {
    /** The outcome first, in the owner's own proven words ("Want more clients from social media?"), then the vehicle. */
    kicker: 'Want more customers from social media?',
    title: (domain: string) => `Post a fresh video ad for ${domain} every week`,
    text: "People stop noticing an ad after they've seen the same ad a few times. The AI Media Machine made the video ad above in a few minutes, and every new video ad takes a few minutes too.",
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
    /** Exactly the lifetime page's row, in its order (owner 2026-10-08). */
    items: WALL,
    wideTitle: 'Also made with the AI Media Machine',
    wide: [
      { video: `${MEDIA}/wide-1.mp4`, poster: `${MEDIA}/wide-1.jpg`, label: 'Cinematic AI product ad' },
      { video: `${MEDIA}/wide-2.mp4`, poster: `${MEDIA}/wide-2.jpg`, label: 'Cinematic AI brand ad' },
    ],
    wideNote: 'Made on a laptop in an afternoon, with no camera crew, no actors and no studio.',
  },
  offer: {
    title: 'Everything you get',
    items: [
      `${WITH_PRESENTER} new video ads every month, for life`,
      'Changes to any video ad: type what to change, like the music, a photo, a line of the script or the voice',
      '12 more AI tools: talking avatars with 200+ presenters, voice-overs in 57 voices or your own cloned voice, music, thumbnails and logos',
      'Daily YouTube tutorials, a private community and help from me',
    ],
    /** The 3-day bonus (offer.ts CLEAN_COPY_HOURS), shown once in full: named, valued, with its end. */
    bonus: {
      tag: (when: string | null) => (when ? `Free bonus until ${when}` : `Free bonus for ${BONUS_DAYS} days`),
      title: (domain: string) => `This video ad for ${domain}, without the watermark (${UNLOCK.price} value)`,
      text: 'Get the AI Media Machine by then and this video ad is in your account within about 10 minutes, ready to post or change. After that, this video ad goes into your account with the watermark.',
    },
    /** Money and time, against what a business owner knows: a freelancer (the owner's numbers, bluefx.net/video-ad and the lifetime page). */
    compare: {
      them: { name: 'A freelancer', lines: [`${FREELANCER} or more per video ad`, 'Days of waiting for each video ad'] },
      us: { name: 'The AI Media Machine', lines: [`About ${PER_VIDEO_AD} per video ad`, 'A few minutes per video ad'] },
      note: `${FIRST_YEAR} video ads in the first year for ${OFFER.now}, once.`,
    },
    tag: '40th birthday price',
    was: OFFER.was,
    now: OFFER.now,
    unit: 'one payment',
    why: `I turned 40 this year, so the lifetime license is ${OFFER.off}.`,
    /** What happens after the click: the checkout, the login email, the first win. */
    next: {
      title: 'What happens when you click',
      steps: (bonus: boolean) => [
        "Check out on ClickBank's secure page, with the email you gave us here.",
        'Your login link arrives by email.',
        bonus
          ? 'This video ad is in your AI Media Machine within about 10 minutes, without the watermark.'
          : 'Paste a link and your first new video ad is ready in a few minutes.',
      ],
    },
    guarantee: '30-day money-back guarantee: try the AI Media Machine for 30 days. If the AI Media Machine is not for you, email me and you get every cent back.',
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
    /**
     * The way in for a buyer who paid with another email, or a customer the email did not match (/go/claim): under the
     * first answer, off the offer card (owner 2026-10-08: "maybe we dont need it on the page").
     */
    claim: 'Open this video ad in your AI Media Machine',
    items: (bonus: boolean, when: string | null) => [
      {
        q: 'What happens to my free video ad?',
        a: bonus
          ? `Get the AI Media Machine within ${BONUS_DAYS} days of getting your video ad${when ? ` (until ${when})` : ''}, with the email you used here, and this video ad shows up in your AI Media Machine within about 10 minutes, without the watermark, ready to change. Paid with another email, or already have the AI Media Machine? Sign in with that account here:`
          : `The ${BONUS_DAYS}-day bonus for this video ad has passed, so this video ad goes into your account with the watermark. Change anything in the video ad and the new version comes without the watermark, like every new video ad you make. Already have the AI Media Machine? Sign in here:`,
        claim: true,
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
    reminder: (when: string) => `Free bonus until ${when}: this video ad without the watermark.`,
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
