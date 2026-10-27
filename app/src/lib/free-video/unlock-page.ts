import { SALES_PAGE } from '@/lib/free-video/sales-page';

/** The freelancer's price for 1 video ad like the free one (the owner's Fiverr screenshot, 2026-10-08). */
const FREELANCER = '$600';

type Client = (typeof SALES_PAGE.reviews.items)[number];
const clients = (names: readonly string[]) =>
  names.map((name) => SALES_PAGE.reviews.items.find((item) => item.name === name)).filter((item): item is Client => Boolean(item));

/** Short dates on the page: "Tue, Nov 3". */
export const shortDate = (iso: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
/** Long dates on the page: "Tuesday, November 3". */
export const longDate = (iso: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(iso));

/**
 * The unlock page, /v/<token>/unlock (owner 2026-10-27, "it has to be strong", then a 4-expert review the owner
 * approved in full): the visitor's own video ad without the watermark for one payment, $49 for 7 days from the first
 * visit, then $99. Changes are included but never asked for before the payment. After the download: the Weekly Video
 * Plan at $99 a month. Copy rules: "your video ad", no em dashes, concrete words, true facts only (the clean file is
 * the same 720 x 1280 render as the free one, so HD, not full HD). Prices come in as arguments, because the lead's own
 * clock picks them.
 */
export const UNLOCK_PAGE = {
  meta: (domain: string) => `Your video ad for ${domain}`,
  kicker: (domain: string) => `Your video ad for ${domain} is ready`,
  title: 'Post your video ad on Facebook today, without the watermark',
  sub: 'Pay once. Download your video ad in 5 minutes. Our team makes 2 rounds of changes for you in the next 30 days.',
  priceUnit: 'one time',
  save: (regular: string, price: string) => `Your free video ad price: save $${Number(regular.slice(1)) - Number(price.slice(1))}`,
  ends: (iso: string, regular: string) => `Ends ${shortDate(iso)}, then ${regular}`,
  left: (ms: number) => {
    const minutes = Math.max(1, Math.ceil(ms / 60_000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'}${hours ? ` ${hours} h` : ''} left`;
    return `${hours ? `${hours} h ` : ''}${minutes % 60} min left`;
  },
  button: (price: string) => `Unlock My Video Ad for ${price}`,
  promiseShort: 'The Feel-Right Promise: changes, or every cent back for 30 days',
  trust: 'Secure checkout by FastSpring. Cards and PayPal.',
  afterClick: 'Finish the payment in the new tab. This page updates by itself as soon as the payment arrives.',
  bar: 'Unlock My Video Ad',
  barWaiting: 'Waiting for your payment...',
  barCheck: 'Paid? Tap here',

  proof: {
    line: 'BlueFX has made video ads for businesses since 2008',
    stars: '5 out of 5 stars',
    faces: clients(['Alex Goad', 'Steve Kane', 'Tony Monaco', 'Gregory Green']),
  },

  compare: {
    title: (price: string) => `A video ad like yours costs ${FREELANCER} on Fiverr. Yours is ${price}.`,
    note: 'Fiverr is the biggest website for hiring freelancers. The price is a Top Rated seller’s basic package for 1 video ad like yours.',
    labels: ['Price', 'Ready in', 'Changes', 'Your work'],
    them: { name: 'A Fiverr freelancer', rows: [FREELANCER, '14 days', '2 revisions', 'You explain everything to them'] },
    us: (price: string) => ({ name: 'Your video ad', rows: [price, '5 minutes', '2 rounds in 30 days', 'Already made from your website'] }),
  },

  changesTitle: 'Want something changed? Our team does that for free',
  changesText: 'You get 2 rounds of changes to the words, voice, photos, logo or presenter. Changes our team made for other business owners recently:',
  changes: [
    "'Organically grown' instead of 'certified organic'",
    'A real person on camera instead of drawings',
    "The owner's last name, said the right way",
    "The shop's own cap in the presenter's hand",
  ],

  getTitle: 'What you get',
  get: [
    { title: 'Your video ad in HD, made for phones', text: 'Without the SAMPLE watermark and without the BlueFX logo at the end.' },
    { title: 'Your download in 5 minutes', text: 'The download button shows up on this page, and a copy comes to your email.' },
    { title: 'Post your video ad anywhere', text: 'Facebook, Instagram, YouTube, TikTok and your website. You can use your video ad in paid Facebook ads too. You own your video ad.' },
    { title: '2 rounds of changes by our team', text: 'Type the change on this page in plain words, any time in the next 30 days. A real person on our team makes the change, and your changed video ad comes back by email within 24 hours.' },
  ],

  reviewsTitle: 'What clients say about videos BlueFX made for them',
  /** Owner 2026-10-27: the 2 quotes about the work itself; the $1 million and "atomic power" quotes read as hype next to $49. */
  reviews: clients(['Steve Kane', 'Tony Monaco']),

  founder: {
    photo: SALES_PAGE.founder.photo,
    name: SALES_PAGE.founder.name,
    role: SALES_PAGE.founder.role,
    title: (price: string) => `Why your video ad is ${price} and not ${FREELANCER}`,
    text: (domain: string, price: string) => [
      "Hi, I'm Szilard. I've made videos for businesses since 2008, and I spend my own money on Facebook ads every week.",
      `Your video ad for ${domain} is already made from your website, so the hard part is done. That is why you pay ${price} and not the ${FREELANCER} a freelancer charges. My team changes anything you want for 30 days.`,
      'If your video ad still doesn’t feel right, email me and you get every cent back.',
    ],
    sign: 'Szilard',
  },

  guaranteeTitle: 'The Feel-Right Promise',
  guarantee: (price: string) =>
    `If your video ad doesn't feel right for your business, our team changes your video ad, 2 rounds in 30 days. Still not right? Email support@bluefx.net within 30 days and you get every cent of your ${price} back.`,

  faqTitle: 'Questions',
  faq: (price: string, regular: string, launch: boolean, filesUntil: string | null) => [
    { q: 'Is this a monthly plan?', a: `No. You pay ${price} once for your video ad. Nothing renews.` },
    ...(launch ? [{ q: `Why ${price} and not ${regular}?`, a: `${price} is the price for people who made a free video ad. After 7 days your video ad costs ${regular}.` }] : []),
    { q: 'Who makes my changes?', a: 'A real person on our team. Your changed video ad comes back by email within 24 hours.' },
    { q: 'Can I add my phone number or my offer?', a: 'Yes. Type the change on this page in plain words, for example "Put our phone number on the last screen."' },
    { q: 'What file do I get?', a: 'An MP4 video file in HD (720 x 1280), standing up for phones, usually 40 to 55 seconds long. Facebook, Instagram, TikTok and YouTube Shorts take your video ad as it is.' },
    { q: 'Is the person in my video ad real?', a: 'The presenter in your video ad is an AI presenter, made for your video ad. Want a different person, or no person at all? Ask for that as one of your changes.' },
    { q: 'Will Facebook run my video ad as a paid ad?', a: 'Facebook checks every paid ad before it runs. Some products, like CBD or supplements, need Facebook’s approval first. Posting your video ad on your own Facebook page, your website or YouTube works for every business.' },
    { q: 'Who owns my video ad?', a: 'You do. Post your video ad anywhere you like, as often as you like, paid ads included.' },
    ...(filesUntil ? [{ q: 'How long can I unlock my video ad?', a: `Until ${longDate(filesUntil)}. The working files of your video ad are deleted 30 days after your video ad was made, and after that your video ad can't be unlocked.` }] : []),
    { q: 'What if I don’t like my video ad?', a: `Ask for a change first. If your video ad still doesn't feel right, email support@bluefx.net within 30 days and you get your ${price} back.` },
  ],
  bottomTitle: (domain: string) => `Post your video ad for ${domain} today`,
  filesLine: (iso: string) => `Your video ad can be unlocked until ${longDate(iso)}.`,
  ps: (domain: string, price: string, regular: string, endsAt: string | null) =>
    `P.S. Your video ad for ${domain} is already made. A freelancer charges ${FREELANCER} and makes you wait 14 days for a video ad like yours. Your video ad is ${price}${endsAt ? ` until ${longDate(endsAt)}, then ${regular}` : ''}, and the Feel-Right Promise covers every cent.`,

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
    changeLabel: 'Want a change? Type the change here',
    changePlaceholder: 'Example: Put our phone number on the last screen.',
    changeButton: 'Send My Change',
    sending: 'Sending...',
    changeNote: 'Free, 2 rounds in 30 days. Your changed video ad comes back by email within 24 hours.',
    sent: (left: number) =>
      `Got it. Our team is making your change and emails your changed video ad within 24 hours. ${left === 1 ? 'You have 1 more round of changes.' : left > 1 ? `You have ${left} more rounds of changes.` : 'That was your last round of changes.'}`,
    refusals: {
      noRoundsLeft: 'You used both rounds of changes. For more changes, email support@bluefx.net.',
      tooLate: 'The 30 days for changes are over. For more changes, email support@bluefx.net.',
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
