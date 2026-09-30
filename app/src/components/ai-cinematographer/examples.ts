import type { FastCameraMotion, ProAspectRatio, VideoModel } from '@/types/cinematographer';

/**
 * Example videos on Video Maker's page, each made on Video Maker's engines with
 * exactly the request the app sends for the prompt, settings and frames listed
 * here, so "Try this example" reproduces the kind of result shown. The people
 * and businesses are invented. Everything lives in the public bucket under
 * script-videos/examples/video-maker/<id>/, apart from anyone's history.
 */
export interface VideoMakerExampleFrame {
  /** File name as it appears in the form. */
  name: string;
  url: string;
}

export interface VideoMakerExample {
  id: string;
  /** Short chip label: what this example is for. */
  label: string;
  title: string;
  /** One line on what the example teaches about structuring the input. */
  shows: string;
  videoUrl: string;
  posterUrl: string;
  prompt: string;
  model: VideoModel;
  duration: number;
  resolution: string;
  aspect_ratio: ProAspectRatio;
  generate_audio: boolean;
  /** Fast's camera menu; 'none' on Pro and Ultra, where the prompt says how the camera moves. */
  camera_motion: FastCameraMotion;
  firstFrame?: VideoMakerExampleFrame;
  lastFrame?: VideoMakerExampleFrame;
}

const EXAMPLES_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/script-videos/examples/video-maker`;
const asset = (id: string, name: string) => `${EXAMPLES_BASE}/${id}/${name}`;

type ExampleInput = Omit<VideoMakerExample, 'videoUrl' | 'posterUrl' | 'firstFrame' | 'lastFrame'> & {
  firstFrame?: string;
  lastFrame?: string;
};

function example({ firstFrame, lastFrame, ...e }: ExampleInput): VideoMakerExample {
  return {
    ...e,
    videoUrl: asset(e.id, 'video.mp4'),
    posterUrl: asset(e.id, 'poster.jpg'),
    firstFrame: firstFrame ? { name: firstFrame, url: asset(e.id, firstFrame) } : undefined,
    lastFrame: lastFrame ? { name: lastFrame, url: asset(e.id, lastFrame) } : undefined,
  };
}

export const VIDEO_MAKER_EXAMPLES: VideoMakerExample[] = [
  example({
    id: 'talking',
    label: 'Talking',
    title: 'A baker talks to camera in her own words',
    shows: 'A photo of the person as the first frame, and the exact words in quotes. Ultra gives her a matching voice and lip sync.',
    prompt: 'The person is saying: "Hi, I\'m Bella. Every Saturday we bake fresh sourdough, and it sells out by ten."',
    model: 'ultra',
    duration: 6,
    resolution: '1080p',
    aspect_ratio: '9:16',
    generate_audio: true,
    camera_motion: 'none',
    firstFrame: 'bella.jpg',
  }),
  example({
    id: 'no-photo',
    label: 'No photo',
    title: 'An ad opening from words alone',
    shows: 'No photo at all: who, where, what happens, the line in quotes, the camera and the light. Ultra invents the owner and his voice.',
    prompt:
      'A tired diner owner in his fifties sits alone at the counter of his empty diner at lunchtime. He glances at the silent phone next to the register, then looks into the camera and says: "Tuesday lunch, and not one table." Static camera, soft window light, quiet room tone.',
    model: 'ultra',
    duration: 6,
    resolution: '1080p',
    aspect_ratio: '9:16',
    generate_audio: true,
    camera_motion: 'none',
  }),
  example({
    id: 'before-after',
    label: 'Before & after',
    title: 'A kitchen remodel in 5 seconds',
    shows: 'Two photos: the old kitchen as the First Frame, the new one as the Last Frame. Ultra fills in the renovation between them.',
    prompt:
      'Renovation time-lapse from one fixed spot: the old cabinets, counters and floor come out and the new kitchen goes in, piece by piece, until the room is finished. Static camera, bright daylight, fast construction sounds.',
    model: 'ultra',
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '9:16',
    generate_audio: true,
    camera_motion: 'none',
    firstFrame: 'kitchen-before.jpg',
    lastFrame: 'kitchen-after.jpg',
  }),
  example({
    id: 'product',
    label: 'Product',
    title: 'A product shot from one photo',
    shows: 'The product photo stays exactly as it is. The words say how the camera moves and what changes around it.',
    prompt:
      'The camera slowly orbits around the green water bottle and keeps it centered in the frame the whole time. The sun rises behind the mountains. Cold drops of condensation slide down the steel. Morning wind and birdsong.',
    model: 'pro',
    duration: 6,
    resolution: '720p',
    aspect_ratio: '16:9',
    generate_audio: true,
    camera_motion: 'none',
    firstFrame: 'bottle-sunrise.jpg',
  }),
  example({
    id: 'real-estate',
    label: 'Real estate',
    title: 'A listing photo comes alive',
    shows: 'One listing photo and a few words on what moves. Fast with Dolly Out pulls back slowly, so the SOLD sign stays in the shot.',
    prompt:
      'A sunny afternoon. The camera slowly pulls back from the house. The SOLD sign swings gently in the breeze, the leaves of the young tree flutter and two birds fly across the blue sky. Quiet street, birdsong.',
    model: 'fast',
    duration: 6,
    resolution: '1080p',
    aspect_ratio: '9:16',
    generate_audio: true,
    camera_motion: 'dolly_out',
    firstFrame: 'sold-house.jpg',
  }),
];
