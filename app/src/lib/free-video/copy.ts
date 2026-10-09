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

import { OFFER, UNLOCK, VIDEO_ADS_LIKE_FREE_PER_MONTH } from './offer';

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
  /** Beside the logo on every page, where a visitor who runs into trouble sees it (owner 2026-10-07). */
  help: 'Need help?',
  questions: 'Questions?',
  privacy: 'Privacy policy',
  privacyUrl: 'https://bluefx.net/privacy-policy/',
  terms: 'Terms',
  termsUrl: 'https://bluefx.net/terms/',
  copyright: '© BlueFX',
  /** DB-IP's free country database finds the visitor's country (geo.ts); its license (CC BY 4.0) asks for this credit. */
  geoCredit: 'IP geolocation by DB-IP',
  geoCreditUrl: 'https://db-ip.com',
} as const;

/**
 * The landing page (v8, modelled on Neil Patel's free tools, owner 2026-10-06): a small label, the promise,
 * one website field with a "Start here!" note, then 3 numbered steps beside a result card; the name and
 * email come in step 2. No watermark and no price on this page (owner 2026-10-06): both offers live on the
 * status pages only. No wait time is promised either, because a busy day puts the video ad in a queue.
 */
export const LANDING = {
  /**
   * The hero, reviewed in Hormozi's and Kennedy's frameworks and approved by the owner 2026-10-07: the reader called
   * out, then the want (above the headline); the low effort and the offer (headline); what the video ad is and where it
   * goes (sub); an honest reason why it is free. "Business owners and marketers": the lifetime buyers are a mix of small
   * agencies, affiliates, realtors and coaches, not only local businesses (ideal customer research, 2026-09-10).
   */
  // One phrase per line, and "free video ad" in green (owner 2026-10-07: the two sentences ran into each other with
  // "no clear delimitation").
  question: ['Business owners and marketers:', 'want more customers from social media?'],
  h1: { first: 'Type your website.', before: 'Get a ', highlight: 'free video ad', after: ' for your business.' },
  sub: 'The AI Media Machine turns the words and photos on your website into a video ad of about 40 seconds, with an AI presenter, a voice-over and music. You get the video ad by email, ready to post on Facebook, Instagram and TikTok.',
  whyFreeLead: 'Why free?',
  whyFree: 'So you can see a video ad made for your own business before you buy anything from us.',
  /** The hand-drawn note pointing at the website field (wide screens only). */
  startHere: 'Start here!',
  /** The small lines under the website field: the limit, what it does not cost, and one proof number. */
  trust: ['One free video ad per business', 'No credit card, no account to create', '36,000+ customers since 2009'],
  /** The numbered steps beside the result card, in order. */
  steps: [
    { title: 'Add your website', text: 'The AI Media Machine reads the words and photos on your website.' },
    { title: 'The AI Media Machine makes your video ad', text: 'An AI presenter, hand-drawn scenes, the voice-over and the music.' },
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
  title: 'Try the AI Media Machine on your website',
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
    { q: 'What do I need?', a: 'Only your website address. The AI Media Machine reads the words and photos on your website and writes the video ad from them.' },
    { q: 'What kind of business can use it?', a: 'Any business with its own website: restaurants, real estate agents, local services, online stores and more.' },
    { q: 'How do I get my video ad?', a: 'By email, as soon as the AI Media Machine finishes it. You can also watch and download the video ad on your video ad page.' },
    { q: 'Who is behind this?', a: 'BlueFX. We have made videos for businesses since 2009, and 36,000+ customers have used our video tools and templates. Your free video ad is made by our AI Media Machine.' },
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
  checklist: ['A script written from your website', 'An AI presenter, a voice-over and music', 'Vertical, for Reels, TikTok and Shorts', 'Sent to your email'],
  /** A real button: it opens the video with sound. */
  watch: 'Watch with sound',
  file: '28 seconds',
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
   * The video in the top card (owner 2026-10-07: weak hook and spokesperson in the first one, "make the hero video
   * with Ray" → "go with dave"): a 28 s video ad about the free video ad, made in the ad studio
   * (ad-studio/public/ads/fv-promo-v2, build.py, spokesperson.json): Dave, a small-town marketing agency owner,
   * says the hook and the call to action (LTX 2.5 Fast, his voice converted to the narrator's), the ascentequipment.com
   * and realtor free video ads without the watermark, this page on a phone, the email notification, subtitles.
   * Plays muted in a loop; a tap opens heroReel.opens with sound. (hero/promo-wb, the first version, is unused.)
   */
  heroReel: {
    video: `${EXAMPLES_BASE}/hero/promo-v2.mp4`,
    poster: `${EXAMPLES_BASE}/hero/promo-v2.jpg`,
    opens: 'promo',
  },
  /** The examples section, in order. */
  ads: [
    { id: 'pizza', name: 'Pizza shop', video: `${EXAMPLES_BASE}/pizza/video.mp4`, poster: `${EXAMPLES_BASE}/pizza/poster.jpg` },
    { id: 'listing', name: 'Home for sale', video: `${EXAMPLES_BASE}/listing/video.mp4`, poster: `${EXAMPLES_BASE}/listing/poster.jpg` },
    { id: 'welder', name: 'Laser welder', video: `${EXAMPLES_BASE}/welder/video.mp4`, poster: `${EXAMPLES_BASE}/welder/poster.jpg` },
    { id: 'realtor', name: 'Real estate agent', video: `${EXAMPLES_BASE}/reel/realtor.mp4`, poster: `${EXAMPLES_BASE}/reel/realtor.jpg` },
    { id: 'promo', name: 'How it works', video: `${EXAMPLES_BASE}/hero/promo-v2.mp4`, poster: `${EXAMPLES_BASE}/hero/promo-v2.jpg` },
  ],
} as const;
export type ExampleVideoAd = (typeof EXAMPLE_VIDEOS.ads)[number];

const REEL_BASE = `${EXAMPLES_BASE}/reel`;

/**
 * The autoplay row of video ads (owner 2026-10-06: "the top ads we had there on autoplay, those are the best and
 * I like that autoplay way"): the 14 ads from the top of bluefx.net/video-ad/, same order and labels, copied to
 * storage as examples/free-video/reel/<id>.mp4 and .jpg (720x1280 with sound, 0.9 to 4 MB each). First comes a
 * real free video ad as a visitor gets it, watermark included (ascentequipment.com, owner 2026-10-06: "the video
 * is amazing! lets keep it in the examples section").
 */
export const REEL_ADS = (
  [
    { id: 'ascent', tag: 'Manufacturer' },
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
  websiteButton: 'Get my free video ad',
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
  /** The sheet's title over a "one free video ad per business" refusal (the AI Media Machine offer replaces the fields). */
  upgradeTitle: 'One free video ad per business',
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
    "Please type your own business website, for example yourbusiness.com. The AI Media Machine can't use pages on Amazon, Zillow, Google, Facebook, Instagram and other big platforms for the free video ad.",
  notFound: (domain: string) =>
    `We couldn't find ${domain}. Please check the spelling. If your website opens in your browser, copy the address from the address bar and paste the address here.`,
  unreadable: (domain: string) =>
    `We couldn't read ${domain}. Some websites hide their text behind a login, or load the text in a way our reader can't see. Try another page of your website with more text on the page, like your About or Services page.`,
  // One free video ad per business; more come with the AI Media Machine, offered right under the message (owner
  // 2026-10-07: "this is meant to be free one single time, and if they want more they should upgrade, we need the reason").
  duplicateEmail: `This email already has its free video ad. The free video ad is one per business. The link to yours is in our email from ${SUPPORT_EMAIL}. To make more video ads, get the AI Media Machine below.`,
  duplicateSite: (domain: string) =>
    `${domain} already has its free video ad. The free video ad is one per business. To make more video ads, get the AI Media Machine below.`,
  tooMany: "You've already asked for a free video ad today. The free video ad is one per business. To make more video ads, get the AI Media Machine below.",
  closed: "Today's free video ads are all taken. Please come back tomorrow.",
  /** A visitor in a country on BLOCKED_COUNTRIES (config.ts), found by IP or time zone. */
  country: (name: string | null) => `We don't offer the free video ad in ${name ?? 'your country'} yet. Please come back later.`,
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
  makingTitle: (name: string, domain: string) => `Thanks, ${name}. The AI Media Machine is making your video ad for ${domain}`,
  eta: (minutes: number) => `Your video ad should be ready in about ${aboutTime(minutes)}.`,
  /** A long queue (the computed wait is past 90 minutes): no exact time. */
  etaBusy: 'Lots of business owners asked for a free video ad today, so your video ad may take a few hours.',
  /** etaMinutes null, etaNote 'paused': new starts are switched off for now (settings.starting = false). */
  etaPaused: 'The AI Media Machine is taking a short break. Your spot in line is saved.',
  /** etaMinutes null, etaNote 'capped': the rolling 24 h cap will not reach this video ad today (review F5). */
  etaCapped: "Today's free video ads are all handed out. Your spot in line is saved, and the AI Media Machine starts on your video ad the moment there's room.",
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
  teaser: 'Your free video ad has a BlueFX watermark in the middle. Every video ad you make in your own AI Media Machine comes without it.',
  /** Browser tab titles. */
  tabTitles: {
    queued: 'Your video ad is in line',
    making: (step: number) => `Making your video ad (${step}/5)`,
    checking: 'Your video ad is getting a final check',
    ready: '✅ Your video ad is ready',
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
  title: (name: string, domain: string) => `${name}, the AI Media Machine is making your video ad for ${domain}`,
  emailNote: "We'll also email you the link.",
  readingTitle: (domain: string) => `Reading ${domain}`,
  readingHint: 'The AI Media Machine is reading the words and the photos on your website.',
  photosTitle: (domain: string) => `Found on ${domain}`,
  photosCount: (count: number) => `${count} ${count === 1 ? 'photo' : 'photos'} the AI Media Machine can use`,
  writingTitle: 'Writing your script',
  writingHint: (domain: string) => `The AI Media Machine is picking the best facts from ${domain} and writing what the voice will say, scene by scene.`,
  scriptTitle: 'Your script, scene by scene',
  scriptHint: (look?: string) =>
    look && LOOK_NAMES[look] ? `Written from your website. The AI Media Machine picked the ${LOOK_NAMES[look]} look for your video ad.` : 'Written from your website.',
  sceneLabel: (number: number) => `Scene ${number}`,
  drawing: 'The hand is drawing this scene',
  making: 'Making this picture',
  moving: 'Moving',
  /** The on-camera presenter who says the first line. */
  presenterTitle: 'Your presenter',
  presenterRecording: 'Cast for your business. Once the script is ready, they record its first line.',
  presenterReady: 'Says the first line of your video ad.',
  presenterLabel: 'Presenter',
  voiceTitle: 'Your voice-over is recorded',
  voicePlay: 'Listen to your voice-over',
  musicTitle: 'Music made for your video ad',
  musicPlay: 'Listen to the music',
  pause: 'Pause',
  renderTitle: 'Putting your video ad together',
  renderHint: 'The AI Media Machine is joining the scenes, the voice-over and the music.',
  checkTitle: 'Final check',
  checkHint: 'The AI Media Machine is checking every scene, the sound and the file.',
  queuedHint: 'While you wait, see how the AI Media Machine makes a video ad.',
  promoLabel: 'How the AI Media Machine makes a video ad',
  /**
   * The stage at the top of the live page: the best picture so far and the newest step, so the first screen always shows
   * something real (owner 2026-10-07: "keep the person on the page ... so they see something nice").
   */
  stageReading: (domain: string) => `Reading ${domain}`,
  stagePhotos: (domain: string, count: number) => `Found on ${domain}: ${count} ${count === 1 ? 'photo' : 'photos'}`,
  stageWebsiteLabel: 'From your website',
  stagePresenterLabel: 'Your presenter',
  stagePresenterCast: 'Meet your presenter',
  stagePresenterRehearsing: 'Getting ready to say your opening line',
  stageOpensWith: 'Your video ad opens with',
  stageRender: (percent: number) => `Putting your video ad together: ${percent}%`,
  stageCheck: 'Final check, almost there',
  progressLine: (step: number, total: number, name: string) => `Step ${step} of ${total}: ${name}`,
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
  /** Owner 2026-10-08: "call it free sample not version". */
  free: 'Download the free sample (with watermark)',
  saveToPhotos: 'Save to Photos',
  saveToPhotosBusy: 'Getting the video ad ready...',
  saveToPhotosAgain: 'Tap again to save the video ad',
  saveToPhotosHint: "Opens your iPhone's Share menu. Choose Save Video, and the video ad shows up in Photos.",
  /** The same names the download links use (leads.ts). */
  fileName: (domain: string) => `${domain}-video-ad-free.mp4`,
  cleanFileName: (domain: string) => `${domain}-video-ad.mp4`,
} as const;

/**
 * The small offer: this one video ad without the watermark, as it is (FastSpring, one time). Status pages only.
 * Changes come with the AI Media Machine only (owner 2026-10-07: "i want more that people buy the ai mm ad maker").
 */
export const UNLOCK_COPY = {
  tag: 'Just this video ad',
  title: 'Only want this video ad without the watermark?',
  body: (domain: string) =>
    `The same video ad for ${domain} in full HD, without the BlueFX watermark and end card, ready to post as it is. To change the video ad, get the AI Media Machine.`,
  price: UNLOCK.price,
  priceUnit: 'one time',
  button: `Unlock this video ad for ${UNLOCK.price}`,
  fine: 'Secure checkout by FastSpring. The clean video ad is ready about 5 minutes after you pay, right here on this page and by email.',
  /** Under the button once it was clicked: the checkout opened in a new tab. */
  afterClick: 'Finish the payment in the new tab. This page updates by itself as soon as the payment arrives.',
  paidTitle: 'Payment received',
  paidBody: 'The AI Media Machine is making your clean video ad (about 5 minutes).',
  paidFine: "You can stay here or close this page. We'll email you the link to the clean video ad too.",
  /** Paid before the free video ad was done (possible through the email link). */
  paidEarly: 'Payment received. The AI Media Machine makes your clean video ad right after your free video ad is ready.',
  readyTitle: 'Your clean video ad is ready',
  readyBody: 'Full HD, without the watermark and end card. Download the video ad and post the video ad as your own.',
  readyButton: 'Download the clean video ad',
  readyFine: "Thanks for your order. We're emailing you the download link too.",
  failedTitle: 'Your payment is in',
  failedBody: 'Making the clean video ad hit a problem. Our team has the details and will email you.',
} as const;

/**
 * The main offer: AI Media Machine lifetime (ClickBank). Status pages only; the ladder comes from OFFER (offer.ts). On the
 * ready page it comes first, above the $99 one (owner 2026-10-07: "i want more that people buy the ai mm ad maker").
 */
export const OFFER_COPY = {
  tag: 'Best value',
  /** Under a refusal on the form (one free video ad per business). */
  headingUpgrade: 'Make 100+ video ads a year yourself',
  bodyUpgrade: 'The AI Media Machine makes these video ads. Get your own and make a video ad for every offer, any time, without a watermark.',
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
  /** Says what you get (the Hormozi review: "lifetime access" to what?). The emails keep their own button text. */
  button: 'Get the AI Media Machine',
  smallPrint: 'Secure checkout by ClickBank.',
  /** Existing customers and buyers (isCustomer) see this instead of the ladder. */
  customerTitle: 'You already have the AI Media Machine',
  customerBody: 'Make your next video ad in the AI Media Machine.',
  customerButton: 'Open the AI Media Machine',
  /** The same box under a finished video ad: the sweep puts the video ad into the customer's account by itself (claim.ts). */
  customerBodyReady: 'Your video ad goes into your AI Media Machine too, without the watermark. Open your video ad there to change anything.',
  customerButtonReady: 'Open your video ad in the AI Media Machine',
} as const;

/**
 * Offer 2's style strip (owner 2026-10-06: "show that with AI Media Machine they unlock multiple video styles"):
 * 5 s silent loops cut from real examples (AI Avatar, the AI Media Machine sales page's UGC cooking ad, The Phantom,
 * Video Maker),
 * 360x640, in smart-video/examples/free-video/styles/<id>.mp4 and .jpg.
 */
const STYLE_BASE = `${EXAMPLES_BASE}/styles`;
export const STYLES = {
  title: 'Every video style, unlocked',
  text: 'With AI Media Machine you make every one of these, for any business:',
  items: (
    [
      ['avatar', 'AI avatar'],
      ['ugc-creator', 'UGC creator'],
      ['whiteboard', 'Whiteboard'],
      ['motion', 'Motion graphics'],
      ['photos', 'Photos that move'],
      ['beforeafter', 'Before and after'],
    ] as const
  ).map(([id, label]) => ({ id, label, video: `${STYLE_BASE}/${id}.mp4`, poster: `${STYLE_BASE}/${id}.jpg` })),
} as const;

/**
 * The live countdown to the end of the 3-day bonus (owner 2026-10-08: "i also want a timer and the thing that expires,
 * to have at least some sort of urgency"), in the bonus box beside the video ad, in the offer box and on the last band.
 * The deadline is real: claim.ts gives the clean copy only to a buyer who pays before it. After it the working files
 * can go any time (cleanup.ts deletes them after 30 days; the owner can shorten that), which is what the copy says.
 */
export const BONUS_TIMER = {
  units: ['days', 'hours', 'min', 'sec'],
  label: 'Time left until the free bonus ends',
  ended: 'The free bonus has ended: your video ad keeps the watermark, and the working files can be deleted any time.',
} as const;

/**
 * Under every button of the lifetime offer, as on the lifetime page's price box (owner 2026-10-08: "under the buttons
 * add the credit card logos and the guarantee text"): the cards ClickBank's checkout takes, then the guarantee in the
 * lifetime page's words, its middle part bold.
 */
export const PAYMENT_TRUST = {
  cardsLabel: 'Pay with Visa, Mastercard, American Express, Discover or PayPal',
  // A no-break hyphen keeps "money-back" on one line.
  guarantee: ['Your purchase is backed by our ', '100% money\u2011back guarantee', ': full refund within 30 days.'],
} as const;

/**
 * The short offer beside the finished video ad (LifetimeOffer 'ready'); the offer under the video ad follows
 * (sales-page.ts) and seeAll jumps there. While the 3-day bonus runs (the view's cleanUntil) the card leads with this
 * video ad without the watermark and the deadline; after that, with the new video ads.
 */
export const OFFER_READY = {
  /**
   * The box beside the finished video ad (Hormozi review 2026-10-09, owner: "all"): value before price, so no price
   * here. The bonus and its timer stay; the button leads down to the stack with the price (SALES_PAGE.stackAnchor).
   */
  /**
   * The headline and the letter under the video ad (Kennedy review 2026-10-09, owner: "now thats a headline!"): the
   * result they just got, the promise, then two lines from me with their name, with the problem (one video ad wears
   * out) folded in. No pronoun for the video ad (owner's rule).
   */
  // "for free" invited "so why pay?"; a free sample sets up the purchase (owner 2026-10-09).
  headline: {
    first: 'The AI Media Machine just built you a free sample: a $600 video ad in 3 minutes.',
    // "unlock the full version" named neither thing they get (Kennedy; owner 2026-10-09: "might sound good").
    second: 'Now get your video ad without the watermark, plus a new video ad every week, for under $3.',
    /** The deck under the headline answers the objection Johnny raised (Kennedy + Hormozi review, owner picked it 2026-10-09). */
    deck: 'You can change anything in your video ad: the presenter, the voice, the words, the photos.',
  },
  /** Like my emails: "Hey {name}," short lines, "Szilard" (owner 2026-10-09: "just Szilard", "break up the text"). */
  letter: {
    greeting: (name: string) => `Hey ${name},`,
    lines: (domain: string) => [
      // The pains a lead skipped (owner 2026-10-09), not "nobody typed a word of the script".
      "My AI Media Machine made the video ad above from your website. You didn't have to write a script, record yourself on camera or learn a video editing app. A freelancer would charge you $600 for a video ad like this.",
      "One video ad wears out, though. People stop noticing an ad after they've seen the same ad a few times.",
      `A fresh video ad every week keeps ${domain} in front of your customers and brings new ones in.`,
      "Here's how to get a fresh video ad for under $3.",
    ],
    signature: 'Szilard',
    /** Under my photo. */
    photoLabel: 'Szilard Gyorfi, founder of BlueFX',
  },
  /** The product shot in the box (owner 2026-10-09: "introduce the ai mm here as an image"). */
  image: { src: '/free-video/aimm-product.jpg', alt: 'The AI Media Machine: the video dashboard on a laptop, and the box' },
  title: 'Like your video ad?',
  text: `Get your video ad without the watermark and ready to change, plus ${VIDEO_ADS_LIKE_FREE_PER_MONTH} new video ads every month.`,
  /** After the 3-day bonus. */
  textLater: `Make ${VIDEO_ADS_LIKE_FREE_PER_MONTH} new video ads every month with the AI that made your video ad.`,
  /** The button names what the box promises (owner 2026-10-09: "see what you get" felt strange), and leads to the price. */
  seeButton: 'Remove the watermark and change anything',
  /**
   * The 3-day bonus, named and valued at the $99 the clean video ad sold for (owner 2026-10-08: "the word buy seems
   * harsh", then the Hormozi review: a fast-action bonus says what you get, what it is worth and until when).
   */
  bonusTitle: `Free bonus: your video ad without the watermark, ready to change (${UNLOCK.price} value)`,
  /** Under the countdown: the deadline only; what expires is explained once, in the stack (Hormozi review 2026-10-09). */
  bonusLine: (when: string) => `Ends ${when}. After that, the watermark stays on your video ad.`,
  /** Before the browser has printed the exact time (useDeadline): true on every visit. */
  bonusLineSoon: 'Ends 3 days after your video ad was made. After that, the watermark stays on your video ad.',
} as const;

/**
 * The emails. No code sends these: the owner pastes them into MailerLite automations by hand.
 * Merge tags: {$name}, {$free_video_site}, {$free_video_url}, {$free_video_token}, {$free_video_clean_url}.
 * Lines like "[Link: Label → url]" become a bold underlined link in the owner's list-email look ("[Button: label → url]" in U1).
 * Never a buy price in any email: no $99 and no $297. "$700 off" is allowed.
 *
 * Built in MailerLite through its connector (2026-10-07), every email as HTML with a plain-text twin:
 * - 'Free Video Ad 1: Your video' (200681113224479794): joins 'Free Video - Ready' → E1 at once. Everyone.
 * - 'Free Video Ad 2: Follow-up' (200681121024837514): joins 'Free Video - Ready' → 1 day → E2 → 1 day → E3 (2 days until
 *   2026-10-08: the 3-day bonus now ends before day 3, so E3 is its last-day email). Excludes
 *   'Free Video - Bought' and exits on it (set by hand in the dashboard); existing customers join Bought at delivery.
 * - 'Free Video - Unlocked' (200681123969238195): joins 'Free Video - Unlocked' → U1 at once.
 * Sender support@bluefx.net. Every email ends with the reason it was sent and {$unsubscribe}.
 */
export const EMAIL_DRAFTS = [
  {
    id: 'E1',
    automation: 'Free Video Ad',
    placement: 'fvmail1',
    send: 'immediately',
    // The owner-approved E1 that went live 2026-10-08 10:30, with the new page's offer: the 3-day bonus, 10 video ads like
    // yours a month, "$700 off" as on the page's badge, and the page's button words.
    subject: '{$name}, your video ad for {$free_video_site} is ready',
    body: [
      'Hey {$name},',
      '',
      'Your video ad for {$free_video_site} is ready:',
      '',
      '[Link: Watch Your Video Ad Here → {$free_video_url}]',
      '',
      'What do you think?',
      '',
      'Want to change something in your video ad? A new first line, your logo, a different photo or other music? Want the BlueFX watermark gone?',
      '',
      'Free bonus for the next 3 days: get the AI Media Machine, and your video ad for {$free_video_site} goes into your account without the watermark. Type the change you want, and the AI Media Machine makes the new version of your video ad in a few minutes.',
      '',
      'With the AI Media Machine you also make 10 new video ads like yours every month: one for every offer you run, and one for every business that pays you to make their video ad.',
      '',
      'Lifetime access is $700 off right now:',
      '',
      '[Link: Get The AI Media Machine Here → https://app.bluefx.net/go/fvmail1?t={$free_video_token}]',
      '',
      'Szilard',
    ].join('\n'),
  },
  {
    id: 'E2',
    automation: 'Free Video Ad',
    placement: 'fvmail2',
    send: '1 day after E1',
    // Owner 2026-10-08: the 3 questions (does it work, for me, can I use it myself), told from his side of the table
    // with a little Frank Kern humor ("feels like i am talking down on them").
    subject: "{$name}, 3 questions I'd ask if I were you",
    body: [
      'Hey {$name},',
      '',
      "If a tool promised to make my video ads by itself, I'd have 3 questions:",
      '',
      '1) Does this thing actually work?',
      '2) Will this thing work for MY business, or only for the pizza shop in the demo?',
      '3) Can I run this thing myself, or will I end up calling my nephew?',
      '',
      'Funny thing: your free video ad already answered all 3.',
      '',
      'The AI Media Machine wrote the script, cast the presenter, recorded the voice-over and picked the music for {$free_video_site}. Your whole job was typing your website. (Your nephew can relax.)',
      '',
      'Next time: paste a link, grab a coffee, come back to a finished video ad. 10 new video ads like yours every month.',
      '',
      'Free bonus, 2 more days: get the AI Media Machine and your video ad goes in without the watermark.',
      '',
      '[Link: Get The AI Media Machine Here → https://app.bluefx.net/go/fvmail2?t={$free_video_token}]',
      '',
      'Szilard',
      '',
      'P.S. Your video ad is still here, watermark and all: {$free_video_url}',
    ].join('\n'),
  },
  {
    id: 'E3',
    automation: 'Free Video Ad',
    placement: 'fvmail3',
    /** 1 day after E2 (was 2): the 3-day bonus would be over by day 3 (owner 2026-10-08). */
    send: '1 day after E2',
    // The last-day email: one deadline, one loss, one button, said with a smile (owner 2026-10-08).
    subject: '{$name}, your free bonus ends tomorrow',
    // Owner 2026-10-08: the working files are what matters, "not just the video"; the version that said "I can delete
    // those working files any time" was "evil", so E3 names them as something the reader gets, and the watermark is
    // the only loss.
    body: [
      'Hey {$name},',
      '',
      'Quick one: your free bonus ends tomorrow.',
      '',
      'Get the AI Media Machine before then, and your video ad for {$free_video_site} goes into your account without the watermark. You also get everything your video ad was made from: the presenter clip, the voice-over, the drawings and the music. So when you want a new first line or other music, you type the change, and the AI Media Machine remakes your video ad in a few minutes.',
      '',
      'After tomorrow, your video ad keeps the BlueFX watermark. Great advertising for me, less great for you :-)',
      '',
      'And lifetime access is still $700 off, my 40th-birthday price. Apparently I only turn 40 once.',
      '',
      '[Link: Get The AI Media Machine Here → https://app.bluefx.net/go/fvmail3?t={$free_video_token}]',
      '',
      'Talk soon,',
      'Szilard',
    ].join('\n'),
  },
  {
    id: 'E4',
    automation: 'Free Video Ad',
    placement: 'fvmail4',
    send: '2 days after E3',
    // The math email, after the 3-day bonus (owner 2026-10-08: "we can actually make new emails with these"): a
    // freelancer's $600 against under $3 a video ad, explained like the page (pay once, 10 a month, so under $3). No
    // buy price: the page shows it.
    subject: '{$name}, $600 or under $3?',
    body: [
      'Hey {$name},',
      '',
      'I checked what a video ad like yours costs on Fiverr.',
      '',
      'A Top Rated seller charges $600 for one whiteboard video like yours, and you wait 14 days for the video.',
      '',
      'With the AI Media Machine, you pay once and make 10 video ads like yours every month, for life. So each video ad costs you under $3, and you wait about 3 minutes.',
      '',
      'Pretty easy choice: $600 and 14 days, or under $3 and about 3 minutes.',
      '',
      'Lifetime access is still $700 off, my 40th-birthday price.',
      '',
      '[Link: Get The AI Media Machine Here → https://app.bluefx.net/go/fvmail4?t={$free_video_token}]',
      '',
      'Talk soon,',
      'Szilard',
      '',
      'P.S. Your video ad for {$free_video_site} is still here: {$free_video_url}',
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
      'Thanks for your order. The AI Media Machine made the clean version of your video ad for {$free_video_site}, without the watermark and end card.',
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
