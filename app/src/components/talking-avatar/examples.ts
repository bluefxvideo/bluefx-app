import type { AvatarQualityTier } from '@/types/talking-avatar-tiers';

/**
 * Example videos on AI Avatar's page, each made by AI Avatar on app.bluefx.net
 * from exactly the photo, script, voice and settings listed here, so "Try this
 * example" reproduces the kind of result shown. The people are library avatars
 * and the businesses are invented. Everything lives in the public bucket under
 * script-videos/examples/ai-avatar/<id>/, apart from anyone's history.
 */
export interface AvatarExample {
  id: string;
  /** Short chip label: the quality tier it shows and its price. */
  label: string;
  title: string;
  /** One line on what the example teaches about structuring the input. */
  shows: string;
  videoUrl: string;
  posterUrl: string;
  tier: AvatarQualityTier;
  /** The avatar photo; a library avatar goes in as its photo. */
  photo: { name: string; url: string };
  script: string;
  /** Basic only: the voice picked in the list (Fast and Ultra choose their own). */
  voice?: { id: string; name: string };
  /** "How should the avatar move?", empty when left blank. */
  action: string;
  resolution: 'landscape' | 'portrait';
  /** Length of the finished video, the length that was charged. */
  seconds: number;
  /** What the video cost: seconds times the tier's price per second. */
  credits: number;
}

const EXAMPLES_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/script-videos/examples/ai-avatar`;
const asset = (id: string, name: string) => `${EXAMPLES_BASE}/${id}/${name}`;

function example({ photo, ...e }: Omit<AvatarExample, 'videoUrl' | 'posterUrl' | 'photo'> & { photo: string }): AvatarExample {
  return {
    ...e,
    videoUrl: asset(e.id, 'video.mp4'),
    posterUrl: asset(e.id, 'poster.jpg'),
    photo: { name: photo, url: asset(e.id, photo) },
  };
}

export const AVATAR_EXAMPLES: AvatarExample[] = [
  example({
    id: 'ultra',
    label: 'Ultra · 8 credits a second',
    title: 'The most realistic lip sync, kept short',
    shows: 'Dwayne from the avatar library and 18 words. Ultra has the most lifelike face and mouth at 8 credits a second, so short scripts pay off.',
    tier: 'ultra',
    photo: 'dwayne-carter.jpg',
    script: "Hi, I'm Dwayne from Carter Heating and Air. AC quit on you? We come out the same day.",
    action: '',
    resolution: 'landscape',
    seconds: 9,
    credits: 72,
  }),
  example({
    id: 'fast',
    label: 'Fast · 2 credits a second',
    title: 'A roofer who speaks the script himself',
    shows: 'Frank from the avatar library and 29 words. On Fast the avatar speaks the script with a voice chosen for him, 2 credits a second.',
    tier: 'fast',
    photo: 'frank-kowalski.jpg',
    script: "Hi, I'm Frank. I've fixed roofs in this town for thirty years. After a storm, call me first. The inspection is free, and I come out the same day.",
    action: '',
    resolution: 'landscape',
    seconds: 14,
    credits: 28,
  }),
  example({
    id: 'basic',
    label: 'Basic · 1 credit a second',
    title: 'A voice you pick, at the lowest price',
    shows: 'Marcus from the avatar library, 35 words and a voice picked from the list. Basic lip-syncs the voice you choose or upload, 1 credit a second.',
    tier: 'standard',
    photo: 'marcus-bell.jpg',
    script: "Hi, I'm Marcus from Bell Moving. Moving this month? Send us a photo of your stuff and we'll text you a flat price within one hour. The price we text is the price you pay.",
    voice: { id: 'English_DecentYoungMan', name: 'Lucas (Decent)' },
    action: '',
    resolution: 'landscape',
    seconds: 10,
    credits: 10,
  }),
];
