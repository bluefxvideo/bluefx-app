/**
 * The result page "the sales page way" (owner 2026-10-22, design board J on the canvas): after their own video ad, the
 * main sales page's tested order (red 94.62% banner, "Could This Be the Best Deal in the Era of AI Video?", example video
 * ads, the sales video, the birthday price box, all 12 tools with a value each, old way vs new way, customers, the founder,
 * why lifetime, everything you own + 94.62% OFF!, the guarantee, questions, walkthrough, P.S.). Copy approved on board J
 * after reviews by Halbert, Hormozi, Kennedy and Ogilvy (expert-review/*.md in the session scratchpad); every number
 * here is checked: tool amounts from 90 days of credit_transactions, a video ad like theirs = 60 credits (50 + the
 * presenter's 10), the $9.99 pack = 100 credits, the $24.99 pack = 300. The classic page stays (RESULT_PAGE_VERSION).
 *
 * Rules (copywriting-rules): no em or en dashes, digits, "your video ad", the AI Media Machine by name, never "The
 * Phantom" alone ("Phantom Ad Maker" is the tool), no stacked negation, social media first (owner 2026-10-22: his buyers
 * mostly don't run ads; they want customers from social media).
 */
import { OFFER, VIDEO_ADS_LIKE_FREE_PER_MONTH } from './offer';

const MONTH = VIDEO_ADS_LIKE_FREE_PER_MONTH;
const YEAR = MONTH * 12;
const FREELANCER = 200;
const FREELANCER_YEAR = `$${(FREELANCER * YEAR).toLocaleString('en-US')}`;
const ASSETS = 'https://ai.bluefx.net/assets';
const SUPABASE = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public';
const EXAMPLES = `${SUPABASE}/script-videos/smart-video/examples/free-video`;
const IMAGE_MAKER = `${SUPABASE}/script-videos/examples/image-maker`;

/** The 8 video ads at the top of the main sales page (ai.bluefx.net/lifetime/), Vimeo background players (owner 2026-10-22: "I have more video ads there"). */
export const SALES_PAGE_HERO_VIMEO = ['1217606652', '1217606691', '1217606651', '1217606688', '1217606709', '1217606706', '1217606686', '1217606680'] as const;

/** Video Swap's demo: the vertical or the horizontal cut of the same intro (the owner picks). */
const VIDEO_SWAP_LOOK = 'vertical' as 'vertical' | 'horizontal';

/** Which result page leads see: 'sales' (board J) or 'classic' (the page live since 2026-10-19). ?page= overrides it for a look. */
export const RESULT_PAGE_VERSION: 'sales' | 'classic' = 'sales';

type ToolMedia =
  | { kind: 'gif'; src: string; alt: string }
  | { kind: 'video'; src: string; poster: string }
  | { kind: 'phone'; src: string; poster: string }
  | { kind: 'slides'; slides: { from: string | null; to: string; label: string }[] }
  | { kind: 'audio'; tracks: { label: string; src: string }[] }
  | { kind: 'placeholder'; label: string };

export interface SalesTool {
  name: string;
  media: ToolMedia;
  does: (domain: string) => string;
  forBusiness: string;
  amount: string;
  value: string;
}

/** The 4 groups of tools, each ending in its own button. */
export const TOOL_GROUPS: { title: string; lead: string | null; tools: SalesTool[] }[] = [
  {
    title: 'MAKE YOUR VIDEO ADS',
    lead: null,
    tools: [
      {
        name: 'Phantom Ad Maker',
        // A whole video ad, presenter first and then the rest (owner: the cropped close-up looked strange).
        media: { kind: 'phone', src: `${EXAMPLES}/aimm/more-bakery.mp4`, poster: `${EXAMPLES}/loops/more-bakery.jpg` },
        // Krug: about 3 lines on a phone (was 12).
        does: (domain) =>
          `The tool that made your video ad for ${domain}. Type your website, paste a script or upload a few photos, and get a finished video ad with a hook, a presenter, scenes, a voice-over and music. Type any change, and the new version is ready in about 3 minutes.`,
        forBusiness: `${MONTH} new video ads every month to post on YouTube, Instagram, Facebook and TikTok, so customers see your business every 3 days.`,
        amount: `${MONTH} complete video ads a month`,
        value: '$100/mo',
      },
      {
        name: 'Video Clip Maker',
        media: { kind: 'gif', src: `${ASSETS}/1.gif`, alt: 'Video Clip Maker turning a photo into a moving video clip' },
        does: () => 'Describe any short video ad, or start from 1 photo. Video Clip Maker plans the shots, animates every scene and shows actors using your product, in video up to 4K.',
        forBusiness: 'A short video ad for every product and every offer you sell, made from a photo you already have, so customers on Facebook, Instagram and TikTok see your product in action.',
        amount: 'Up to about 100 short clips a month',
        value: '$59/mo',
      },
      {
        name: 'AI Avatar',
        media: { kind: 'gif', src: `${ASSETS}/4_ai_avatar_1.gif`, alt: 'An AI presenter speaking a typed script' },
        does: () =>
          'Type your script and pick 1 of 246 AI presenters, from different ethnicities, age groups and professions. Or upload 1 photo of yourself, and you become the presenter. The presenter says your words to the camera, in a video ad, a how-to video or a presentation.',
        forBusiness: 'You, from 1 photo, or a presenter you pick, explain your business to new customers, and you never have to stand in front of a camera.',
        amount: 'Up to about 20 talking videos a month',
        value: '$29/mo',
      },
      {
        name: 'Video Swap',
        // The intro of the owner's UGC Ad Clone video: him and 2 women, the same moves (owner 2026-10-22). VIDEO_SWAP_LOOK picks the cut.
        media: VIDEO_SWAP_LOOK === 'vertical' ? { kind: 'phone', src: '/free-video/video-swap-vertical.mp4', poster: '/free-video/video-swap-vertical.jpg' } : { kind: 'video', src: '/free-video/video-swap-horizontal.mp4', poster: '/free-video/video-swap-horizontal.jpg' },
        does: () => 'Put a new person into any video. The motion stays the same.',
        forBusiness: 'Your face in a video ad you never filmed, so customers on Facebook and Instagram get to know the person behind your business.',
        amount: 'Up to about 75 seconds of video a month',
        value: '$19/mo',
      },
    ],
  },
  {
    title: 'COPY THE VIDEOS THAT ALREADY WORK',
    lead: 'Find Video Ads shows you the best-performing video ads on Facebook right now, and the Video Analyzer & Ad Cloner rebuilds the best video around your product, ready to post on your own pages.',
    tools: [
      {
        name: 'Video Analyzer & Ad Cloner',
        media: { kind: 'gif', src: `${ASSETS}/video_analyzer.gif`, alt: 'The Video Analyzer breaking down a video ad shot by shot' },
        does: () =>
          "Paste the link to any video: a competitor's video ad, or a popular video from a business in another field. The AI breaks down the hook, the script, the shot sequence and the timing, then rebuilds the video ad around your product.",
        forBusiness: 'Your own version of a video that already works for another business, rebuilt with your product and your business name, ready to post on YouTube, Instagram, Facebook and TikTok.',
        amount: 'Up to about 100 video analyses, or about 2 cloned video ads a month',
        value: '$99/mo',
      },
      {
        name: 'Find Video Ads',
        media: { kind: 'gif', src: `${ASSETS}/winning_ads_1.gif`, alt: 'A feed of the best-performing video ads' },
        does: () => 'A live feed of the best-performing Facebook video ads right now. Spot a video ad worth copying, then send the video ad to the Video Analyzer & Ad Cloner with 1 click.',
        forBusiness: 'You see which videos already get attention in your market, so you know what to post before you make your next video ad.',
        amount: 'Unlimited',
        value: '$59/mo',
      },
    ],
  },
  {
    title: 'MAKE EVERY VIDEO AD LOOK AND SOUND RIGHT',
    lead: 'Pictures, thumbnails, voices and music, so more people stop and watch your video ad to the end.',
    tools: [
      {
        name: 'Image Maker',
        media: {
          kind: 'slides',
          slides: [
            { from: `${IMAGE_MAKER}/product/bottle.jpg`, to: `${IMAGE_MAKER}/product/result.jpg`, label: 'The same bottle, in a new place' },
            { from: `${IMAGE_MAKER}/combine/bella.jpg`, to: `${IMAGE_MAKER}/combine/result.jpg`, label: 'The baker holds the bottle' },
            { from: `${IMAGE_MAKER}/restage/kitchen.jpg`, to: `${IMAGE_MAKER}/restage/result.jpg`, label: 'A kitchen photo restaged for a listing' },
            { from: null, to: `${IMAGE_MAKER}/poster/result.jpg`, label: 'A bakery poster with every word spelled right' },
          ],
        },
        does: () => "Start from your own product photo. Image Maker puts your product in a new scene, in a person's hands, or on a poster with every word spelled right.",
        forBusiness: 'New pictures of your real product for every post and every video ad, without paying for a photo shoot, so customers see your real product.',
        amount: 'Up to 300 pictures a month',
        value: '$20/mo',
      },
      {
        name: 'Thumbnail Maker',
        media: { kind: 'gif', src: `${ASSETS}/6_thumbnail_1.gif`, alt: 'Thumbnail Maker making a YouTube thumbnail' },
        does: () => 'Paste your video link, a photo or 1 sentence. The AI makes the picture people see before pressing play on YouTube, designed to get the click.',
        forBusiness: 'More people press play on your videos, and every extra view is 1 more person who hears about your business.',
        amount: 'Up to about 50 thumbnails a month',
        value: '$10/mo',
      },
      {
        name: 'Voice',
        media: {
          kind: 'audio',
          tracks: [
            { label: 'Voice 1', src: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/b782d8ba-fcdc-45fa-93b1-c3c7ed752e6f/voice/voice_over_1771596000980_44kox4mme.mp3' },
            { label: 'Voice 2', src: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/b782d8ba-fcdc-45fa-93b1-c3c7ed752e6f/voice/voice_over_1771761823473_zc6anb9vn.mp3' },
            { label: 'Voice 3', src: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/b782d8ba-fcdc-45fa-93b1-c3c7ed752e6f/voice/voice_over_1771761938225_en22k86lo.mp3' },
            { label: 'Voice 4', src: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/b782d8ba-fcdc-45fa-93b1-c3c7ed752e6f/voice/voice_over_1771762021702_47o6wi8i4.mp3' },
          ],
        },
        does: () => 'Type your words and pick 1 of 57 voices with real emotion and emphasis. Or clone your own voice, and every script comes out in your voice.',
        forBusiness: 'Customers hear a clear voice-over on every video ad, in 1 of 57 voices or in your own voice, and you never pay a voice-over artist $200+ per script.',
        amount: 'Up to about 300 voice-overs a month',
        value: '$11/mo',
      },
      {
        name: 'Music',
        media: {
          kind: 'audio',
          tracks: [
            { label: 'Blues', src: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/16_blues.mp3' },
            { label: 'Gospel', src: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/18_gospel.mp3' },
            { label: 'Upbeat', src: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/music-machine_music_3482a18b-9d9f-49a9-be51-1f159bfd20a6_2026-02-03T203830878Z.mp3' },
            { label: 'Piano', src: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/04_piano.mp3' },
          ],
        },
        does: () => 'New music in any style, made for each video ad, with singing or without.',
        forBusiness: 'You stop paying for royalty-free music track by track, and your videos stay safe from copyright strikes on YouTube, because every music track is made for you and owned by you.',
        amount: 'Up to about 100 music tracks a month',
        value: '$10/mo',
      },
    ],
  },
  {
    title: 'MORE WAYS TO GET CUSTOMERS',
    lead: 'A video for every home you list, and a free ebook that gets viewers to leave an email address.',
    tools: [
      {
        name: 'ReelEstate',
        media: { kind: 'video', src: `${SUPABASE}/script-videos/examples/reelestate/automatic/14-birchwood-lane-automatic.mp4`, poster: `${SUPABASE}/script-videos/examples/reelestate/listing/poster-animated.jpg` },
        does: () => 'Paste a listing link from Zillow or Realtor.com. ReelEstate cleans up the listing photos and makes a complete video of the home.',
        forBusiness: 'If you sell homes: a video for every listing the same day, so buyers on Facebook and Instagram see the home while the listing is new, and future sellers see how you market a home.',
        amount: 'Up to about 8 listing videos of 30 seconds a month',
        value: '$24/mo',
      },
      {
        name: 'Ebook Writer',
        media: { kind: 'gif', src: `${ASSETS}/3_Ebook_2.gif`, alt: 'Ebook Writer making an ebook with a cover' },
        does: () => 'A complete ebook with a cover, formatting and pictures, written by the AI, ready to give away or to sell.',
        forBusiness: 'A free ebook to give away in your videos. People leave an email address to get the ebook, so your email list grows and you can send your offers to every person on the list.',
        amount: 'Up to about 8 ebooks a month',
        value: '$20/mo',
      },
    ],
  },
];

export const RESULT_SALES = {
  banner: { strong: 'BREAKING NEWS:', text: 'BlueFX Releases Groundbreaking', off: '94.62% Off', end: 'Limited-Time Offer.' },

  top: {
    title: (name: string) => `Congratulations, ${name}! Your video ad is ready.`,
    sample: 'Your free sample has a SAMPLE stamp. With the AI Media Machine, your video ads come without the stamp.',
    /** The button scrolls to the example video ads right below (owner 2026-10-22), so it names those. */
    seeAll: 'See more examples',
  },

  hero: {
    kicker: 'You just saw what 1 tool of the AI Media Machine can do. Now let me show you all 12 tools you get.',
    pill: 'AI Media Machine',
    /** The sales page's headline and sub headline, word for word, 2 lines (owner 2026-10-22: "those words are not accidental"). */
    titleLine1: 'Could This Be the Best Deal',
    titleStart: 'in the Era of ',
    titleMark: 'AI Video',
    titleEnd: '?',
    subStart: 'For the first time ever, you can ',
    subStrong: 'access over $5,520.00-a-year worth of our best AI video tools',
    subEnd: ', including the AI that made your video ad, for a minuscule fraction of the normal price...',
    note: 'The video ads play by themselves, silent, like on the sales page. Tap any video ad to hear it.',
  },

  salesVideo: {
    title: 'Watch this video before you sign up:',
    /** The sales page's current video until the new sales video is made (owner 2026-10-22). */
    vimeo: '1217606653',
    caption: 'Szilard Gyorfi, founder of BlueFX, shows the AI Media Machine.',
    /** The owner's real photo in the video's purple studio (2026-10-22), no text; the play button in its purple. */
    poster: '/free-video/sales-video-poster.jpg',
    play: 'Play the video: Szilard shows the AI Media Machine',
  },

  price: {
    /**
     * Ogilvy's refinement of Kennedy's Version 1 (owner 2026-10-22, after Halbert, Hormozi and Kennedy: the birthday was
     * on the page 7 times and made it about the owner). The birthday is said once, here, as the reason for the sale;
     * everywhere else it is the reader's own sale price. Every line stays true for a reader who returns to a fresh timer.
     */
    title: 'Lifetime access to the AI Media Machine, on sale for a short time',
    reason: "Why the sale? I just turned 40, and I only turn 40 once, so I'm celebrating with a sale that runs for a short time.",
    timer: 'Your sale price ends in',
    /** While the 3-day bonus runs, 1 deadline for both (Krug). */
    timerBonus: 'Your sale price and both bonuses end in',
    regular: 'Regular price:',
    birthday: 'Your sale price:',
    line: `One payment, no monthly fee. All 12 tools are yours for life, and your account refills with ${MONTH} complete video ads every month.`,
  },

  button: {
    main: 'Yes! I Want the AI Media Machine',
    price: `${OFFER.now} once, for life`,
    tools: 'Yes! I Want All 12 Tools',
    bar: `Get the AI Media Machine · ${OFFER.now}`,
    guarantee: '30-day money-back guarantee. Your login arrives by email.',
    written: 'Your next 3 video ads are already made and waiting inside.',
    cards: 'Pay with Visa, Mastercard, American Express, Discover or PayPal',
  },

  bonus: {
    title: (domain: string) => `Plus, for ${domain}: your next 3 video ads, already made`,
    text: (domain: string, day: string | null) =>
      `Video ads #2, #3 and #4 for ${domain} wait inside the AI Media Machine, the AI that made your free sample. Get the AI Media Machine ${day ? `by ${day}` : 'while your bonus runs'}, and each video ad is ready to post about 3 minutes after your click.`,
    items: [
      { label: 'Bonus 1 (ends with the timer):', text: 'your free video ad, without the SAMPLE stamp ($200 value: what a freelancer charges for 1 video ad like yours)' },
      { label: 'Bonus 2 (ends with the timer):', text: `your next 3 video ads, already made and ready with one click, on top of your ${MONTH} video ads a month ($600 value)` },
    ],
    timer: 'Your 2 free bonuses end in',
  },

  how: {
    title: "Here's how the AI Media Machine gets you more customers. You already did the first 2 steps.",
    result: (domain: string) => `THE RESULT: New customers see your video ad and come to ${domain}`,
    resultText: `Every month, the AI Media Machine makes ${MONTH} more video ads for you, so more new customers come to you.`,
    scrollTitle: 'Your customers are scrolling right now',
    scrollText:
      'How did you find the AI Media Machine? Probably through a video on Facebook or YouTube. Your customers are there too, over 2½ hours a day. When your business posts a new video every 3 days, your customers see your business, your products and your website, again and again.',
    leads: 'Our own videos brought BlueFX 222,712 leads since 2013.',
    leadsImage: '/free-video/leadpages-count.jpg',
    leadsAlt: 'Our Leadpages dashboard showing 222,712 leads',
  },

  tools: {
    kicker: 'THE TOOLS',
    title: "Here's Everything You're Getting For 94.62% Off!",
    titleStart: "Here's Everything You're Getting For ",
    titleMark: '94.62% Off!',
    lead: (domain: string) =>
      `Phantom Ad Maker made your video ad for ${domain}. Here are all 12 tools, with what each tool makes for your business and what the same job rents for elsewhere. One payment gets you all 12 tools.`,
    /** Said once here instead of under every demo (Krug). */
    note: 'Every demo below is real output from the AI Media Machine, not edited.',
    forBusiness: 'For your business:',
    value: 'Real-World Value:',
    elsewhere: 'elsewhere',
    included: '✓ Included',
    proof: (tool: string) => `Real output from ${tool}, not edited.`,
    yourPhoto: 'Your photo',
    play: (label: string) => `Play ${label}`,
    alsoIncluded: 'Also included: Logo Maker and Script Generator.',
  },

  oldWay: {
    kicker: 'THE DIFFERENCE',
    title: 'The old way is slow, expensive and full of guesswork. The AI Media Machine is the shortcut.',
    intro: 'Most business owners get video ads the hard way. Hire a freelancer. Wait days. Spend hundreds of dollars.',
    image: '/free-video/old-new-way.jpg',
    alt: 'Drawing: a stressed business owner at a desk full of papers, then the same owner smiling with a phone while customers walk in',
    oldTitle: 'The old way',
    old: [
      'Hire a video editor for $100+ an hour and wait days for 1 video',
      'Guess what to say and show in your video ad, and hope customers watch',
      'Pay a voice-over artist $200+ per script and hope the tone is right',
      'Spend $50 to $100 per thumbnail with a graphic designer',
    ],
    newTitle: 'The AI Media Machine',
    new: [
      'Type your website and get a finished video ad, with the script, presenter, voice-over and music',
      'Start from a video that already works for another business',
      'The AI breaks down the hook, the script and every shot, then rebuilds the video ad with your product',
      `${MONTH} complete video ads every month, for life`,
    ],
    costTitle: `What ${YEAR} video ads a year cost you`,
    freelancer: { name: 'HIRE A FREELANCER', line1: `$${FREELANCER} for each video ad`, line2: `× ${YEAR} video ads a year`, price: `= ${FREELANCER_YEAR}`, per: 'every year' },
    machine: { name: 'THE AI MEDIA MACHINE', line1: `${MONTH} video ads a month`, line2: `= ${YEAR} video ads a year`, price: `= ${OFFER.now}`, per: 'once, for life' },
    after: (domain: string) => `${YEAR} video ads a year means ${YEAR} chances for new customers to find ${domain}.`,
  },

  customers: {
    kicker: 'WHAT CUSTOMERS SAY',
    title: 'BlueFX customers, in their own words',
    lead: "I've been building BlueFX since 2008, for more than 36,000 customers. Here are a few of those customers.",
  },

  founder: {
    kicker: 'THE FOUNDER',
    title: 'I spent $60K of my own money on video ads to figure out what actually brings in customers. Then I built the AI Media Machine.',
    name: 'Szilard Gyorfi',
    role: 'Founder of BlueFX (est. 2008) & AI Media Machine',
    photo: '/free-video/owner.jpg',
    text: [
      "I'm Szilard Gyorfi. I've been building BlueFX since 2008, from a one-man video template shop into a business that's served 36,000+ customers worldwide.",
      "I've made 700+ videos for customers by hand, and each video took days, sometimes weeks.",
      "2 years ago I moved all my video work to AI. A video that used to take me a week now takes minutes. And now I'm giving you the AI Media Machine I use every day, the same AI Media Machine that made your video ad.",
    ],
    /** 4, so none sits alone on a row (Krug). */
    stats: ['18 Years Building BlueFX', '$60K+ Spent Testing Video Ads', '777 YouTube Videos', '36K+ Customers Served'],
  },

  lifetime: {
    title: 'Why lifetime? And why only during this window',
    /** The owner's bold openings (his hand edit on board J). */
    paragraphs: [
      { lead: '', text: 'Let me be straight with you.' },
      { lead: '', text: "Bought separately, the 12 tools inside the AI Media Machine would cost you $460 a month, every month. Miss a payment, and you lose the tools. I know you're tired of monthly fees. Everybody is." },
      { lead: 'So lifetime access', text: ` works differently: pay once, and the AI Media Machine is yours forever. Lifetime access sells for ${OFFER.was}. One payment instead of $5,520 every year.` },
      { lead: 'Is this for real?', text: ` Yes. One payment of ${OFFER.now} gets you the full AI Media Machine: all 12 tools, everything you see on this page, every update we ship in the future, and ${MONTH} complete video ads like yours every month, for life.` },
      { lead: `Why ${OFFER.now} and not ${OFFER.was}?`, text: ` ${OFFER.now} is your sale price until the timer hits zero.` },
      { lead: "What's the catch?", text: ` The timer. Your sale price of ${OFFER.now} lasts until the timer on this page hits zero. The regular price of lifetime access is ${OFFER.was}.` },
    ],
  },

  own: {
    title: "Here's everything you own after one payment",
    lead: 'Each price below is what a tool that does the same job rents for elsewhere, every month.',
    image: '/free-video/aimm-product.jpg',
    imageAlt: 'All 12 tools of the AI Media Machine',
    rows: [
      { text: `${MONTH} complete video ads like yours, every month, for life`, value: 'included' },
      { text: 'Phantom Ad Maker, the tool that made your video ad', value: '$100/mo' },
      { text: 'Video Clip Maker, any short video ad, up to 4K', value: '$59/mo' },
      { text: 'AI Avatar, 246 presenters', value: '$29/mo' },
      { text: 'Video Swap', value: '$19/mo' },
      { text: 'Video Analyzer & Ad Cloner', value: '$99/mo' },
      { text: 'Find Video Ads', value: '$59/mo' },
      { text: 'Image Maker', value: '$20/mo' },
      { text: 'Thumbnail Maker', value: '$10/mo' },
      { text: 'Voice, 57 pro voices + your own cloned voice', value: '$11/mo' },
      { text: 'Music', value: '$10/mo' },
      { text: 'ReelEstate', value: '$24/mo' },
      { text: 'Ebook Writer', value: '$20/mo' },
      { text: 'All future updates', value: 'included' },
    ],
    bonusRows: [
      { label: 'BONUS 1 (ends with the timer)', text: 'your free video ad, without the SAMPLE stamp', value: '$200 value' },
      { label: 'BONUS 2 (ends with the timer)', text: (domain: string) => `your next 3 video ads for ${domain}, already made`, value: '$600 value' },
    ],
    total: 'Total Value:',
    totalValue: '$5,520 Per Year',
    lifetime: 'Lifetime Access:',
    birthday: 'Your Sale Price:',
    grab: 'Grab Lifetime Access Today And Get',
    off: '94.62% OFF!',
    recharge: 'Busy month? Add a one-time recharge pack: $24.99 gives you 300 more credits, enough for 5 more complete video ads. Packs start at $9.99.',
    bonusEnds: (when: string) => `Your 2 free bonuses end ${when}: your video ad without the SAMPLE stamp, and your next 3 video ads.`,
    source: 'Where these prices come from: each value is the monthly price of a well-known online tool that does the same job, checked October 2026.',
  },

  guarantee: {
    title: 'My 30-day money-back guarantee',
    name: 'Szilard Gyorfi, founder of BlueFX',
    text: [
      "Make video ads with the AI Media Machine for 30 days. If you're not happy, email me at support@bluefx.net and I'll refund every cent.",
      'Download your video ads, your 3 bonus video ads included. Every video ad you download stays yours, even after a refund.',
      "You pay once, so there's no subscription to cancel.",
      'You risk nothing. I risk my reputation built over 18 years and 36,000 customers.',
    ],
    /** The 3 bonus video ads exist only while the bonus runs. */
    textNoBonus: 'Download your video ads. Every video ad you download stays yours, even after a refund.',
    signature: 'Szilard',
  },

  still: {
    title: 'Still thinking about the AI Media Machine?',
    text: [
      `Right now, other businesses in your market post videos on YouTube, Instagram, Facebook and TikTok every day, and customers see those businesses first. With the AI Media Machine, your business posts a new video every 3 days too: ${MONTH} complete video ads every month, for life.`,
      `Your sale price of ${OFFER.now} runs until the timer on this page hits zero. Lifetime access regularly sells for ${OFFER.was}.`,
    ],
  },

  faq: {
    title: 'Questions',
    items: [
      {
        q: 'Is the AI Media Machine a monthly subscription?',
        a: [`No. You pay ${OFFER.now} once, and there's no monthly fee. Every month, for life, your account refills with ${MONTH} new video ads like yours. You also have 30 days to get your money back.`],
      },
      {
        q: 'How many video ads can I make, and do the other 11 tools cost extra?',
        a: [
          `You get ${MONTH} complete video ads like yours every month, for life, and the other 11 tools come with no extra payment.`,
          `Every month your account gets 600 credits, and all 12 tools use the same 600 credits. Put all 600 credits into video ads, and you get ${MONTH} complete video ads. Or mix: 8 complete video ads plus 60 pictures also uses 600 credits. Find Video Ads uses no credits at all.`,
          'Busy month? Add a one-time recharge pack: $24.99 gives you 300 more credits, enough for 5 more complete video ads. Packs start at $9.99.',
        ],
      },
      {
        q: 'Will video ads and social media videos bring me more customers?',
        a: [
          'Your customers spend over 2½ hours a day on YouTube, Instagram, Facebook and TikTok. A business that posts a new video every 3 days shows up there again and again, with the business name, the products and the website in every video. When a customer needs what you sell, your business is the name the customer remembers. Our own videos brought BlueFX 222,712 leads since 2013.',
        ],
      },
      {
        q: 'What can I change in my video ad?',
        a: [
          'Anything. The words, a typo from your website, the presenter (1 of 246 presenters, or your own photo), the voice and accent (1 of 57 voices, or your own cloned voice), the music, the photos, your logo and your own clips. Type what you want changed, and the new version of your video ad is ready in about 3 minutes.',
        ],
      },
      {
        q: 'Can I make video ads for my clients?',
        a: ['Yes, at no extra cost. Videos you make in the AI Media Machine come out without our BlueFX logo, and each video downloads to your computer as an MP4 file, ready to hand to your client.'],
      },
      {
        q: 'Can I make video ads without a website?',
        a: [
          'Yes. The AI Media Machine makes video ads from the link to your business on Google Maps, or from a few lines you type about your business and your photos. Your product and home listings on Amazon, TikTok Shop, Zillow and Realtor.com work too.',
        ],
      },
      {
        q: 'Can I make other kinds of video ads?',
        a: [
          'Yes. Pick a look for each video ad: playful, elegant, bold, clean or whiteboard. Or let the AI Media Machine pick the best match for your business, with or without an AI presenter. And Video Clip Maker makes any kind of short video ad from 1 photo or 1 idea.',
        ],
      },
      {
        q: 'Do I need to be technical?',
        a: [
          'No. If you can paste a link and click a button, you can make video ads with the AI Media Machine. The AI writes the script and makes the voice-over, the pictures and the music. The AI Media Machine runs in your browser, with nothing to install.',
        ],
      },
      {
        q: 'Do I have to use all 12 tools?',
        a: [
          'No. Start with Phantom Ad Maker, the tool that made your video ad: type your website, and Phantom Ad Maker makes your next video ad. Open the other 11 tools when your business needs a new kind of video ad, a voice-over, music or an ebook. The 17-minute walkthrough below shows all 12 tools.',
        ],
      },
    ],
  },

  ps: {
    p1: (name: string, domain: string) =>
      `${name}, your video ad for ${domain} is a free sample. Your free sample might not be perfect, might need a few changes, and carries a SAMPLE stamp with bluefx.net.`,
    p2: `With the AI Media Machine, you type any change and get the new version of your video ad in about 3 minutes, without the stamp. You also get all 12 tools and ${MONTH} complete video ads every month, for life.`,
    p3: `Your sale price is ${OFFER.now} instead of ${OFFER.was}, and you have 30 days to get every cent back. Get the AI Media Machine before the timer hits zero.`,
    bonus: (domain: string, when: string | null) =>
      `And your next 3 video ads for ${domain} are already made. Get the AI Media Machine ${when ? `by ${when}` : 'while your bonus runs'}, and each video ad is ready to post about 3 minutes after your click.`,
    /** The key words in bold. */
    bold: ['free sample', 'in about 3 minutes', 'all 12 tools', `${MONTH} complete video ads every month, for life`, `${OFFER.now} instead of ${OFFER.was}`, '30 days to get every cent back', 'already made', `about ${FREELANCER_YEAR}`, `you pay ${OFFER.now}, once`],
    pps: (domain: string) =>
      `Here's the math. A freelancer charges about $${FREELANCER} for 1 video ad like yours, so ${YEAR} video ads a year cost about ${FREELANCER_YEAR}. With the AI Media Machine, you pay ${OFFER.now}, once. Every video ad is one more chance for new customers to find ${domain}.`,
  },
} as const;
