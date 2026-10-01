import type { ToolExample } from '@/components/tools/tool-examples';
import type { CleanupPreset, TargetDuration } from '@/types/reelestate';

// Real results of ReelEstate, made in the tool with invented houses.
const BASE = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/examples/reelestate';

export interface ListingVideoExample extends ToolExample {
  videoUrl: string;
  posterUrl: string;
  /** The name of the project that "Try this example" creates. */
  projectName: string;
  photos: { name: string; url: string }[];
  aspectRatio: '16:9' | '9:16';
  targetDuration: TargetDuration;
  introText: string;
  voice: { id: string; name: string };
  music: { id: string; name: string; url: string };
  /** The script as the voice read it: written by the tool, first line edited to name the address. */
  script: string[];
  /** Seconds the finished video runs. */
  seconds: number;
  /** What each paid step cost. The export is free. */
  credits: { photoCheck: number; script: number; voice: number };
}

export const LISTING_VIDEO_EXAMPLES: ListingVideoExample[] = [
  {
    id: 'listing',
    label: 'Listing video',
    title: '14 Birchwood Lane: 8 photos, one narrated video',
    shows:
      'One photo per room, in the order a visitor walks the house. 30 seconds chosen, 31 seconds delivered: the script is written to fit the length with the chosen voice.',
    videoUrl: `${BASE}/listing/14-birchwood-lane.mp4`,
    posterUrl: `${BASE}/listing/poster.jpg`,
    projectName: '14 Birchwood Lane (example)',
    photos: [
      { name: '01-front.jpg', url: `${BASE}/listing/01-front.jpg` },
      { name: '02-porch.jpg', url: `${BASE}/listing/02-porch.jpg` },
      { name: '03-living-room.jpg', url: `${BASE}/listing/03-living-room.jpg` },
      { name: '04-dining-room.jpg', url: `${BASE}/listing/04-dining-room.jpg` },
      { name: '05-kitchen.jpg', url: `${BASE}/listing/05-kitchen.jpg` },
      { name: '06-bedroom.jpg', url: `${BASE}/listing/06-bedroom.jpg` },
      { name: '07-bathroom.jpg', url: `${BASE}/listing/07-bathroom.jpg` },
      { name: '08-backyard.jpg', url: `${BASE}/listing/08-backyard.jpg` },
    ],
    aspectRatio: '16:9',
    targetDuration: 30,
    introText: '14 Birchwood Lane',
    voice: { id: 'Calm_Woman', name: 'Serena (Calm)' },
    music: {
      id: 'upbeat-3',
      name: 'Welcome Home',
      url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/music-library/upbeat/upbeat-3.mp3',
    },
    script: [
      'Welcome to 14 Birchwood Lane, a navy blue home under mature trees.',
      'Relax on the inviting porch with a cozy swing.',
      'The living room features a fireplace and bookshelves.',
      'Host dinners under the elegant brass pendant light.',
      'This modern kitchen offers a large white quartz island.',
      'The cozy bedroom highlights beautiful wooden ceiling beams.',
      'Enjoy a double vanity with sleek marble countertops.',
      'Watch the sunset. Schedule your private showing today.',
    ],
    seconds: 31,
    credits: { photoCheck: 2, script: 1, voice: 2 },
  },
];

export interface PhotoCleanupExample extends ToolExample {
  beforeUrl: string;
  afterUrl: string;
  /** The file name the photo gets in the form. */
  fileName: string;
  preset: CleanupPreset;
  credits: number;
}

export const PHOTO_CLEANUP_EXAMPLES: PhotoCleanupExample[] = [
  {
    id: 'clutter',
    label: 'Remove Clutter',
    title: 'A lived-in living room, cleared',
    shows: 'Toys, moving boxes, the laundry basket and loose cables are gone. The sofa, the rug and the coffee table are untouched.',
    beforeUrl: `${BASE}/cleanup/living-room-before.jpg`,
    afterUrl: `${BASE}/cleanup/living-room-after.jpg`,
    fileName: 'living-room.jpg',
    preset: 'remove_clutter',
    credits: 2,
  },
  {
    id: 'sky',
    label: 'Sky Enhancement',
    title: 'A grey day turned into a blue sky',
    shows: 'The sky and the light change. The house, the lawn and the driveway stay the same.',
    beforeUrl: `${BASE}/cleanup/house-before.jpg`,
    afterUrl: `${BASE}/cleanup/house-after.jpg`,
    fileName: 'house-front.jpg',
    preset: 'sky_enhancement',
    credits: 2,
  },
  {
    id: 'counters',
    label: 'Declutter Counters',
    title: 'Kitchen counters, cleared',
    shows: 'Everything on the counters is gone. The drawings on the fridge stay: Remove Personal Items takes those.',
    beforeUrl: `${BASE}/cleanup/kitchen-before.jpg`,
    afterUrl: `${BASE}/cleanup/kitchen-after.jpg`,
    fileName: 'kitchen.jpg',
    preset: 'declutter_counters',
    credits: 2,
  },
];
