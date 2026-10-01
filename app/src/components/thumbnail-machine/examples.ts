/**
 * Example thumbnails on Thumbnail Maker's page. Each was made in Thumbnail Maker
 * on app.bluefx.net with exactly the description, the text overlay and the
 * reference photos listed here. The people and businesses are made up. "Try this
 * example" puts the same input into the form, so it costs nothing until Generate.
 * Everything lives in the public bucket under script-videos/examples/thumbnail-maker/<id>/.
 */
export interface ThumbnailExample {
  id: string;
  /** Short chip label: what this example starts from. */
  label: string;
  title: string;
  /** One line on what the example teaches about structuring the input. */
  shows: string;
  /** The finished thumbnail. */
  image: string;
  prompt: string;
  textOverlay: string;
  references: { name: string; url: string }[];
  credits: number;
}

const EXAMPLES_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/script-videos/examples/thumbnail-maker`;
const asset = (id: string, name: string) => `${EXAMPLES_BASE}/${id}/${name}`;

export const THUMBNAIL_EXAMPLES: ThumbnailExample[] = [
  {
    id: 'face',
    label: 'Your face',
    title: 'A face from one photo, with the reaction you ask for',
    shows:
      'One ordinary photo as the reference. The description says where the man is, what his face does and what is behind him. The words go in Text Overlay.',
    image: asset('face', 'result.jpg'),
    prompt:
      'The man from the reference photo on the left side, mouth open in surprise, eyebrows raised, pointing with his thumb at a bright remodeled kitchen behind him: white cabinets, a butcher block island, pendant lights. A big yellow arrow points at the island.',
    textOverlay: '$4K KITCHEN',
    references: [{ name: 'tom.jpg', url: asset('face', 'tom.jpg') }],
    credits: 10,
  },
  {
    id: 'garden',
    label: 'No photo',
    title: 'A thumbnail from a description alone',
    shows:
      'No reference photo. The description puts the big thing on the left and the comparison on the right, and leaves the words to Text Overlay.',
    image: asset('garden', 'result.jpg'),
    prompt:
      "A raised garden bed overflowing with huge ripe red tomatoes, a gardener's gloved hand holding one giant tomato up to the camera on the left, bright summer sun, blue sky. On the right, one small wilted tomato plant in a pot for comparison.",
    textOverlay: '3X MORE TOMATOES',
    references: [],
    credits: 10,
  },
  {
    id: 'product',
    label: 'Product',
    title: 'Your product against the alternative',
    shows:
      'One product photo as the reference. The jar keeps its label, and the description builds the comparison around the jar.',
    image: asset('product', 'result.jpg'),
    prompt:
      'The honey jar from the reference photo on the left with a big green check mark above the jar, a plastic bear-shaped squeeze bottle of honey on the right with a big red X above the bottle, both on a white kitchen counter, bright even light.',
    textOverlay: 'IS YOUR HONEY FAKE?',
    references: [{ name: 'honey-jar.jpg', url: asset('product', 'honey-jar.jpg') }],
    credits: 10,
  },
];
