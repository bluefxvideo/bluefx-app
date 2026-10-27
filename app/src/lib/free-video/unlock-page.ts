import { UNLOCK } from '@/lib/free-video/offer';

const P = UNLOCK.price;

/**
 * The unlock page, /v/<token>/unlock (owner 2026-10-27, after a 4-expert review): one offer, the visitor's own video ad
 * without the watermark for one payment, ready about 5 minutes later. Changes are included but never asked for before
 * the payment. After the download: the Weekly Video Plan at $99 a month. Copy rules: "your video ad" every time, no em
 * dashes, concrete words.
 */
export const UNLOCK_PAGE = {
  meta: (domain: string) => `Your video ad for ${domain}`,
  price: P,
  kicker: (domain: string) => `Your video ad for ${domain}`,
  title: 'Download your video ad without the watermark in 5 minutes',
  sub: 'Pay once and post your video ad on Facebook today. Want anything changed in the next 30 days? Our team makes the change for free.',
  priceUnit: 'one time',
  priceNote: 'Nothing renews',
  button: `Unlock My Video Ad for ${P}`,
  trust: 'Cards and PayPal. Secure checkout by FastSpring.',
  afterClick: 'Finish the payment in the new tab. This page updates by itself as soon as the payment arrives.',
  bar: 'Unlock My Video Ad',

  getTitle: `What you get for ${P}`,
  get: [
    'Your video ad in full HD, without the SAMPLE watermark and the BlueFX end card',
    'Your download button on this page about 5 minutes after you pay, plus a copy in your email',
    'Post your video ad on Facebook, Instagram, YouTube, TikTok and your website, paid ads included',
    '2 rounds of changes by our team for 30 days, free',
  ],

  changesTitle: 'Want something changed? Our team does that for free',
  changesText:
    'After you pay, type the change on this page in plain words, any time in the next 30 days. You get 2 rounds of changes to the words, voice, photos, logo or presenter. Changes our team made for other business owners this week:',
  changes: [
    "'Organically grown' instead of 'certified organic'",
    'A real person on camera instead of drawings',
    "The owner's last name, said the right way",
    "The customer's own cap in the presenter's hand",
  ],

  guaranteeTitle: '30-day money-back guarantee',
  guarantee: `Download your video ad and post your video ad. If your video ad doesn't feel right for your business, email support@bluefx.net within 30 days and you get your ${P} back.`,

  faqTitle: 'Questions',
  faq: [
    { q: 'Is this a monthly plan?', a: `No. You pay ${P} once for your video ad. Nothing renews.` },
    { q: 'What do I get after I pay?', a: 'A download button right on this page about 5 minutes after you pay, and your video ad in your email.' },
    { q: 'Who owns my video ad?', a: 'You do. Post your video ad anywhere you like, as often as you like, paid ads included.' },
    { q: 'Can I change my video ad later?', a: 'Yes. Type the change on this page in plain words, any time in the next 30 days. A new script or topic counts as a new video ad.' },
  ],
  bottomTitle: (domain: string) => `Post your video ad for ${domain} today`,

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
