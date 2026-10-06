/**
 * Every visible string of the free video ad funnel, in one place, as DRAFTS for the owner to approve.
 *
 * The owner's rules for this file: no em-dashes, never "it" for the video ad (write "the video ad"),
 * no stacked decorative negation, concrete words, contractions, English only. The landing page never
 * mentions the watermark or any price (owner 2026-10-06): both offers live on the status pages only.
 * Emails never print a buy price; "$700 off" is the only money figure an email may carry.
 * Placeholders are functions.
 *
 * Client-safe: no process.env and no server imports. Pages, components and server code all import it.
 * Server code relies on VALIDATION (types/free-video.ts) and on ERRORS: keep those keys and signatures.
 */

import { OFFER, UNLOCK } from './offer';

export const SUPPORT_EMAIL = 'support@bluefx.net';

/** Page titles and descriptions (Next.js metadata). */
export const PAGE_META = {
  landingTitle: 'Free Video Ad for Your Business | BlueFX',
  thanksTitle: 'Your free video ad is on the way | BlueFX',
  videoTitle: (domain: string) => `Your video ad for ${domain}`,
} as const;

/** The funnel header and footer. The owner confirms the two links (both answered 200 on 2026-10-05). */
export const LAYOUT = {
  logoAlt: 'BlueFX',
  questions: 'Questions?',
  privacy: 'Privacy policy',
  privacyUrl: 'https://bluefx.net/privacy-policy/',
  terms: 'Terms',
  termsUrl: 'https://bluefx.net/terms/',
  copyright: '© BlueFX',
} as const;

/**
 * The landing page (v8, modelled on Neil Patel's free tools, owner 2026-10-06): a small label, the promise,
 * one website field with a "Start here!" note, then 3 numbered steps beside a result card; the name and
 * email come in step 2. No watermark and no price on this page (owner 2026-10-06): both offers live on the
 * status pages only. No wait time is promised either, because a busy day puts the video ad in a queue.
 */
export const LANDING = {
  /** The small label above the headline. */
  pill: 'Free video ad maker',
  h1: 'Get a free video ad for your business',
  sub: 'Type your website. The Phantom turns the words and photos on it into a video ad with a voice-over and music.',
  /** The hand-drawn note pointing at the website field (wide screens only). */
  startHere: 'Start here!',
  /** The small lines under the website field: what it does not cost. */
  trust: ['100% free', 'No credit card', 'No account to create'],
  /** The numbered steps beside the result card, in order. */
  steps: [
    { title: 'Add your website', text: 'The Phantom reads the words and photos on your website.' },
    { title: 'The Phantom makes your video ad', text: 'The script, the voice-over, the music and the captions.' },
    { title: 'Get your video ad by email', text: 'Post the video ad on Facebook, Instagram, TikTok and YouTube Shorts.' },
  ],
  /** The blue band at the bottom, with the same website field. */
  bottomHeading: 'Ready for your free video ad?',
} as const;

/**
 * The sticky bar at the bottom of the screen (as on neilpatel.com, owner 2026-10-06 "I like the lil sticky banner
 * at the bottom too"). It slides up once the top field is out of view and hides near the bottom form.
 * Wide screens: the line, the website field and the button. Phones: the line and a button back to the top field.
 */
export const STICKY = {
  label: 'Get a free video ad',
  /**
   * The owner at the bar's left edge, popping up over it and pointing at the line (owner 2026-10-06: "add me onto
   * it, we had the first image with me"): the first pointing photo, cut at the waist and flipped to point right.
   */
  photo: { src: '/free-video/owner-sticky.webp', width: 559, height: 600 },
  title: 'Try The Phantom on your website',
  text: 'A free video ad with a voice-over and music, by email.',
  /** Phones: scrolls back to the top field and opens the keyboard. */
  start: 'Start',
  close: 'Close',
} as const;

/**
 * The proof strip under the top card (as Ubersuggest's "Trusted by over 250,000 users"). Only numbers the
 * owner already publishes: bluefx.net ("Used by 36,000+ customers", "since 2009", "Our clients have
 * brought in 220K+ leads") and the BlueFx Video AI YouTube channel (22K subscribers, 2026-10-06).
 */
export const PROOF = {
  lead: 'BlueFX has made videos for businesses since 2009',
  stats: [
    { value: '36,000+', label: 'customers' },
    { value: '22K', label: 'YouTube subscribers' },
    { value: '220K+', label: 'leads for our video clients' },
  ],
} as const;

/** The questions at the bottom of the landing page. Every answer is true today; none mentions a price or the watermark. */
export const FAQ = {
  eyebrow: 'Questions',
  heading: 'Before you start',
  items: [
    { q: 'Is the video ad really free?', a: 'Yes. Every business gets one free video ad. No credit card, and no account to create.' },
    { q: 'What do I need?', a: 'Only your website address. The Phantom reads the words and photos on your website and writes the video ad from them.' },
    { q: 'What kind of business can use it?', a: 'Any business with its own website: restaurants, real estate agents, local services, online stores and more.' },
    { q: 'How do I get my video ad?', a: 'By email, as soon as The Phantom finishes it. You can also watch and download the video ad on your video ad page.' },
    { q: 'Who is behind this?', a: 'BlueFX. We have made videos for businesses since 2009, and 36,000+ customers have used our video tools and templates. The Phantom is one of the tools inside our AI Media Machine.' },
  ],
} as const;

/**
 * The card beside the steps, drawn as this page in a browser window with the "how it works" video ad playing
 * inside (EXAMPLE_VIDEOS.heroReel). The checklist is what every free video ad gets, so every line is true.
 */
export const RESULT_PREVIEW = {
  address: 'app.bluefx.net/free-video-ad',
  badge: 'How it works',
  title: 'From your website to a video ad',
  checklist: ['A script written from your website', 'A voice-over and music', 'Vertical, for Reels, TikTok and Shorts', 'Sent to your email'],
  /** A real button: it opens the video with sound. */
  watch: 'Watch with sound',
  file: '27 seconds',
} as const;

/** The hero reel and the examples section: every video on the landing page opens one player, with sound. */
export const EXAMPLES = {
  /** The silent reel in the hero (a button: screen readers hear the label, everyone sees the chip). */
  reelLabel: 'Watch how it works, with sound',
  reelChip: 'Watch with sound',
  eyebrow: 'Examples',
  /** The ads in the row were made by the BlueFX team in the ad studio, so the heading never says The Phantom made them. */
  heading: 'Video ads made by BlueFX',
  lead: 'Restaurants, dentists, realtors, gyms and more. Tap the speaker on a video ad to hear it.',
  soundOn: (tag: string) => `Turn the sound on: ${tag.toLowerCase()} video ad`,
  soundOff: (tag: string) => `Turn the sound off: ${tag.toLowerCase()} video ad`,
  prev: 'Previous video ads',
  next: 'More video ads',
  madeFor:
    'Made for restaurants, dentists, realtors, contractors, plumbers, roofers, landscapers, cleaners, salons, gyms, chiropractors, vets, lawyers, insurance agents, mortgage brokers, auto shops, daycares, churches, online stores and every local business with something to sell.',
  /** The button on each thumbnail (screen readers). */
  playLabel: (name: string) => `Play the video ad: ${name.toLowerCase()}`,
  /** The player window (screen readers). */
  dialogLabel: (name?: string) => (name ? `Example video ad: ${name.toLowerCase()}` : 'Example video ad'),
  close: 'Close the video ad',
} as const;

const EXAMPLES_BASE = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video';

/**
 * Every example video on the landing page. Real Phantom renders, each made from a link, in three
 * different looks (720x1280 H.264, faststart). Swapping a video is a change to this one constant.
 */
export const EXAMPLE_VIDEOS = {
  /**
   * The video in the top card (owner 2026-10-06: "why don't we just make an awesome video ad about the service?"):
   * a 27 s video ad about the free video ad, made in the ad studio (ad-studio/public/ads/fv-promo, build.py): an AI
   * presenter (Kling AI Avatar on the narrator's own voice), a real screen recording of this page, real Phantom
   * renders, the email notification. Plays muted in a loop; a tap opens heroReel.opens with sound. (The earlier
   * clips hero/listing-reel, hero/pizza-reel and hero/reel are unused.)
   */
  heroReel: {
    video: `${EXAMPLES_BASE}/hero/promo.mp4`,
    poster: `${EXAMPLES_BASE}/hero/promo.jpg`,
    opens: 'promo',
  },
  /** The examples section, in order. */
  ads: [
    { id: 'pizza', name: 'Pizza shop', video: `${EXAMPLES_BASE}/pizza/video.mp4`, poster: `${EXAMPLES_BASE}/pizza/poster.jpg` },
    { id: 'listing', name: 'Home for sale', video: `${EXAMPLES_BASE}/listing/video.mp4`, poster: `${EXAMPLES_BASE}/listing/poster.jpg` },
    { id: 'welder', name: 'Laser welder', video: `${EXAMPLES_BASE}/welder/video.mp4`, poster: `${EXAMPLES_BASE}/welder/poster.jpg` },
    { id: 'realtor', name: 'Real estate agent', video: `${EXAMPLES_BASE}/reel/realtor.mp4`, poster: `${EXAMPLES_BASE}/reel/realtor.jpg` },
    { id: 'promo', name: 'How it works', video: `${EXAMPLES_BASE}/hero/promo.mp4`, poster: `${EXAMPLES_BASE}/hero/promo.jpg` },
  ],
} as const;
export type ExampleVideoAd = (typeof EXAMPLE_VIDEOS.ads)[number];

const REEL_BASE = `${EXAMPLES_BASE}/reel`;

/**
 * The autoplay row of video ads (owner 2026-10-06: "the top ads we had there on autoplay, those are the best and
 * I like that autoplay way"): the 14 ads from the top of bluefx.net/video-ad/, same order and labels, copied to
 * storage as examples/free-video/reel/<id>.mp4 and .jpg (720x1280 with sound, 0.9 to 4 MB each).
 */
export const REEL_ADS = (
  [
    { id: 'bbq', tag: 'Restaurant' },
    { id: 'toon', tag: 'Insurance' },
    { id: 'dentalfaq', tag: 'Dentist' },
    { id: 'realtor', tag: 'Real estate' },
    { id: 'ugc', tag: 'Gym' },
    { id: 'yardstory', tag: 'Landscaping' },
    { id: 'daycare', tag: 'Daycare' },
    { id: 'furniture', tag: 'Furniture store' },
    { id: 'mortgage', tag: 'Mortgage' },
    { id: 'pest', tag: 'Pest control' },
    { id: 'reviews', tag: 'Veterinarian' },
    { id: 'chat', tag: 'Cleaning service' },
    { id: 'boutique', tag: 'Clothing store' },
    { id: 'solar', tag: 'Solar' },
  ] as const
).map((ad) => ({ ...ad, video: `${REEL_BASE}/${ad.id}.mp4`, poster: `${REEL_BASE}/${ad.id}.jpg` }));

/** Step 1 (the website field, twice on the landing page) and step 2 (the sheet with name and email). */
export const FORM = {
  /** Step 1. The label is read by screen readers only. */
  website: 'Your business website',
  websitePlaceholder: 'yourbusiness.com',
  websiteButton: 'Make my free video ad',
  /** Step 2: a bottom sheet on phones, a centred window from 640 px. */
  stepTag: 'Step 2 of 2',
  sheetTitle: (domain: string) => `Where should we send your video ad for ${domain}?`,
  close: 'Close',
  firstName: 'Your first name',
  firstNamePlaceholder: 'Joe',
  email: 'Your email',
  emailPlaceholder: 'you@yourbusiness.com',
  sendButton: 'Send me my free video ad',
  /** Shown on the send button once a submit has taken longer than 1 s (the website check runs first). */
  busy: 'Checking your website...',
  /** Sits under the send button. Sending the form is the consent. */
  consent: "We'll email you the link to your video ad, plus a few short tips on getting more customers with video. You can unsubscribe with one click.",
  /** The silent answer to a bot (honeypot filled). Nothing is stored. */
  silentThanks: 'Thanks! Check your inbox.',
  /** The request never reached the server (no connection). */
  offline: "We couldn't reach our server. Please check your internet connection and try again.",
} as const;

/** Field messages used by FreeVideoLeadSchema (types/free-video.ts) and by the form's own check. */
export const VALIDATION = {
  firstNameMissing: 'Please type your first name',
  firstNameOnly: 'Please type only your first name',
  firstNameLong: 'Please type a shorter first name',
  email: "That email address doesn't look right",
  websiteMissing: 'Please type your website address',
  websiteLong: 'That website address is too long',
  consent: 'Please agree to get the link to your video ad by email',
} as const;

/** Answers of POST /api/free-video, keyed by the error code the route returns (code 'refused' uses refusedHost). */
export const ERRORS = {
  /** normalizeWebsite could not make a public web address out of the text. */
  invalid: 'Please type your website address, for example yourbusiness.com.',
  refusedHost:
    "Please type your own business website, for example yourbusiness.com. The Phantom can't use pages on Amazon, Zillow, Google, Facebook, Instagram and other big platforms for the free video ad.",
  notFound: (domain: string) =>
    `We couldn't find ${domain}. Please check the spelling. If your website opens in your browser, copy the address from the address bar and paste the address here.`,
  unreadable: (domain: string) =>
    `We couldn't read ${domain}. Some websites hide their text behind a login, or load the text in a way our reader can't see. Try another page of your website with more text on the page, like your About or Services page.`,
  duplicateEmail: `This email address already has a free video ad. Look for our email from ${SUPPORT_EMAIL}, and check your spam folder too. If the video ad is still being made, the email arrives as soon as the video ad is ready.`,
  duplicateSite: (domain: string) =>
    `${domain} already has a free video ad. We make one free video ad for each business website. If you asked for that video ad, look for our email from ${SUPPORT_EMAIL}.`,
  tooMany: "You've asked for several free video ads today. Please come back tomorrow.",
  closed: "Today's free video ads are all taken. Please come back tomorrow.",
  paused: 'The free video ad maker is taking a short break. Please try again in an hour.',
  generic: 'Something went wrong on our side. Please try again in a minute.',
} as const;

/**
 * The next step under a form error, so no answer is a dead end. Both open the visitor's own email app
 * (a mailto link to support), so no address goes anywhere else.
 */
export const NEXT_STEPS = {
  /** Under duplicateEmail and duplicateSite. */
  resendLead: "Can't find our email?",
  resendLink: 'Ask us to send the link again',
  resendSubject: 'Please send my free video ad link again',
  resendBody: (website: string) =>
    `Hi, please send me the link to my free video ad again.${website ? `\n\nMy website: ${website}` : ''}`,
  /**
   * Under refusedHost. OWNER DECISION: this promises a video ad made by hand from emailed photos
   * (The Phantom with photos and text, about $1 and a few minutes each). Drop these five lines to
   * show the refusal on its own.
   */
  noWebsiteLead: 'No website of your own?',
  noWebsiteLink: 'Email us 3 photos of your work and a few lines about your business',
  noWebsiteAfter: ", and we'll make your free video ad from those.",
  noWebsiteSubject: 'Free video ad from my photos',
  noWebsiteBody: 'Hi, I have no website of my own. Here are 3 photos of my work and a few lines about my business:\n\n',
} as const;

/** "1 minute", "45 minutes", "1 hour", "1.5 hours". */
function aboutTime(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) return rounded === 1 ? '1 minute' : `${rounded} minutes`;
  const hours = Math.round(rounded / 30) / 2;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

/** The live status page: /free-video-ad/thanks/<token> and /v/<token>. */
export const STATUS = {
  /** ahead = FreeVideoView.position, the number of video ads in line before this one (0 = next). */
  queuedTitle: (name: string, domain: string, ahead: number) =>
    ahead <= 0
      ? `Thanks, ${name}. Your video ad for ${domain} is next in line`
      : `Thanks, ${name}. Your video ad for ${domain} is number ${ahead + 1} in line`,
  makingTitle: (name: string, domain: string) => `Thanks, ${name}. The Phantom is making your video ad for ${domain}`,
  eta: (minutes: number) => `Your video ad should be ready in about ${aboutTime(minutes)}.`,
  /** A long queue (the computed wait is past 90 minutes): no exact time. */
  etaBusy: 'Lots of business owners asked for a free video ad today, so your video ad may take a few hours.',
  /** etaMinutes null, etaNote 'paused': new starts are switched off for now (settings.starting = false). */
  etaPaused: 'The Phantom is taking a short break. Your spot in line is saved.',
  /** etaMinutes null, etaNote 'capped': the rolling 24 h cap will not reach this video ad today (review F5). */
  etaCapped: "Today's free video ads are all handed out. Your spot in line is saved, and The Phantom starts on your video ad the moment there's room.",
  closeOk: "You can close this page. We'll email you the link as soon as your video ad is ready.",
  steps: {
    reading: (domain: string) => `Reading ${domain}`,
    writing: 'Writing the script',
    recording: 'Recording the voice-over and making the music',
    rendering: 'Putting the video ad together',
    renderingPercent: (percent: number) => `Putting the video ad together (${Math.round(percent)}%)`,
    finalCheck: 'Final check',
  },
  /** Screen readers: the step that is running now. */
  nowLabel: (step: string) => `Now: ${step}`,
  progressLabel: 'How far your video ad is',
  readyTitle: (domain: string) => `Your video ad for ${domain} is ready`,
  /** The note above the offers on the thank-you page. */
  readyNoteThanks: "We're emailing you the link to this page too, so you can come back any time.",
  /** The same note on /v/<token>, which the visitor reached from that email. */
  readyNoteEmail: 'Bookmark this page to come back to your video ad any time.',
  checkingTitle: (domain: string) => `Your video ad for ${domain} is getting a final check`,
  checking: "Our team is giving your video ad a final check. We'll email you the link as soon as the video ad is ready.",
  failedTitle: (domain: string) => `We hit a problem with your video ad for ${domain}`,
  failed: (domain: string) =>
    `Something went wrong while making your video ad for ${domain}. Our team has the details and will email you.`,
  unreadableTitle: (domain: string) => `We couldn't read ${domain}`,
  unreadable:
    "Some websites hide their text behind a login, or load the text in a way our reader can't see. Try another page of your website with more text on the page, like your About or Services page.",
  unreadableNote: 'This try cost you nothing, and you can use the same email address again.',
  retryButton: 'Try another page of your website',
  /** Shown when the page stops checking (90 minutes without the tab coming back into view). */
  stale: 'This page stopped checking for news about your video ad.',
  staleButton: 'Check again',
  /** The page could not read the video ad's details (a database hiccup). */
  loadErrorTitle: "We couldn't load this page",
  loadError: 'Please reload the page in a minute. Nothing you sent us is lost.',
  reload: 'Reload the page',
  /** Above the lifetime offer while the visitor waits. */
  whileYouWait: 'While you wait',
  /** The waiting page's line about Offer 1. */
  teaser: `Your free video ad has a BlueFX watermark in the middle. When the video ad is ready, you can unlock the clean version for ${UNLOCK.price}.`,
  /** Browser tab titles. */
  tabTitles: {
    queued: 'Your video ad is in line',
    making: (step: number) => `Making your video ad (${step}/5)`,
    checking: 'Your video ad is getting a final check',
    ready: 'Your video ad is ready',
  },
} as const;

/** The look names the director picks from (lib/smart-video/types STYLE_NAMES), as the live page says them. */
const LOOK_NAMES: Record<string, string> = { playful: 'Playful', elegant: 'Elegant', bold: 'Bold', clean: 'Clean', whiteboard: 'Whiteboard' };

/**
 * The live status page (owner 2026-10-06: "visualize and actually show what we are building"): every line
 * names a real piece of the visitor's video ad, shown the moment The Phantom has made it.
 */
export const LIVE = {
  pill: 'Live',
  pillQueued: 'In line',
  readyPill: 'Ready',
  title: (name: string, domain: string) => `${name}, The Phantom is making your video ad for ${domain}`,
  emailNote: "We'll also email you the link.",
  readingTitle: (domain: string) => `Reading ${domain}`,
  readingHint: 'The Phantom is reading the words and the photos on your website.',
  photosTitle: (domain: string) => `Found on ${domain}`,
  photosCount: (count: number) => `${count} ${count === 1 ? 'photo' : 'photos'} The Phantom can use`,
  writingTitle: 'Writing your script',
  writingHint: (domain: string) => `The Phantom is picking the best facts from ${domain} and writing what the voice will say, scene by scene.`,
  scriptTitle: 'Your script, scene by scene',
  scriptHint: (look?: string) =>
    look && LOOK_NAMES[look] ? `Written from your website. The Phantom picked the ${LOOK_NAMES[look]} look for your video ad.` : 'Written from your website.',
  sceneLabel: (number: number) => `Scene ${number}`,
  drawing: 'The hand is drawing this scene',
  making: 'Making this picture',
  moving: 'Moving',
  voiceTitle: 'Your voice-over is recorded',
  voicePlay: 'Listen to your voice-over',
  musicTitle: 'Music made for your video ad',
  musicPlay: 'Listen to the music',
  pause: 'Pause',
  renderTitle: 'Putting your video ad together',
  renderHint: 'The Phantom is joining the scenes, the voice-over and the music.',
  checkTitle: 'Final check',
  checkHint: 'The Phantom is checking every scene, the sound and the file.',
  queuedHint: 'While you wait, see how The Phantom makes a video ad.',
  promoLabel: 'How The Phantom makes a video ad',
} as const;

/**
 * The 5 progress lines in order, for the job steps reading → directing → producing → rendering → finishing.
 * renderPercent shows on the 4th line only while that step runs.
 */
export function statusSteps(domain: string, renderPercent?: number): string[] {
  return [
    STATUS.steps.reading(domain),
    STATUS.steps.writing,
    STATUS.steps.recording,
    renderPercent === undefined ? STATUS.steps.rendering : STATUS.steps.renderingPercent(renderPercent),
    STATUS.steps.finalCheck,
  ];
}

/** The player of the visitor's own video ad on the ready page. */
export const PLAYER = {
  label: (domain: string) => `Your video ad for ${domain}`,
  soundOn: 'Tap for sound',
  /** When the phone blocks even muted autoplay (Low Power Mode). */
  play: 'Play the video ad',
  loadError: "The video ad didn't load. Please reload the page, or use the download button.",
} as const;

/** The download buttons and saving the video ad to Photos on an iPhone. */
export const DOWNLOAD = {
  free: 'Download the free version (with watermark)',
  saveToPhotos: 'Save to Photos',
  saveToPhotosBusy: 'Getting the video ad ready...',
  saveToPhotosAgain: 'Tap again to save the video ad',
  saveToPhotosHint: "Opens your iPhone's Share menu. Choose Save Video, and the video ad shows up in Photos.",
  /** iPhones without the Share menu for files: Safari puts a download in Files, not in Photos. */
  iphoneTip:
    "On an iPhone: tap Download, then tap the download arrow in Safari's address bar and open the video ad. Tap Share, then Save Video, and the video ad shows up in Photos.",
  /** The same names the download links use (leads.ts). */
  fileName: (domain: string) => `${domain}-video-ad-free.mp4`,
  cleanFileName: (domain: string) => `${domain}-video-ad.mp4`,
} as const;

/** Offer 1: the clean video ad, without the watermark (FastSpring, one time). Status pages only. */
export const UNLOCK_COPY = {
  tag: 'Offer 1',
  title: 'Unlock the full video ad, with no watermark',
  body: (domain: string) =>
    `The same video ad for ${domain} in full HD, without the BlueFX watermark and end card. Post the video ad as your own on Facebook, Instagram and TikTok.`,
  price: UNLOCK.price,
  priceUnit: 'one time',
  button: `Unlock my video ad for ${UNLOCK.price}`,
  fine: 'Secure checkout by FastSpring. The clean video ad is ready about 5 minutes after you pay, right here on this page and by email.',
  /** Under the button once it was clicked: the checkout opened in a new tab. */
  afterClick: 'Finish the payment in the new tab. This page updates by itself as soon as the payment arrives.',
  paidTitle: 'Payment received',
  paidBody: 'The Phantom is making your clean video ad (about 5 minutes).',
  paidFine: "You can stay here or close this page. We'll email you the link to the clean video ad too.",
  /** Paid before the free video ad was done (possible through the email link). */
  paidEarly: 'Payment received. The Phantom makes your clean video ad right after your free video ad is ready.',
  readyTitle: 'Your clean video ad is ready',
  readyBody: 'Full HD, without the watermark and end card. Download the video ad and post the video ad as your own.',
  readyButton: 'Download the clean video ad',
  readyFine: "Thanks for your order. We're emailing you the download link too.",
  failedTitle: 'Your payment is in',
  failedBody: 'Making the clean video ad hit a problem. Our team has the details and will email you.',
} as const;

/** Offer 2: AI Media Machine lifetime (ClickBank). Status pages only; the ladder comes from OFFER (offer.ts). */
export const OFFER_COPY = {
  tag: 'Offer 2',
  /** While the visitor waits. */
  headingWaiting: 'Make 100+ video ads a year yourself',
  bodyWaiting:
    "The Phantom that's making your video ad is one of the tools inside AI Media Machine. Paste a website, a few lines about an offer or a few photos, and The Phantom makes a finished video ad with a voice-over and music in 3 to 7 minutes.",
  /** Under the finished video ad. */
  heading: 'Or make 100+ video ads a year yourself',
  body: 'The Phantom that made your video ad is one of the tools inside AI Media Machine.',
  /** 600 credits a month x 12 / 50 credits per video ad = 144 a year (offer.ts). */
  bullets: [
    '100+ video ads a year, every one without a watermark',
    'Edits included: change the images, footage, music, script and voice',
    '12 bonus video tools, like AI Avatar, Clone Studio, Video Swap and ReelEstate',
    'Pay once and keep AI Media Machine for life',
    '30-day money-back guarantee',
  ],
  /** Shown struck through; screen readers hear wasLabel first. */
  was: OFFER.was,
  wasLabel: 'Regular price',
  now: OFFER.now,
  nowLabel: 'Now',
  unit: 'one time',
  /** The badge. */
  off: OFFER.off,
  button: 'Get lifetime access',
  smallPrint: 'Secure checkout by ClickBank.',
  /** Existing customers (isCustomer) see this instead of the ladder. */
  customerTitle: 'You already have AI Media Machine',
  customerBody: 'Make your next video ad in The Phantom.',
  customerButton: 'Open The Phantom',
} as const;

/**
 * The emails. No code sends these: the owner pastes them into MailerLite automations by hand.
 * Merge tags: {$name}, {$free_video_site}, {$free_video_url}, {$free_video_token}, {$free_video_clean_url}.
 * Lines like "[Button: label → url]" become a MailerLite button.
 * Never a buy price in any email: no $29 and no $297. "$700 off" is allowed.
 *
 * Automation 'Free Video Ad': trigger joins group 'Free Video - Ready'; E1 at once, E2 a day later,
 * E3 two days after E2; E2 and E3 are skipped when free_video_customer = yes; exit on 'Free Video - Bought'.
 * E1 pitches only the clean version, which customers can buy too, so E1 needs no customer condition.
 * Automation 'Free Video - Unlocked': trigger joins group 'Free Video - Unlocked'; U1 at once.
 */
export const EMAIL_DRAFTS = [
  {
    id: 'E1',
    automation: 'Free Video Ad',
    placement: 'fvmail1',
    send: 'immediately',
    subject: '{$name}, your video ad for {$free_video_site} is ready',
    body: [
      'Hi {$name},',
      '',
      'The Phantom just finished your video ad for {$free_video_site}.',
      '',
      '[Button: Watch my video ad → {$free_video_url}]',
      '',
      'You can download the free version of the video ad on that page.',
      '',
      "Here's my tip: post the video ad as an Instagram Reel and as a TikTok on the same day, then boost whichever post gets more views.",
      '',
      'Talk soon,',
      'Szilard',
      '',
      'P.S. Want the video ad without the BlueFX watermark in the middle? Open your video ad page and unlock the clean version. The Phantom makes the clean video ad in about 5 minutes: {$free_video_url}',
    ].join('\n'),
  },
  {
    id: 'E2',
    automation: 'Free Video Ad',
    placement: 'fvmail2',
    send: '1 day after E1',
    subject: '3 places to post your video ad today',
    body: [
      'Hi {$name},',
      '',
      'Here are 3 places to post your video ad for {$free_video_site} today:',
      '',
      '1) a Reel on Instagram',
      '2) a post on your Facebook page, pinned to the top',
      '3) TikTok or YouTube Shorts',
      '',
      "Here's your video ad again: {$free_video_url}",
      '',
      'AI Media Machine members make 100+ video ads a year like yours, every one without a watermark. Edits are included: change the images, footage, music, script and voice whenever you like.',
      '',
      'Lifetime access is $700 off right now: https://app.bluefx.net/go/fvmail2?t={$free_video_token}',
      '',
      'Szilard',
    ].join('\n'),
  },
  {
    id: 'E3',
    automation: 'Free Video Ad',
    placement: 'fvmail3',
    send: '2 days after E2',
    subject: '{$name}, 100+ video ads a year for {$free_video_site}',
    body: [
      'Hi {$name},',
      '',
      "People stop noticing an ad after they've seen the same ad a few times. A fresh video ad every week keeps {$free_video_site} in front of your customers.",
      '',
      'With AI Media Machine you paste a website, a product page or a few lines about an offer, and The Phantom makes the video ad in 3 to 7 minutes. That adds up to 100+ video ads a year, every one without a watermark, and you can change the images, footage, music, script and voice whenever you like.',
      '',
      'You also get 12 bonus video tools, like AI Avatar, Clone Studio, Video Swap and ReelEstate.',
      '',
      '[Button: Get lifetime access → https://app.bluefx.net/go/fvmail3?t={$free_video_token}]',
      '',
      'Szilard',
      '',
      'P.S. Lifetime access is $700 off right now, and you have 30 days to ask for your money back.',
    ].join('\n'),
  },
  {
    id: 'U1',
    automation: 'Free Video - Unlocked',
    placement: null,
    send: 'immediately',
    subject: '{$name}, your clean video ad for {$free_video_site} is ready',
    body: [
      'Hi {$name},',
      '',
      'Thanks for your order. The Phantom made the clean version of your video ad for {$free_video_site}, without the watermark and end card.',
      '',
      '[Button: Download my clean video ad → {$free_video_clean_url}]',
      '',
      'The clean video ad is on your video ad page too: {$free_video_url}',
      '',
      'On an iPhone? Open your video ad page and tap Save to Photos. The video ad then shows up in Photos, ready for Instagram, Facebook and TikTok.',
      '',
      'Szilard',
    ].join('\n'),
  },
] as const;

/** One object for callers that prefer `copy.x`. */
export const copy = {
  meta: PAGE_META,
  layout: LAYOUT,
  landing: LANDING,
  examples: EXAMPLES,
  form: FORM,
  validation: VALIDATION,
  errors: ERRORS,
  nextSteps: NEXT_STEPS,
  status: STATUS,
  player: PLAYER,
  download: DOWNLOAD,
  unlock: UNLOCK_COPY,
  offer: OFFER_COPY,
  emails: EMAIL_DRAFTS,
} as const;
