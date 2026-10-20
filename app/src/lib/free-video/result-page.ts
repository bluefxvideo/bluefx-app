/**
 * The result page of a free video ad (owner 2026-10-19, the Design canvas "Free Video Ad: 3 Written Video Ads", board A
 * on a phone and board D on a computer, the top from boards E and F): the congratulations with the robot, the video ad,
 * the next 3 video ads already made (next-ads.ts), how the AI Media Machine gets them customers, the comparison and the
 * first price button, everything they get, the birthday price, the 2 free bonuses and their timer, the promise, the
 * questions, customers in their own words, more video ads, the walkthrough and the P.S. Three buttons and a bar on phones
 * go straight to ClickBank's checkout with the price on them (offer.ts RESULT_PAGE_PLACEMENTS); no price above the
 * comparison (owner: "lets move the price down").
 *
 * The bonuses run CLEAN_COPY_HOURS after the video ad was ready (offer.ts cleanCopyUntil): their free video ad without
 * the logo, and the next 3 video ads, each made with one click in their account after the purchase (bonus-ads.ts).
 * After that, or without planned video ads, every line about them stays off the page.
 *
 * Client-safe: plain data and pure functions. The owner's copy rules hold everywhere (copywriting-rules): digits, "your"
 * video ad, the customers as the subject, no em dashes, the AI Media Machine by name (never The Phantom).
 */

import { OFFER, VIDEO_ADS_LIKE_FREE_PER_MONTH } from './offer';

const MEDIA = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video';

/** 10 video ads like theirs a month; 120 a year. */
const MONTH = VIDEO_ADS_LIKE_FREE_PER_MONTH;
const YEAR = MONTH * 12;
/** What a freelancer charges for one video ad like theirs (owner 2026-10-19: "$200 is better", easier to believe than $600), and for a year of them. */
const FREELANCER = 200;
const FREELANCER_YEAR = `$${(FREELANCER * YEAR).toLocaleString('en-US')}`;

/** "Wednesday at 9:47 PM": the bonus deadline in the visitor's own time zone (the page prints it only in the browser). */
export const bonusDeadlineLabel = (iso: string) => {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
  return { day, when: `${day} at ${time}` };
};

/** The 10 video ads under "More video ads you can make": 6 s silent loops, each opening its full video ad with sound. */
const EXAMPLES = [
  { id: 'more-realtor', label: 'Realtor ad', full: `${MEDIA}/aimm/more-realtor.mp4` },
  { id: 'wall-2', label: 'AI creator', full: `${MEDIA}/aimm/wall-2.mp4` },
  { id: 'wall-4', label: 'Supplement ad', full: `${MEDIA}/aimm/wall-4.mp4` },
  { id: 'more-bakery', label: 'Bakery', full: `${MEDIA}/aimm/more-bakery.mp4` },
  { id: 'more-honey', label: 'Honey brand', full: `${MEDIA}/aimm/more-honey.mp4` },
  { id: 'ugc-creator', label: 'Cooking creator', full: `${MEDIA}/styles/ugc-creator.mp4` },
  { id: 'more-kitchen', label: 'Kitchen gadget', full: `${MEDIA}/aimm/more-kitchen.mp4` },
  { id: 'photos', label: 'Real estate', full: `${MEDIA}/styles/photos.mp4` },
  { id: 'whiteboard', label: 'Whiteboard', full: `${MEDIA}/styles/whiteboard.mp4` },
  { id: 'avatar', label: 'AI presenter', full: `${MEDIA}/styles/avatar.mp4` },
].map((item) => ({ ...item, loop: `${MEDIA}/loops/${item.id}.mp4`, poster: `${MEDIA}/loops/${item.id}.jpg` }));

/** The 5 customers with a video, in the mockup's order; their quotes are SALES_PAGE.reviews' (word for word from bluefx.net). */
export const VIDEO_REVIEWS = ['Gregory Green', "Francis D'Costa", 'Sambath Sim', 'Deryck Jones', 'Bucky Helms'] as const;
/** The 3 customer videos right under the first "Yes!" button, after the next 3 video ads (owner 2026-10-19: "after the first button i agree, we need testimonial"); the customers section keeps all of them too (owner 2026-10-20: "Put them the fuck back"). */
export const VIDEO_REVIEWS_UNDER_ADS = ['Bucky Helms', "Francis D'Costa", 'Sambath Sim'] as const satisfies readonly (typeof VIDEO_REVIEWS)[number][];
/** Where each face sits in its video's picture, for the small portrait crop. */
export const REVIEW_FACES: Record<(typeof VIDEO_REVIEWS)[number], string> = {
  'Gregory Green': '34% 30%',
  "Francis D'Costa": '40% 52%',
  'Sambath Sim': '50% 55%',
  'Deryck Jones': '52% 40%',
  'Bucky Helms': '54% 35%',
};

export const RESULT_PAGE = {
  /** Boards E (phone) and F (computer), owner 2026-10-19: the AI Media Machine is the maker, no time in the headline, the 10 a month first, no price at the top. */
  hero: {
    congrats: (name: string) => `Congratulations, ${name}!`,
    title: (domain: string) => `The AI Media Machine made your video ad from ${domain}.`,
    robot: 'The AI Media Machine robot giving a thumbs up and pointing at your video ad',
    /** The robot's name tag, so the name has a face. */
    robotLabel: 'AI Media Machine',
    /**
     * Right under their video ad, where they judge it (owner 2026-10-20: "some ads do have a small error so the client will
     * want to edit and change stuff, so that's what I think his first judgment will be"). His line from boards A and D,
     * word for word; the new hero had dropped it.
     */
    sample:
      'Your free sample has our BlueFX logo and might need a few changes. With the full AI Media Machine, you change anything in about 3 minutes, and your new video ads come without our logo.',
    /** "so more customers can find", not "keep finding" (owner: "Why not make it more simple?"). */
    line: (domain: string) => `With the AI Media Machine, you get ${MONTH} new video ads like yours every month, so more customers can find ${domain}.`,
    /** A computer's hero: a plain link down to the 3 video ads instead of the price button. */
    seeNext: 'See your next 3 video ads',
  },

  how: {
    title: "Here's how the AI Media Machine gets you more customers. You already did the first 2 steps.",
    demo: {
      app: 'AI Media Machine',
      field: 'Your website, or a few lines about your business',
      make: 'Make my video ad',
      or: 'or upload photos',
      chips: ['Script', 'Presenter', 'Voice-over and music'],
      ready: 'Your video ad is ready',
      changeLabel: 'Type a change',
      change: 'Use a woman presenter',
      makeChange: 'Make the change',
      /** The boards' pictures: a sign shop's free video ad, then the same opening with a woman presenter. */
      before: '/free-video/demo-before.jpg',
      after: '/free-video/demo-after.jpg',
      label: (domain: string) => `The AI Media Machine making a video ad for ${domain}, then a change typed in one sentence`,
    },
    steps: [
      { title: 'You type your website, or upload a few photos', text: (domain: string) => `You typed ${domain}.`, done: true },
      { title: 'The AI makes your video ad', text: () => 'Script, presenter, voice-over and music, in about 3 minutes.', done: true },
      {
        title: 'You change anything, then post your video ad where your customers scroll',
        text: () => 'Type a change like "use a woman presenter", then post on Facebook, Instagram, YouTube and TikTok.',
        done: false,
      },
    ],
    doneTag: 'DONE',
    nextTag: 'NEXT',
    result: {
      kicker: 'THE RESULT',
      title: (domain: string) => `New customers see your video ad and come to ${domain}`,
      text: `Every month, the AI Media Machine makes ${MONTH} more video ads for you, so more new customers come to you.`,
      image: '/free-video/result-drawing.webp',
      alt: 'A video ad on a phone, and new customers walking from the phone into a shop',
      /** The money each new customer brings, popping up at the shop's door (owner: "some odd number ... even $500"). */
      cash: ['+$148', '+$320', '+$99', '+$515', '+$260'],
    },
  },

  scrolling: {
    title: 'Your customers are scrolling right now',
    /** A story the reader lived 5 minutes ago instead of statistics (owner 2026-10-19, Halbert: "story, ok agree"). */
    text: 'How did you find the AI Media Machine? Probably through a video on Facebook or YouTube. Your customers are there too, over 2½ hours a day. A new video ad every 3 days keeps your business in front of your customers.',
    leadsStrong: 'Our own videos brought us 222,712 leads.',
    leadsRest: 'Your video ads are built the same way.',
    image: '/free-video/leadpages-leads.jpg',
    alt: 'Our Leadpages dashboard showing 222,712 leads',
    caption: 'Our Leadpages dashboard: 222,712 leads from our own video content since 2013.',
  },

  compare: {
    title: `What ${YEAR} video ads a year cost you`,
    freelancer: { name: 'A freelancer', line1: `about $${FREELANCER} per video ad`, line2: `${YEAR} video ads a year`, price: FREELANCER_YEAR, per: 'every year' },
    machine: { name: 'The AI Media Machine', line1: `${MONTH} video ads a month`, line2: `${YEAR} video ads a year`, line2After: ', included', price: OFFER.now, per: 'once, yours for life' },
    line: (domain: string) => `${YEAR} video ads a year means ${YEAR} chances for new customers to find ${domain}.`,
  },

  buy: {
    /**
     * The owner's "Yes" button (2026-10-19): the AI Media Machine makes the video ads, so the button never reads like a
     * service that sends them ("now the button feels like a service i buy"). The bar on a phone shows the first line only.
     */
    button: 'Yes! I Want the AI Media Machine',
    buttonMore: `that makes ${MONTH} new video ads for me every month`,
    was: OFFER.was,
    now: OFFER.now,
    /** "no monthly fee" (owner 2026-10-20, after a lead asked whether lifetime means unlimited): 10 a month is not a membership. */
    once: 'one payment, no monthly fee',
    cards: 'Pay with Visa, Mastercard, American Express, Discover or PayPal',
    guarantee: '30-day money-back guarantee',
    secure: 'Secure checkout · Instant access',
    login: 'Your login arrives by email.',
    loginWritten: 'Your login arrives by email. Your next 3 video ads are already made and waiting inside.',
    last: `Includes ${MONTH} complete video ads every month · 30-day money-back guarantee`,
  },

  written: {
    /** Only a teaser is planned now; each video ad is made when the buyer clicks it (owner 2026-10-19, bonus-ads.ts). */
    /** The owner's words, word for word (2026-10-19: "keep already written its simple", then "actually, already made"). */
    title: 'Your next 3 video ads are already made.',
    /** The id the E2 email links to ({$free_video_url}#next-ads, "See Your Next 3 Video Ads Here"). */
    anchor: 'next-ads',
    text: (domain: string, day: string | null) =>
      `Video ads #2, #3 and #4 for ${domain} wait inside the AI Media Machine, the AI that made your free sample. Get the AI Media Machine ${day ? `by ${day}` : 'while your bonus runs'}, and each one is ready to post about 3 minutes after you click it.`,
    length: '0:40',
    chip: 'Ready with one click',
    meta: 'AI presenter · voice-over · music · captions',
    alt: (n: number, title: string) => `Video ad ${n}: ${title}`,
    writing: (n: number) => `Writing video ad #${n}…`,
  },

  stack: {
    title: 'Everything you get today',
    items: (domain: string, written: boolean, bonus: boolean) =>
      [
        { text: 'A new video ad every 3 days, so new customers can find you' },
        { text: 'The AI Media Machine, yours for life' },
        { text: `${MONTH} complete video ads every month` },
        written ? { text: `Your next 3 video ads for ${domain}, already made` } : null,
        { text: 'Change anything in about 3 minutes' },
        bonus ? { bonus: true, text: 'your free video ad, without our BlueFX logo' } : null,
        written ? { bonus: true, text: `your next 3 video ads, already made and ready with one click, on top of your ${MONTH} video ads a month` } : null,
      ].filter((item): item is { text: string; bonus?: boolean } => item !== null),
    bonusLabel: 'Bonus:',
    /** The 2 fragments under the stack (owner: "dov has a good testimonial with the 45% increase ... dercy is also great"). */
    proof: [
      {
        name: 'Dov Rom',
        role: 'President, Ascent Equipment',
        photo: '/free-video/testimonials/dov-rom.jpg',
        before: '"Within just a few weeks of launching, we have seen a ',
        strong: '45% increase in organic traffic',
        after: '."',
      },
      {
        name: 'Deryck Jones',
        role: 'Marketing agency owner',
        photo: '/free-video/testimonials/deryck-jones.jpg',
        before: '"…it saves me countless hours… Any place I can get a shortcut to guard and protect my time ',
        strong: "it's worth a fortune",
        after: '."',
      },
    ],
  },

  /** Said like Frank Kern would (owner 2026-10-19: "currently it sounds robotic"). */
  founder: {
    name: 'Szilard Gyorfi, founder of BlueFX',
    photo: '/free-video/owner.jpg',
    text: `I just turned 40! To celebrate, I'm dropping the price of the AI Media Machine from ${OFFER.was} to ${OFFER.now}. When my birthday celebration ends, the price goes back to ${OFFER.was}.`,
    was: OFFER.was,
    now: OFFER.now,
    once: 'one payment, yours for life',
  },

  bonus: {
    title: (written: boolean, when: string | null) =>
      `${written ? 'Your 2 free bonuses end' : 'Your free bonus ends'} ${when ?? 'soon'}`,
  },

  promise: {
    title: 'My 30-day promise',
    text: (written: boolean) =>
      `Make video ads for 30 days. If you're not happy, email me at support@bluefx.net and I'll refund every cent.${written ? ' You keep your 3 video ads anyway.' : ''}`,
    signature: 'Szilard',
  },

  faq: {
    title: 'Questions',
    items: [
      // The two questions a lead asked about "lifetime" (owner 2026-10-20) come first.
      {
        q: 'Is the AI Media Machine a monthly subscription?',
        yes: 'No.',
        a: `You pay ${OFFER.now} once, and there's no monthly fee. Every month, for life, your account refills with ${MONTH} new video ads like yours. You also have 30 days to get your money back.`,
      },
      {
        q: 'How many video ads can I make?',
        a: `${MONTH} complete video ads like yours every month, for life. In a busy month you can add a one-time recharge pack, from $9.99.`,
      },
      {
        q: 'Will video ads bring me more customers?',
        a: 'Your customers scroll Facebook, Instagram, YouTube and TikTok every day, and a new video ad every 3 days keeps your business in front of your customers. Our own videos brought us 222,712 leads, and your video ads are built the same way.',
      },
      {
        q: 'What can I change in my video ad?',
        yes: 'Anything.',
        a: 'The words, a typo from your website, the presenter (one of 246, or your own photo), the voice and accent (one of 57 voices, or your own cloned voice), the music, the photos, your logo and your own clips. Type what you want changed, and the new version is ready in about 3 minutes.',
      },
      {
        q: 'Can I make video ads for my clients?',
        yes: 'Yes,',
        a: 'at no extra cost. Videos you make in the AI Media Machine come out without our BlueFX logo, and each video downloads to your computer as an MP4 file, ready to hand to your client.',
      },
      {
        q: 'Can I make video ads without a website?',
        yes: 'Yes.',
        a: 'The AI Media Machine makes video ads from the link to your business on Google Maps, or from a few lines you type about your business and your photos. Your product and home listings on Amazon, TikTok Shop, Zillow and Realtor.com work too.',
      },
      {
        q: 'Can I make other kinds of video ads?',
        yes: 'Yes.',
        a: 'Pick a look for each video ad: playful, elegant, bold, clean or whiteboard. Or let the AI Media Machine pick the best match for your business, with or without an AI presenter.',
      },
      {
        q: 'Do I need to be technical?',
        yes: 'No.',
        a: 'If you can paste a link and click a button, you can make video ads with the AI Media Machine. The AI writes the script and makes the voice-over, the pictures and the music. The AI Media Machine runs in your browser, with nothing to install.',
      },
    ] as { q: string; yes?: string; a: string }[],
  },

  reviews: {
    kicker: 'WHAT CUSTOMERS SAY',
    title: 'BlueFX customers, in their own words',
    lead: "I've been building BlueFX since 2009, for more than 36,000 customers. Here are a few of those customers.",
    tiles: [
      { big: 'Since 2009', small: 'building BlueFX' },
      { big: '36,000+', small: 'customers' },
      { big: '222,712', small: 'leads from our own videos' },
    ],
    stars: '5 stars',
    play: (name: string) => `Play ${name}'s video`,
  },

  examples: {
    title: 'More video ads you can make with the AI Media Machine',
    lead: 'One for every kind of business. Tap any video ad to watch with sound.',
    sound: 'Sound',
    watch: (label: string) => `Watch the ${label} video ad with sound`,
    close: 'Close',
    items: EXAMPLES,
  },

  ps: {
    /** Only while the 3 written video ads are a bonus; otherwise the math is the only P.S. */
    ps: (name: string, domain: string, when: string | null) =>
      `${name}, your next 3 video ads for ${domain} are already made. Get the AI Media Machine ${when ? `by ${when}` : 'while your bonus runs'}, and each one is ready to post about 3 minutes after you click it, on top of your ${MONTH} video ads a month.`,
    pps: (domain: string) =>
      `Here's the math. A freelancer charges about $${FREELANCER} for one video ad like yours. With the AI Media Machine, you can make ${YEAR} video ads a year for ${domain}. Hiring a freelancer for those ${YEAR} video ads would cost about `,
    ppsStrong: `${FREELANCER_YEAR} a year`,
    ppsEnd: `. You pay ${OFFER.now}, once. And every video ad is one more chance for new customers to find you.`,
  },

  walkthrough: {
    kicker: 'SEE IT WORKING',
    jump: 'Jump to:',
    length: '17:31',
    posterAlt: 'Szilard inside the AI Media Machine',
  },

  bar: {
    label: 'Get the AI Media Machine',
  },
} as const;
