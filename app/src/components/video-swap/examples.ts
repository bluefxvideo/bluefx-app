import type { ToolExample } from '@/components/tools/tool-examples';
import type { VideoSwapOrientation } from '@/lib/video-swap/pricing';

/**
 * Example swaps on Video Swap's page, each made by Video Swap on app.bluefx.net
 * from exactly the video, photo and settings listed here. The people are
 * invented (our own AI actors and GPT Image photos). Everything lives in the
 * public bucket under script-videos/examples/video-swap/<id>/.
 */
export interface VideoSwapExample extends ToolExample {
  /** The video that went in and the result, playing together in one file. */
  compareUrl: string;
  posterUrl: string;
  /** How the two videos sit in the comparison: next to each other, or one above the other. */
  layout: 'side-by-side' | 'stacked';
  sourceVideo: { name: string; url: string };
  personPhoto: { name: string; url: string };
  orientation: VideoSwapOrientation;
  keepSound: boolean;
  /** Seconds the video was billed for. */
  seconds: number;
  credits: number;
}

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/script-videos/examples/video-swap`;

export const VIDEO_SWAP_EXAMPLES: VideoSwapExample[] = [
  {
    id: 'talking',
    label: 'Talking take',
    title: 'One sales take, a new presenter',
    shows:
      'A 7-second take with speech. The man from the photo says the line with the same mouth and hand movements, in the place of the photo. The voice of the video stays.',
    compareUrl: `${BASE}/talking/compare.mp4`,
    posterUrl: `${BASE}/talking/poster.jpg`,
    layout: 'side-by-side',
    sourceVideo: { name: 'furnace-offer-take.mp4', url: `${BASE}/talking/furnace-offer-take.mp4` },
    personPhoto: { name: 'technician.jpg', url: `${BASE}/talking/technician.jpg` },
    orientation: 'video',
    keepSound: true,
    seconds: 7,
    credits: 56,
  },
  {
    id: 'gestures',
    label: 'Gestures',
    title: 'A reaction clip, performed by someone else',
    shows:
      'A 6-second clip without speech. The woman from the photo repeats every move: the surprise at the phone, the smile, the open hand, the point at the screen.',
    compareUrl: `${BASE}/gestures/compare.mp4`,
    posterUrl: `${BASE}/gestures/poster.jpg`,
    layout: 'stacked',
    sourceVideo: { name: 'phone-reaction-take.mp4', url: `${BASE}/gestures/phone-reaction-take.mp4` },
    personPhoto: { name: 'florist.jpg', url: `${BASE}/gestures/florist.jpg` },
    orientation: 'video',
    keepSound: false,
    seconds: 6,
    credits: 48,
  },
];
