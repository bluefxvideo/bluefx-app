/**
 * The AI Media Machine lifetime page (https://ai.bluefx.net/lifetime/, repo bluefxvideo/bluefx,
 * static-sales-pages/lifetime/index.html) under the finished free video ad. Owner 2026-10-08: "put the entire page
 * except maybe a few things to the Thank You page, but it should be shown only once the result is visible". Its words
 * as they are, in this funnel's colors, with these changes:
 * - no countdown timer and none of its lines ("until the timer hits zero"): people come back to this page for days;
 * - BlueFX since 2009 (owner: "2009 is ok"; the lifetime page says est. 2008), 18 years in marketing as there;
 * - no customer reviews (nobody can check them) and no founder video yet (owner: "for now, no video");
 * - every button opens ClickBank's checkout through /go, the tool buttons too (there they scroll to the price box);
 * - the FAQ starts with two questions about the free video ad.
 * Media: copies in script-videos/smart-video/examples/free-video/aimm/ (the demo GIFs as MP4, 47 MB down to 3.7 MB;
 * the video wall from the original files), the voice and music samples where the lifetime page plays them from.
 */
import { PHANTOM_CREDITS, PHANTOM_REVISION_CREDITS } from '@/lib/smart-video/pricing';
import { LIFETIME_MONTHLY_CREDITS, OFFER, VIDEO_ADS_PER_MONTH } from './offer';

const STORAGE = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public';
const MEDIA = `${STORAGE}/script-videos/smart-video/examples/free-video/aimm`;
const VOICES = `${STORAGE}/script-videos/b782d8ba-fcdc-45fa-93b1-c3c7ed752e6f/voice`;
const MUSIC = `${STORAGE}/audio/public`;

const usd = (price: string) => Number(price.replace(/\D/g, ''));
const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;

export interface SalesTool {
  /** The small label above the name (the first two tools only). */
  step?: string;
  name: string;
  /** The name in the "Everything You Own" table, when it says more. */
  ownName?: string;
  /** How much of it, top right. */
  badge: string;
  text: string;
  /** What the same thing rents for elsewhere, per month. */
  monthly: number;
  image: string;
  demo?: { video: string; poster: string };
  samples?: readonly { label: string; src: string }[];
}

/** A tool with its product picture (product-<image>.jpg) and its demo loop (demo-<demo>.mp4 and .jpg), if any. */
const tool = (image: string, demo: string | null, rest: Omit<SalesTool, 'image' | 'demo'>): SalesTool => ({
  ...rest,
  image: `${MEDIA}/product-${image}.jpg`,
  ...(demo
    ? {
        demo: {
          video: `${MEDIA}/demo-${demo}.mp4`,
          poster: `${MEDIA}/demo-${demo}.jpg`,
        },
      }
    : {}),
});

/** The 12 tools in the lifetime page's order and groups. The first group has no title. */
export const TOOL_GROUPS: readonly {
  title: string | null;
  tools: readonly SalesTool[];
}[] = [
  {
    title: null,
    tools: [
      tool('winning-ads', 'winning-ads', {
        step: 'Step 1 · Find',
        name: 'Winning Ads Finder',
        badge: 'Unlimited',
        text: 'A live feed of the best-performing Facebook and TikTok ads running right now. Spot one worth copying. Send it to the Video Analyzer with one click.',
        monthly: 59,
      }),
      tool('ad-cloner', 'video-analyzer', {
        step: 'Step 2 · Clone',
        name: 'Video Analyzer & Ad Cloner',
        badge: 'Unlimited',
        text: 'Paste any video URL. AI breaks down the hook, script, shot sequence, and timing. One click and it rebuilds the winning formula with your product baked in.',
        monthly: 99,
      }),
    ],
  },
  {
    title: 'Video Creation',
    tools: [
      tool('cinematographer', 'cinematographer', {
        name: 'AI Cinematographer',
        ownName: 'AI Cinematographer: cinematic video up to 4K',
        badge: '~100 videos/month',
        text: 'Plan shots, animate scenes, add products and actors using them. From a single image or idea, AI builds cinematic video with complex motion, transitions, and storytelling built in.',
        monthly: 100,
      }),
      tool('avatar', 'avatar', {
        name: 'Talking AI Avatar',
        ownName: 'Talking AI Avatar: 200+ presenters',
        badge: '~20 videos/month',
        text: 'Spokesperson videos without being on camera. 200+ hyper-realistic avatars for ads, tutorials, and presentations.',
        monthly: 29,
      }),
      tool('script-to-video', 'script-to-video', {
        name: 'Script-to-Video Generator',
        badge: '~20/month',
        text: 'Type one sentence. Get a complete video with script, voiceover, visuals, and captions. Perfect for Shorts, Reels, and TikToks.',
        monthly: 28,
      }),
      tool('thumbnail', 'thumbnail', {
        name: 'AI Thumbnail Maker',
        badge: '~50/month',
        text: 'Just paste your video link. AI watches it and creates a custom thumbnail designed to maximize clicks. No design skills needed.',
        monthly: 10,
      }),
    ],
  },
  {
    title: 'Audio & Voice',
    tools: [
      tool('voiceover', null, {
        name: 'AI Voiceover Studio',
        ownName: 'AI Voiceover Studio: 57 pro voices + voice cloning',
        badge: 'Unlimited',
        text: "57 pro voices with real emotion and emphasis, or clone ANY voice. Your voice. A client's voice. Anyone's.",
        monthly: 11,
        samples: [
          {
            label: 'Deep and Commanding',
            src: `${VOICES}/voice_over_1771596000980_44kox4mme.mp3`,
          },
          {
            label: 'Mature and Authoritative',
            src: `${VOICES}/voice_over_1771761823473_zc6anb9vn.mp3`,
          },
          {
            label: 'Energetic Male',
            src: `${VOICES}/voice_over_1771761938225_en22k86lo.mp3`,
          },
          {
            label: 'Commanding Female',
            src: `${VOICES}/voice_over_1771762021702_47o6wi8i4.mp3`,
          },
        ],
      }),
      tool('music', null, {
        name: 'AI Music Maker',
        badge: 'Unlimited',
        text: 'Copyright-free music in any style, fully owned by you. Supports both vocals with lyrics and instrumental-only tracks.',
        monthly: 10,
        samples: [
          { label: 'Electric Blues', src: `${MUSIC}/examples/16_blues.mp3` },
          { label: 'Gospel Choir', src: `${MUSIC}/examples/18_gospel.mp3` },
          {
            label: 'Cinematic Heavy Metal',
            src: `${MUSIC}/music-machine_music_3482a18b-9d9f-49a9-be51-1f159bfd20a6_2026-02-03T203830878Z.mp3`,
          },
          { label: 'Classical Piano', src: `${MUSIC}/examples/04_piano.mp3` },
        ],
      }),
    ],
  },
  {
    title: 'Monetization & Growth',
    tools: [
      tool('offers', 'top-offers', {
        name: 'Top Offers Finder',
        badge: '50+ products',
        text: '50+ affiliate products paying $50+ per sale with proven hooks baked in. Pick one, AI builds the video, you post and earn.',
        monthly: 49,
      }),
      tool('ebook', 'ebook', {
        name: 'AI Ebook Writer',
        badge: 'Unlimited',
        text: 'Complete ebooks with covers, formatting, and graphics. Perfect as lead magnets and authority builders for your personal brand.',
        monthly: 20,
      }),
    ],
  },
  {
    title: 'Content & Research',
    tools: [
      tool('multiplier', 'multiplier', {
        name: 'Content Multiplier',
        badge: 'Unlimited',
        text: 'Paste a YouTube link and get blog posts, emails, social media captions, and more. One piece of content becomes dozens.',
        monthly: 30,
      }),
      tool('logo', 'logo', {
        name: 'AI Logo Generator',
        badge: 'Unlimited',
        text: 'Professional logos for any business or brand. Describe what you want, then refine any element with simple text commands.',
        monthly: 15,
      }),
    ],
  },
];

const TOOLS = TOOL_GROUPS.flatMap((group) => group.tools);
/** $460 a month, $5,520 a year: what the 12 tools rent for elsewhere. */
const MONTH = TOOLS.reduce((sum, item) => sum + item.monthly, 0);
const YEAR = MONTH * 12;
/** 94.62: $297 against a year of renting the same tools. */
const PERCENT = ((1 - usd(OFFER.now) / YEAR) * 100).toFixed(2);
const MORE_TOOLS = 'Image Maker, Video Swap, YouTube Repurpose, Script Generator, Video Ad From Script, Viral Trends, Trending Keywords, Reel Estate';
const CREDITS_LINE = `One-time payment • ${LIFETIME_MONTHLY_CREDITS} monthly credits (≈100 short videos per month) forever • 30-day money-back guarantee`;

/** The lifetime page's price box, shown three times. */
export const PRICE_BOX = {
  tag: '40th Birthday Deal',
  wasLabel: 'Lifetime license',
  was: OFFER.was,
  now: `Just ${OFFER.now}`,
  line: 'One payment. Everything on this page, forever.',
  button: 'Add To Cart',
} as const;

export const SALES_PAGE = {
  /** The id the short offer's link beside the video ad jumps to. */
  anchor: 'everything-you-get',
  hero: {
    eyebrow: 'AI Media Machine',
    /** The last words are underlined. */
    title: ['Could This Be the Best Deal', 'in the Era of ', 'AI Video', '?'],
    lead: [
      `For the first time ever, you can `,
      `access over ${money(YEAR)}.00-a-year worth of our best AI video tools`,
      `, including the AI that clones winning ads, for a minuscule fraction of the normal price...`,
    ],
    /** Tap a clip for its sound, as on the lifetime page; the arrows scroll the strip on wider screens. */
    soundOn: 'Turn the sound on',
    soundOff: 'Turn the sound off',
    previous: 'Earlier videos',
    next: 'More videos',
    wall: Array.from({ length: 9 }, (_, index) => ({
      video: `${MEDIA}/wall-${index + 1}.mp4`,
      poster: `${MEDIA}/wall-${index + 1}.jpg`,
    })),
    wideTitle: 'Also made with AI Media Machine',
    wide: [
      {
        video: `${MEDIA}/wide-1.mp4`,
        poster: `${MEDIA}/wide-1.jpg`,
        label: 'Cinematic AI product ad',
      },
      {
        video: `${MEDIA}/wide-2.mp4`,
        poster: `${MEDIA}/wide-2.jpg`,
        label: 'Cinematic AI brand ad',
      },
    ],
    wideNote: 'No camera crew. No actors. No studio. Made on a laptop, in an afternoon.',
  },
  order: {
    /** "Watch this video before you sign up:" on the lifetime page. Set { src, poster, label } to show it. */
    video: null as { src: string; poster: string; label: string } | null,
    videoTitle: 'Watch this video before you sign up:',
    title: 'Get Lifetime Access For:',
    text: `The lifetime license sells for ${OFFER.was}. For my 40th birthday, it's ${OFFER.off}:`,
    fine: [
      'Includes lifetime access to all programs and tools listed on this page.',
      'Your purchase is backed by our 100% money-back guarantee: full refund within 30 days.',
    ],
  },
  letter: {
    title: `Get ${PERCENT}% Off.`,
    greeting: 'Dear Friend,',
    body: [
      'See how long this page is?',
      'Believe it or not, this is NOT a sales letter.',
      "Everything below is literally just a demonstration of each tool you're getting: real output, made by the AI, shown as-is. Scroll and look at what the machine produces. That's the pitch.",
      `If what you see is worth one payment of ${OFFER.now} to own forever, grab it. If not, no hard feelings.`,
    ],
    signature: '- Szilard',
    questionsIntro: 'But before you look at that, let me answer two questions you might have about this offer:',
    questions: [
      {
        q: 'Question One: Is this for real?',
        a: `Answer: Yes. You really CAN get lifetime access to everything on this page for ${PERCENT}% off. That is not a typo. This is not a trick. One payment, and all 12 AI tools are yours forever, plus ${LIFETIME_MONTHLY_CREDITS} fresh credits every month, enough for up to 100 short videos.`,
      },
      {
        q: 'Question Two: Why are you doing this?',
        a: `Answer: Because I turned 40 this year! The lifetime license normally sells for ${OFFER.was}, and against ${money(YEAR)} a year of renting, ${OFFER.was} once is already the best deal I know of in this space. But 40 felt like a number worth celebrating with something bigger than cake. So for my birthday, the license is ${OFFER.off}: ${OFFER.now}, once. Apparently I only turn 40 once :-)`,
      },
    ],
  },
  stats: {
    title: 'From the founder of BlueFX (est. 2009)',
    items: [
      { value: '18', label: 'Years in Marketing' },
      { value: '$60K+', label: 'Spent Testing Video Ads' },
      { value: '100+', label: 'Products Launched' },
      { value: '709', label: 'Videos Published' },
      { value: '36K+', label: 'Customers Served' },
    ],
  },
  tools: {
    eyebrow: 'The tools',
    title: ["Here's Everything You're Getting For ", `${PERCENT}% Off!`],
    lead: 'One payment. All the tools. No juggling subscriptions.',
    value: (monthly: number) => ['Real-World Value: ', `${money(monthly)}/month`, ' as a subscription elsewhere'] as const,
    included: '✓ Included In This Lifetime Offer!',
    button: 'Yes! I Want This!',
  },
  system: {
    title: ["You're not just creating content.", "You're building a system that can pay you."],
    text: 'While most people play with AI tools, AI Media Machine owners are building real businesses.',
    button: 'Yes! I Want Lifetime Access →',
    fine: CREDITS_LINE,
  },
  highlights: {
    title: 'And that was just the 12 highlights.',
    lead: 'You get 20+ tools, all included, forever.',
    more: `Also inside: ${MORE_TOOLS} and more.`,
    credits: `${LIFETIME_MONTHLY_CREDITS} credits refreshed every month, enough for about 100 short videos per month, for life. No subscription. Ever.`,
    fine: 'Backed by our 100% money-back guarantee: full refund within 30 days.',
  },
  steps: {
    eyebrow: 'How it works',
    title: 'The Clone & Profit System',
    items: [
      {
        title: 'Find a winner',
        text: 'Use the Winning Ads Finder to browse top-performing Facebook and TikTok ads running right now.',
      },
      {
        title: 'AI reverse-engineers it',
        text: 'The Video Analyzer breaks it down shot-by-shot: hook structure, timing, script pattern, visual formula, audio cues. The entire blueprint.',
      },
      {
        title: 'Rebuild with your product',
        text: 'AI Cinematographer recreates it with your product, your brand, your message swapped in. Same winning structure. Your offer.',
      },
      {
        title: 'Post & perform',
        text: 'Proven format. Your product. You just post it.',
      },
    ],
    close: "Why guess what works when you can clone what's already proven?",
  },
  audience: {
    eyebrow: 'Who this is for',
    title: ['Built for People Who Need Video Ads', 'Not a Film Degree'],
    items: [
      {
        image: `${MEDIA}/who-ecommerce.jpg`,
        alt: 'Business owner',
        title: 'Have a business?',
        text: 'Stop guessing what video ads will work. AI analyzes top-performing ads in your niche, learns why they convert, and builds fresh ads around your product. Your brand. Your message. Proven structure.',
      },
      {
        image: `${MEDIA}/who-real-estate.jpg`,
        alt: 'Real estate agent',
        title: 'Real estate agent?',
        text: 'Turn one listing into 10 video ads before lunch. Property tours, neighborhood highlights, testimonial-style walkthroughs.',
      },
      {
        image: `${MEDIA}/who-creator.jpg`,
        alt: 'Content creator',
        title: 'Affiliate marketer or content creator?',
        text: '50+ high-paying products already loaded in. AI knows the hooks, angles, and benefits that convert. Just pick a product and publish.',
      },
      {
        image: `${MEDIA}/who-beginner.jpg`,
        alt: 'Beginner getting started',
        title: 'Just getting started?',
        text: 'No filming. No writing scripts. No showing your face. No figuring out what to create. AI handles the hard parts. You handle the posting.',
      },
    ],
  },
  compare: {
    eyebrow: 'The difference',
    title: ['The Old Way Is Slow, Expensive, and Full of Guesswork.', 'This Is the Shortcut.'],
    lead: "Most people create video ads the hard way. Hire freelancers. Wait days. Spend hundreds. And still have no idea if it's going to work. This is different.",
    oldTitle: 'The old way',
    old: [
      'Hire a video editor for $100+/hour and wait days for one video',
      'Guess what hooks, angles, and formats might work',
      'Pay a voiceover artist $200+ per script and hope the tone is right',
      'Spend $50-100 per thumbnail with a graphic designer',
      'Create content for one platform, then start over for the next one',
    ],
    newTitle: 'AI Media Machine',
    new: [
      "Start from a video that's ALREADY getting millions of views",
      'AI tells you exactly why it works, then rebuilds it with your product',
      "200+ AI spokespersons, 57 pro voices, clone anyone's voice instantly",
      'Thumbnails, music, logos. All built in. No extra tools, no extra cost',
      'One piece of content becomes dozens across every platform',
    ],
    close: "You're not creating ads from scratch. You're cloning what's already proven and making it yours.",
  },
  pillars: {
    items: [
      {
        title: "You're not alone",
        text: 'Daily YouTube tutorials. Private community. Real support from a real founder, not a chatbot.',
      },
      {
        title: 'Built-in monetization',
        text: '50+ affiliate products pre-loaded. Each pays $50+ per sale. AI already knows the hooks and angles. Just pick a product and post.',
      },
      {
        title: 'Built by a marketer',
        text: "18 years. $60K+ spent testing video ads. 709 videos. 36,000+ customers. Not a VC-funded startup. A marketer's tool built in the trenches.",
      },
    ],
    button: 'Yes! I Want Lifetime Access →',
    fine: CREDITS_LINE,
  },
  founder: {
    eyebrow: 'The founder',
    title: ['I Spent $60K of My Own Money on Video Ads', 'to Figure Out What Actually Converts.', 'Then I Built This.'],
    photo: `${MEDIA}/founder.jpg`,
    name: 'Szilard Gyorfi',
    role: 'Founder of BlueFX (est. 2009) & AI Media Machine',
    links: [
      { label: 'BlueFX.net', href: 'https://bluefx.net' },
      {
        label: 'YouTube',
        href: 'https://www.youtube.com/channel/UCiXb0GsKv0KiFrW6ho5Gk3Q',
      },
      { label: 'Facebook', href: 'https://www.facebook.com/bluefxvideo' },
    ],
    story: [
      "I'm Szilard Gyorfi. I've been in digital marketing since 2008, building BlueFX from a one-man video template shop into a business that's served 36,000+ customers worldwide.",
      "Over 18 years I've launched 100+ products across every niche imaginable: tech tools, weight loss, video production, digital courses. I've spent over $60,000 of my own money on Facebook ads. Not a company budget. My money. Testing hooks, angles, creatives, audiences, figuring out what actually gets people to click, watch, and buy.",
      "I've published 709 videos on YouTube. Created 600+ client videos the hard way. Days, sometimes weeks per video. Generated over 200,000 leads and 7.8 million views across our channels.",
      "Two years ago I rebuilt my entire workflow with AI. What used to take a week now takes minutes. And now I'm giving you the same system I use every day to find winning ads, reverse-engineer them, and rebuild them for any product.",
    ],
    quote:
      "This isn't a VC-funded startup built by engineers who've never spent a dollar on ads. This is a marketer's tool, built by a marketer who's been in the trenches for 18 years.",
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Why Lifetime?',
    letter: [
      { lead: '', text: 'Let me be straight with you.' },
      {
        lead: '',
        text: `Bought separately, the tools inside this machine would cost you over ${money(MONTH)} a month. Every month. Forever. Miss a payment, lose your tools. I know you're tired of it. Everybody is.`,
      },
      {
        lead: '',
        text: `So this version works differently: pay once, own it forever. The lifetime license sells for ${OFFER.was}. One payment instead of ${money(YEAR)} every year, and every tool on this page is yours for good.`,
      },
      {
        lead: 'Is this for real?',
        text: `Yes. One payment of ${OFFER.now}, and you get the entire AI Media Machine: every tool, plus ${LIFETIME_MONTHLY_CREDITS} fresh credits every single month, for life. Not a stripped-down version. The full product, everything you see on this page, plus every update we ship in the future.`,
      },
      {
        lead: `Why ${OFFER.now} and not ${OFFER.was}?`,
        text: `I turned 40 this year. I have been building BlueFX since 2009, and I wanted to mark the occasion the way a marketer does: with the most ridiculous deal of my career. ${OFFER.off} the lifetime license.`,
      },
      {
        lead: 'Do the math:',
        text: `the same tools rent for over ${money(MONTH)} a month elsewhere. That's ${money(YEAR)}.00 a year. The lifetime license is ${OFFER.was}. Today it's ${OFFER.now}, once. It pays for itself in the very first month, and every month after that costs you nothing. Forever.`,
      },
    ],
    boxEyebrow: 'Lifetime Access',
    boxTitle: 'Pay Once. Own It Forever.',
    boxText: `${LIFETIME_MONTHLY_CREDITS} fresh credits, about 100 short videos per month, for life. No subscription. Ever.`,
    listsTitle: 'All 20+ tools. Full access. No restrictions.',
    lists: [
      {
        title: 'Video Creation',
        items: ['~100 AI cinematographer videos/month', '~20 talking avatar videos/month', '~20 script-to-video creations/month', '~50 AI thumbnails/month'],
      },
      {
        title: 'Unlimited Tools',
        items: [
          'Winning Ads Finder + Video Analyzer & Ad Cloner',
          'AI Voiceover Studio (57 voices + voice cloning)',
          'AI Music Maker (copyright-free)',
          'AI Ebook Writer',
          'Content Multiplier',
          'AI Logo Generator',
          'Trending Keywords Finder',
        ],
      },
      {
        title: 'Included',
        items: [
          '200+ AI avatars + create custom avatars',
          '50+ monetizable products with proven hooks',
          'Private community + founder support',
          'New features added at no extra cost',
        ],
      },
    ],
    button: `Get Lifetime Access for ${OFFER.now} →`,
    fine: 'One-time payment. No recurring charges. Backed by our 100% money-back guarantee: full refund within 30 days.',
    more: [
      'Need more?',
      " Your monthly capacity is generous. More than most people use. But if you're on a roll and want to keep creating, you can grab extra credits anytime in small, affordable packs. No plan upgrade required.",
    ],
    guaranteeTitle: '30-Day Money-Back Guarantee',
    guarantee: [
      "If you don't save time, create content you're proud of, and see the potential, email me within 30 days and I'll refund every cent. There's nothing to cancel, because there's no subscription.",
      'You risk nothing. I risk my reputation built over 18 years and 36,000 customers.',
    ],
  },
  own: {
    title: ["Here's Everything You Own", 'After One Payment'],
    lead: 'These are the cheapest prices the same capabilities rent for elsewhere, every single month.',
    rows: [
      ...TOOLS.map((item) => ({
        name: item.ownName ?? item.name,
        price: `${money(item.monthly)}/mo`,
      })),
      { name: `8+ more tools: ${MORE_TOOLS}`, price: 'included' },
      {
        name: '50+ monetizable products with proven hooks, private community, all future updates',
        price: 'included',
      },
    ],
    credits: `Plus ${LIFETIME_MONTHLY_CREDITS} fresh generation credits, about 100 short videos per month, for life. Need a heavy month? Recharge packs start at $9.99, only when you want them.`,
    totals: [
      { label: 'Total Value:', value: `${money(YEAR)}.00 Per Year` },
      { label: 'Lifetime License:', value: OFFER.was },
      { label: 'Your 40th-Birthday Price:', value: OFFER.now },
    ],
    grab: ['Grab Lifetime Access Today And Get', `${PERCENT}% OFF!`],
    button: 'Yes! I Want Lifetime Access →',
  },
  thinking: {
    title: 'Still Thinking About It?',
    body: [
      "Right now, someone in your market is running ads that work. They figured out the hook, the format, the angle. They're getting the clicks you want.",
      "With AI Media Machine, you don't have to figure it out from scratch. You find what's working. AI tells you why. Then you rebuild it for your brand.",
      'Same proven format. Your product. Your results.',
    ],
    button: 'Add To Cart',
    buttonLine: `One payment of ${OFFER.now}. Regular price ${OFFER.was}.`,
    fine: CREDITS_LINE,
    trust: ['Secure SSL checkout', 'Instant access', '30-day money-back guarantee'],
    secure: '256-bit SSL Encrypted • Your information is 100% secure',
  },
  faq: {
    title: 'Frequently Asked Questions',
    items: [
      {
        q: 'What happens to my free video ad?',
        a: 'Buy with the email you used here, and this video ad shows up in your AI Media Machine within about 10 minutes, without the watermark, ready to change. Bought with another email? Come back to this page and use the link under the offer beside your video ad.',
      },
      {
        q: 'How many video ads like this one can I make?',
        a: `${LIFETIME_MONTHLY_CREDITS} credits arrive every month. A video ad like yours takes ${PHANTOM_CREDITS} credits, so that is ${VIDEO_ADS_PER_MONTH} video ads a month, ${VIDEO_ADS_PER_MONTH * 12} a year. A change to a video ad takes ${PHANTOM_REVISION_CREDITS}.`,
      },
      {
        q: 'How is this different from other AI ad tools?',
        a: `Most AI ad tools give you a blank page. You write a script, pick an avatar, and hope it works. AI Media Machine starts from what's already proven. Our Video Analyzer breaks down any winning ad and shows you exactly why it works. Then the system rebuilds it with your product. Plus, you get 200+ avatars, 57 pro voices, and everything for a single one-time payment, where the same capabilities would cost you over ${money(MONTH)} every month elsewhere, or run out of credits halfway through the month.`,
      },
      {
        q: 'Do I need to be technical or know video editing?',
        a: 'No. The whole point is that AI handles the technical work. If you can paste a URL and click a few buttons, you can use this.',
      },
      {
        q: "What if I don't have a product?",
        a: "We've pre-loaded 50+ affiliate products that pay $50+ per sale. The AI is already trained on each one: hooks, angles, benefits. Pick a product, let AI build the video, post it, and earn when someone buys through your link.",
      },
      {
        q: 'What if I need more credits in a month?',
        a: "Your monthly capacity covers more than most people use. But if you're having a productive week and want to keep the momentum going, you can grab extra credits anytime in small, affordable packs. No subscription, nothing recurring. Just top up and keep creating.",
      },
      {
        q: 'Is this really a one-time payment?',
        a: `Yes. Pay ${OFFER.now} once and you own AI Media Machine for life, including ${LIFETIME_MONTHLY_CREDITS} fresh credits every month (enough for roughly 100 short videos per month), forever. There is no subscription, no renewal, and nothing to cancel. Backed by a 30-day money-back guarantee.`,
      },
    ],
  },
  /** The lifetime page's footer notes: ClickBank sells the lifetime license, so its retailer notice goes with the offer. */
  legal: {
    income: 'Income examples are for illustration only. Your results depend on effort, audience, and many other factors.',
    support: ['For product support, email ', '. For order support, contact ', 'ClickBank', '.'],
    clickbankUrl: 'https://www.clkbank.com/',
    notes: [
      "ClickBank is the retailer of products on this site. CLICKBANK® is a registered trademark of Click Sales Inc., a Delaware corporation located at 1444 S. Entertainment Ave., Suite 410 Boise, ID 83709, USA and used by permission. ClickBank's role as retailer does not constitute an endorsement, approval or review of these products or any claim, statement or opinion used in promotion of these products.",
      'This site and the products and services offered on this site are not associated, affiliated, endorsed, or sponsored by Youtube or Facebook, nor have they been reviewed tested or certified by Youtube or Facebook.',
      'You understand this to be an expression of opinions and not professional advice. You are solely responsible for the use of any content and hold BlueFx, Inc. and all members and affiliates harmless in any event or claim. You can also safely assume that I get paid anytime you click on a link on this site. We recommend that you do your own Independent research before purchasing anything.',
      "Disclaimer: We do NOT believe in get rich quick programs. We believe in hard work, adding value and dedication to reach your goals. It's a fact that one that does not take action will see no results whatsoever. The results featured on this page are not the norm and are extraordinary results from hard work, commitment and dedication by following through and taking action. You will get no results whatsoever if you assume by soaking up information products, joining program after program your life will change with riches. This is not for you. Your results are based upon your actions. If you want a magic button that will fulfil your life with riches then please leave this page and do NOT purchase. Our products are intended to help you share your message with the world whilst growing your business. We don't make any guarantees about your own results because we don't know you. Results in life are solely based on decisions made. We are here to help and guide you to move forward faster by giving you awesome content, direction and strategies to reach your end goal. Please check the content thoroughly on this page and that you are committed to taking relentless action and will put in the effort before you decide to make a purchase. If not then please leave this page and do not purchase.",
    ],
  },
} as const;
