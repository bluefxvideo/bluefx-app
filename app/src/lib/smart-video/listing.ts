import type { DirectorPlan, SmartAsset, StyleName } from './types';

/**
 * The automatic listing video (ReelEstate): the Phantom's engine with a fixed
 * recipe. The client gives a listing link or photos and the facts; the video
 * walks the home photo by photo, shows the address, the price and the figures
 * as animated text, ends on the agent's contact, and holds the chosen length.
 */

export const LISTING_LENGTHS = [30, 45, 60] as const;
export type ListingLength = (typeof LISTING_LENGTHS)[number];

export interface ListingOptions {
  /** The length the client chose, in seconds. */
  seconds: ListingLength;
  /** Every photo in the video becomes a moving clip (image-to-video). Always true in the product; false only in local checks of text and length. */
  animate: boolean;
}

/** A listing video shows whole photos, so it needs enough of them for the shortest plan the engine accepts. */
export const LISTING_MIN_PHOTOS = 4;

/**
 * A listing page shows 30 to 60 photos. This many of them, taken evenly from
 * the whole listing, go to the director, who picks one per room: enough for the
 * longest video (16 photos) with room to skip floor plans and near-duplicates.
 */
export const LISTING_LINK_PHOTOS = 20;
/** The client's own photos come on top of the link's, so the link brings fewer when there are uploads. */
export const listingLinkPhotos = (uploads: number) => Math.max(8, LISTING_LINK_PHOTOS - uploads);

// The narrator's pace with the direction below, measured 2026-10-01 on eight listing recordings
// (338 to 783 characters of narration): 0.063 to 0.073 seconds per character from the first word
// to the last, breaths between the lines included. Numbers are spoken as words, so characters
// predict the time better than words do. One take reads up to 10% faster or 5% slower than the mean,
// so the plan only has to come close: the recording is then fitted to the length (see below).
const SECONDS_PER_CHARACTER = 0.07;
const FASTEST_TAKE = 0.9;
const SLOWEST_TAKE = 1.05;
/** A listing narration has long words: the price and the figures are spoken in full. */
const CHARACTERS_PER_WORD = 6.8;
/** The opener, the price with the figures and the last line together, in words. */
const FIXED_WORDS = 29;
/** The picture is on screen this long before the first word. */
const SECONDS_BEFORE_VOICE = 0.65;
/**
 * After the last word, the music holds the contact card. This ending stretches or shrinks (shortest,
 * longest) so the video ends on the chosen length: the voice never reads at exactly the planned pace.
 */
export const LISTING_TAIL = [3, 6] as const;
/**
 * The recorded voice is brought to the pace that ends the video on its length, within these limits
 * (slowest, fastest): a few percent is not heard as a change of the voice.
 */
export const LISTING_TEMPO = [0.94, 1.06] as const;
/**
 * A beat of music between two photos. The pauses between the lines stretch up to this to bring a
 * short recording to the video's length; only what they cannot cover is left to a slower voice.
 */
export const LISTING_MAX_PAUSE = 0.5;
/** The pause the plan counts on, so a recording of the usual pace needs no change of tempo. */
const USUAL_PAUSE = 0.2;
/** When the last word of a video of this length should end: the ending then has room to stretch and to shrink. */
export const listingVoiceEnd = (seconds: number) => seconds - (LISTING_TAIL[0] + LISTING_TAIL[1]) / 2;
/** A room's line is at least this long (about 2.3 seconds), or the photo is gone before the viewer has seen it. */
const MIN_ROOM_CHARACTERS = 32;
const MIN_ROOM_WORDS = 6;
/** The opener, the price with the figures and the ending with the contact card take about this long at every length. */
const FIXED_SECONDS = 18;
/** A room photo is on screen about this long. */
const SECONDS_PER_ROOM = 3.2;

/** How many photos a video of this length shows, given how many usable ones there are: 7 in 30 seconds, 11 in 45, 16 in 60. */
export function listingPhotoCount(seconds: number, available: number): number {
  return Math.max(LISTING_MIN_PHOTOS, Math.min(available, 3 + Math.round((seconds - FIXED_SECONDS) / SECONDS_PER_ROOM)));
}

/** When the narrator's last word is heard. */
export function narrationSeconds(plan: Pick<DirectorPlan, 'scenes'>): number {
  return SECONDS_BEFORE_VOICE + plan.scenes.reduce((sum, scene) => sum + scene.narration.trim().length, 0) * SECONDS_PER_CHARACTER;
}

/** The characters of narration that end a video of this length and this many photos without any change to the voice. */
const characterBudget = (seconds: number, photos: number) =>
  Math.floor((listingVoiceEnd(seconds) - SECONDS_BEFORE_VOICE - USUAL_PAUSE * (photos - 1)) / SECONDS_PER_CHARACTER);

/** How the narrator reads a listing. The pace measured above belongs to this direction: a calmer one ("unhurried") read 15% slower. */
const LISTING_VOICE = 'Warm and clear, at a lively, natural pace, like an agent walking a buyer through the home.';

/** The motion every listing photo gets. Checked on 18 house photos (6, 8 and 12 s): one continuous push-in, no jump to another shot. */
export const LISTING_MOTION = 'Slow smooth dolly in on rails. Stabilized camera, no handheld shake, no jitter. Professional real estate cinematography.';

/** Clip lengths the animation engine makes, in seconds. A scene longer than the longest clip plays it slower. */
const CLIP_SECONDS = [6, 8, 10, 12];
export const listingClipSeconds = (sceneSeconds: number) => CLIP_SECONDS.find((seconds) => seconds >= sceneSeconds) ?? CLIP_SECONDS[CLIP_SECONDS.length - 1];

/** The rules the director follows for a listing video. They replace the general rules wherever the two differ. */
export function listingRecipe(listing: ListingOptions, photos: number, look: StyleName): string {
  const characters = characterBudget(listing.seconds, photos);
  const words = Math.floor(characters / CHARACTERS_PER_WORD);
  // What is left for a room once the opener, the figures and the call to action are said
  const roomWords = Math.max(MIN_ROOM_WORDS, Math.floor((words - FIXED_WORDS) / Math.max(1, photos - 3)));
  return `

THIS VIDEO IS A PROPERTY LISTING VIDEO. The rules in this section replace the general rules above wherever the two differ.
- "format" is "tour", "style" is "${look}", "captions" is true.
- LENGTH: the finished video runs ${listing.seconds} seconds. That takes a narration of ${Math.ceil(words * 0.96)} to ${Math.floor(words * 1.02)} words in total (about ${characters} characters, spaces included): with fewer the video ends early, with more it runs over. Count them before you answer. A room gets one line of ${roomWords} to ${roomWords + 1} words and at least ${MIN_ROOM_CHARACTERS} characters: shorter, and the photo is gone before the viewer has seen it.
- PHOTOS: show ${photos} photos, each in exactly ONE scene with background "mediaFull", so the video has ${photos} scenes. Order them the way a visitor walks the home: the front of the house first, then porch or entry, living room, dining room, kitchen, bedrooms, bathrooms, other rooms, and the backyard or the view last (without one, end on the most inviting room; never on a bathroom, a closet or a hallway). When there are more photos than scenes, take the best photo of each room and skip near-duplicates, floor plans, maps and pictures with printed text. Never show a photo twice.
- SCENE 1 (the front of the house): blocks = a title with the street address in capitals, kept short ("14 BIRCHWOOD LN"), and a pill with the city and state. Narration: an opener of 6 to 9 words that names the place and the kind of home ("Just listed in Meridian, Idaho: a craftsman bungalow."), so the address stays on screen for about three seconds.
- SCENE 2 (the next photo): blocks = a number with the asking price (value, prefix "$") and tiles for bedrooms, bathrooms and living area (top = "Beds" / "Baths" / "Sq Ft" or "m²" as the material gives it, big = the figure, icon = one emoji such as 🛏️ 🛁 📐, cue = the spoken words of that figure; one tile per figure the material gives). Narration: the price with its currency ("five hundred eighty-five thousand dollars") and these figures, as spoken words. The figures on screen are exact; a figure you round in speech gets "over", "nearly" or "about" in front ("just over nine hundred thousand dollars", "over three thousand two hundred square feet"), so the spoken words stay true next to the figure on screen. A round figure is said as it is. Without a price in the material, leave the number out; with fewer than two figures, leave the tiles out. Never invent a figure.
- EVERY OTHER SCENE EXCEPT THE LAST: "blocks": [] . Room photos carry no text; the captions carry the words. Narration: one full spoken sentence about what the viewer sees in THIS photo, concrete (materials, features, light), the way an agent says it while walking through ("The kitchen centers on a white quartz island."). No two lines open the same way or lean on the same verb. No hype words ("stunning", "dream home").
- LAST SCENE: blocks = a title with the call to action in capitals ("OPEN HOUSE\\nSAT 11-2" when the material names an open house, otherwise "BOOK A\\nSHOWING"), a caption "Listed by" plus the agent's name when the material names the agent, and a highlight with the agent's phone number (else the email, else the website; with none of them, the street address plus a note in "warnings"). Narration: one line about this photo, then the call to action. Never read the phone number out.
- Everything spoken and everything on screen is in the language of the client's text, the labels and the call to action included.
- No gallery, chips, rows, badge, emoji, stars, quote, logo or media blocks anywhere. "animate", "lifestyleShots", "drawings" and "signatureSound" are null.
- voice.direction: "${LISTING_VOICE}"`;
}

/**
 * What a listing plan must get right. Returned as one sentence for the director
 * to correct; null when the plan is fine.
 */
export function checkListingPlan(plan: DirectorPlan, assets: SmartAsset[], listing: ListingOptions): string | null {
  const photos = assets.filter((a) => a.kind === 'image').length;
  const wanted = listingPhotoCount(listing.seconds, photos);
  const shown = plan.scenes.map((scene) => scene.background.asset);
  const notFull = plan.scenes.findIndex((scene) => scene.background.type !== 'mediaFull');
  if (notFull !== -1) return `scene ${notFull + 1}: every scene of a listing video has a "mediaFull" background with one of the photos.`;
  // (with fewer photos than the shortest video has scenes, one photo has to come back)
  const twice = photos >= LISTING_MIN_PHOTOS && shown.find((id, i) => shown.indexOf(id) !== i);
  if (twice) return `photo "${twice}" is shown in two scenes; every scene shows a different photo.`;
  if (plan.scenes.length > wanted || plan.scenes.length < Math.min(wanted, Math.max(LISTING_MIN_PHOTOS, wanted - 1))) {
    return `the video has ${plan.scenes.length} scenes; a ${listing.seconds}-second listing video with these photos has ${wanted} scenes, one photo each.`;
  }
  const withText = plan.scenes.findIndex((scene, i) => i > 1 && i < plan.scenes.length - 1 && scene.blocks.length > 0);
  if (withText !== -1) return `scene ${withText + 1} is a room photo and must have "blocks": [] (only scene 1, scene 2 and the last scene carry text).`;
  if (!plan.scenes[0].blocks.some((b) => b.type === 'title')) return 'scene 1 needs a title with the street address.';
  const last = plan.scenes[plan.scenes.length - 1];
  if (!last.blocks.some((b) => b.type === 'highlight')) return 'the last scene needs a highlight block with the agent\'s contact.';
  const forbidden = plan.scenes.flatMap((scene) => scene.blocks).find((b) => !['title', 'pill', 'number', 'tiles', 'caption', 'highlight'].includes(b.type));
  if (forbidden) return `a listing video has no "${forbidden.type}" block; use only title, pill, number, tiles, caption and highlight.`;

  const short = plan.scenes.findIndex((scene, i) => i > 1 && i < plan.scenes.length - 1 && scene.narration.trim().length < MIN_ROOM_CHARACTERS);
  if (short !== -1) {
    return `scene ${short + 1} says only "${plan.scenes[short].narration.trim()}": a room's line needs at least ${MIN_ROOM_CHARACTERS} characters (${MIN_ROOM_WORDS} words or more), so the photo stays on screen long enough to be seen.`;
  }

  // The pauses, the voice's tempo and the ending absorb a good deal. A narration that could still miss the
  // length when the take reads at its slowest, or at its fastest, goes back to the director.
  const lastWord = narrationSeconds(plan);
  const pauses = LISTING_MAX_PAUSE * (plan.scenes.length - 1);
  const atSlowest = (lastWord * SLOWEST_TAKE) / LISTING_TEMPO[1] + LISTING_TAIL[0];
  const atFastest = (lastWord * FASTEST_TAKE) / LISTING_TEMPO[0] + pauses + LISTING_TAIL[1];
  const said = plan.scenes.map((scene) => scene.narration.trim()).join(' ');
  const count = said.split(/\s+/).filter(Boolean).length;
  // How far the narration is from its length, in words of the size this plan uses
  const off = Math.max(2, Math.ceil(Math.abs(characterBudget(listing.seconds, plan.scenes.length) - (said.length - plan.scenes.length + 1)) / (said.length / Math.max(1, count))));
  if (atSlowest > listing.seconds + 0.5) {
    return `the narration has ${count} words and would make the video about ${Math.round(atSlowest)} seconds long; the client chose ${listing.seconds}. Cut about ${off} words (${count - off} in total), from the room lines first, keeping the price, the figures and the call to action.`;
  }
  if (atFastest < listing.seconds - 1) {
    return `the narration has ${count} words and would make the video only about ${Math.round(atFastest)} seconds long; the client chose ${listing.seconds}. Add about ${off} words (${count + off} in total), spread over the room lines: say more of what each photo shows.`;
  }
  return null;
}

/** A tile's figure with its thousands separator, the way the video's language writes it ("3,225"). A year stays a year. */
export function listingFigure(big: string, label: string | null | undefined, language: string): string {
  if (!/^\d{4,}$/.test(big.trim()) || /year|built/i.test(label ?? '')) return big;
  try {
    return Number(big).toLocaleString(language);
  } catch {
    return Number(big).toLocaleString('en-US');
  }
}

/** What the recipe fixes is not left to the plan: captions on, nothing generated but the clips of the client's own photos. */
export function asListingPlan(plan: DirectorPlan): DirectorPlan {
  return {
    ...plan,
    format: 'tour',
    captions: true,
    voice: { ...plan.voice, direction: LISTING_VOICE },
    animate: null,
    lifestyleShots: null,
    drawings: null,
    signatureSound: null,
  };
}
