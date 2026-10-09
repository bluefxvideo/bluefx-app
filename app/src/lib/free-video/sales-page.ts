/**
 * The AI Media Machine offer under the finished free video ad. Owner 2026-10-08: the whole lifetime page here was "too
 * much info, too many directions"; then "it still needs work and clarity, ask alex hormozi"; then "rethink, ask alex
 * to review the page". The page now reads: the outcome first ("Want more customers from social media?"), the 3 questions
 * the free video ad already answered (it works, for your business, and you can use it yourself), video ads made with
 * the AI Media Machine, then one offer box: what you get, the
 * 3-day bonus named and valued (shown in full once, a short reminder elsewhere), a freelancer against the AI Media
 * Machine in money and time, the birthday price, one button, what happens after the click, the guarantee; then the
 * founder, five questions, the last button.
 *
 * One number everywhere: 10 video ads a month. A free video ad opens with an AI presenter (runner.ts presenter: true),
 * and in the AI Media Machine that is PHANTOM_CREDITS + PHANTOM_PRESENTER_CREDITS = 60 of the 600 monthly credits (the
 * 12 without a presenter stays off the page: it complicates the offer). The deadline is real: the 3-day bonus
 * (offer.ts CLEAN_COPY_HOURS), enforced in claim.ts, shown as the day and hour in the visitor's own time. The bonus is
 * valued at the $99 the clean video ad sold for. The freelancer numbers are the owner's own (bluefx.net/video-ad, the
 * lifetime page). The examples row is exactly the lifetime page's 9 vertical videos, in its order. No timer, no
 * reviews, BlueFX since 2009.
 *
 * The math uses 3 numbers (owner 2026-10-08, after his girlfriend got lost in "10, 297, 3 ... so its 10 or 100 or
 * ??"): $297 once, 10 video ads every month, so under $3 per video ad, against $600 for 1 video ad on Fiverr. No
 * division, no video ads per year and no credits on the page.
 */
import { CLEAN_COPY_HOURS, OFFER, PRICE_PER_VIDEO_AD_UNDER, UNLOCK, VIDEO_ADS_LIKE_FREE_PER_MONTH } from './offer';

const MEDIA = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/aimm';

/** Video ads a month like the free one, with its AI presenter: the one number the page uses. */
const WITH_PRESENTER = VIDEO_ADS_LIKE_FREE_PER_MONTH;
/** $297 over a year of those: "under $3" (offer.ts). */
const UNDER = PRICE_PER_VIDEO_AD_UNDER;
/**
 * A Top Rated Fiverr seller's Basic package for one 60-second whiteboard video, like the free video ad: $600, 14-day
 * delivery, 2 revisions, no presenter (the owner's screenshot, 2026-10-08; the screenshot itself is off the page, owner:
 * "take it out").
 */
const FREELANCER = '$600';

/**
 * The 9 vertical videos at the top of the lifetime page, in its order (copies of ~/Downloads/lifetime-page-videos). The
 * labels are for screen readers only: the lifetime page shows the videos without captions.
 */
const WALL = [
  'Cooking video',
  'AI creator',
  'Product demo',
  'Testimonial ad',
  'Recipe video',
  'Cinematic product ad',
  'Skincare ad',
  'Baking video',
  'Phone-style ad',
].map((label, index) => ({ video: `${MEDIA}/wall-${index + 1}.mp4`, poster: `${MEDIA}/wall-${index + 1}.jpg`, label }));

/**
 * "Saturday, October 11 at 2:15 PM": the bonus deadline in the visitor's own time zone. Only the browser knows that zone,
 * so the page prints it after it starts (useDeadline), never on the server.
 */
export const deadlineLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

const BONUS_DAYS = CLEAN_COPY_HOURS / 24;

export const SALES_PAGE = {
  /** The id the short offer's link beside the video ad jumps to. */
  anchor: 'everything-you-get',
  /** The id of the stack with the price, where the button beside the video ad jumps (Hormozi review 2026-10-09: value before price). */
  stackAnchor: 'what-you-get',
  /**
   * The 3 questions every buyer of software asks, and the free video ad already answered all 3 (owner 2026-10-08:
   * "people first like to see proof, can a software actually deliver? next can it create the result for them? and the
   * biggest one can they actually use the software themself ... with the free vid we prove all 3 concerns").
   */
  questions: {
    /** Told from Szilard's side with a little humor, like E2 (owner 2026-10-08: "feels like i am talking down on them"). */
    title: "3 questions I'd ask if I were you",
    lead: 'Funny thing: your free video ad already answered all 3.',
    items: (domain: string) => [
      {
        q: 'Does this thing actually work?',
        a: 'The AI Media Machine wrote the script, cast the presenter, recorded the voice-over and picked the music for your video ad above, in about 3 minutes.',
      },
      {
        q: 'Will this thing work for MY business, or only for the pizza shop in the demo?',
        a: `Your video ad above is about ${domain}, made from your own website.`,
      },
      {
        q: 'Can I run this thing myself, or will I end up calling my nephew?',
        a: 'You already did: you typed one website address. Your nephew can relax. Every new video ad starts the same way, and the next video ad is ready in about 3 minutes.',
      },
    ],
  },
  /**
   * What a buyer can change, in the words of a lead who could not find an edit button on the free video ad (Johnny,
   * teaminsightplus.com, 2026-10-09: "I did not see a way to edit anything ... I would prefer to pick my own [avatar]
   * along with how he speaks and any accents he has ... a typo I saw"). Owner: "the questions he had are the things that
   * would get people to buy, they need to be featured on the page ... images of the multitude of avatars". Every answer
   * is true today: note edits (wording, typos, voice, music, photos, logo), the AI Avatar tool (246 presenters or your own
   * photo, 60 voices, voice cloning) whose clip goes into the video ad with an edit.
   */
  changes: {
    /** Changes come with the paid AI Media Machine, never the free sample (owner 2026-10-09: "they might think that they can do this in the free version"). */
    kicker: 'With the AI Media Machine',
    title: 'Want to change something in your video ad?',
    lead: 'The video ad above is your free sample. With the AI Media Machine you can change anything: type what you want, and the new version is ready in about 3 minutes.',
    /**
     * A real change (Hormozi review 2026-10-09: show, don't tell; owner: "pick a more visual thing, maybe changing the
     * avatar"): the ascentequipment.com free video ad's opening, then the same line said by another presenter (cast with
     * castPresenter + talkingPresenter), rendered clean; the note typed over the free sample.
     */
    demo: {
      video: `${MEDIA}/edit-demo.mp4`,
      poster: `${MEDIA}/edit-demo.jpg`,
      label: 'A real change typed in the AI Media Machine: a different presenter says the same opening line',
      caption: 'A real change: one sentence typed, and the same video ad opens with a new presenter about 3 minutes later.',
    },
    items: [
      { q: 'Can I change the wording?', a: 'Yes. Type what your video ad should say instead, one line or the whole script.' },
      { q: 'Can I fix a typo that came from my website?', a: 'Yes. Type "change X to Y", and the voice-over and the text on screen change with it.' },
      { q: 'Can I pick my own presenter?', a: 'Yes. Choose one of 246 presenters, or use your own photo, and put your presenter in your video ad.' },
      { q: 'Can I choose how they speak, even the accent?', a: 'Yes. Pick one of 60 voices, with Australian and Indian English accents among them, or clone your own voice.' },
      { q: 'Can I change the music, the photos or add my logo?', a: 'Yes. Ask for other music, add your own photos and your logo, and they go into your video ad.' },
      /** The sixth card fills the row on a desktop (layout review 2026-10-09); true today: uploaded clips and photos go in. */
      { q: 'Can I use my own video clips?', a: 'Yes. Upload your own clips and photos, and the AI Media Machine builds the video ad around them.' },
    ],
    facesTitle: '246 presenters to choose from',
    facesNote: 'Or use your own photo.',
    /** The 246 presenters minus the 24 faces shown. */
    more: '+222',
    /** 24 presenters of the AI Avatar library (avatar_templates), cropped square around the face (public/free-video/avatars). */
    faces: Array.from({ length: 24 }, (_, i) => `/free-video/avatars/${String(i + 1).padStart(2, '0')}.webp`),
  },
  /**
   * Customers in their own words (owner 2026-10-09: "we have plenty of testimonials, use them ... add also 5 stars to
   * each"): quoted word for word from bluefx.net/video-ad and bluefx.net/testimonials, the ones about video work and
   * saved time. Photos from the video-ad page where it has one; initials otherwise.
   */
  reviews: {
    title: 'What BlueFX customers say',
    lead: '36,000+ customers since 2009.',
    starsLabel: '5 out of 5 stars',
    /** The one quote above the price (owner 2026-10-09: Dov's 45% "more believable" than Alex's $1 million). */
    nearPrice: 'Dov Rom',
    play: (name: string) => `Play ${name}'s video`,
    /**
     * The five with a video keep the video (owner 2026-10-09: "keep the video, and also the face of the person in the
     * little circle"): the public Vimeo and YouTube players bluefx.net/video-ad embeds; faces cut from their thumbnails.
     */
    items: [
      { quote: 'The video project is contributing to sales for us, approaching US$ 1 million per year.', name: 'Alex Goad', role: 'Net Frontier Marketing', photo: '/free-video/testimonials/alex-goad.jpg' },
      { quote: 'Given a good brief and some content, even stills, BlueFX has a skill to turn ideas into motion-video reality. So impressed we are now making another 3 videos.', name: 'Steve Kane', role: 'Megaled Ltd.', photo: '/free-video/testimonials/steve-kane.jpg' },
      { quote: "BlueFX is atomic power for business and I can't recommend him enough. Szilard is a hero. My advice: get unstuck and contact him right away.", name: 'Gregory Green', role: 'President, Slide E Digitizing', photo: '/free-video/testimonials/gregory-green.jpg', video: { youtube: 'V2UpR-Z_rIU', poster: '/free-video/testimonials/gregory-green-video.jpg', vertical: false } },
      { quote: "I have several marketing agencies, I got a video production company\u2026 it saves me countless hours\u2026 Any place I can get a shortcut to guard and protect my time it's worth a fortune.", name: 'Deryck Jones', role: 'Marketing agency owner', photo: '/free-video/testimonials/deryck-jones.jpg', video: { vimeo: '517463516', poster: '/free-video/testimonials/deryck-jones-video.jpg', vertical: false } },
      { quote: "It's all high quality, we use it almost daily for our video marketing company here at BigDeal.solutions.", name: 'Bucky Helms', role: 'BigDeal.solutions', photo: '/free-video/testimonials/bucky-helms.jpg', video: { vimeo: '517463589', poster: '/free-video/testimonials/bucky-helms-video.jpg', vertical: false } },
      { quote: 'The videos are fantastic and are easy to use.', name: "Francis D'Costa", role: 'Insurance advisor', photo: '/free-video/testimonials/francis-dcosta.jpg', video: { vimeo: '517463537', poster: '/free-video/testimonials/francis-dcosta-video.jpg', vertical: true } },
      { quote: "It's so easy to use and I don't need to learn too much to edit video.", name: 'Sambath Sim', role: 'Entrepreneur', photo: '/free-video/testimonials/sambath-sim.jpg', video: { vimeo: '517463570', poster: '/free-video/testimonials/sambath-sim-video.jpg', vertical: true } },
      { quote: 'I rarely give public endorsements, but my experience with BlueFx was so positive that I am compelled to share it. Within just a few weeks of launching, we have seen a 45% increase in organic traffic.', name: 'Dov Rom', role: 'President, Ascent Equipment. His video ad is in the clip above.', photo: '/free-video/testimonials/dov-rom.jpg' },
      { quote: "Can't express enough how much I have appreciated the professionalism and top-shelf work pushed out by BlueFX.", name: 'Tony Monaco', role: 'Director of Sales & Marketing', photo: '/free-video/testimonials/tony-monaco.jpg' },
    ],
  },
  proof: {
    title: 'Video ads made with the AI Media Machine',
    text: 'Tap a video ad for the sound.',
    soundOn: 'Turn the sound on',
    soundOff: 'Turn the sound off',
    previous: 'Earlier video ads',
    next: 'More video ads',
    /** Exactly the lifetime page's row, in its order (owner 2026-10-08). */
    items: WALL,
  },
  /**
   * The price per video ad, big, against a freelancer's $600 (owner 2026-10-08: "highlight it, in an entire section
   * contrasting it with $600 per video and showing a snapshot of it on the fiver seller ... big, clearly explained").
   * Same day his girlfriend got lost in "10, 297, 3 ... so its 10 or 100 or ??", and $297 against $600 "lost the
   * power": the title and the cards keep under $3 against $600, and the lead explains under $3 in 3 lines, one number
   * each, with no division and no video ads per year.
   */
  math: {
    eyebrow: 'The math',
    /** For screen readers, before a row the Fiverr package does not have. */
    missingLabel: 'Not included:',
    title: `Under ${UNDER} per video ad`,
    lead: [`You pay ${OFFER.now} once.`, `You get ${WITH_PRESENTER} video ads every month, for life.`, `So each video ad costs you under ${UNDER}.`],
    them: {
      name: 'A freelancer',
      /** Who Fiverr is, for readers who never hired online (owner 2026-10-09: "many wont know about it ... explain the context"). */
      note: 'The going rate on Fiverr, the biggest website for hiring freelancers, for 1 video ad like yours.',
      price: FREELANCER,
      per: 'for 1 video ad',
      time: '14 days of waiting',
      /** The gig's Basic package, row for row against ours: no AI presenter, 2 revisions. */
      includes: [
        { text: 'Script writing', has: true },
        { text: 'Voice-over', has: true },
        { text: 'Music', has: true },
        { text: 'An AI presenter', has: false },
        { text: '2 rounds of changes', has: true },
      ],
    },
    us: {
      name: 'The AI Media Machine',
      price: `Under ${UNDER}`,
      per: 'per video ad, all included',
      /** Owner 2026-10-08: "3 min waiting time". Free video ads take 2.8 min from start to finish (median of 19; 3 in 4 within 3.2 min). */
      time: 'About 3 minutes of waiting',
      /** Row for row against the Fiverr card beside it. */
      includes: ['Changes: type what to change', 'Script writing', 'Voice-over', 'Music', 'An AI presenter'],
    },
  },
  offer: {
    title: 'Everything you get',
    /** The product shot over the stack (owner 2026-10-09): the dashboard on a laptop and the box, remade at 816 px with GPT Image 2.5 from his 300 px original. */
    image: { src: '/free-video/aimm-product.jpg', alt: 'The AI Media Machine: the video dashboard on a laptop, and the box' },
    /**
     * Each piece with what it WOULD cost elsewhere (owner 2026-10-09: "$600 each from a freelancer" could read as a
     * freelancer making them, so every value starts with "Would cost you"), then the total (Hormozi review 2026-10-09, owner: "all"): the $600 a
     * video ad on Fiverr of the math section, the $75 a round of changes, and the lifetime page's own "Real-World Value
     * ... as a subscription elsewhere" for avatars ($29), voice-overs ($11) and music ($10). The community has no price
     * anywhere, so none is made up for it.
     */
    items: [
      { text: `${WITH_PRESENTER} new video ads every month, for life: a video ad for every offer, every holiday special, every slow week`, value: 'Would cost you $600 each from a freelancer' },
      { text: 'Changes to any video ad: type what to change, like the music, a photo, a line of the script or the voice', value: 'Would cost you $75 a round from a freelancer' },
      { text: 'More AI tools: talking avatars, voice-overs (even in your own cloned voice), music, thumbnails and logos', value: 'Would cost you $50+ a month in other subscriptions' },
      { text: 'Daily YouTube tutorials, a private community and help from me', value: 'Included' },
    ],
    /** The comparison the reader makes (Hormozi review 2026-10-09: "$6,000 a month on Fiverr" reads as a stretch). */
    totalLabel: `What a freelancer would charge for ${WITH_PRESENTER} video ads a month`,
    total: '$6,000',
    yoursLabel: 'Your price, once',
    yours: OFFER.now,
    /** The 3-day bonus (offer.ts CLEAN_COPY_HOURS), shown once in full: named, valued, with its end. */
    bonus: {
      tag: (when: string | null) => (when ? `Free bonus until ${when}` : `Free bonus for ${BONUS_DAYS} days`),
      title: (domain: string) => `Your video ad for ${domain}, without the watermark and ready to change (${UNLOCK.price} value)`,
      // Owner 2026-10-08: no "within about 10 minutes" here ("needed to say??"), and "After the timer expires".
      text: "Get the AI Media Machine by then and your video ad goes into your account with all the working files: the presenter clip, the voice-over, the drawings and the music. Change anything, any time. After the timer expires, the working files can be deleted any time. Then the watermark stays on your video ad, and your video ad can't be changed anymore.",
    },
    tag: '40th birthday price',
    was: OFFER.was,
    now: OFFER.now,
    unit: 'one payment',
    why: `I turned 40 this year, so the lifetime license is ${OFFER.off}.`,
    /** The anchor at the price (Kennedy review 2026-10-09). */
    anchor: `A freelancer charges ${FREELANCER} for ONE video ad.`,
    /** What happens after the click: the checkout, the login email, the first win. */
    next: {
      title: 'What happens when you click',
      steps: (bonus: boolean) => [
        "Check out on ClickBank's secure page, with the email you gave us here.",
        'Your login link arrives by email.',
        bonus
          ? 'Your video ad is in your AI Media Machine within about 10 minutes, without the watermark and ready to change.'
          : 'Paste a link and your first new video ad is ready in about 3 minutes.',
      ],
    },
  },
  founder: {
    /** The square portrait the owner picked 2026-10-09 ("my face is more easy to see"), 600 px. */
    photo: `${MEDIA}/founder-2.jpg`,
    name: 'Szilard Gyorfi',
    role: 'Founder of BlueFX, making videos for businesses since 2009',
    text: "I've spent my own money on Facebook ads for years, testing what gets people to click, watch and buy. The AI Media Machine is the same system I use every day.",
    risk: 'You risk nothing. I risk my reputation.',
    /** The named guarantee (Hormozi review 2026-10-09): the same 30-day refund ClickBank gives, with a name, in my words. */
    guarantee: {
      name: 'The 10 Video Ads Guarantee',
      text: "Make your first 10 video ads. If you don't love them, email me within 30 days and you get every penny back.",
    },
    facts: ['18 years in marketing', '$60K+ of my own money spent testing video ads', '36,000+ customers'],
  },
  faq: {
    title: 'Questions',
    /**
     * The way in for a buyer who paid with another email, or a customer the email did not match (/go/claim): under the
     * first answer, off the offer card (owner 2026-10-08: "maybe we dont need it on the page").
     */
    claim: 'Open your video ad in the AI Media Machine',
    items: (bonus: boolean, when: string | null) => [
      {
        q: 'What happens to my free video ad?',
        a: bonus
          ? `Get the AI Media Machine within ${BONUS_DAYS} days of getting your video ad${when ? ` (until ${when})` : ''}, with the email you used here, and your video ad shows up in your AI Media Machine within about 10 minutes, without the watermark and with all the working files (presenter clip, voice-over, drawings, music), ready to change. After that, the working files can be deleted any time: your downloaded video ad stays yours, with the watermark, but then nobody can change your video ad anymore. Paid with another email, or already have the AI Media Machine? Sign in with that account here:`
          : `The ${BONUS_DAYS}-day bonus for your video ad has passed, so the working files of your video ad (presenter clip, voice-over, drawings, music) can be deleted any time, and then nobody can change your video ad anymore. Your video ad above stays yours to download, with the watermark, and every new video ad you make in the AI Media Machine comes without a watermark. Already have the AI Media Machine? Sign in here:`,
        claim: true,
      },
      {
        // A lead's own words (2026-10-08: "your prices are too high. People are struggling financially these days"),
        // answered with the owner's math from his reply.
        q: `Isn't ${OFFER.now} a lot right now?`,
        a: `Money is tight for a lot of people right now. A freelancer charges ${FREELANCER} for 1 video ad like yours (the going rate on Fiverr, the biggest website for hiring freelancers). Your one payment of ${OFFER.now} covers ${WITH_PRESENTER} video ads like yours every month, for life. That's under ${UNDER} per video ad.`,
      },
      {
        // The same lead: "I wish the videos were longer by at least 90 seconds". Exact-words scripts follow their own
        // length (pricing.ts phantomCredits: each started minute after the first costs PHANTOM_EXTRA_MINUTE_CREDITS); the
        // answer names no credits (3 numbers only, see the top).
        q: 'Can my video ads be longer?',
        a: `Yes. Your free video ad is about 40 seconds. In the AI Media Machine you can write your own script, and the video ad runs as long as the script. A longer video ad uses more of your monthly credits.`,
      },
      {
        q: 'Do I need to be technical?',
        a: 'No. If you can paste a link and click a button, you can make video ads with the AI Media Machine. The AI writes the script and makes the voice-over, the pictures and the music. The AI Media Machine runs in your browser. Nothing to install.',
      },
      {
        q: 'Is this really one payment?',
        a: `Yes. Pay ${OFFER.now} once and you own the AI Media Machine for life, with ${WITH_PRESENTER} new video ads every month. There is no subscription, no renewal and nothing to cancel, and you have 30 days to get your money back.`,
      },
      {
        q: 'What if I need more credits?',
        a: 'Your monthly credits cover more than most people use. In a busy month you can add a credit pack, from $9.99, with nothing recurring.',
      },
    ],
  },
  close: {
    title: (domain: string) => `Get the next video ad for ${domain} today`,
    reminder: (when: string) => `Free bonus ends ${when}. After that, the watermark stays on your video ad.`,
    /**
     * A P.S. with an admission about the product (Kennedy review 2026-10-09; owner: an admission, never what the free
     * video ad cost me, and "big visual problems that the ad may have for the client", not a typo).
     */
    ps: (when: string | null) =>
      `P.S. The AI Media Machine isn't perfect. Maybe the presenter isn't who you'd want speaking for your business, or the AI used a photo from your website you'd never have chosen. That's what the changes are for: type what you want instead, and the new version is ready in about 3 minutes. The watermark comes off the minute you're in. After ${when ?? 'the timer expires'}, the watermark stays.`,
    line: `One payment of ${OFFER.now} covers ${WITH_PRESENTER} video ads every month, for life: under ${UNDER} per video ad.`,
    /** A second P.S. for the other tools: the stack carries their value, this is the reminder at the decision (Kennedy; owner picked it 2026-10-09). */
    pps: `P.P.S. The ${WITH_PRESENTER} video ads a month are the main thing. Talking avatars, voice-overs, music, thumbnails and logos come with them, included.`,
  },
  /** ClickBank sells the lifetime license, so its retailer notice goes with the offer (as on the lifetime page). */
  legal: {
    support: ['For product support, email ', '. For order support, contact ', 'ClickBank', '.'],
    clickbankUrl: 'https://www.clkbank.com/',
    notes: [
      "ClickBank is the retailer of products on this site. CLICKBANK® is a registered trademark of Click Sales Inc., a Delaware corporation located at 1444 S. Entertainment Ave., Suite 410 Boise, ID 83709, USA and used by permission. ClickBank's role as retailer does not constitute an endorsement, approval or review of these products or any claim, statement or opinion used in promotion of these products.",
      'This site and the products and services offered on this site are not associated, affiliated, endorsed, or sponsored by Youtube or Facebook, nor have they been reviewed tested or certified by Youtube or Facebook.',
    ],
  },
} as const;
