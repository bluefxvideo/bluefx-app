/**
 * Example ads on Clone Video Ad's page. Each was made in Clone Video Ad on
 * app.bluefx.net: the source ad (from our own ad library, never a real brand's)
 * was analyzed, the listed photos went into Customize, the AI Assistant got the
 * listed instruction, and the finished clips were put together under the voice
 * over. "Try this example" loads the saved analysis, so it costs nothing.
 * Everything lives in the public bucket under script-videos/examples/clone-video-ad/<id>/.
 */
export interface CloneAdExample {
  id: string;
  /** Short chip label: the business the ad was cloned for. */
  label: string;
  title: string;
  /** One line on what the example teaches about cloning an ad. */
  shows: string;
  /** The ad that was cloned. */
  source: { name: string; videoUrl: string; posterUrl: string };
  videoUrl: string;
  posterUrl: string;
  /** The saved analysis of the source ad (Markdown). */
  analysisUrl: string;
  photos: { name: string; url: string }[];
  aspectRatio: '9:16' | '16:9';
  /** What was sent to the AI Assistant after the shot plan. */
  instruction: string;
  voice: { id: string; name: string };
  /** Every credit the finished ad took: analysis, pictures, clips and voice. */
  credits: number;
}

/**
 * Example ads on Video Ad From Script's page. Each was made in Video Ad From Script:
 * the script was pasted as it stands here, the listed photos went into Customize,
 * the shot plan was used as the AI made it (every clip with a still camera), and
 * the finished clips were put together under the voice over. "Try this example"
 * loads the script, the photos and the settings, so it costs nothing. Everything
 * lives in the public bucket under script-videos/examples/video-ad-from-script/<id>/.
 */
export interface ScriptAdExample {
  id: string;
  /** Short chip label: the business the ad is for. */
  label: string;
  title: string;
  /** One line on what the example teaches about writing the script. */
  shows: string;
  videoUrl: string;
  posterUrl: string;
  /** The narration script, exactly as it was pasted. */
  script: string;
  photos: { name: string; url: string }[];
  aspectRatio: '9:16' | '16:9';
  voice: { id: string; name: string };
  scenes: number;
  /** Every credit the finished ad took: pictures, clips and voice (the shot plan is free). */
  credits: number;
}

const EXAMPLES_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/script-videos/examples/clone-video-ad`;
const asset = (id: string, name: string) => `${EXAMPLES_BASE}/${id}/${name}`;
const SCRIPT_EXAMPLES_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/script-videos/examples/video-ad-from-script`;
const scriptAsset = (id: string, name: string) => `${SCRIPT_EXAMPLES_BASE}/${id}/${name}`;

export const CLONE_AD_EXAMPLES: CloneAdExample[] = [
  {
    id: 'barber',
    label: 'Barbershop',
    title: 'A gym ad, cloned for a barbershop',
    shows:
      "The original: a gym-goer's selfie hook, the empty gym, an end card. Three shop photos and one instruction turned it into a barbershop ad with the same beats.",
    source: { name: 'gym-ad.mp4', videoUrl: asset('barber', 'source.mp4'), posterUrl: asset('barber', 'source-poster.jpg') },
    videoUrl: asset('barber', 'video.mp4'),
    posterUrl: asset('barber', 'poster.jpg'),
    analysisUrl: asset('barber', 'analysis.md'),
    photos: ['barber-shop.jpg', 'barber-cut.jpg', 'barber-front.jpg'].map((name) => ({ name, url: asset('barber', name) })),
    aspectRatio: '9:16',
    instruction:
      'Make this ad for Sharp Line Barbers, a barbershop with no wait on Saturday mornings, using the three photos. Same structure: a young man films a selfie outside the shop, then the empty chairs, then a fresh fade, then the end card "Sharp Line Barbers - Walk-ins welcome". Narration: "POV, you finally found a barber with no wait on a Saturday. Look at this, three chairs open, nobody waiting. Sharp Line, walk-ins welcome."',
    voice: { id: 'Casual_Guy', name: 'Jake (Casual)' },
    credits: 61,
  },
];

export const SCRIPT_AD_EXAMPLES: ScriptAdExample[] = [
  {
    id: 'honey',
    label: 'Honey farm',
    title: 'A product ad from a 59-word script and one photo',
    shows:
      'Five short sentences became six scenes: the hook, the farm, the frames, the pour, the toast, the offer. The jar from the photo is in every scene, with the same label.',
    videoUrl: scriptAsset('honey', 'video.mp4'),
    posterUrl: scriptAsset('honey', 'poster.jpg'),
    script:
      'This jar of honey was still inside a beehive on Monday. Hollow Creek Honey comes from sixty hives on one wildflower meadow in Vermont. Every frame is spun by hand, and the raw honey goes straight into the jar, never heated. Spread a spoonful on warm toast and taste the clover. Order two jars today, and shipping is free.',
    photos: [{ name: 'honey-jar.jpg', url: scriptAsset('honey', 'honey-jar.jpg') }],
    aspectRatio: '9:16',
    voice: { id: 'English_MaturePartner', name: 'Michael (Mature)' },
    scenes: 6,
    credits: 86,
  },
];
