/**
 * Example analyses on Analyze Video's page. Each ad is one of our own sample ads
 * (the businesses are made up), uploaded to Analyze Video on app.bluefx.net with
 * the listed analysis type and instructions. The saved analysis is what came out.
 * "Try this example" puts the video and the settings into the form and opens the
 * saved analysis, so it costs nothing. Everything lives in the public bucket under
 * script-videos/examples/analyze-video/<id>/.
 */
export type ExampleAnalysisType = 'storyboard_recreation' | 'full_breakdown' | 'shot_list' | 'script_extraction' | 'custom_only';

export interface AnalyzeVideoExample {
  id: string;
  /** Short chip label: what the analysis is for. */
  label: string;
  title: string;
  /** One line on what the example teaches about picking the analysis. */
  shows: string;
  /** The analyzed ad. */
  video: { name: string; url: string; posterUrl: string };
  analysisType: ExampleAnalysisType;
  /** The type's name in the Analysis Type list. */
  analysisTypeLabel: string;
  /** Additional or custom instructions as typed; empty when none were given. */
  instructions: string;
  /** The saved analysis (Markdown). */
  analysisUrl: string;
  credits: number;
}

const EXAMPLES_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/script-videos/examples/analyze-video`;
const asset = (id: string, name: string) => `${EXAMPLES_BASE}/${id}/${name}`;

export const ANALYZE_VIDEO_EXAMPLES: AnalyzeVideoExample[] = [
  {
    id: 'storyboard',
    label: 'Shot by shot',
    title: 'A furnace tune-up ad, broken down shot by shot',
    shows:
      'Six shots with times, the person, the place, the camera and every word on screen. Clone Video Ad builds your version from this breakdown.',
    video: { name: 'furnace-tune-up-ad.mp4', url: asset('storyboard', 'source.mp4'), posterUrl: asset('storyboard', 'poster.jpg') },
    analysisType: 'storyboard_recreation',
    analysisTypeLabel: 'Storyboard Recreation',
    instructions: '',
    analysisUrl: asset('storyboard', 'analysis.md'),
    credits: 3,
  },
  {
    id: 'script',
    label: 'The script',
    title: 'A dentist Q&A ad, turned back into its script',
    shows:
      'Who says what and when, every line of on-screen text, and the structure of the ad: two questions, two answers, the call to action.',
    video: { name: 'dentist-questions-ad.mp4', url: asset('script', 'source.mp4'), posterUrl: asset('script', 'poster.jpg') },
    analysisType: 'script_extraction',
    analysisTypeLabel: 'Script/Dialogue Extraction',
    instructions: '',
    analysisUrl: asset('script', 'analysis.md'),
    credits: 3,
  },
  {
    id: 'custom',
    label: 'Your own question',
    title: 'A roofing ad, answered with your own question',
    shows:
      'Custom Prompt Only sends just what you type. Here: find the hook, the offer, the proof and the call to action, then write three new hooks.',
    video: { name: 'storm-roof-ad.mp4', url: asset('custom', 'source.mp4'), posterUrl: asset('custom', 'poster.jpg') },
    analysisType: 'custom_only',
    analysisTypeLabel: 'Custom Prompt Only',
    instructions:
      'List the hook, the offer, the proof and the call to action in this ad, each with the second where it appears. Then write 3 new opening hooks I could test for the same offer.',
    analysisUrl: asset('custom', 'analysis.md'),
    credits: 3,
  },
];
