/**
 * Example clones on Clone Studio's page. Each was made in Clone Studio on
 * app.bluefx.net from an ad in our own ad library (never a real brand's) with
 * the listed photos and instruction; both businesses are made up. "Try this
 * example" copies the saved board into the user's account for free: the
 * breakdown, the photos, each scene's instruction and motion prompt, and no
 * results (board.json). Everything lives in the public bucket under
 * script-videos/examples/clone-studio/<id>/.
 */
export interface CloneStudioExample {
  id: string;
  /** Short chip label: the business the ad was cloned for. */
  label: string;
  title: string;
  /** One line on what the example teaches about cloning scene by scene. */
  shows: string;
  /** The ad that was cloned. */
  source: { name: string; videoUrl: string; posterUrl: string };
  videoUrl: string;
  posterUrl: string;
  /** Saved board: the project row's breakdown fields with results cleared. */
  boardUrl: string;
  /** Title of the copy in the user's projects; also finds an earlier copy. */
  copyTitle: string;
  photos: { name: string; url: string }[];
  /** What went into "Apply to all scenes". */
  instruction: string;
  /** What was then changed by hand, card by card. */
  edits: string;
  /** Every credit the finished ad took: breakdown, pictures, clips and music. */
  credits: number;
}

const EXAMPLES_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/script-videos/examples/clone-studio`;
const asset = (id: string, name: string) => `${EXAMPLES_BASE}/${id}/${name}`;

export const CLONE_STUDIO_EXAMPLES: CloneStudioExample[] = [
  {
    id: 'pizza',
    label: 'Pizzeria',
    title: "A bakery ad, cloned scene by scene for a pizzeria",
    shows:
      'Same six scenes, same timing. The owner, the food and the storefront are swapped from four photos, and the end card gets the new name and number.',
    source: { name: 'bakery-ad.mp4', videoUrl: asset('pizza', 'source.mp4'), posterUrl: asset('pizza', 'source-poster.jpg') },
    videoUrl: asset('pizza', 'video.mp4'),
    posterUrl: asset('pizza', 'poster.jpg'),
    boardUrl: asset('pizza', 'board.json'),
    copyTitle: "Nonna Rosa's Pizza (example)",
    photos: ['pizza-owner.jpg', 'pizza-margherita.jpg', 'pizza-knots.jpg', 'pizza-front.jpg'].map((name) => ({ name, url: asset('pizza', name) })),
    instruction:
      "Replace Bella with the pizzeria owner from reference 1. Replace the sourdough loaves with the margherita pizza from reference 2 and the cinnamon rolls with the garlic knots from reference 3. Replace the bakery storefront with Nonna Rosa's Pizza from reference 4. Remove all on-screen text. The words change to fit the pizzeria: he is Tony from Nonna Rosa's Pizza, a margherita is twelve dollars and garlic knots are six, 642 Main Street, open Tuesday to Sunday, and viewers text the number on screen to order.",
    edits:
      'Only Tony speaks (scene 1), so the ad keeps one voice; the other motion prompts say "No speech". The end card got its new text, and "text" came off its negative prompt.',
    credits: 327,
  },
];
