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
import { BANK_CREDITS, BANK_VIDEO_ADS, OFFER, PRICE_PER_BANK_VIDEO_AD, VIDEO_ADS_LIKE_FREE_PER_MONTH } from './offer';
import { PHANTOM_CREDITS } from '@/lib/smart-video/pricing';

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
const VIDEO_SWAP_LOOK = 'horizontal' as 'vertical' | 'horizontal';

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

  /**
   * The looks a buyer can pick in the Phantom's "Change style" gallery (make-video-ad.tsx STYLES), right under their own
   * video ad (owner 2026-10-27 picked this spot, small). Same 7-second loops as the gallery (public/smart-video/looks),
   * so the page shows exactly what the app offers.
   */
  styles: {
    title: 'With the AI Media Machine, choose from 8 video styles.',
    more: 'New styles added every month.',
    yours: 'Your free video ad',
    items: [
      { id: 'whiteboard', label: 'Hand-drawn' },
      { id: 'vintage', label: 'Vintage TV' },
      { id: 'news', label: 'News studio' },
      { id: 'cartoon', label: 'Cartoon' },
      { id: 'comic', label: 'Comic book' },
      { id: 'chalkboard', label: 'Chalkboard' },
      { id: 'scrapbook', label: 'Scrapbook' },
      { id: 'clay', label: 'Clay' },
    ],
  },

  top: {
    title: (name: string) => `Congratulations, ${name}! Your video ad is ready.`,
    /** Who the AI Media Machine is for, in a lead's own words (owner 2026-10-26: "business owners who have to run everything themselves"). Above the video ad. */
    forWho: 'The AI Media Machine is built for business owners who run everything themselves.',
    /** The second reason to buy, from a lead's reply ("use it on other peoples websites and I sell the video to them"). Under the video ad. */
    resell: 'Make video ads for your own business, or for other businesses and sell the video ads to them.',
    sample: 'Your free sample has a SAMPLE stamp. With the AI Media Machine, your video ads come without the stamp.',
    /** The button scrolls to the example video ads right below (owner 2026-10-22), so it names those. */
    seeAll: 'See more examples',
    /** The owner's tutorial, under their video ad (owner 2026-10-23: "at the top, just under the result that they made"). */
    tutorial: {
      youtubeId: 'pgBrSmI1cOE',
      label: 'Change anything in your video ad: here is how',
      text: '11 minutes, real example, no editing skills needed. You make the changes inside the AI Media Machine.',
      /** Jump links into the tutorial (seconds), from the owner's own script (2026-10-23). */
      chapters: [
        { at: 174, label: 'A new person on camera' },
        { at: 288, label: 'Put yourself on camera' },
        { at: 327, label: 'Change the music' },
        { at: 387, label: 'Change the voice' },
        { at: 433, label: 'Your 3 extra video ads' },
      ],
      jump: 'Jump to:',
    },
    /**
     * The big button right under their video ad (owner 2026-10-24: "If people want to change stuff, it should be much
     * more prominent"; Clarity showed taps on the sample line and the next-ad pictures, and few tutorial plays). Opens
     * the short cut when quick is set, else the tutorial at "A new person on camera".
     */
    change: {
      label: 'Change Your Video Ad: Watch How',
      at: 174,
      /**
       * The short cut of the tutorial we host (2026-10-24: the owner's 11-minute tutorial cut to the 4 changes, step
       * titles, captions and a 4.5 s end card "You make these changes inside the AI Media Machine. Tap the button below
       * to get the AI Media Machine. 30-day money-back guarantee."); its length goes on the button. null: the button
       * opens the full tutorial at `at`.
       */
      quick: {
        src: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/free-video/tutorial/edit-2min-v1.mp4',
        poster: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/free-video/tutorial/edit-2min-v1-poster.jpg',
        minutes: 2,
      } as { src: string; poster: string; minutes: number } | null,
      /** Under the buy button once the short cut has ended. */
      again: 'Watch again',
    },
    /** A tap on a picture of the next 3 video ads opens the tutorial at "Your 3 extra video ads". */
    nextAd: { at: 433, label: 'See how', aria: 'See how your next 3 video ads are made' },
  },

  /**
   * The walkthrough near the end of the page: the owner's edit tutorial instead of the 17-minute tour (owner 2026-10-23:
   * "replace the tut at the bottom too"). Chapters from his own script. The classic page and the walkthrough email keep
   * the 17-minute tour.
   */
  walkthroughVideo: {
    anchor: 'walkthrough',
    /** Owner 2026-11-02: the new Phantom Ad Maker tutorial (YouTube PSfn9Au02JY, 14:53), chapters from its YouTube chapters. */
    youtubeId: 'PSfn9Au02JY',
    poster: 'https://i.ytimg.com/vi/PSfn9Au02JY/maxresdefault.jpg',
    title: 'Watch me use the AI Media Machine on my own screen',
    lead: '15 minutes: I type a website and get a finished video ad, change it with my own face and logo, then make a News studio video ad from a few lines.',
    playLabel: 'Play the 15 minute walkthrough',
    chapters: [
      { label: 'Pick a style', at: 98 },
      { label: 'Paste your website', at: 270 },
      { label: 'Your finished video ad', at: 328 },
      { label: 'Make a change', at: 379 },
      { label: 'A video ad from a few lines', at: 687 },
    ],
    length: '14:53',
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
    /** Kennedy review 2026-11-02 (owner "oki"): no heading here; the birthday line leads into the timer. */
    title: '',
    reason: "Why the sale? I just turned 40, and I only turn 40 once, so I'm celebrating with a sale that runs for a short time.",
    timer: 'Your sale price ends in',
    /** While the 3-day bonus runs, 1 deadline for both (Krug). */
    timerBonus: 'Your sale price and both bonuses end in',
    regular: 'Regular price:',
    birthday: 'Your sale price:',
    /** The monthly-fee objection, answered at the price (owner 2026-10-26: leads wrote "$99 is not in my business budget monthly"). */
    payOnce: 'One payment. Absolutely no monthly fees.',
    line: `All 12 tools are yours for life, and your account refills with ${MONTH} complete video ads every month.`,
  },

  button: {
    main: 'Yes! I Want the AI Media Machine',
    price: `${OFFER.now} once, for life`,
    tools: 'Yes! I Want All 12 Tools',
    bar: `Get the AI Media Machine · ${OFFER.now}`,
    /** Under every Yes button (owner 2026-10-26): the website, or the buyer's own script, photos and videos. */
    typeLine: "Type your website, or bring your own script, photos and videos. That's it.",
    guarantee: '30-day money-back guarantee. Your login arrives by email.',
    written: 'Your next 3 video ads are already made and waiting inside.',
    cards: 'Pay with Visa, Mastercard, American Express, Discover or PayPal',
    /**
     * The 3 x $100 option (owner 2026-10-23 after price objections; wording merged from Ogilvy, Hormozi, Kennedy and
     * Halbert: an underlined link, never a second button; $297 stays "the lowest-cost option"; the schedule spelled out).
     * The price box shows all 3 lines, every other button the short link.
     */
    splitLowest: 'Paying once is the lowest-cost option.',
    splitLink: 'Or split it into 3 payments of $100',
    splitSchedule: '$100 today, $100 in 30 days, $100 in 60 days. $300 total. All 12 tools from day 1.',
    splitShort: 'Or pay in 3 parts: $100 today, in 30 days and in 60 days',
  },

  /** Right after the price box (owner 2026-10-26: "VERY important"): video ads for other businesses, sold by the buyer. */
  resell: {
    title: "Use the AI Media Machine on other people's websites and sell the video ads to them.",
    text: `Type any business's website, and the AI Media Machine makes a video ad for that business. Your account makes ${MONTH} complete video ads every month, for your business or for theirs.`,
    proof: 'One of our buyers, a marketing agency owner in California, already makes video ads for 7 client websites with his account.',
    /** Owner 2026-10-26: "10 videos, but what if I get 20 videos?" The 1,000-credit pack (buy-credits-dialog.tsx) at 60 credits per video ad like the free one. */
    more: `Need more than ${MONTH} a month for your clients? Add a credit pack any time: 1,000 credits ($69.99) make about ${Math.floor(1000 / 60)} more video ads, with nothing recurring.`,
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
    /** The line above the tool list that says what the amounts mean; the bank copy only (RESULT_SALES_BANK). */
    amountsNote: null as string | null,
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
    stats: [
      { big: '18', small: 'years building BlueFX' },
      { big: '$60K+', small: 'spent testing video ads' },
      { big: '777', small: 'YouTube videos' },
      { big: '36K+', small: 'customers served' },
    ],
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
      { lead: "What's the catch?", text: ` The timer. I turned 40, and this birthday sale ends when the timer on this page hits zero. Then lifetime access goes back to ${OFFER.was}.` },
    ],
  },

  own: {
    title: "Here's everything you own after one payment",
    lead: 'Each price below is what a tool that does the same job rents for elsewhere, every month.',
    image: '/free-video/aimm-product.jpg',
    imageAlt: 'All 12 tools of the AI Media Machine',
    rows: [
      { text: `${MONTH} complete video ads like yours, every month, for life`, value: `$${FREELANCER * MONTH}/mo` },
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
        a: [`No. You pay ${OFFER.now} once, and there are absolutely no monthly fees. Every month, for life, your account refills with ${MONTH} new video ads like yours. You also have 30 days to get your money back.`],
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
          'Yes. Pick a style for each video ad: hand-drawn, vintage TV, news studio, cartoon, comic book, chalkboard, scrapbook, clay and more, with new styles added every month. Or let the AI Media Machine pick the best match for your business, with or without an AI presenter. And Video Clip Maker makes any kind of short video ad from 1 photo or 1 idea.',
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
          'No. Start with Phantom Ad Maker, the tool that made your video ad: type your website, and Phantom Ad Maker makes your next video ad. Open the other 11 tools when your business needs a new kind of video ad, a voice-over, music or an ebook. The 15-minute walkthrough above shows Phantom Ad Maker step by step.',
        ],
      },
    ],
  },

  /**
   * The same sales page on the $49 thank-you page (owner 2026-10-28: "the upsell for the $49 offer should be the AI
   * Media Machine", replacing the Weekly Video Plan). Their video ad is already above, so the page starts with this
   * headline instead of the video ad block. The headline is a placeholder: the owner will write the final one.
   */
  /**
   * The top of the free thank-you page, modeled on the $297 upsell (owner 2026-11-02: "so much unnecessary bulk of
   * text, tiring to read. instead the changer, and the headline with 100 video ads sort of thing"): the headline with a
   * red part, one line under it, and the $49 page's change chat with one free change made by the AI engine (the SAMPLE
   * stamp stays). The big "Best Deal" headline and the $5,520 line stay below as the anchor (owner: no $49 paid here).
   */
  freeTop: {
    /** Owner 2026-11-02: the first sentence on top, the changer, then the offer question and the line under it below the changer. */
    title: (name: string) => `${name}, the AI Media Machine just made your first video ad.`,
    offerParts: ['What if you could make ', `${MONTH} more every month, for life`, '?'] as const,
    /** Owner 2026-11-02: "why so many?" is answered right where the number first shows. */
    why: "That's a new video ad every 3 days, so more customers find your business and call you first.",
    sub: 'One payment. Absolutely no monthly fees.',
    /** Under the change chat (owner 2026-11-02): the free video ad is a sample; the full version is for real use, without the stamp. */
    sample: {
      title: 'Your free video ad is a sample.',
      text: 'The full version comes without the SAMPLE stamp and with a commercial license, so you can post your video ad for your business, or sell video ads to your clients.',
      price: `You get the full version of this video ad, plus ${MONTH} new video ads every month, for ${OFFER.now}, one time.`,
      button: 'Get the Full Version',
    },
    /** The button under the offer (the owner's words on the offer card, OFFER_CARD.seeAll); it scrolls to the price box. */
    seeAll: 'See Everything You Get',
    tryLine: 'Try your first change free',
    chat: {
      title: 'What would you like changed?',
      note: 'Your first change is free.',
      hello: '',
      ideas: [
        { label: 'Add my phone number', ask: 'Please add my phone number.' },
        { label: 'A different person', ask: "I'd like a different person on camera." },
        { label: 'Change the wording', ask: "I'd like to change some of the wording." },
        { label: 'Other music or voice', ask: "I'd like other music or a different voice." },
        { label: 'Your offer or your prices', ask: "I'd like to change the offer or the prices." },
      ],
      thinking: 'Typing...',
      listTitle: 'Your changes:',
      listNote: 'Tap the green button, and our AI engine makes these changes right here, free, in about 5 minutes.',
      placeholder: 'Type your change here',
      send: 'Send',
      limit: 'You sent a lot of messages today. Please email your changes to support@bluefx.net.',
      error: 'Sorry, my answer did not come through. Please try again, or email support@bluefx.net.',
    },
    free: {
      note: 'Our AI engine makes these changes right now, free, in about 5 minutes. Your video ad keeps the SAMPLE stamp.',
      button: 'See My Changes Free',
      starting: 'Starting...',
      failed: 'Sorry, that change did not work this time. Please try again.',
      refusals: {
        style: 'A whole new video style comes with the AI Media Machine, where you pick any of the 8 styles. Try a different change for free.',
        used: 'Your free change is already made. With the AI Media Machine, you make every next change yourself in about 3 minutes.',
        noList: 'Tell me your change in the chat first.',
        notReady: 'Your video ad is not ready yet. Please try again in a minute.',
        paid: 'Your video ad is already yours.',
      },
      orBuy: 'Or get the AI Media Machine and change anything yourself',
      working: 'Making your changes...',
      workingNote: 'About 5 minutes. Keep this page open: your new video ad shows up right here.',
      doneKicker: 'Your change is in',
      before: 'Before',
      after: 'After',
      // Owner 2026-11-04 (Shannon): after the free change the box still said "Your first change is free" and ticked her
      // new request as if made. Now it says the free change is used and what the next change takes.
      doneHead: 'Your free change is done. Watch the After version.',
      madeTitle: 'Made for free:',
      nextTitle: 'Your next change:',
      doneNote: 'Want more changes? With the AI Media Machine, you make every next change yourself, typed just like here, in about 3 minutes, without the SAMPLE stamp.',
      doneButton: 'Get the AI Media Machine',
      nextNote: 'Your free change is used. With the AI Media Machine, you make this change yourself, typed just like here, in about 3 minutes, without the SAMPLE stamp.',
      nextButton: 'Get the AI Media Machine and Make This Change',
      /** The chat's answer once the free change is used (a fixed line: the AI promised changes that never ran). */
      usedReply: "Noted. Your free change is already used, so this one you make yourself in the AI Media Machine: type it there just like here, and it's done in about 3 minutes.",
    },
  },
  afterUnlock: {
    /** Owner 2026-10-28 ("10 is much more palatable" than 120 a year); the price moved to the line under it on the copy expert's advice. */
    /** Owner 2026-10-28 picked the shorter version (10 a month, not 120 a year; the price on the line under it). */
    title: (name: string) => `${name}, the AI Media Machine made your video ad. What if you could make ${MONTH} more every month, for life?`,
    /** Owner 2026-10-29: "the headline needs a bit of red on some words plus an arrow": the same headline in 3 parts, the middle one red. */
    titleParts: (name: string) => [`${name}, the AI Media Machine made your video ad. What if you could make `, `${MONTH} more every month, for life`, '?'] as const,
    /** All 3 experts (Ogilvy, Hormozi, Kennedy, 2026-10-28): no $297 at the top, someone who just paid $49 compares the two first. */
    sub: 'One payment. Absolutely no monthly fees.',
    /** Owner OK'd the panel's changes for THIS page only (2026-10-28): lines written for a stranger, said for a buyer. */
    salesVideoTitle: 'Watch me open all 12 tools:',
    priceReason: 'Why $297? Because you already bought from me today.',
    step3: { title: 'You post your video ad where your customers scroll', text: 'On Facebook, Instagram, YouTube and TikTok.' },
    scrollText:
      'How did you find me? Probably through a video on Facebook or YouTube. Your customers are there too, over 2½ hours a day. When your business posts a new video every 3 days, your customers see your business, your products and your website, again and again.',
    /** The P.S. lines that talk about a free sample with a SAMPLE stamp, said right for someone who just bought the clean video ad. */
    /**
     * Once their timer has run out (owner 2026-10-28: "the timer gone, and just say your sale price or limited-time
     * offer"): the lines that point at the timer, said without it. The timer here runs once per browser, it never restarts.
     */
    noTimer: {
      why: ` ${OFFER.now} is your sale price, a limited-time offer.`,
      catch: ` None. ${OFFER.now} is a limited-time offer. The regular price of lifetime access is ${OFFER.was}.`,
      still: `Your sale price of ${OFFER.now} is a limited-time offer. Lifetime access regularly sells for ${OFFER.was}.`,
      ps3: `Your sale price is ${OFFER.now} instead of ${OFFER.was}, a limited-time offer, with a 30-day money-back guarantee. Get the AI Media Machine before the offer expires.`,
    },
    /** P.S. line 3 while the timer runs (owner 2026-10-28: "every cent back" reads like an invite to refund; say "money-back guarantee"). */
    ps3: `Your sale price is ${OFFER.now} instead of ${OFFER.was}, with a 30-day money-back guarantee. Get the AI Media Machine before the offer expires.`,
    /** Hormozi's P.S., refined (owner 2026-10-28). */
    ps1: (name: string, domain: string) => `${name}, your $49 video ad for ${domain} is yours to keep. With the AI Media Machine, your next ${MONTH} video ads are included every month, for life.`,
    ps2: 'You make them yourself, type any change and get the new version in about 3 minutes, and all 12 tools are yours.',
  },

  ps: {
    p1: (name: string, domain: string) =>
      `${name}, your video ad for ${domain} is a free sample. Your free sample might not be perfect, might need a few changes, and carries a SAMPLE stamp with bluefx.net.`,
    p2: `With the AI Media Machine, you type any change and get the new version of your video ad in about 3 minutes, without the stamp. You also get all 12 tools and ${MONTH} complete video ads every month, for life.`,
    p3: `Your sale price is ${OFFER.now} instead of ${OFFER.was}, and you have 30 days to get every cent back. Get the AI Media Machine before the timer hits zero.`,
    bonus: (domain: string, when: string | null) =>
      `And your next 3 video ads for ${domain} are already made. Get the AI Media Machine ${when ? `by ${when}` : 'while your bonus runs'}, and each video ad is ready to post about 3 minutes after your click.`,
    /** No bold words in the P.S. (owner 2026-10-22: "just awful"); only P.S. and P.P.S. are bold. */
    bold: [] as string[],
    pps: (domain: string) =>
      `Here's the math. A freelancer charges about $${FREELANCER} for 1 video ad like yours, so ${YEAR} video ads a year cost about ${FREELANCER_YEAR}. With the AI Media Machine, you pay ${OFFER.now}, once. Every video ad is one more chance for new customers to find ${domain}.`,
  },
} as const;

// ---------------------------------------------------------------------------------------------------------------
// The credit bank copy (owner-approved 2026-11-02): new lifetime buyers get 5,000 credits once that never expire, so
// "10 complete video ads every month, for life" becomes "100 complete video ads, ready whenever you need them". Shown
// only once the bank is launched (FreeVideoView.bankCopy, credit-bank-launch.ts); until then the pages show
// RESULT_SALES and TOOL_GROUPS above, unchanged. The software itself stays "for life" (the buttons keep
// "$297 once, for life"). Rules: never "credits" in a headline, "video ad(s)" by name, never "unlimited" for video ads.

/** The same shape as RESULT_SALES with plain strings, so the bank copy can say other words. */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends (...args: infer A) => infer R
        ? (...args: A) => Widen<R>
        : T extends readonly (infer U)[]
          ? readonly Widen<U>[]
          : T extends object
          ? { readonly [K in keyof T]: Widen<T[K]> }
          : T;
export type SalesCopy = Widen<typeof RESULT_SALES>;

const BANK = BANK_VIDEO_ADS;
const BANK_CREDITS_TEXT = BANK_CREDITS.toLocaleString('en-US');
const FREELANCER_BANK = `$${(FREELANCER * BANK).toLocaleString('en-US')}`;
const READY = 'ready whenever you need them';
/** Image Maker's cheapest picture (1K, actions/tools/image-maker.ts CREDIT_COST): the FAQ's mix. */
const PICTURE_CREDITS = 2;
const MIX_ADS = 80;
const MIX_PICTURES = (BANK_CREDITS - MIX_ADS * PHANTOM_CREDITS) / PICTURE_CREDITS;

/**
 * What 5,000 credits make in each tool on its own, from the prices in the code on 2026-11-02 (rounded down):
 * Phantom 50 a video ad; Video Clip Maker 12 a 6-second Fast clip (2/s, the default); AI Avatar 40 a 20-second Fast
 * video (2/s); Video Swap 8 a second; Video Analyzer 6 a link, a cloned video ad about 304 (6 scenes of 5 seconds);
 * Image Maker 2 a 1K picture; Thumbnail Maker 10; Voice 3 per started 1,000 characters; Music 6 a track; ReelEstate
 * at most 129 for a 30-second listing video (25 + 7 clips at 2 a clip second); Ebook Writer 79 as the page quotes it.
 */
const BANK_TOOLS: Record<string, { amount: string; forBusiness?: string }> = {
  'Phantom Ad Maker': {
    amount: `${BANK} complete video ads`,
    forBusiness: `${BANK} new video ads to post on YouTube, Instagram, Facebook and TikTok: 2 new video ads every week for a full year.`,
  },
  'Video Clip Maker': { amount: 'Up to about 400 short clips' },
  'AI Avatar': { amount: 'Up to about 125 talking videos' },
  'Video Swap': { amount: 'Up to about 625 seconds of video' },
  'Video Analyzer & Ad Cloner': { amount: 'Up to about 800 video analyses, or about 16 cloned video ads' },
  'Find Video Ads': { amount: 'Unlimited' },
  'Image Maker': { amount: 'Up to 2,500 pictures' },
  'Thumbnail Maker': { amount: 'Up to about 500 thumbnails' },
  Voice: { amount: 'Up to about 1,600 voice-overs' },
  Music: { amount: 'Up to about 800 music tracks' },
  ReelEstate: { amount: 'Up to about 38 listing videos of 30 seconds' },
  'Ebook Writer': { amount: 'Up to about 60 ebooks' },
};

export const TOOL_GROUPS_BANK: typeof TOOL_GROUPS = TOOL_GROUPS.map((group) => ({
  ...group,
  tools: group.tools.map((tool) => ({ ...tool, ...BANK_TOOLS[tool.name] })),
}));

const S = RESULT_SALES;
const BANK_PACK = `Add a credit pack any time: 1,000 credits ($69.99) make ${Math.floor(1000 / PHANTOM_CREDITS)} more video ads, with nothing recurring.`;
const bankRecharge = `Busy season? ${BANK_PACK}`;

export const RESULT_SALES_BANK: SalesCopy = {
  ...S,
  price: {
    ...S.price,
    line: `All 12 tools are yours for life, plus ${BANK} complete video ads that never expire.`,
  },
  resell: {
    ...S.resell,
    text: `Type any business's website, and the AI Media Machine makes a video ad for that business. Your account makes ${BANK} complete video ads, for your business or for theirs.`,
    more: `Need more than ${BANK} video ads for your clients? ${BANK_PACK}`,
  },
  bonus: {
    ...S.bonus,
    items: [S.bonus.items[0], { ...S.bonus.items[1], text: `your next 3 video ads, already made and ready with one click, on top of your ${BANK} complete video ads ($600 value)` }],
  },
  how: {
    ...S.how,
    resultText: `The AI Media Machine makes your next ${BANK} video ads, so more new customers come to you.`,
    scrollText: S.how.scrollText.replace('posts a new video every 3 days', 'posts 2 new video ads every week'),
  },
  tools: {
    ...S.tools,
    amountsNote: `Use your account in any tool you like. The number under each tool is how many that tool makes if you use only that tool: for example ${BANK} video ads, or ${(BANK_CREDITS / PICTURE_CREDITS).toLocaleString('en-US')} pictures, or a mix of both.`,
  },
  oldWay: {
    ...S.oldWay,
    new: [...S.oldWay.new.slice(0, 3), `${BANK} complete video ads, ${READY}`],
    costTitle: `What ${BANK} video ads cost you`,
    freelancer: { ...S.oldWay.freelancer, line1: `$${FREELANCER} for each video ad`, line2: `× ${BANK} video ads`, price: `= ${FREELANCER_BANK}`, per: '' },
    machine: { ...S.oldWay.machine, line1: `${BANK} video ads`, line2: '', price: `= ${OFFER.now}, once`, per: `That's ${PRICE_PER_BANK_VIDEO_AD} a video ad` },
    after: (domain: string) => `${BANK} video ads means ${BANK} chances for new customers to find ${domain}.`,
  },
  lifetime: {
    ...S.lifetime,
    paragraphs: S.lifetime.paragraphs.map((paragraph) =>
      paragraph.lead === 'Is this for real?'
        ? {
            ...paragraph,
            text: ` Yes. One payment of ${OFFER.now} gets you the full AI Media Machine: all 12 tools, everything you see on this page, every update we ship in the future, and ${BANK} complete video ads like yours, ${READY}.`,
          }
        : paragraph
    ),
  },
  own: {
    ...S.own,
    rows: [{ ...S.own.rows[0], text: `${BANK} complete video ads like yours, ${READY}`, value: `$${(FREELANCER * BANK).toLocaleString('en-US')} at a freelancer` }, ...S.own.rows.slice(1)],
    recharge: bankRecharge,
  },
  still: {
    ...S.still,
    title: 'Your unfair advantage',
    text: [
      `91% of businesses now use video to get customers (Wyzowl Video Marketing Report 2026). So the question is not whether your competitors post videos. It's how often. With the AI Media Machine, your business posts 2 new video ads every week for a full year, because ${BANK} complete video ads are included. Others pay a freelancer $${FREELANCER} for each video ad. You pay ${OFFER.now}, once. That's your unfair advantage.`,
      ...S.still.text.slice(1),
    ],
  },
  faq: {
    ...S.faq,
    items: S.faq.items.map((item, index) =>
      index === 0
        ? {
            ...item,
            a: [
              `No, your investment is ${OFFER.now}, one time, and there are absolutely no monthly fees. Your account gets ${BANK_CREDITS_TEXT} credits, enough for ${BANK} video ads like yours, and the credits never expire. You also have 30 days to get your money back.`,
            ],
          }
        : index === 1
          ? {
              ...item,
              a: [
                `You get ${BANK} complete video ads like yours, ${READY}, and the other 11 tools come with no extra payment.`,
                `Your account gets ${BANK_CREDITS_TEXT} credits that never expire, and all 12 tools use the same ${BANK_CREDITS_TEXT} credits. Put all ${BANK_CREDITS_TEXT} credits into video ads, and you get ${BANK} complete video ads. Or mix: ${MIX_ADS} complete video ads plus ${MIX_PICTURES} pictures also uses ${BANK_CREDITS_TEXT} credits. Find Video Ads uses no credits at all.`,
                bankRecharge,
              ],
            }
          : item.a.some((line) => line.includes('every 3 days'))
            ? { ...item, a: item.a.map((line) => line.replace('posts a new video every 3 days', 'posts 2 new video ads every week')) }
            : item
    ),
  },
  freeTop: {
    ...S.freeTop,
    offerParts: ['What if your next ', `${BANK} video ads cost just ${PRICE_PER_BANK_VIDEO_AD} each`, '?'] as const,
    why: "That's 2 new video ads every week for a full year, so more customers find your business and call you first.",
    sample: { ...S.freeTop.sample, price: `You get the full version of this video ad, plus your next ${BANK} video ads, for ${OFFER.now}, one time.` },
  },
  afterUnlock: {
    ...S.afterUnlock,
    scrollText: S.afterUnlock.scrollText.replace('posts a new video every 3 days', 'posts 2 new video ads every week'),
    title: (name: string) => `${name}, the AI Media Machine just made your first video ad. What if your next ${BANK} video ads cost just ${PRICE_PER_BANK_VIDEO_AD} each?`,
    titleParts: (name: string) => [`${name}, the AI Media Machine just made your first video ad. What if your next `, `${BANK} video ads cost just ${PRICE_PER_BANK_VIDEO_AD} each`, '?'] as const,
    sub: 'One payment. Absolutely no monthly fees.',
    ps1: (name: string, domain: string) => `${name}, your $49 video ad for ${domain} is yours to keep. With the AI Media Machine, your next ${BANK} video ads are included, ${READY}.`,
    ps2: 'The AI Media Machine makes each video ad for you, ready to post in about 3 minutes, and all 12 tools are yours with absolutely no monthly fees.',
  },
  ps: {
    ...S.ps,
    p2: `With the AI Media Machine, you type any change and get the new version of your video ad in about 3 minutes, without the stamp. You also get all 12 tools and ${BANK} complete video ads, ${READY}.`,
    pps: (domain: string) =>
      `Here's the math. A freelancer charges about $${FREELANCER} for 1 video ad like yours, so ${BANK} video ads would cost about ${FREELANCER_BANK} if you hired a freelancer. With the AI Media Machine, you pay only ${OFFER.now}, one time! That's just ${PRICE_PER_BANK_VIDEO_AD} a video ad. Every video ad is one more chance for new customers to find ${domain}.`,
  },
};

/** The words for a page: the bank copy once the credit bank is launched, else today's. */
export const salesCopy = (bank: boolean | undefined): { copy: SalesCopy; groups: typeof TOOL_GROUPS } =>
  bank ? { copy: RESULT_SALES_BANK, groups: TOOL_GROUPS_BANK } : { copy: RESULT_SALES, groups: TOOL_GROUPS };
