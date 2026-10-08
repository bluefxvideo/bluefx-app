/**
 * The AI Media Machine offer under the finished free video ad. Owner 2026-10-08: the whole lifetime page here was "too
 * much info, too many directions"; then "it still needs work and clarity, ask alex hormozi"; then "rethink, ask alex
 * to review the page". The page now reads: the outcome first ("Want more customers from social media?"), the 3 questions
 * the free video ad already answered (it works, for your business, and you can use it yourself), video ads made with
 * the AI Media Machine, then one offer box: what you get, the
 * 3-day bonus named and valued (shown in full once, a short reminder elsewhere), a freelancer against the AI Media
 * Machine in money and time, the birthday price, one button, what happens after the click, the guarantee; then the
 * founder, five questions, the last button.
 *
 * One number everywhere: 10 video ads a month. A free video ad opens with an AI presenter (runner.ts presenter: true),
 * and in the AI Media Machine that is PHANTOM_CREDITS + PHANTOM_PRESENTER_CREDITS = 60 of the 600 monthly credits (the
 * 12 without a presenter stays off the page: it complicates the offer). The deadline is real: the 3-day bonus
 * (offer.ts CLEAN_COPY_HOURS), enforced in claim.ts, shown as the day and hour in the visitor's own time. The bonus is
 * valued at the $99 the clean video ad sold for. The freelancer numbers are the owner's own (bluefx.net/video-ad, the
 * lifetime page). The examples row is exactly the lifetime page's 9 vertical videos, in its order. No timer, no
 * reviews, BlueFX since 2009.
 *
 * The math uses 3 numbers (owner 2026-10-08, after his girlfriend got lost in "10, 297, 3 ... so its 10 or 100 or
 * ??"): $297 once, 10 video ads every month, so under $3 per video ad, against $600 for 1 video ad on Fiverr. No
 * division, no video ads per year and no credits on the page.
 */
import { CLEAN_COPY_HOURS, OFFER, PRICE_PER_VIDEO_AD_UNDER, UNLOCK, VIDEO_ADS_LIKE_FREE_PER_MONTH } from './offer';

const MEDIA = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/aimm';

/** Video ads a month like the free one, with its AI presenter: the one number the page uses. */
const WITH_PRESENTER = VIDEO_ADS_LIKE_FREE_PER_MONTH;
/** $297 over a year of those: "under $3" (offer.ts). */
const UNDER = PRICE_PER_VIDEO_AD_UNDER;
/** A Top Rated Fiverr seller's price for one 60-second whiteboard video, like the free video ad (the owner's screenshot). */
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
    text: (domain: string) => `People stop noticing an ad after they've seen the same ad a few times. A fresh video ad every week keeps ${domain} in front of your customers.`,
  },
  /**
   * The 3 questions every buyer of software asks, and the free video ad already answered all 3 (owner 2026-10-08:
   * "people first like to see proof, can a software actually deliver? next can it create the result for them? and the
   * biggest one can they actually use the software themself ... with the free vid we prove all 3 concerns").
   */
  questions: {
    /** Told from Szilard's side with a little humor, like E2 (owner 2026-10-08: "feels like i am talking down on them"). */
    title: "3 questions I'd ask if I were you",
    lead: 'Funny thing: your free video ad already answered all 3.',
    items: (domain: string) => [
      {
        q: 'Does this thing actually work?',
        a: 'The AI Media Machine wrote the script, cast the presenter, recorded the voice-over and picked the music for the video ad above, in about 3 minutes.',
      },
      {
        q: 'Will this thing work for MY business, or only for the pizza shop in the demo?',
        a: `The video ad above is about ${domain}, made from your own website.`,
      },
      {
        q: 'Can I run this thing myself, or will I end up calling my nephew?',
        a: 'You already did: you typed one website address. Your nephew can relax. Every new video ad starts the same way, and the next video ad is ready in about 3 minutes.',
      },
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
  /**
   * The price per video ad, big, against a freelancer's $600 (owner 2026-10-08: "highlight it, in an entire section
   * contrasting it with $600 per video and showing a snapshot of it on the fiver seller ... big, clearly explained").
   * Same day his girlfriend got lost in "10, 297, 3 ... so its 10 or 100 or ??", and $297 against $600 "lost the
   * power": the title and the cards keep under $3 against $600, and the lead explains under $3 in 3 lines, one number
   * each, with no division and no video ads per year.
   */
  math: {
    eyebrow: 'The math',
    title: `Under ${UNDER} per video ad`,
    lead: [`You pay ${OFFER.now} once.`, `You make ${WITH_PRESENTER} video ads every month, for life.`, `So each video ad costs you under ${UNDER}.`],
    them: {
      name: 'A freelancer on Fiverr',
      price: FREELANCER,
      per: 'for 1 video ad',
      time: '14 days of waiting',
      /**
       * The owner's screenshot of a real Fiverr gig (2026-10-08): a Top Rated seller's 60-second whiteboard animation
       * video, Basic package $600, 14-day delivery, script, voice-over and music included. Cropped to the package box,
       * so the seller's name, photo and client logos stay off the page. Every free video ad is a whiteboard video ad
       * (runner.ts look: 'whiteboard'), so the comparison is like for like.
       */
      snapshot: {
        src: `${MEDIA}/fiverr-whiteboard-600.jpg`,
        width: 830,
        height: 968,
        caption: "A Top Rated seller's 60-second whiteboard video on Fiverr, October 2026",
      } as { src: string; width: number; height: number; caption: string } | null,
    },
    us: {
      name: 'The AI Media Machine',
      price: `Under ${UNDER}`,
      per: 'per video ad, all included',
      /** Owner 2026-10-08: "3 min waiting time". Free video ads take 2.8 min from start to finish (median of 19; 3 in 4 within 3.2 min). */
      time: 'About 3 minutes of waiting',
      /** Line for line against the Fiverr package box beside it. */
      includes: ['Script writing', 'Voice-over', 'Music', 'An AI presenter', 'Changes: type what to change'],
    },
  },
  offer: {
    title: 'Everything you get',
    items: [
      `${WITH_PRESENTER} new video ads every month, for life`,
      'Changes to any video ad: type what to change, like the music, a photo, a line of the script or the voice',
      'More AI tools: talking avatars, voice-overs (even in your own cloned voice), music, thumbnails and logos',
      'Daily YouTube tutorials, a private community and help from me',
    ],
    /** The 3-day bonus (offer.ts CLEAN_COPY_HOURS), shown once in full: named, valued, with its end. */
    bonus: {
      tag: (when: string | null) => (when ? `Free bonus until ${when}` : `Free bonus for ${BONUS_DAYS} days`),
      title: (domain: string) => `This video ad for ${domain}, without the watermark (${UNLOCK.price} value)`,
      text: 'Get the AI Media Machine by then and this video ad is in your account within about 10 minutes, ready to post or change. After that, this video ad goes into your account with the watermark.',
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
          : 'Paste a link and your first new video ad is ready in about 3 minutes.',
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
        // A lead's own words (2026-10-08: "your prices are too high. People are struggling financially these days"),
        // answered with the owner's math from his reply.
        q: `Isn't ${OFFER.now} a lot right now?`,
        a: `Money is tight for a lot of people right now. On Fiverr, 1 video ad like yours costs ${FREELANCER}. Your one payment of ${OFFER.now} covers ${WITH_PRESENTER} video ads like yours every month, for life. That's under ${UNDER} per video ad.`,
      },
      {
        // The same lead: "I wish the videos were longer by at least 90 seconds". Exact-words scripts follow their own
        // length (pricing.ts phantomCredits: each started minute after the first costs PHANTOM_EXTRA_MINUTE_CREDITS); the
        // answer names no credits (3 numbers only, see the top).
        q: 'Can my video ads be longer?',
        a: `Yes. Your free video ad is about 40 seconds. In the AI Media Machine you can write your own script, and the video ad runs as long as the script. A longer video ad uses more of your monthly credits.`,
      },
      {
        q: 'Do I need to be technical?',
        a: 'No. If you can paste a link and click a button, you can make video ads with the AI Media Machine. The AI writes the script and makes the voice-over, the pictures and the music.',
      },
      {
        q: 'Is this really one payment?',
        a: `Yes. Pay ${OFFER.now} once and you own the AI Media Machine for life, with ${WITH_PRESENTER} new video ads every month. There is no subscription, no renewal and nothing to cancel, and you have 30 days to get your money back.`,
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
    line: `One payment of ${OFFER.now} covers ${WITH_PRESENTER} video ads every month, for life: under ${UNDER} per video ad.`,
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
