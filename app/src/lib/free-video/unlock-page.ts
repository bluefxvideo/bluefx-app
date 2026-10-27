import { SALES_PAGE } from '@/lib/free-video/sales-page';

type Client = (typeof SALES_PAGE.reviews.items)[number];
const clients = (names: readonly string[]) =>
  names
    .map((name) => SALES_PAGE.reviews.items.find((item) => item.name === name))
    .filter((item): item is Client => Boolean(item))
    // The sales page points at a clip above ("His video ad is in the clip above."); this page has no such clip.
    .map((item) => ({ ...item, role: item.role.replace(/\.\s*His video ad is in the clip above\.?$/, '') }));

/** Short dates on the page: "Tue, Nov 3". */
export const shortDate = (iso: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
/** Long dates on the page: "Tuesday, November 3". */
export const longDate = (iso: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(iso));

/**
 * What a freelancer charges for each part of a video ad like the free one (owner 2026-10-27: itemize it, then show
 * that everything is included). Voice-over $70 (owner 2026-10-27: "200 is way too much, maybe 70"); editing at $100 an
 * hour as on the Weekly Video Plan page; the others are the owner's to confirm.
 */
const FREELANCE_PARTS = [
  { part: 'A script written to sell', price: 100 },
  { part: 'A voice-over artist', price: 70 },
  { part: 'A person on camera', price: 150 },
  { part: 'Graphics, music and captions', price: 100 },
  { part: 'Editing, about 2 hours at $100 an hour', price: 200 },
] as const;
const FREELANCE_TOTAL = FREELANCE_PARTS.reduce((sum, item) => sum + item.price, 0);

/**
 * The unlock page, /v/<token>/unlock. Rewritten 2026-10-27 after the owner's notes ("you made this like a robot"):
 * talk like a person, the free video ad is a sample, revisions (not "rounds") until the video ad is just right, common
 * change examples, one itemized freelancer comparison, the long pages' benefits (customers scrolling, the walking
 * customers, 222,712 leads), every testimonial, and the $60K founder story from the Weekly Video Plan page. No P.S.
 * True facts only: the clean file is the same 720 x 1280 render as the free one (HD, not full HD).
 */
export const UNLOCK_PAGE = {
  meta: (domain: string) => `Your video ad for ${domain}`,
  kicker: (domain: string) => `Your video ad for ${domain} is ready`,
  /** Owner 2026-10-27: "our biggest challenge, clients always want something changed", so the changes go in the headline, in red. */
  title: 'Get your video ad without the watermark,',
  titleRed: 'plus any changes you want.',
  sub: 'This video is a sample we made from your website alone, so a few details may not be quite right yet. Tell us what to fix, and a real person on my team makes the changes until your video ad proudly represents your business.',
  /** Real requests from leads who replied, as small chips under the sub. */
  chips: ['Your wording', 'A different person', 'Your phone number'] as const,
  priceUnit: 'one time',
  save: (regular: string, price: string) => `Your free video ad price: save $${Number(regular.slice(1)) - Number(price.slice(1))}`,
  ends: (iso: string, regular: string) =>
    `Ends ${new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))}, then ${regular}`,
  timerLabel: (price: string) => `Your ${price} price ends in`,
  priceUpIn: 'Price goes up in',
  left: (ms: number) => {
    const minutes = Math.max(1, Math.ceil(ms / 60_000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'}${hours ? ` ${hours} h` : ''} left`;
    return `${hours ? `${hours} h ` : ''}${minutes % 60} min left`;
  },
  button: (price: string) => `Get My Video Ad for ${price}`,
  buttonChanged: (price: string) => `Get My Changed Video Ad for ${price}`,
  watchBig: 'Watch full size',
  close: 'Close',
  chat: {
    title: 'What would you like changed in your video ad?',
    note: 'Type your changes here. A real person on my team makes them.',
    hello: 'Hi! Tap an idea below, or type your own change in plain words.',
    ideas: [
      { label: 'Add my phone number', ask: 'Please add my phone number.' },
      { label: 'A different person', ask: "I'd like a different person on camera." },
      { label: 'Change the wording', ask: "I'd like to change some of the wording." },
      { label: 'Other music or voice', ask: "I'd like other music or a different voice." },
      { label: 'Your own photos or your logo', ask: "I'd like to use my own photos or my logo." },
      { label: 'Your offer or your prices', ask: "I'd like to change the offer or the prices." },
    ],
    /** The 3 chips under the headline send these when tapped. */
    chipAsks: ["I'd like to change some of the wording.", "I'd like a different person on camera.", 'Please add my phone number.'],
    arrowNote: 'Tell us your changes here',
    askLinkPhone: 'Want something changed? Tell us below',
    askLinkComputer: 'Want something changed? Tell us below on the right',
    placeholder: 'Type your change here',
    send: 'Send',
    thinking: 'Typing...',
    listTitle: 'Your changes are saved:',
    listNote: 'Tap the green button. Your video ad without the watermark is ready in about 5 minutes, and my team emails you your changed video ad within 24 hours. Thought of something else? Add it here any time.',
    limit: 'You sent a lot of messages today. Please email your changes to support@bluefx.net.',
    error: 'Sorry, my answer did not come through. Please try again, or email support@bluefx.net.',
  },
  promiseShort: (price: string) => `The Feel-Right Promise: changes until your video ad feels right, or your ${price} back`,
  trust: 'Secure checkout by FastSpring. Cards and PayPal.',
  afterClick: 'Finish the payment in the new tab. This page updates by itself as soon as the payment arrives.',
  bar: 'Get My Video Ad',
  barWaiting: 'Waiting for your payment...',
  barCheck: 'Paid? Tap here',

  proof: {
    line: 'BlueFX has made videos for businesses since 2008',
    stars: '5 out of 5 stars',
    faces: clients(['Alex Goad', 'Steve Kane', 'Tony Monaco', 'Gregory Green']),
  },

  changes: {
    title: 'Want something changed? Just tell us.',
    text: 'Type what you want in plain words, and a real person on my team makes the change. You get as many revisions as you need, within reason, until your video ad is just right.',
    examplesTitle: 'What people usually ask for:',
    examples: [
      'Your phone number on the last screen',
      'A different voice, a man or a woman',
      'Other music',
      'Your own photos or your logo',
      'A different person on camera, or no person',
      'A word or a line in the script',
      'Your offer or your prices',
    ],
  },

  /** The 8 looks the Phantom can remake a video ad in (RESULT_SALES.styles, the same loops as its style gallery). */
  styles: {
    title: 'Want to change the video style completely?',
    text: 'Pick one of these 8 styles, and my team remakes your video ad in that style.',
    more: 'New styles added every month.',
  },

  getTitle: 'What you get',
  get: [
    { title: 'Your video ad without the watermark', text: 'In HD, made for phones, without the SAMPLE watermark and without our logo at the end.' },
    { title: 'Ready in 5 minutes', text: 'Your download button shows up on this page, and a copy comes to your email.' },
    { title: 'Revisions until your video ad is just right', text: 'Tell us what to change, and my team emails you the new version within 24 hours.' },
    { title: 'Post your video ad anywhere', text: 'You own your video ad. Post your video ad as often as you like, and use your video ad in paid ads too.' },
  ],
  platforms: ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'Your website'],

  scrolling: {
    title: 'Your customers are scrolling right now',
    text: 'How did you find us? Probably through a video on Facebook or YouTube. Your customers are there too, over 2 hours a day. When your video ad shows up in their feed, your business is the name they remember when they need what you sell.',
    sceneNote: 'Your video ad shows your business to the people scrolling Facebook, Instagram, TikTok and YouTube every day.',
    leadsStrong: 'Our own video ads brought BlueFX 222,712 leads.',
    leadsRest: 'Your video ad is built the same way.',
    image: '/free-video/leadpages-leads.jpg',
    alt: 'Our Leadpages dashboard showing 222,712 leads',
    caption: 'Our Leadpages dashboard: 222,712 leads since 2013, from our own video ads.',
  },

  compare: {
    title: 'What a video ad like yours costs from a freelancer',
    parts: FREELANCE_PARTS.map((item) => ({ part: item.part, price: `$${item.price}` })),
    totalLabel: 'A freelancer, all together',
    total: `$${FREELANCE_TOTAL}`,
    wait: 'plus days of waiting',
    usLabel: 'Your video ad, everything included',
    usNote: 'Script, voice-over, person on camera, graphics, music, captions and editing: already done.',
  },

  reviewsTitle: 'What our clients say',
  reviewsLead: "I've been building BlueFX since 2008, for more than 36,000 customers. Here's what a few of them say.",
  reviewsWorkLabel: 'Video work my team made for them',
  reviews: clients(['Steve Kane', 'Alex Goad', 'Dov Rom', 'Tony Monaco']),
  videoReviewsLabel: 'Customers of BlueFX video templates',
  videoReviews: ['Gregory Green', 'Deryck Jones', 'Bucky Helms'] as const,

  /** The founder story of the Weekly Video Plan page (owner 2026-10-27: "we already made a good founder story ... use that"). */
  founder: {
    photo: SALES_PAGE.founder.photo,
    name: 'Szilard Gyorfi, founder of BlueFX',
    title: 'I spent $60K of my own money on video ads to figure out what actually brings in customers',
    text: (price: string) => [
      "I'm Szilard Gyorfi. I've been building BlueFX since 2008, from a one-man video template shop into a business that has served 36,000+ customers around the world.",
      'I made 700+ videos for customers by hand, and each video took days, sometimes weeks.',
      `2 years ago I moved all my video work to AI. A video ad that used to take me a week now takes minutes. That's why your video ad is ${price} and not hundreds of dollars.`,
    ],
    lessonsTitle: 'What spending $60K on video ads taught me:',
    lessons: [
      { strong: 'Get attention first.', text: 'Your video ad opens with 1 problem your customer has, in the first 3 seconds.' },
      { strong: 'Present the facts in an interesting way.', text: 'Your real prices, your real offer and your real photos, shown so people keep watching.' },
      { strong: 'Tell people what to do next.', text: 'Your website on screen at the end.' },
    ],
    lessonsEnd: 'Your video ad is built on this proven sales video formula, with all 3 steps.',
    proofLine: 'The same formula is behind our own video ads, and those video ads brought BlueFX 222,712 leads.',
    proofImage: '/free-video/leadpages-leads.jpg',
    proofAlt: 'Our Leadpages dashboard showing 222,712 leads',
    proofCaption: 'Our Leadpages dashboard: 222,712 leads since 2013, from our own video ads.',
    stats: [
      { n: '18', label: 'years building BlueFX' },
      { n: '$60K+', label: 'spent testing video ads' },
      { n: '777', label: 'YouTube videos' },
      { n: '36K+', label: 'customers served' },
    ],
  },

  guaranteeTitle: 'The Feel-Right Promise',
  guaranteeSub: '30-day money-back guarantee',
  guarantee: (price: string) =>
    `If your video ad doesn't feel right for your business, tell us, and my team changes your video ad until it does. Still not happy? Email support@bluefx.net within 30 days, and you get every cent of your ${price} back.`,

  faqTitle: 'Questions',
  faq: (price: string, filesUntil: string | null) => [
    { q: 'Is this a monthly plan?', a: `No. You pay ${price} once for your video ad. Nothing renews.` },
    { q: 'How many revisions do I get?', a: 'As many as you need, within reason, until your video ad is just right. Send them in the 30 days after you pay.' },
    { q: 'Who makes my changes?', a: 'A real person on my team. Your new version comes back by email within 24 hours.' },
    { q: 'What file do I get?', a: 'An MP4 video file in HD (720 x 1280), standing up for phones, usually 40 to 55 seconds long. Facebook, Instagram, TikTok and YouTube Shorts take your video ad as it is.' },
    { q: 'Is the person in my video ad real?', a: 'The presenter in your video ad is an AI presenter, made for your video ad. Want a different person, or no person at all? Just ask.' },
    { q: 'Will Facebook run my video ad as a paid ad?', a: 'Facebook checks every paid ad before it runs. Some products, like CBD or supplements, need Facebook’s approval first. Posting your video ad on your own Facebook page, your website or YouTube works for every business.' },
    { q: 'Who owns my video ad?', a: 'You do. Post your video ad anywhere you like, as often as you like, paid ads included.' },
    ...(filesUntil ? [{ q: 'How long can I unlock my video ad?', a: `Until ${longDate(filesUntil)}. The working files of your video ad are deleted 30 days after your video ad was made, and after that your video ad can't be unlocked.` }] : []),
    { q: 'What if I don’t like my video ad?', a: `Tell us what to change first. Still not happy? Email support@bluefx.net within 30 days, and you get your ${price} back.` },
  ],
  bottomTitle: (domain: string) => `Get your video ad for ${domain} without the watermark`,
  filesLine: (iso: string) => `Your video ad can be unlocked until ${longDate(iso)}.`,

  paid: {
    title: 'Payment received. Your video ad is unlocking.',
    text: 'Your download button shows up right here in about 5 minutes. We are emailing your video ad to you too.',
    progress: 'Removing the watermark',
  },
  failed: {
    title: 'Your payment is in',
    text: 'Removing the watermark hit a problem. Our team has the details and emails your video ad to you today.',
  },
  closed: {
    title: 'Your video ad can no longer be unlocked',
    text: 'The working files of your video ad were deleted 30 days after your video ad was made. Questions? Email support@bluefx.net.',
    button: 'See your video ad',
  },
  ready: {
    title: 'Your video ad is ready',
    button: 'Download My Video Ad',
    requestedTitle: 'Changes my team is making for you:',
    requestedNote: 'Your changed video ad comes to your email within 24 hours.',
    changeLabel: 'Want something changed? Type it here',
    changePlaceholder: 'Example: Put our phone number on the last screen.',
    changeButton: 'Send My Change',
    sending: 'Sending...',
    changeNote: 'Free revisions until your video ad is just right. Your new version comes back by email within 24 hours.',
    sent: () => 'Got it. My team is making your change and emails you the new version within 24 hours. Want something else changed too? Send it any time.',
    refusals: {
      noRoundsLeft: 'You sent a lot of revisions. To keep going, email support@bluefx.net and my team helps you.',
      tooLate: 'Revisions are open for 30 days after you pay. For more changes, email support@bluefx.net.',
      notPaid: 'Changes open once your payment is in.',
      generic: 'Your change did not go through. Please email support@bluefx.net with your change.',
    },
  },
  plan: {
    kicker: 'For more customers every week',
    title: (domain: string) => `Get a new video ad like this for ${domain} every Tuesday`,
    text: 'Our team writes and makes a new video ad for your business every week from your website and your ideas, and changes anything you want the same day.',
    price: '$99',
    priceUnit: 'a month, cancel any time',
    button: 'Start My Weekly Video Plan',
    more: 'See how the Weekly Video Plan works',
  },
} as const;
