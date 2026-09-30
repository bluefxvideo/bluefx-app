import type { VideoFormat, VideoLook } from './types';

/**
 * Example videos on The Phantom's page, each made by The Phantom itself on
 * app.bluefx.net from exactly the text, settings and files listed here, so
 * "Try this example" reproduces the kind of result shown. The businesses are
 * invented (555 numbers). Everything lives in the public bucket under
 * script-videos/smart-video/examples/<id>/, apart from anyone's video history.
 */
export interface PhantomExampleFile {
  /** File name as it appears in the form. */
  name: string;
  url: string;
  kind: 'photo' | 'clip';
}

export interface PhantomExample {
  id: string;
  /** Short chip label: who this example is for. */
  label: string;
  title: string;
  /** One line on what the example teaches about structuring the input. */
  shows: string;
  videoUrl: string;
  posterUrl: string;
  format: VideoFormat;
  look: VideoLook;
  brief: string;
  link?: string;
  files: PhantomExampleFile[];
}

const EXAMPLES_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/script-videos/smart-video/examples`;
const asset = (id: string, name: string) => `${EXAMPLES_BASE}/${id}/${name}`;

function example(e: Omit<PhantomExample, 'videoUrl' | 'posterUrl' | 'files'> & { files: Omit<PhantomExampleFile, 'url'>[] }): PhantomExample {
  return {
    ...e,
    videoUrl: asset(e.id, 'video.mp4'),
    posterUrl: asset(e.id, 'poster.jpg'),
    files: e.files.map((f) => ({ ...f, url: asset(e.id, f.name) })),
  };
}

export const PHANTOM_EXAMPLES: PhantomExample[] = [
  example({
    id: 'realtor',
    label: 'Realtor',
    title: 'Free home valuation, with the agent on camera',
    shows: 'A 10-second phone clip of the agent opens the ad in her own voice. Two listing photos and a few lines of notes do the rest.',
    format: 'vertical',
    look: 'elegant',
    brief:
      'Dana Whitfield, Keystone Realty in Meridian, Idaho. Every home I listed last month sold in under 30 days. Free home valuation: text me your address and I send a price back within the hour, no obligation. Text HOME to 208-555-0190. My video and two recent listings are attached.',
    files: [
      { name: 'dana-talking.mp4', kind: 'clip' },
      { name: 'listing-1.jpg', kind: 'photo' },
      { name: 'listing-2.jpg', kind: 'photo' },
    ],
  }),
  example({
    id: 'roofing',
    label: 'Roofer',
    title: 'Free storm inspection',
    shows: 'Five photos of real roof work and the facts a customer needs. The Phantom writes the script and picks the order.',
    format: 'vertical',
    look: 'bold',
    brief:
      "Ridgeline Roofing, Oklahoma City. After a storm, the damage you can't see from the ground is the part that costs you. Free roof inspection within 24 hours, with photos of every problem sent the same day. We meet your insurance adjuster for you. Most repairs are done in one day: shingles, gutters, fascia. Licensed and insured. Call 405-555-0174.",
    files: [
      { name: 'roof-a1.jpg', kind: 'photo' },
      { name: 'roof-a2.jpg', kind: 'photo' },
      { name: 'roof-b1.jpg', kind: 'photo' },
      { name: 'roof-b2.jpg', kind: 'photo' },
      { name: 'roof-c1.jpg', kind: 'photo' },
    ],
  }),
  example({
    id: 'product',
    label: 'Product',
    title: 'An Amazon product, horizontal',
    shows: 'A packshot and three lifestyle photos become a 16:9 ad for YouTube or a product page. The price and where to buy go in the text.',
    format: 'horizontal',
    look: 'clean',
    brief:
      'Trailhead 32 oz insulated water bottle. Ice at 6 am, still ice at 6 pm: cold for 24 hours. One-hand flip straw, fits car cup holders, dishwasher safe, lifetime lid guarantee. $29.99 on Amazon with Prime and free returns. For the gym, the car and the trail.',
    files: [
      { name: 'bottle-packshot.jpg', kind: 'photo' },
      { name: 'bottle-l1.jpg', kind: 'photo' },
      { name: 'bottle-l2.jpg', kind: 'photo' },
      { name: 'bottle-l3.jpg', kind: 'photo' },
    ],
  }),
];
