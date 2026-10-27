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
      { label: 'A different video style', ask: "I'd like my video ad in a different video style." },
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
    listNote: 'Tap the green button. Right after you pay, our AI engine makes these changes on your page, in about 5 to 10 minutes. Not quite right? A real person on my team fixes it. Thought of something else? Add it here any time.',
    limit: 'You sent a lot of messages today. Please email your changes to support@bluefx.net.',
    error: 'Sorry, my answer did not come through. Please try again, or email support@bluefx.net.',
  },
  promiseShort: (price: string) => `The Feel-Right Promise: changes until your video ad feels right, or your ${price} back`,
  trust: 'Secure checkout by FastSpring. Cards and PayPal.',
  afterClick: 'Finish the payment in the checkout window. This page updates by itself as soon as the payment arrives.',
  bar: 'Get My Video Ad',
  barWaiting: 'Waiting for your payment...',
  barCheck: 'Paid? Tap here',

  proof: {
    line: 'BlueFX has made videos for businesses since 2008',
    stars: '5 out of 5 stars',
    faces: clients(['Alex Goad', 'Steve Kane', 'Tony Monaco', 'Gregory Green']),
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
    changeOpen: 'Want something changed? Tap here',
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
  /**
   * The Weekly Video Plan offer right after the $49 payment (owner 2026-10-27, his sales video idea word for word where
   * possible): first month free, then $99 a month for 4 social media videos (one a week, under $25 each against $49).
   * Changes by the team come first; cancel any time and keep the videos.
   */
  thanks: {
    /** The compact status at the top while the video ad is made (offer review 2026-10-27: one row, the offer starts on the first screen). */
    paidTitle: (name: string) => `Paid. Your video ad is being made${name ? `, ${name}` : ''}.`,
    /** Owner 2026-10-27: nobody checks the clean file before it goes out, so the page says what really happens. */
    paidNote: 'Your video ad shows up right here in about 5 minutes, and we email you a copy. Want anything changed? A real person on my team is here to help.',
    makingChanges: 'My team is making your changes:',
    /** The offer names itself first (3-expert review 2026-10-27: buyers did not know what the 4 pictures were for). */
    kickerPaid: 'One more thing',
    kickerReady: 'Now, your next 4 videos',
    title: (domain: string) => `Want a new social media video for ${domain} every week? Your first month is free.`,
    sub: 'My team makes you 4 social media videos a month, one a week, from your website and your ideas. $0 today, then $99 a month. Cancel any time.',
    /** The benefit on the button (owner 2026-10-27: "there should be a clear benefit on the green button"). */
    button: 'Yes! Get My First 4 Videos Free',
    today: '$0 today, then $99 per month after 30 days. Cancel any time with one email.',
    /**
     * The owner's sales video for this offer (he records it: thank you, the math, the free month, the guarantee), shown
     * between the headline and the first button. Empty until it exists: a local preview shows where it goes.
     */
    salesVideo: '' as string,
    salesVideoPoster: '' as string,
    salesVideoSpot: 'Your sales video goes here (between the headline and the first button)',
    plannedTitle: 'Here are your first 4, already planned from your website',
    /** Owner 2026-10-27: the 4 are only ideas to make planning easy; any other idea is fine. */
    plannedNote: 'These are just ideas my team planned from your website, to make planning your next videos easy. Don\u2019t like one? Tell us, and we make a different one. Start your free month, and we make them for you, one a week.',
    week: (n: number) => `Week ${n}`,
    styles: ['Hand-drawn', 'News studio', 'Cartoon', 'Vintage TV'],
    promoCard: {
      title: 'Your next sale or holiday special',
      teaser: 'Black Friday, a holiday sale, a new product? Tell us, and my team makes that week\u2019s social media video.',
    },
    howTitle: 'How it works',
    how: [
      { title: 'We plan your videos', text: 'My team reads your website and plans a new social media video for every week.' },
      { title: 'Tell us what\u2019s coming up', text: 'Got a Black Friday sale, a holiday special or a new product? Tell us, and that\u2019s the video we make. No ideas this week? My team picks one.' },
      { title: 'Your new video arrives every week', text: 'A real person on my team checks every video before it goes out, and you get it by email.' },
      { title: 'Ask for any change', text: 'The style, the script, the person on screen, the editing. Just ask, and my team changes it.' },
    ],
    getTitle: 'Everything you get',
    get: [
      '4 new social media videos every month, one a week',
      'Made by my team from your website and your ideas',
      'Your sales, holiday specials and new products, made on request',
      'Any change you want: style, script, person on screen, editing',
      'Cancel any time with one email, and keep every video',
    ],
    oneByOne: 'Bought one by one at $49: $196 a month',
    planPrice: 'Weekly Video Plan: $99 a month, under $25 per video',
    firstMonth: 'Your first month: $0',
    riskTitle: 'You take no risk',
    risk: [
      'Don\u2019t like a video? My team fixes or changes anything for you: the style, the script, the person on screen, the editing. No problem.',
      'Still not happy with the service, for any reason? Cancel any time with one email, and keep every video we made for you.',
      'No contract. That\u2019s how sure I am you\u2019ll love your videos.',
    ],
    faqTitle: 'Questions',
    faq: [
      { q: 'Will I be charged today?', a: 'No. Your first month is free: $0 today, then $99 a month after 30 days.' },
      { q: 'Did I already sign up when I paid $49?', a: 'No. The $49 was for your video ad only. The Weekly Video Plan starts only if you tap the green button.' },
      { q: 'Are the 4 pictures my videos?', a: 'Not yet. They\u2019re the ideas my team planned from your website. Your real videos get made once you start your free month.' },
      { q: 'Do I have to do anything?', a: 'No. My team plans and makes your videos. Tell us about a sale or a new product whenever you have one.' },
      { q: 'How do I cancel?', a: 'Send one email to support@bluefx.net, any time. You keep every video we made for you.' },
      {
        q: 'Can I get social media videos for more than 1 business?',
        a: 'Yes. Each business gets its own Weekly Video Plan, so every business gets its own new social media video every week. Start your free month now, then email support@bluefx.net and my team sets up your next business.',
      },
    ],
    /** One real client quote next to the price box (offer review 2026-10-27: one, with a face, where doubt peaks). */
    quote: clients(['Steve Kane'])[0],
    noThanks: 'No thanks, just my video ad',
    sign: 'I\u2019m looking forward to making your next videos and getting you more customers from social media.',
    signName: 'Szilard',
    declined: 'No problem. Your video ad is all yours.',
  },
  /** The two ways to change a paid video ad (owner 2026-10-27): 3 instant AI changes, the team always available. */
  changes: {
    open: 'Want something changed? Tap here',
    instantTitle: 'Instant: our AI engine makes your change right here',
    instantNote: (left: number) => `About 5 to 10 minutes. You have ${left} of 3 instant changes left.`,
    instantNone: 'You used your 3 instant changes. My team makes any other change for you.',
    placeholder: 'Example: Put 555-123-4567 on the last screen, and use a man\u2019s voice.',
    instantButton: 'Make My Change Now',
    starting: 'Starting...',
    humanTitle: 'Need human help? A team member makes the changes for you',
    humanNote: 'Up to 24 hours. Your changed video ad comes back by email.',
    humanButton: 'Ask My Team Instead',
    filesButton: 'Add photos, your logo or video clips',
    filesLimit: 'Up to 5 files, 100 MB each. Photos (JPG, PNG, HEIC) and videos (MP4, MOV).',
    filesTooBig: (names: string) => `Too big (over 100 MB): ${names}`,
    filesWrongType: (names: string) => `Photos and videos only: ${names}`,
    filesUploading: 'Uploading your files...',
    filesFailed: 'Your files did not upload. Please try again.',
    remove: 'Remove',
    working: (text: string) => `Making your change: \u201c${text}\u201d`,
    workingNote: 'This takes about 5 to 10 minutes. You can stay on this page or come back later.',
    doneNote: 'Here\u2019s your changed video ad. Not quite right? Make another change, or ask my team.',
    failed: 'That change did not work, and it does not count. Try again with other words, or ask my team.',
    versions: 'Your versions:',
    original: 'Original',
    version: (n: number) => `Change ${n}`,
    refusals: {
      style: 'A completely new style is made by my team. Tap \u201cAsk My Team Instead\u201d and tell us which style you want.',
      busy: 'Your last change is still being made. Give it a few minutes.',
      noneLeft: 'You used your 3 instant changes. My team makes any other change for you.',
      notPaid: 'Changes open once your payment is in.',
      generic: 'Your change did not start. Please try again, or ask my team.',
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
