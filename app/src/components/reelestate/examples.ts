import type { ToolExample } from '@/components/tools/tool-examples';
import type { AgentCloneDuration, CleanupPreset, TargetDuration } from '@/types/reelestate';
import type { ListingLength } from '@/lib/smart-video/listing';
import type { VideoFormat } from '@/lib/smart-video/types';

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
  /** What each paid step cost. Animation is the Studio's Animate All, 6 credits per photo here. The export is free. */
  credits: { photoCheck: number; script: number; voice: number; animation: number };
}

export const LISTING_VIDEO_EXAMPLES: ListingVideoExample[] = [
  {
    id: 'listing',
    label: 'Listing video',
    title: '14 Birchwood Lane: 8 photos, animated and narrated',
    shows:
      'One photo per room, in the order a visitor walks the house. Animate All in the Studio turned every photo into a moving clip. 30 seconds chosen, 31 seconds delivered: the script is written to fit the length with the chosen voice.',
    videoUrl: `${BASE}/listing/14-birchwood-lane-animated.mp4`,
    posterUrl: `${BASE}/listing/poster-animated.jpg`,
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
    credits: { photoCheck: 2, script: 1, voice: 2, animation: 48 },
  },
];

/**
 * The example on the Automatic tab: the same invented house, made by the
 * automatic listing video from exactly the photos, facts and settings listed.
 */
export interface AutomaticVideoExample extends ToolExample {
  videoUrl: string;
  posterUrl: string;
  photos: { name: string; url: string }[];
  /** The text typed into "Facts and contact". */
  facts: string;
  seconds: ListingLength;
  format: VideoFormat;
  /** Seconds the finished video runs. */
  runs: number;
  /** The video's own price, and what animating the photos added. */
  credits: { video: number; animation: number };
}

export const AUTOMATIC_VIDEO_EXAMPLES: AutomaticVideoExample[] = [
  {
    id: 'automatic',
    label: 'Listing video',
    title: '14 Birchwood Lane: 7 photos and 6 lines of facts in, the finished video out',
    shows:
      'Nothing was placed by hand. The address, the price and the figures appear as animated text, every photo moves, the captions follow the voice, and the last photo carries the open house and the phone number.',
    videoUrl: `${BASE}/automatic/14-birchwood-lane-automatic.mp4`,
    posterUrl: `${BASE}/automatic/poster.jpg`,
    photos: [
      { name: '01-front.jpg', url: `${BASE}/listing/01-front.jpg` },
      { name: '02-porch.jpg', url: `${BASE}/listing/02-porch.jpg` },
      { name: '03-living-room.jpg', url: `${BASE}/listing/03-living-room.jpg` },
      { name: '05-kitchen.jpg', url: `${BASE}/listing/05-kitchen.jpg` },
      { name: '06-bedroom.jpg', url: `${BASE}/listing/06-bedroom.jpg` },
      { name: '07-bathroom.jpg', url: `${BASE}/listing/07-bathroom.jpg` },
      { name: '08-backyard.jpg', url: `${BASE}/listing/08-backyard.jpg` },
    ],
    facts: [
      '14 Birchwood Lane, Meridian, Idaho 83642',
      '$585,000',
      '4 bedrooms, 3 bathrooms, 2,450 square feet',
      'Craftsman bungalow with a covered front porch and porch swing. Living room with a fireplace and built-in bookshelves. Kitchen with a large white quartz island. Primary bedroom with wooden ceiling beams. Bathroom with a double vanity and marble countertops. Fenced backyard with a fire pit, facing the sunset.',
      'Open house Saturday 11 to 2.',
      'Listed by Dana Whitfield, Keystone Realty, 208-555-0190',
    ].join('\n'),
    seconds: 30,
    format: 'horizontal',
    runs: 30,
    credits: { video: 25, animation: 42 },
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

export interface AgentCloneExample extends ToolExample {
  videoUrl: string;
  posterUrl: string;
  /** The agent's own photo: one photo serves every room. */
  agentPhoto: { name: string; url: string };
  /** The listing photo the agent is placed into. */
  background: { name: string; url: string };
  /** The composite prompt, exactly as entered. */
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  duration: AgentCloneDuration;
  /** The action text, exactly as entered. */
  action: string;
  /** The preset button behind the action, when one was used. */
  actionPreset?: string;
  dialogue: string;
  /** What each paid step cost. */
  credits: { composite: number; animation: number };
}

export const AGENT_CLONE_EXAMPLES: AgentCloneExample[] = [
  {
    id: 'kitchen',
    label: 'In the kitchen',
    title: 'A 10-second kitchen tour with the agent in the room',
    shows:
      'One photo of the agent and one listing photo. The agent stands in the kitchen with matching light, gestures at the island and says the line.',
    videoUrl: `${BASE}/agent-clone/kitchen.mp4`,
    posterUrl: `${BASE}/agent-clone/kitchen-poster.jpg`,
    agentPhoto: { name: 'agent-photo.jpg', url: `${BASE}/agent-clone/agent-photo.jpg` },
    background: { name: '05-kitchen.jpg', url: `${BASE}/listing/05-kitchen.jpg` },
    prompt:
      'A real estate agent standing naturally in this property. Professional photo, natural lighting, matching perspective and shadows.',
    aspectRatio: '16:9',
    duration: 10,
    action: 'gesturing around the room, presenting the space to the viewer',
    actionPreset: 'Gesturing around',
    dialogue: 'Welcome to 14 Birchwood Lane. This kitchen has a quartz island and brass fixtures. Come see it this weekend.',
    credits: { composite: 2, animation: 10 },
  },
  {
    id: 'front',
    label: 'In front of the house',
    title: 'A 6-second "just listed" clip for Reels',
    shows:
      'Portrait format. The prompt places the agent on the front path, and the action makes the agent walk toward the camera.',
    videoUrl: `${BASE}/agent-clone/front.mp4`,
    posterUrl: `${BASE}/agent-clone/front-poster.jpg`,
    agentPhoto: { name: 'agent-photo.jpg', url: `${BASE}/agent-clone/agent-photo.jpg` },
    background: { name: '01-front.jpg', url: `${BASE}/listing/01-front.jpg` },
    prompt:
      'A real estate agent standing on the front path of this house, the whole house visible behind her. Professional photo, natural lighting, matching perspective and shadows.',
    aspectRatio: '9:16',
    duration: 6,
    action: 'walking slowly toward the camera along the front path, smiling',
    dialogue: 'Just listed: 14 Birchwood Lane. Message me for a private showing.',
    credits: { composite: 2, animation: 6 },
  },
];
