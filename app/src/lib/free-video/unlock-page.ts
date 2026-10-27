import { SALES_PAGE } from '@/lib/free-video/sales-page';

/** The freelancer's price for 1 video ad like the free one (the owner's Fiverr screenshot, 2026-10-08). */
const FREELANCER = '$600';

/** The BlueFX clients whose words are about videos BlueFX made for them (not about the software). */
const CLIENTS = ['Alex Goad', 'Steve Kane', 'Tony Monaco', 'Gregory Green'] as const;

/**
 * The unlock page, /v/<token>/unlock (owner 2026-10-27, "it has to be strong, everything a strong sales page needs"):
 * the visitor's own video ad without the watermark for one payment, $49 for 7 days from the first visit, then $99.
 * Changes are included but never asked for before the payment. After the download: the Weekly Video Plan at $99 a
 * month. Copy rules: "your video ad" every time, no em dashes, concrete words. Prices come in as arguments, because the
 * lead's own clock picks them.
 */
export const UNLOCK_PAGE = {
  meta: (domain: string) => `Your video ad for ${domain}`,
  kicker: (domain: string) => `Your video ad for ${domain} is ready`,
  title: 'Download your video ad without the watermark in 5 minutes',
  sub: 'Pay once, post your video ad on Facebook today, and our team makes 2 rounds of changes for you, free, for 30 days.',
  priceUnit: 'one time',
  save: (regular: string, price: string) => `Launch price: save $${Number(regular.slice(1)) - Number(price.slice(1))}`,
  endsOn: (when: string, regular: string) => `Launch price ends ${when}. Then ${regular}.`,
  left: (days: number, hours: number) => (days > 0 ? `${days} ${days === 1 ? 'day' : 'days'} ${hours} h left` : `${hours} ${hours === 1 ? 'hour' : 'hours'} left`),
  button: (price: string) => `Unlock My Video Ad for ${price}`,
  guaranteeShort: '30-day money-back guarantee',
  trust: 'Cards and PayPal. Secure checkout by FastSpring.',
  afterClick: 'Finish the payment in the new tab. This page updates by itself as soon as the payment arrives.',
  bar: 'Unlock My Video Ad',

  proof: {
    line: 'BlueFX has made video ads for businesses since 2008',
    stars: '5 out of 5 stars',
  },

  compare: {
    title: (price: string) => `A video ad like yours costs ${FREELANCER} on Fiverr. Yours is ${price}.`,
    note: 'Fiverr is the biggest website for hiring freelancers. The price is a Top Rated seller’s basic package for 1 video ad like yours.',
    them: { name: 'A Fiverr freelancer', rows: [FREELANCER, '14 days of waiting', '2 revisions', 'You write the brief'] },
    us: (price: string) => ({ name: 'Your video ad', rows: [price, 'Ready in 5 minutes', '2 rounds of changes in 30 days', 'Already made from your website'] }),
    labels: ['Price', 'When you get your video ad', 'Changes', 'Your work'],
  },

  getTitle: 'What you get',
  get: [
    { title: 'Your video ad in full HD', text: 'Without the SAMPLE watermark and without the BlueFX end card.' },
    { title: 'Your download in 5 minutes', text: 'The download button shows up on this page, and a copy comes to your email.' },
    { title: 'Post your video ad anywhere', text: 'Facebook, Instagram, YouTube, TikTok and your website. Paid ads included. You own your video ad.' },
    { title: '2 rounds of changes by our team', text: 'Type the change on this page in plain words, any time in the next 30 days. Your changed video ad comes back by email within 24 hours.' },
  ],

  stepsTitle: 'How it works',
  steps: [
    { title: 'Tap the green button', text: 'Pay once with a card or PayPal on the secure FastSpring checkout.' },
    { title: 'Download your video ad', text: 'About 5 minutes later your clean video ad is on this page and in your email.' },
    { title: 'Ask for changes', text: 'Want anything different? Type the change here and our team makes it.' },
  ],

  changesTitle: 'Want something changed? Our team does that for free',
  changesText: 'You get 2 rounds of changes to the words, voice, photos, logo or presenter. Changes our team made for other business owners this week:',
  changes: [
    "'Organically grown' instead of 'certified organic'",
    'A real person on camera instead of drawings',
    "The owner's last name, said the right way",
    "The customer's own cap in the presenter's hand",
  ],

  reviewsTitle: 'What business owners say about BlueFX videos',
  reviews: CLIENTS.map((name) => SALES_PAGE.reviews.items.find((item) => item.name === name)).filter(
    (item): item is (typeof SALES_PAGE.reviews.items)[number] => Boolean(item)
  ),

  founder: {
    photo: SALES_PAGE.founder.photo,
    name: SALES_PAGE.founder.name,
    role: SALES_PAGE.founder.role,
    title: 'A note from me',
    text: (domain: string, price: string) => [
      "Hi, I'm Szilard. I've made videos for businesses since 2008, and I spend my own money on Facebook ads every week.",
      `Your video ad for ${domain} is already made. For ${price} you get the clean file today, and my team changes anything you want for 30 days.`,
      'If your video ad still doesn’t feel right, email me and you get every cent back.',
    ],
    sign: 'Szilard',
  },

  guaranteeTitle: '30-day money-back guarantee',
  guarantee: (price: string) =>
    `Download your video ad and post your video ad. If your video ad doesn't feel right for your business, email support@bluefx.net within 30 days and you get your ${price} back.`,

  faqTitle: 'Questions',
  faq: (price: string, regular: string, launch: boolean) => [
    { q: 'Is this a monthly plan?', a: `No. You pay ${price} once for your video ad. Nothing renews.` },
    ...(launch ? [{ q: `Why ${price} and not ${regular}?`, a: `${price} is the launch price for people who made a free video ad. After 7 days your video ad costs ${regular}.` }] : []),
    { q: 'What do I get after I pay?', a: 'A download button right on this page about 5 minutes after you pay, and your video ad in your email.' },
    { q: 'Who owns my video ad?', a: 'You do. Post your video ad anywhere you like, as often as you like, paid ads included.' },
    { q: 'Can I change my video ad later?', a: 'Yes. Type the change on this page in plain words, any time in the next 30 days. A new script or topic counts as a new video ad.' },
    { q: 'Do I need any software?', a: 'No. You get a normal video file that plays on every phone and computer.' },
    { q: 'What if I don’t like my video ad?', a: `Ask for a change first. If your video ad still doesn't feel right, email support@bluefx.net within 30 days and you get your ${price} back.` },
  ],
  bottomTitle: (domain: string) => `Post your video ad for ${domain} today`,
  ps: (price: string, launch: boolean, regular: string) =>
    launch
      ? `P.S. Your video ad is already made. ${price} gets you the clean file in 5 minutes, plus 2 rounds of changes. The launch price ends soon, then your video ad costs ${regular}.`
      : `P.S. Your video ad is already made. ${price} gets you the clean file in 5 minutes, plus 2 rounds of changes.`,

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
