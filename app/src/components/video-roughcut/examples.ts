import type { ToolExample } from '@/components/tools/tool-examples';

/**
 * The example on Rough Cut's page: a raw recording that Rough Cut processed on
 * app.bluefx.net, with the cuts exactly as the XML holds them. The mechanic and
 * his shop are invented (an AI talking head with scripted stumbles). Everything
 * lives in the public bucket under script-videos/examples/rough-cut/<id>/.
 */
export interface RoughcutExample extends ToolExample {
  /** The raw recording that went in. "Try this example" loads this file. */
  rawVideo: { name: string; url: string };
  /** The same recording with the XML's cuts applied, the way an editor plays it after the import. */
  cutVideoUrl: string;
  posterUrl: string;
  rawSeconds: number;
  cutSeconds: number;
  /** Seconds removed, as the tool reported them. */
  removedSeconds: number;
  /** The parts the XML keeps, in seconds of the raw recording. */
  kept: { from: number; to: number }[];
  /** "What was cut", as the tool lists it. */
  removals: { start: number; end: number; text: string; reason: string }[];
  credits: number;
}

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/script-videos/examples/rough-cut`;

export const ROUGHCUT_EXAMPLES: RoughcutExample[] = [
  {
    id: 'brakes',
    label: 'Raw take',
    title: 'A 72-second raw take, cut to 40 seconds',
    shows:
      'A mechanic records a tip video and stumbles six times. Every false start is cut, and the last complete take of each line stays.',
    rawVideo: { name: 'brake-tips-raw-take.mp4', url: `${BASE}/brakes/brake-tips-raw-take.mp4` },
    cutVideoUrl: `${BASE}/brakes/brake-tips-rough-cut.mp4`,
    posterUrl: `${BASE}/brakes/poster.jpg`,
    rawSeconds: 72.4,
    cutSeconds: 39.84,
    removedSeconds: 33,
    kept: [
      { from: 7.32, to: 14.6 },
      { from: 17.2, to: 25.08 },
      { from: 30.88, to: 39.84 },
      { from: 41.36, to: 47.88 },
      { from: 53.36, to: 56.44 },
      { from: 66.32, to: 72.4 },
    ],
    removals: [
      {
        start: 0,
        end: 7.2,
        text: "Okay. Hi. I'm Ray from Ray's Auto. Sorry. Let me start again.",
        reason: 'Lead-in filler before the recording starts',
      },
      {
        start: 14.96,
        end: 17.04,
        text: 'Number one. Um,',
        reason: "False start on 'number one' and filler before the full line",
      },
      {
        start: 25.52,
        end: 30.23,
        text: 'Number two is the pedal. If the pedal feels soft or... Wait.',
        reason: "Earlier attempt at the 'number two is the pedal' line that trails off, plus 'wait'",
      },
      {
        start: 40.09,
        end: 41.37,
        text: 'the car pulls to',
        reason: "Stumble at the start of the 'pulls to one side' line",
      },
      {
        start: 48.16,
        end: 53.03,
        text: "So if you notice any of these, don't, um, okay.",
        reason: "Earlier attempt at the 'if you notice any of these' line and filler",
      },
      {
        start: 56.72,
        end: 66.09,
        text: "Call us at five five five zero one four two, and we will check your brakes for free. And that's... One more time.",
        reason: "Earlier take of the phone number line, the trailing 'and that's', and the 'one more time' restart",
      },
    ],
    credits: 20,
  },
];
