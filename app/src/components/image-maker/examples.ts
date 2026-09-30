import type { AspectRatio, Resolution } from './image-maker-page';

/**
 * Example images on Image Maker's page, each made by Image Maker on
 * app.bluefx.net from exactly the prompt, reference photos and settings listed
 * here, so "Try this example" reproduces the kind of result shown. The people
 * and businesses are invented. Everything lives in the public bucket under
 * script-videos/examples/image-maker/<id>/, apart from anyone's history.
 */
export interface ImageMakerExample {
  id: string;
  /** Short chip label: what this example is for. */
  label: string;
  title: string;
  /** One line on what the example teaches about structuring the input. */
  shows: string;
  prompt: string;
  /** Reference photos, in the order they were added. */
  references: { name: string; url: string }[];
  aspect: AspectRatio;
  resolution: Resolution;
  count: number;
  images: string[];
}

const EXAMPLES_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/script-videos/examples/image-maker`;
const asset = (id: string, name: string) => `${EXAMPLES_BASE}/${id}/${name}`;

function example({ references, ...e }: Omit<ImageMakerExample, 'references' | 'images'> & { references: string[] }): ImageMakerExample {
  return {
    ...e,
    references: references.map((name) => ({ name, url: asset(e.id, name) })),
    images: [asset(e.id, 'result.jpg')],
  };
}

export const IMAGE_MAKER_EXAMPLES: ImageMakerExample[] = [
  example({
    id: 'poster',
    label: 'Poster',
    title: 'A bakery poster with every word spelled right',
    shows: 'No photo needed. The words that must appear go in quotes, and the prompt says where each line sits.',
    prompt:
      'Poster for a small bakery. Big bold headline at the top: "Fresh sourdough every Saturday". Below it, a rustic sourdough loaf on a wooden board with a little flour dust, warm morning window light. Small line at the bottom: "Bella\'s Bakehouse · Opens at 7". Clean layout with plenty of empty space.',
    references: [],
    aspect: '3:4',
    resolution: '2K',
    count: 1,
  }),
  example({
    id: 'product',
    label: 'Product scene',
    title: 'The same bottle, in a new place',
    shows: 'One product photo as the reference. The prompt says where to put it and what must stay exactly the same.',
    prompt:
      'Put this exact bottle on a mossy rock beside a mountain lake at sunrise. Keep the bottle, its color, cap and straw exactly as they are. Morning mist on the water, soft golden light, shallow depth of field.',
    references: ['bottle.jpg'],
    aspect: '1:1',
    resolution: '2K',
    count: 1,
  }),
  example({
    id: 'combine',
    label: 'Person + product',
    title: 'The baker holds the bottle',
    shows: 'Two photos, a person and a product. The prompt names each one by what it is, so their order does not matter.',
    prompt:
      'The woman in the apron stands in her bakery and holds the green water bottle, smiling at the camera. Keep her face and the bottle exactly as they are. Shelves of bread behind her, natural window light, looks like a phone photo.',
    references: ['bottle.jpg', 'bella.jpg'],
    aspect: '3:4',
    resolution: '2K',
    count: 1,
  }),
  example({
    id: 'restage',
    label: 'Photo edit',
    title: 'A kitchen photo restaged for a listing',
    shows: 'Your own photo, edited: say what to change and what to keep. Auto keeps the shape of your photo.',
    prompt:
      'Restage this kitchen for a real estate listing: clear the clutter off the counters, add a bowl of lemons and a small plant, open the blinds, bright daylight. Keep the cabinets, walls, floor, appliances and camera angle exactly as they are.',
    references: ['kitchen.jpg'],
    aspect: 'auto',
    resolution: '2K',
    count: 1,
  }),
];
