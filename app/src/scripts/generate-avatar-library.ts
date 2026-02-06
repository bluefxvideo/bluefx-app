/**
 * UGC Avatar Library Generator
 *
 * Generates diverse UGC-style avatar images using Nano Banana Pro (fal.ai),
 * uploads them to Supabase Storage, and inserts them into avatar_templates.
 *
 * Usage:
 *   npx tsx src/scripts/generate-avatar-library.ts --test     # Generate 2 test images
 *   npx tsx src/scripts/generate-avatar-library.ts --all       # Generate all 30 avatars
 *   npx tsx src/scripts/generate-avatar-library.ts --seed-only # Just insert DB records (images already uploaded)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const FAL_KEY = process.env.FAL_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!FAL_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars: FAL_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---------- Character Definitions ----------

type AgeRange = 'young' | 'middle_aged' | 'senior';

function ageToRange(age: number): AgeRange {
  if (age < 30) return 'young';
  if (age < 46) return 'middle_aged';
  return 'senior';
}

interface AvatarCharacter {
  name: string;
  slug: string;
  gender: 'male' | 'female';
  age: number;
  ethnicity: string;
  style: string;
  setting: string;
  voiceId: string;
  description: string;
  promptDetails: string;
}

const PROMPT_SUFFIX = `Looking directly at the camera with a natural, friendly expression. Arms relaxed at sides or resting on lap, hands below frame and not visible. Natural soft lighting, shallow depth of field with soft bokeh background. Authentic candid portrait, not overly retouched. 16:9 landscape aspect ratio, head and shoulders framing, centered. The person is NOT holding anything — no phone, no camera, no device, no objects in hands. This is a clean headshot portrait.`;

// Selfie-style UGC prompt suffix — raw, handheld, imperfect, older smartphone look
const SELFIE_PROMPT_SUFFIX = `Shot on front-facing camera of an older smartphone, handheld at arm's length, slightly from above. The person is looking directly into the phone camera lens with a natural, casual expression. No phone visible in the frame — the viewer sees what the front camera sees. Slightly grainy image quality, subtle digital noise, not crisp or sharp. Imperfect natural lighting, no studio lights, no ring light. Minor lens distortion from wide-angle front camera. Slight motion blur from handheld shot. Muted color palette, not over-saturated. 16:9 landscape aspect ratio, close-up selfie framing from upper chest up. Raw, unpolished, authentic UGC content creator aesthetic. This looks like a real person's casual selfie, not a professional photo.`;

// Hyper-realistic prompt suffix — ultra-photorealistic, cinematic, indistinguishable from real photography
const HYPER_REALISTIC_PROMPT_SUFFIX = `Ultra-realistic cinematic photography captured as if shot on a full-frame professional DSLR with a 35mm prime lens at f/1.8. The person has a natural, mid-conversation expression — mouth slightly open as if speaking, eyes engaged with the camera, creating an authentic content-creator feel. Skin shows true-to-life micro-detail including visible pores, faint blemishes, natural oil sheen on forehead and cheekbones, subtle redness, and fine peach fuzz — nothing airbrushed, no retouching, no plastic skin. Eyes are sharp and glossy with realistic light reflections inside the pupils, natural eyelashes, and visible eyebrow hair strands. Shallow depth of field with creamy natural bokeh in the background giving strong subject separation. Warm natural lighting with realistic shadows, soft highlights, and subtle ambient bounce light creating dimensional depth. Color grading is neutral and photographic with true skin tones, warm highlights, slight golden bias, no oversaturation, no artificial HDR. Fine cinematic film grain and subtle sensor noise in the shadows, preserving organic realism. 16:9 landscape aspect ratio, head and upper chest framing, centered. The person is NOT holding anything — no phone, no device. 8K photorealism, true-to-life textures, indistinguishable from a real photograph. No cartoon, no CGI, no 3D render, no beauty filters, no over-smoothing, no glamour lighting, no Instagram filter look, no distorted features.`;

const CHARACTERS: AvatarCharacter[] = [
  // ---- FEMALE (15) ----
  {
    name: 'Sofia Martinez',
    slug: 'sofia-martinez',
    gender: 'female',
    age: 25,
    ethnicity: 'Latina',
    style: 'Casual hoodie, messy bun',
    setting: 'Bedroom with ring light',
    voiceId: 'Lovely_Girl',
    description: 'Young Latina content creator with casual, relatable energy',
    promptDetails: 'Portrait photo of a young Latina woman, 25 years old, warm brown skin, dark brown hair in a messy bun, wearing a soft pink casual hoodie. She is sitting in her bedroom with warm ambient lighting, fairy lights and posters visible in the blurred background.',
  },
  {
    name: 'Aisha Johnson',
    slug: 'aisha-johnson',
    gender: 'female',
    age: 30,
    ethnicity: 'Black',
    style: 'Business casual blouse',
    setting: 'Home office',
    voiceId: 'Wise_Woman',
    description: 'Professional Black woman with confident, articulate presence',
    promptDetails: 'Portrait photo of a Black woman, 30 years old, deep brown skin, shoulder-length natural curls, wearing a cream silk blouse with small gold earrings. She is in a clean home office with a bookshelf and a green plant slightly blurred in the background.',
  },
  {
    name: 'Emily Chen',
    slug: 'emily-chen',
    gender: 'female',
    age: 22,
    ethnicity: 'East Asian',
    style: 'Oversized tee, glasses',
    setting: 'Dorm room',
    voiceId: 'Sweet_Girl_2',
    description: 'Young East Asian student with approachable, nerdy charm',
    promptDetails: 'Portrait photo of a young East Asian woman, 22 years old, fair skin, straight black hair past her shoulders, wearing round glasses and an oversized graphic t-shirt. She is in a cozy dorm room with posters and string lights softly blurred behind her.',
  },
  {
    name: 'Priya Sharma',
    slug: 'priya-sharma',
    gender: 'female',
    age: 35,
    ethnicity: 'South Asian',
    style: 'Elegant kurti top',
    setting: 'Living room with plants',
    voiceId: 'Calm_Woman',
    description: 'Graceful South Asian woman with calm, authoritative demeanor',
    promptDetails: 'Portrait photo of a South Asian woman, 35 years old, warm brown skin, dark hair parted to the side, wearing an elegant deep teal kurti top with subtle gold embroidery. She is in a bright living room with indoor plants and natural window light softly blurring behind her.',
  },
  {
    name: 'Hannah Mueller',
    slug: 'hannah-mueller',
    gender: 'female',
    age: 28,
    ethnicity: 'White/European',
    style: 'Denim jacket, earrings',
    setting: 'Cafe window',
    voiceId: 'Inspirational_girl',
    description: 'Trendy European woman with bright, inspiring energy',
    promptDetails: 'Portrait photo of a European woman, 28 years old, fair skin with light freckles, wavy dirty blonde hair, wearing a light denim jacket over a white tee with dangling gold earrings. She is sitting near a cafe window with warm afternoon light streaming in, blurred street scene outside.',
  },
  {
    name: 'Fatima Al-Hassan',
    slug: 'fatima-al-hassan',
    gender: 'female',
    age: 32,
    ethnicity: 'Middle Eastern',
    style: 'Hijab, smart casual',
    setting: 'Clean desk setup',
    voiceId: 'English_ConfidentWoman',
    description: 'Confident Middle Eastern woman with professional, modern style',
    promptDetails: 'Portrait photo of a Middle Eastern woman, 32 years old, olive skin, wearing a navy blue hijab and a smart casual light gray blazer over a white top. She is at a clean modern desk setup with a monitor and succulent plant softly blurred behind her.',
  },
  {
    name: 'Yuki Tanaka',
    slug: 'yuki-tanaka',
    gender: 'female',
    age: 27,
    ethnicity: 'Japanese',
    style: 'Minimalist sweater',
    setting: 'Modern apartment',
    voiceId: 'English_SereneWoman',
    description: 'Minimalist Japanese woman with serene, thoughtful presence',
    promptDetails: 'Portrait photo of a Japanese woman, 27 years old, fair skin, short bob haircut, wearing a cream minimalist oversized knit sweater. She is in a modern minimalist apartment with clean white walls and a single piece of art softly blurred behind her.',
  },
  {
    name: 'Olivia Brooks',
    slug: 'olivia-brooks',
    gender: 'female',
    age: 45,
    ethnicity: 'White/American',
    style: 'Professional blazer',
    setting: 'Kitchen counter',
    voiceId: 'English_Wiselady',
    description: 'Mature American woman with warm, experienced authority',
    promptDetails: 'Portrait photo of a white American woman, 45 years old, light skin, shoulder-length auburn hair with subtle highlights, wearing a fitted navy blazer over a soft v-neck top. She is standing at a modern kitchen counter with warm pendant lighting softly blurred behind her.',
  },
  {
    name: 'Zara Okafor',
    slug: 'zara-okafor',
    gender: 'female',
    age: 24,
    ethnicity: 'Nigerian',
    style: 'Colorful top, headband',
    setting: 'Bright room',
    voiceId: 'Lively_Girl',
    description: 'Vibrant Nigerian woman with lively, energetic personality',
    promptDetails: 'Portrait photo of a Nigerian woman, 24 years old, deep rich brown skin, wearing a vibrant colorful patterned Ankara top with a matching headband. She is in a bright, airy room with white walls and colorful cushions softly blurred in the background.',
  },
  {
    name: 'Maria Rossi',
    slug: 'maria-rossi',
    gender: 'female',
    age: 38,
    ethnicity: 'Italian/Mediterranean',
    style: 'Casual shirt, necklace',
    setting: 'Balcony/outdoor',
    voiceId: 'English_GracefulLady',
    description: 'Elegant Mediterranean woman with warm, graceful charm',
    promptDetails: 'Portrait photo of an Italian Mediterranean woman, 38 years old, olive skin, dark wavy hair falling past her shoulders, wearing a relaxed white linen shirt with a delicate gold pendant necklace. She is on a balcony with potted herbs and a warm sunset sky softly blurred behind her.',
  },
  {
    name: 'Lin Wei',
    slug: 'lin-wei',
    gender: 'female',
    age: 29,
    ethnicity: 'Chinese',
    style: 'Turtleneck, minimal',
    setting: 'Studio backdrop',
    voiceId: 'English_Soft-spokenGirl',
    description: 'Polished Chinese woman with quiet confidence and elegance',
    promptDetails: 'Portrait photo of a Chinese woman, 29 years old, fair porcelain skin, straight black hair in a low ponytail, wearing a black turtleneck. She is in front of a soft neutral gray studio-like backdrop with gentle directional lighting creating soft shadows.',
  },
  {
    name: 'Jessica Taylor',
    slug: 'jessica-taylor',
    gender: 'female',
    age: 42,
    ethnicity: 'Black/American',
    style: 'Cardigan, warm smile',
    setting: 'Cozy living room',
    voiceId: 'English_Wiselady',
    description: 'Warm Black American woman with nurturing, trustworthy presence',
    promptDetails: 'Portrait photo of a Black American woman, 42 years old, medium brown skin, natural hair styled in soft twist-out curls, wearing a cozy camel-colored cardigan over a simple top. She is in a warm living room with a soft couch and warm lamp light blurred behind her.',
  },
  {
    name: 'Camille Dupont',
    slug: 'camille-dupont',
    gender: 'female',
    age: 26,
    ethnicity: 'French/Mixed',
    style: 'Beret, striped top',
    setting: 'Parisian balcony',
    voiceId: 'Exuberant_Girl',
    description: 'Chic French mixed-race woman with playful, creative spirit',
    promptDetails: 'Portrait photo of a French mixed-race woman, 26 years old, light brown skin, curly dark hair, wearing a classic black beret and a navy-and-white Breton striped top. She is on a small Parisian balcony with wrought-iron railing and rooftops softly blurred behind her.',
  },
  {
    name: 'Ana Petrov',
    slug: 'ana-petrov',
    gender: 'female',
    age: 33,
    ethnicity: 'Eastern European',
    style: 'Blouse, pulled-back hair',
    setting: 'Home office',
    voiceId: 'English_GracefulLady',
    description: 'Composed Eastern European woman with sharp, professional demeanor',
    promptDetails: 'Portrait photo of an Eastern European woman, 33 years old, fair skin, light brown hair neatly pulled back, wearing a soft lavender blouse with small stud earrings. She is in a tidy home office with a white desk and organized shelves softly blurred behind her.',
  },
  {
    name: 'Maya Williams',
    slug: 'maya-williams',
    gender: 'female',
    age: 21,
    ethnicity: 'Mixed race',
    style: 'Crop top, natural hair',
    setting: 'Ring light setup',
    voiceId: 'English_PlayfulGirl',
    description: 'Young mixed-race creator with bold, playful Gen-Z energy',
    promptDetails: 'Portrait photo of a young mixed-race woman, 21 years old, light brown skin, voluminous natural curly hair, wearing a trendy sage green crop top with small hoop earrings. She is in her brightly lit room with colorful backdrop and wall art softly blurred behind her.',
  },

  // ---- MALE (15) ----
  {
    name: 'James Cooper',
    slug: 'james-cooper',
    gender: 'male',
    age: 35,
    ethnicity: 'White/American',
    style: 'Button-down, rolled sleeves',
    setting: 'Home office',
    voiceId: 'Deep_Voice_Man',
    description: 'Confident American man with polished, trustworthy energy',
    promptDetails: 'Portrait photo of a white American man, 35 years old, light skin, short brown hair neatly styled, wearing a light blue button-down shirt with sleeves rolled up. He is in a warm home office with a wooden desk and framed prints softly blurred behind him.',
  },
  {
    name: 'Marcus Washington',
    slug: 'marcus-washington',
    gender: 'male',
    age: 28,
    ethnicity: 'Black/American',
    style: 'Hoodie, cap backwards',
    setting: 'Bedroom setup',
    voiceId: 'Casual_Guy',
    description: 'Casual Black American creator with laid-back, authentic vibe',
    promptDetails: 'Portrait photo of a Black American man, 28 years old, dark brown skin, short fade haircut, wearing a dark gray hoodie and a backwards cap. He is in a casual bedroom with LED strip lights on the wall and posters softly blurred behind him.',
  },
  {
    name: 'Raj Patel',
    slug: 'raj-patel',
    gender: 'male',
    age: 32,
    ethnicity: 'Indian',
    style: 'Polo shirt, neat beard',
    setting: 'Living room',
    voiceId: 'Patient_Man',
    description: 'Thoughtful Indian man with patient, knowledgeable presence',
    promptDetails: 'Portrait photo of an Indian man, 32 years old, medium brown skin, short dark hair and a neatly trimmed beard, wearing a navy blue polo shirt. He is in a bright living room with a beige sofa and a window with sheer curtains softly blurred behind him.',
  },
  {
    name: 'Carlos Rivera',
    slug: 'carlos-rivera',
    gender: 'male',
    age: 26,
    ethnicity: 'Latino',
    style: 'T-shirt, chain necklace',
    setting: 'Studio/ring light',
    voiceId: 'Decent_Boy',
    description: 'Charismatic young Latino man with street-smart creative energy',
    promptDetails: 'Portrait photo of a young Latino man, 26 years old, tan skin, dark wavy hair swept to the side, wearing a black crew-neck t-shirt with a thin silver chain necklace. He is in a studio setup with soft even lighting on his face, dark backdrop softly blurred behind him.',
  },
  {
    name: 'Kenji Nakamura',
    slug: 'kenji-nakamura',
    gender: 'male',
    age: 30,
    ethnicity: 'Japanese',
    style: 'Crewneck, glasses',
    setting: 'Minimal desk',
    voiceId: 'English_ReservedYoungMan',
    description: 'Thoughtful Japanese man with calm, tech-savvy aesthetic',
    promptDetails: 'Portrait photo of a Japanese man, 30 years old, fair skin, neat short black hair, wearing modern rectangular glasses and a charcoal gray crewneck sweater. He is at a minimal clean desk with a laptop and a small plant softly blurred behind him.',
  },
  {
    name: 'Omar Hassan',
    slug: 'omar-hassan',
    gender: 'male',
    age: 38,
    ethnicity: 'Middle Eastern',
    style: 'Smart casual shirt',
    setting: 'Professional home office',
    voiceId: 'Determined_Man',
    description: 'Determined Middle Eastern man with experienced, authoritative presence',
    promptDetails: 'Portrait photo of a Middle Eastern man, 38 years old, olive skin, dark short hair and a well-groomed short beard, wearing a crisp white button-up shirt with the collar open. He is in a professional home office with dark wood shelves and warm ambient lighting softly blurred behind him.',
  },
  {
    name: 'Liam O\'Brien',
    slug: 'liam-obrien',
    gender: 'male',
    age: 24,
    ethnicity: 'Irish/White',
    style: 'Flannel shirt',
    setting: 'Cozy room, bookshelf',
    voiceId: 'English_FriendlyPerson',
    description: 'Friendly Irish young man with warm, down-to-earth personality',
    promptDetails: 'Portrait photo of a young Irish man, 24 years old, fair skin with light freckles, reddish-brown hair, wearing a green and navy flannel shirt. He is in a cozy room with a wooden bookshelf full of books and a warm reading lamp softly blurred behind him.',
  },
  {
    name: 'David Kim',
    slug: 'david-kim',
    gender: 'male',
    age: 34,
    ethnicity: 'Korean',
    style: 'Turtleneck, modern',
    setting: 'Clean apartment',
    voiceId: 'Elegant_Man',
    description: 'Stylish Korean man with refined, modern sophistication',
    promptDetails: 'Portrait photo of a Korean man, 34 years old, fair skin, styled dark hair with a slight side part, wearing a sleek black turtleneck. He is in a modern clean apartment with minimalist decor, a large window with soft natural light, and neutral tones softly blurred behind him.',
  },
  {
    name: 'Andre Mitchell',
    slug: 'andre-mitchell',
    gender: 'male',
    age: 42,
    ethnicity: 'Black/American',
    style: 'Blazer, no tie',
    setting: 'Kitchen/casual',
    voiceId: 'English_ManWithDeepVoice',
    description: 'Distinguished Black American man with commanding, relaxed authority',
    promptDetails: 'Portrait photo of a Black American man, 42 years old, dark brown skin, short salt-and-pepper hair, wearing a charcoal blazer over a simple dark crew-neck, no tie. He is in a stylish modern kitchen with marble countertops and pendant lights softly blurred behind him.',
  },
  {
    name: 'Mateo Garcia',
    slug: 'mateo-garcia',
    gender: 'male',
    age: 29,
    ethnicity: 'Mexican',
    style: 'Graphic tee, stubble',
    setting: 'Outdoor patio',
    voiceId: 'English_Jovialman',
    description: 'Easy-going Mexican man with relaxed, humorous charm',
    promptDetails: 'Portrait photo of a Mexican man, 29 years old, warm tan skin, dark hair and light stubble, wearing a vintage-style graphic t-shirt. He is sitting on an outdoor patio with wooden furniture and green plants softly blurred behind him, golden hour warm light.',
  },
  {
    name: 'Noah Schmidt',
    slug: 'noah-schmidt',
    gender: 'male',
    age: 22,
    ethnicity: 'German/White',
    style: 'Crew neck sweater',
    setting: 'Dorm/student room',
    voiceId: 'English_DecentYoungMan',
    description: 'Young German student with clean, earnest energy',
    promptDetails: 'Portrait photo of a young German man, 22 years old, fair skin, sandy blonde hair, wearing a simple navy crew-neck sweater over a white t-shirt collar. He is in a student dorm room with textbooks and a laptop on a desk softly blurred behind him.',
  },
  {
    name: 'Tunde Adeyemi',
    slug: 'tunde-adeyemi',
    gender: 'male',
    age: 36,
    ethnicity: 'Nigerian',
    style: 'Patterned shirt',
    setting: 'Bright living room',
    voiceId: 'English_Diligent_Man',
    description: 'Confident Nigerian man with diligent, professional style',
    promptDetails: 'Portrait photo of a Nigerian man, 36 years old, deep brown skin, clean-shaven with a confident expression, wearing a bold patterned African print button-up shirt. He is in a bright modern living room with a white sofa and large windows with natural light softly blurred behind him.',
  },
  {
    name: 'Alex Volkov',
    slug: 'alex-volkov',
    gender: 'male',
    age: 31,
    ethnicity: 'Russian/Eastern European',
    style: 'Plain tee, stubble',
    setting: 'Neutral background',
    voiceId: 'English_Gentle-voiced_man',
    description: 'Reserved Eastern European man with calm, gentle presence',
    promptDetails: 'Portrait photo of a Russian man, 31 years old, fair skin, light brown hair slightly tousled, short stubble, wearing a plain heather gray t-shirt. He is in front of a soft neutral beige wall with minimal decor, gentle side lighting creating subtle shadows.',
  },
  {
    name: 'Sam Nguyen',
    slug: 'sam-nguyen',
    gender: 'male',
    age: 27,
    ethnicity: 'Vietnamese',
    style: 'Casual button-up',
    setting: 'Modern kitchen',
    voiceId: 'English_PatientMan',
    description: 'Approachable Vietnamese man with patient, genuine manner',
    promptDetails: 'Portrait photo of a Vietnamese man, 27 years old, light tan skin, neat dark hair, wearing an unbuttoned light olive casual button-up shirt over a white tee. He is in a modern bright kitchen with white cabinets and stainless steel appliances softly blurred behind him.',
  },
  {
    name: 'Daniel Brooks',
    slug: 'daniel-brooks',
    gender: 'male',
    age: 50,
    ethnicity: 'White/American',
    style: 'Glasses, sweater vest',
    setting: 'Study/library',
    voiceId: 'English_WiseScholar',
    description: 'Distinguished older American man with scholarly, wise demeanor',
    promptDetails: 'Portrait photo of a white American man, 50 years old, graying hair at the temples, wearing reading glasses and a classic charcoal sweater vest over a light blue dress shirt. He is in a warm study with dark wooden bookshelves full of books and warm desk lamp light softly blurred behind him.',
  },
];

// ---- SELFIE-STYLE UGC CHARACTERS (10) ----
// Raw handheld selfie shots — car, kitchen, bedroom, etc.
const SELFIE_CHARACTERS: AvatarCharacter[] = [
  {
    name: 'Tanya Reed',
    slug: 'tanya-reed',
    gender: 'female',
    age: 34,
    ethnicity: 'Black/American',
    style: 'Tank top, gold hoops',
    setting: 'Car, driver seat',
    voiceId: 'Wise_Woman',
    description: 'Relatable Black American woman filming a casual car selfie',
    promptDetails: 'Selfie photo of a Black American woman, 34 years old, medium brown skin, long braids pulled over one shoulder, wearing a white tank top and small gold hoop earrings. She is sitting in the driver seat of a car with the seatbelt on, car interior and dashboard slightly blurred behind her, daylight coming through the windshield.',
  },
  {
    name: 'Mike Chen',
    slug: 'mike-chen-selfie',
    gender: 'male',
    age: 29,
    ethnicity: 'Chinese/American',
    style: 'Plain tee, messy hair',
    setting: 'Kitchen, morning',
    voiceId: 'Casual_Guy',
    description: 'Casual Chinese American guy filming in his kitchen',
    promptDetails: 'Selfie photo of a Chinese American man, 29 years old, light skin, slightly messy dark hair, wearing a faded navy t-shirt. He is standing in a kitchen with white tile backsplash, coffee mugs, and a microwave slightly blurred behind him, morning light from a window.',
  },
  {
    name: 'Rachel Torres',
    slug: 'rachel-torres',
    gender: 'female',
    age: 27,
    ethnicity: 'Latina',
    style: 'Hoodie, no makeup',
    setting: 'Bedroom, messy',
    voiceId: 'Lively_Girl',
    description: 'Young Latina woman filming a raw, no-makeup bedroom selfie',
    promptDetails: 'Selfie photo of a young Latina woman, 27 years old, warm olive skin, dark wavy hair loose and slightly messy, no makeup, wearing an oversized gray hoodie. She is in a bedroom with an unmade bed and pillows visible behind her, warm ambient lamp light, slightly dim.',
  },
  {
    name: 'Derek Williams',
    slug: 'derek-williams',
    gender: 'male',
    age: 41,
    ethnicity: 'Black/American',
    style: 'Work shirt, tired eyes',
    setting: 'Car, parking lot',
    voiceId: 'English_ManWithDeepVoice',
    description: 'Working dad filming a quick car selfie video',
    promptDetails: 'Selfie photo of a Black American man, 41 years old, dark brown skin, short cropped hair with slight graying at temples, wearing a blue work polo shirt. He is in his car in a parking lot, car seat and rearview mirror slightly blurred, overcast daylight through the windows, looking a bit tired but genuine.',
  },
  {
    name: 'Sarah Kim',
    slug: 'sarah-kim-selfie',
    gender: 'female',
    age: 31,
    ethnicity: 'Korean/American',
    style: 'Cardigan, glasses',
    setting: 'Living room couch',
    voiceId: 'Calm_Woman',
    description: 'Relatable Korean American woman on the couch',
    promptDetails: 'Selfie photo of a Korean American woman, 31 years old, fair skin, straight dark hair in a loose ponytail, wearing thin-framed glasses and a beige oversized cardigan. She is sitting on a living room couch with throw pillows and a blanket visible, a TV remote on the cushion, soft warm lamp light.',
  },
  {
    name: 'Jake Morrison',
    slug: 'jake-morrison',
    gender: 'male',
    age: 25,
    ethnicity: 'White/American',
    style: 'Baseball cap, stubble',
    setting: 'Truck cab',
    voiceId: 'English_FriendlyPerson',
    description: 'Young guy filming from his truck',
    promptDetails: 'Selfie photo of a young white American man, 25 years old, light skin, light brown stubble, wearing a worn baseball cap and a plain gray t-shirt. He is sitting in the cab of a pickup truck, steering wheel partially visible, dusty dashboard, harsh afternoon sunlight coming through the side window.',
  },
  {
    name: 'Nina Patel',
    slug: 'nina-patel-selfie',
    gender: 'female',
    age: 38,
    ethnicity: 'Indian/American',
    style: 'Apron, messy bun',
    setting: 'Kitchen, cooking',
    voiceId: 'English_GracefulLady',
    description: 'Indian American mom filming while cooking',
    promptDetails: 'Selfie photo of an Indian American woman, 38 years old, warm brown skin, dark hair in a messy bun with a few strands loose, wearing a simple apron over a plain black t-shirt. She is in a kitchen with pots on the stove and spice jars on the counter behind her, warm overhead kitchen light, slightly steamy.',
  },
  {
    name: 'Chris Okafor',
    slug: 'chris-okafor-selfie',
    gender: 'male',
    age: 33,
    ethnicity: 'Nigerian/American',
    style: 'Gym clothes, sweaty',
    setting: 'Car after gym',
    voiceId: 'English_Diligent_Man',
    description: 'Nigerian American guy filming after a workout',
    promptDetails: 'Selfie photo of a Nigerian American man, 33 years old, dark brown skin, short hair, slight sheen of sweat, wearing a dark athletic compression shirt. He is in his car after leaving the gym, gym bag on the passenger seat visible, parking lot visible through the car window, bright daylight.',
  },
  {
    name: 'Megan Hall',
    slug: 'megan-hall',
    gender: 'female',
    age: 44,
    ethnicity: 'White/American',
    style: 'Sweater, reading glasses',
    setting: 'Kitchen counter',
    voiceId: 'English_Wiselady',
    description: 'Suburban mom filming a kitchen counter selfie',
    promptDetails: 'Selfie photo of a white American woman, 44 years old, light skin, shoulder-length blonde hair slightly disheveled, wearing a chunky knit brown sweater and reading glasses pushed up on her head. She is leaning against a kitchen counter with wooden cabinets, a fruit bowl, and grocery bags slightly visible behind her, warm indoor lighting.',
  },
  {
    name: 'Luis Ramirez',
    slug: 'luis-ramirez-selfie',
    gender: 'male',
    age: 36,
    ethnicity: 'Mexican/American',
    style: 'Flannel over tee',
    setting: 'Backyard patio',
    voiceId: 'English_Jovialman',
    description: 'Mexican American dad filming in the backyard',
    promptDetails: 'Selfie photo of a Mexican American man, 36 years old, warm tan skin, short dark hair, light stubble, wearing an open flannel shirt over a white t-shirt. He is on a backyard patio with a plastic chair and chain-link fence slightly blurred behind him, late afternoon golden sunlight, slightly overexposed sky.',
  },
];

// ---- OVER 50 (50-64) ----
const OVER_50_CHARACTERS: AvatarCharacter[] = [
  {
    name: 'Denise Carter',
    slug: 'denise-carter',
    gender: 'female',
    age: 52,
    ethnicity: 'Black/American',
    style: 'Cozy sweater, reading glasses on chain',
    setting: 'Kitchen table',
    voiceId: 'English_Wiselady',
    description: 'Warm Black American woman in her 50s sharing life wisdom from the kitchen',
    promptDetails: 'Selfie photo of a Black American woman, 52 years old, medium brown skin, short natural gray-streaked hair, warm brown eyes, wearing a soft burgundy sweater with reading glasses hanging on a beaded chain around her neck. She is sitting at a kitchen table with a coffee mug and a plate of food slightly visible, warm overhead kitchen light, wooden cabinets behind her.',
  },
  {
    name: 'Robert Hoffman',
    slug: 'robert-hoffman',
    gender: 'male',
    age: 55,
    ethnicity: 'White/American',
    style: 'Work flannel, salt-pepper beard',
    setting: 'Garage workshop',
    voiceId: 'Deep_Voice_Man',
    description: 'Hands-on American man in his 50s filming from his workshop',
    promptDetails: 'Selfie photo of a white American man, 55 years old, weathered skin, thick salt-and-pepper beard, deep-set blue eyes, wearing a worn red-and-black flannel shirt. He is in a garage workshop with tools hanging on a pegboard and a workbench with sawdust slightly blurred behind him, harsh fluorescent overhead light.',
  },
  {
    name: 'Gloria Mendez',
    slug: 'gloria-mendez',
    gender: 'female',
    age: 58,
    ethnicity: 'Latina',
    style: 'Floral blouse, gold cross necklace',
    setting: 'Living room, family photos',
    voiceId: 'Calm_Woman',
    description: 'Warm Latina grandmother figure sharing stories from the living room',
    promptDetails: 'Selfie photo of a Latina woman, 58 years old, warm tan skin, dark hair with prominent gray streaks pulled back loosely, wearing a colorful floral blouse and a small gold cross necklace. She is in a living room with framed family photos on a shelf and a crocheted throw on the couch behind her, soft warm lamp light.',
  },
  {
    name: 'Vikram Mehta',
    slug: 'vikram-mehta',
    gender: 'male',
    age: 54,
    ethnicity: 'Indian',
    style: 'Polo shirt, trimmed mustache',
    setting: 'Home office, desk',
    voiceId: 'Patient_Man',
    description: 'Professional Indian man in his 50s with calm authority',
    promptDetails: 'Selfie photo of an Indian man, 54 years old, medium brown skin, graying hair combed neatly, trimmed salt-and-pepper mustache, wearing a dark green polo shirt. He is at a home desk with a laptop, a cup of tea, and a framed family photo slightly visible behind him, soft desk lamp light.',
  },
  {
    name: 'Susan Park',
    slug: 'susan-park',
    gender: 'female',
    age: 51,
    ethnicity: 'Korean/American',
    style: 'Simple tee, no makeup',
    setting: 'Garden, outdoor',
    voiceId: 'English_SereneWoman',
    description: 'Natural Korean American woman in her 50s, gardening casual',
    promptDetails: 'Selfie photo of a Korean American woman, 51 years old, fair skin with fine lines around her eyes, dark hair with some silver strands in a casual low ponytail, wearing a simple white t-shirt. She is outdoors in a garden with potted plants and greenery softly blurred behind her, bright natural daylight, slightly overexposed.',
  },
  {
    name: 'Thomas Wagner',
    slug: 'thomas-wagner',
    gender: 'male',
    age: 60,
    ethnicity: 'German/White',
    style: 'Button-down, wire glasses',
    setting: 'Study with bookshelves',
    voiceId: 'English_WiseScholar',
    description: 'Distinguished European man in his 60s, scholarly presence',
    promptDetails: 'Selfie photo of a German man, 60 years old, fair skin, thin gray hair, wearing wire-rimmed glasses and a light blue button-down shirt. He is in a home study with dark wooden bookshelves packed with books, a desk lamp casting warm light, slightly dim ambient lighting.',
  },
  {
    name: 'Amina Hassan',
    slug: 'amina-hassan-senior',
    gender: 'female',
    age: 56,
    ethnicity: 'Middle Eastern',
    style: 'Headscarf, warm cardigan',
    setting: 'Kitchen, cooking',
    voiceId: 'English_GracefulLady',
    description: 'Warm Middle Eastern woman in her 50s, maternal kitchen setting',
    promptDetails: 'Selfie photo of a Middle Eastern woman, 56 years old, olive skin with gentle wrinkles, wearing a patterned headscarf and a warm olive green cardigan. She is in a kitchen with pots on the stove, spices on the counter, and steam slightly visible, warm overhead kitchen light.',
  },
  {
    name: 'Charles Robinson',
    slug: 'charles-robinson',
    gender: 'male',
    age: 53,
    ethnicity: 'Black/American',
    style: 'Polo, clean shaven',
    setting: 'Car, commuting',
    voiceId: 'English_ManWithDeepVoice',
    description: 'Professional Black American man filming from his car',
    promptDetails: 'Selfie photo of a Black American man, 53 years old, dark brown skin, closely cropped graying hair, clean-shaven, wearing a crisp white polo shirt. He is in the driver seat of a nice sedan with leather seats, seatbelt on, parking garage visible through the window, flat even lighting.',
  },
];

// ---- OVER 65 (65-74) ----
const OVER_65_CHARACTERS: AvatarCharacter[] = [
  {
    name: 'Barbara Mitchell',
    slug: 'barbara-mitchell',
    gender: 'female',
    age: 68,
    ethnicity: 'White/American',
    style: 'Turtleneck, pearl earrings',
    setting: 'Kitchen, baking',
    voiceId: 'English_Wiselady',
    description: 'Classic American grandmother, warm and approachable',
    promptDetails: 'Selfie photo of a white American woman, 68 years old, fair skin with visible wrinkles and smile lines, short silver-white hair neatly styled, wearing a cream turtleneck and small pearl stud earrings. She is in a kitchen with baking supplies, a mixing bowl, and flour dusted on the counter, warm golden kitchen light.',
  },
  {
    name: 'Eugene Davis',
    slug: 'eugene-davis',
    gender: 'male',
    age: 70,
    ethnicity: 'Black/American',
    style: 'Cardigan, newsboy cap',
    setting: 'Front porch',
    voiceId: 'English_ManWithDeepVoice',
    description: 'Distinguished Black American elder with storytelling warmth',
    promptDetails: 'Selfie photo of a Black American man, 70 years old, dark brown skin with deep expression lines, short white hair, wearing a brown wool cardigan and a newsboy cap. He is sitting on a front porch with a wooden railing and potted plants, afternoon sunlight casting long shadows, neighborhood slightly visible in the background.',
  },
  {
    name: 'Mei-Ling Zhou',
    slug: 'mei-ling-zhou',
    gender: 'female',
    age: 66,
    ethnicity: 'Chinese/American',
    style: 'Quilted vest, simple',
    setting: 'Living room, TV visible',
    voiceId: 'Calm_Woman',
    description: 'Gentle Chinese American grandmother, calm and wise',
    promptDetails: 'Selfie photo of a Chinese American woman, 66 years old, fair skin with fine wrinkles, gray hair in a short practical cut, wearing a quilted navy vest over a simple white long-sleeve shirt. She is in a living room with a TV visible in the background, a couch with floral cushions, and a glass of water on the coffee table, soft indoor light.',
  },
  {
    name: 'Hector Vargas',
    slug: 'hector-vargas',
    gender: 'male',
    age: 72,
    ethnicity: 'Latino',
    style: 'Guayabera shirt',
    setting: 'Backyard, plastic chair',
    voiceId: 'Patient_Man',
    description: 'Warm Latino grandfather with patient storytelling style',
    promptDetails: 'Selfie photo of a Latino man, 72 years old, tan weathered skin with deep smile lines, thick white mustache, sparse gray hair, wearing a white guayabera shirt. He is sitting in a plastic chair in a backyard with a chain-link fence and a lemon tree slightly blurred behind him, bright afternoon sun, slightly overexposed.',
  },
  {
    name: 'Rosemary Costa',
    slug: 'rosemary-costa',
    gender: 'female',
    age: 69,
    ethnicity: 'Italian/Mediterranean',
    style: 'Apron over dress',
    setting: 'Kitchen, sauce cooking',
    voiceId: 'English_GracefulLady',
    description: 'Italian grandmother cooking and talking to camera',
    promptDetails: 'Selfie photo of an Italian woman, 69 years old, olive skin with wrinkles, silver hair pinned up in a loose bun, wearing a floral apron over a dark dress. She is in a kitchen with a large pot of sauce on the stove, wooden spoons, garlic bulbs on the counter, warm steamy kitchen light.',
  },
  {
    name: 'Harold Peterson',
    slug: 'harold-peterson',
    gender: 'male',
    age: 67,
    ethnicity: 'White/Scandinavian',
    style: 'Fleece vest, plaid shirt',
    setting: 'Garage, car visible',
    voiceId: 'English_WiseScholar',
    description: 'Practical Scandinavian American retiree, handy and knowledgeable',
    promptDetails: 'Selfie photo of a Scandinavian American man, 67 years old, fair ruddy skin, thin white hair, wearing a dark fleece vest over a red plaid flannel shirt. He is in a garage with the hood of a car partially visible and tools on shelves, overhead fluorescent light, slightly harsh shadows.',
  },
];

// ---- OVER 75-80 (75-85) ----
const OVER_75_CHARACTERS: AvatarCharacter[] = [
  {
    name: 'Dorothy Evans',
    slug: 'dorothy-evans',
    gender: 'female',
    age: 78,
    ethnicity: 'White/American',
    style: 'Housecoat, white hair',
    setting: 'Armchair, living room',
    voiceId: 'English_Wiselady',
    description: 'Sweet elderly American woman filming from her favorite armchair',
    promptDetails: 'Selfie photo of a white American woman, 78 years old, fair wrinkled skin with age spots, thin white permed hair, wearing a light blue housecoat with a tissue tucked in the pocket. She is sitting in a plush armchair in a living room with a crocheted blanket over the armrest, family photos on the side table, warm lamp light, slightly dim.',
  },
  {
    name: 'James Washington Sr.',
    slug: 'james-washington-sr',
    gender: 'male',
    age: 80,
    ethnicity: 'Black/American',
    style: 'Suspenders, button shirt',
    setting: 'Porch, rocking chair',
    voiceId: 'English_ManWithDeepVoice',
    description: 'Dignified Black American elder sharing wisdom from the porch',
    promptDetails: 'Selfie photo of a Black American man, 80 years old, dark brown weathered skin with deep wrinkles and smile lines, thin white hair, wearing suspenders over a light blue button-up shirt. He is sitting in a wooden rocking chair on a porch with a glass of lemonade on a small table beside him, golden afternoon light, slightly overexposed.',
  },
  {
    name: 'Yoko Tanaka',
    slug: 'yoko-tanaka-elder',
    gender: 'female',
    age: 76,
    ethnicity: 'Japanese/American',
    style: 'Knit shawl, gentle smile',
    setting: 'Kitchen table, tea',
    voiceId: 'English_SereneWoman',
    description: 'Gentle Japanese American grandmother at the kitchen table',
    promptDetails: 'Selfie photo of a Japanese American woman, 76 years old, fair skin with deep wrinkles, thin gray hair in a short neat style, wearing a hand-knit lavender shawl over a simple blouse. She is sitting at a kitchen table with a teapot and a ceramic teacup, a window with sheer curtains behind her, soft diffused daylight.',
  },
  {
    name: 'Walter Schmidt',
    slug: 'walter-schmidt',
    gender: 'male',
    age: 82,
    ethnicity: 'German/American',
    style: 'Sweater vest, glasses',
    setting: 'Garden bench, outdoor',
    voiceId: 'English_WiseScholar',
    description: 'Distinguished elderly German American man in his garden',
    promptDetails: 'Selfie photo of a German American man, 82 years old, fair skin with deep wrinkles and age spots, bald on top with thin white hair on the sides, wearing thick-framed glasses and a brown sweater vest over a white dress shirt. He is sitting on a wooden garden bench with rose bushes and a green lawn softly blurred behind him, gentle overcast daylight.',
  },
  {
    name: 'Carmen Delgado',
    slug: 'carmen-delgado',
    gender: 'female',
    age: 79,
    ethnicity: 'Latina',
    style: 'Floral dress, rosary',
    setting: 'Living room, couch',
    voiceId: 'Calm_Woman',
    description: 'Beloved Latina great-grandmother with gentle, nurturing presence',
    promptDetails: 'Selfie photo of a Latina woman, 79 years old, warm tan wrinkled skin, thin gray hair pulled back in a small bun, wearing a floral cotton dress with a small rosary visible around her wrist. She is sitting on an old couch in a living room with a crocheted doily on the armrest, religious imagery on the wall behind her, warm indoor lamp light.',
  },
  {
    name: 'Rajesh Gupta',
    slug: 'rajesh-gupta-elder',
    gender: 'male',
    age: 77,
    ethnicity: 'Indian',
    style: 'Kurta, white hair',
    setting: 'Home, sitting area',
    voiceId: 'Patient_Man',
    description: 'Wise Indian grandfather with patient, storytelling warmth',
    promptDetails: 'Selfie photo of an Indian man, 77 years old, medium brown wrinkled skin, full white hair and a white mustache, wearing a simple cotton kurta in off-white. He is in a sitting area of his home with a low wooden table, cushions on the floor, and a window with afternoon light coming through, warm ambient tones.',
  },
];

// ---- WHITE / COMMON US DEMOGRAPHIC (20) ----
// Fills gap for majority US demographic across all age groups
const WHITE_US_CHARACTERS: AvatarCharacter[] = [
  // Young women (20s)
  {
    name: 'Ashley Bennett',
    slug: 'ashley-bennett',
    gender: 'female',
    age: 24,
    ethnicity: 'White/American',
    style: 'Messy ponytail, oversized tee',
    setting: 'Car, driver seat',
    voiceId: 'Lovely_Girl',
    description: 'Everyday young American woman filming a quick car video',
    promptDetails: 'Selfie photo of a young white American woman, 24 years old, fair skin, dirty blonde hair in a messy ponytail, minimal makeup, wearing a plain oversized heather gray t-shirt. She is in the driver seat of a Honda SUV, seatbelt on, coffee cup in the center console, parking lot visible through the windshield, midday flat light.',
  },
  {
    name: 'Brittany Collins',
    slug: 'brittany-collins',
    gender: 'female',
    age: 27,
    ethnicity: 'White/American',
    style: 'Leggings look, hair clip',
    setting: 'Kitchen, morning routine',
    voiceId: 'Inspirational_girl',
    description: 'Relatable young American woman in her morning kitchen',
    promptDetails: 'Selfie photo of a young white American woman, 27 years old, light skin, medium brown hair with a claw clip holding it up, wearing a black athletic zip-up jacket. She is in a kitchen with a Keurig coffee maker, cereal boxes on the counter, and a paper towel roll visible behind her, bright morning window light.',
  },
  // Young men (20s)
  {
    name: 'Tyler Anderson',
    slug: 'tyler-anderson',
    gender: 'male',
    age: 23,
    ethnicity: 'White/American',
    style: 'College kid, hoodie',
    setting: 'Bedroom, gaming setup',
    voiceId: 'Decent_Boy',
    description: 'Average American college-age guy in his room',
    promptDetails: 'Selfie photo of a young white American man, 23 years old, fair skin, short light brown hair slightly messy, patchy attempt at a beard, wearing a plain black hoodie. He is in a bedroom with a computer monitor with RGB lights, an energy drink can on the desk, and a messy bed behind him, blue-ish LED ambient light.',
  },
  {
    name: 'Brandon Miller',
    slug: 'brandon-miller',
    gender: 'male',
    age: 26,
    ethnicity: 'White/American',
    style: 'Work polo, clean cut',
    setting: 'Car, after work',
    voiceId: 'English_FriendlyPerson',
    description: 'Regular working American guy filming in his car',
    promptDetails: 'Selfie photo of a white American man, 26 years old, light skin, short brown hair neatly combed, clean-shaven, wearing a company polo shirt. He is in his car in a parking lot after work, steering wheel visible, takeout bag on the passenger seat, late afternoon sun coming through the window.',
  },
  // 30s women
  {
    name: 'Jennifer Walsh',
    slug: 'jennifer-walsh',
    gender: 'female',
    age: 33,
    ethnicity: 'White/American',
    style: 'Mom look, messy bun',
    setting: 'Living room, kid toys visible',
    voiceId: 'Calm_Woman',
    description: 'American mom filming between tasks at home',
    promptDetails: 'Selfie photo of a white American woman, 33 years old, light skin, light brown hair in a messy top bun, dark circles under her eyes, wearing a plain navy v-neck t-shirt. She is in a living room with kid toys scattered on the floor, a sippy cup on the coffee table, and a baby monitor on the couch armrest, soft indoor light.',
  },
  {
    name: 'Stephanie Davis',
    slug: 'stephanie-davis',
    gender: 'female',
    age: 36,
    ethnicity: 'White/American',
    style: 'Casual cardigan, wine glass',
    setting: 'Kitchen counter, evening',
    voiceId: 'English_GracefulLady',
    description: 'Relatable suburban American woman unwinding in the evening',
    promptDetails: 'Selfie photo of a white American woman, 36 years old, fair skin with light freckles, shoulder-length reddish-brown hair, wearing a soft oatmeal-colored cardigan over a tank top. She is at a kitchen counter with a glass of red wine, a cutting board, and dinner prep ingredients slightly visible behind her, warm overhead kitchen pendant light.',
  },
  // 30s men
  {
    name: 'Ryan Thompson',
    slug: 'ryan-thompson',
    gender: 'male',
    age: 34,
    ethnicity: 'White/American',
    style: 'Dad look, baseball cap',
    setting: 'Backyard, grill visible',
    voiceId: 'Deep_Voice_Man',
    description: 'Regular American dad in the backyard',
    promptDetails: 'Selfie photo of a white American man, 34 years old, light skin, short brown hair under a faded baseball cap, light stubble, wearing a plain gray t-shirt with a slight stain. He is in a backyard with a Weber charcoal grill, a plastic kids play set, and a patchy lawn visible behind him, late afternoon golden light.',
  },
  {
    name: 'Matt Johnson',
    slug: 'matt-johnson',
    gender: 'male',
    age: 38,
    ethnicity: 'White/American',
    style: 'Button-down, tired but friendly',
    setting: 'Home office, messy desk',
    voiceId: 'English_PatientMan',
    description: 'Working American dad in his home office',
    promptDetails: 'Selfie photo of a white American man, 38 years old, fair skin, receding hairline with short brown hair, wearing a wrinkled light blue button-down shirt with the top button undone. He is in a messy home office with papers, a dual monitor setup, a half-empty water bottle, and a kid drawing taped to the wall behind him, overhead fluorescent light.',
  },
  // 40s women
  {
    name: 'Karen Mitchell',
    slug: 'karen-mitchell-us',
    gender: 'female',
    age: 42,
    ethnicity: 'White/American',
    style: 'Mom jeans era, highlights',
    setting: 'Car, school pickup line',
    voiceId: 'English_Wiselady',
    description: 'Suburban American mom filming while waiting in the car',
    promptDetails: 'Selfie photo of a white American woman, 42 years old, fair skin, shoulder-length blonde-highlighted hair, wearing sunglasses pushed up on her head and a casual striped t-shirt. She is in a minivan with the car seat visible in the back, a Starbucks cup in the cupholder, school visible through the windshield, bright midday light.',
  },
  {
    name: 'Lisa Parker',
    slug: 'lisa-parker',
    gender: 'female',
    age: 47,
    ethnicity: 'White/American',
    style: 'Fleece vest, practical',
    setting: 'Kitchen, dinner prep',
    voiceId: 'English_Wiselady',
    description: 'Practical American woman in her late 40s cooking dinner',
    promptDetails: 'Selfie photo of a white American woman, 47 years old, fair skin with some fine lines, dark blonde hair in a short practical bob, wearing a dark green fleece vest over a long-sleeve white tee. She is in a kitchen with a crockpot on the counter, a grocery receipt and reusable bags visible, warm yellowish overhead light.',
  },
  // 40s men
  {
    name: 'Kevin O\'Malley',
    slug: 'kevin-omalley',
    gender: 'male',
    age: 44,
    ethnicity: 'White/American',
    style: 'Gym clothes, post workout',
    setting: 'Car, gym parking lot',
    voiceId: 'Determined_Man',
    description: 'Middle-aged American guy after a workout',
    promptDetails: 'Selfie photo of a white American man, 44 years old, ruddy fair skin, short graying brown hair, slight sweat, wearing a faded old college t-shirt. He is in his car in a gym parking lot, a gym bag and water bottle on the passenger seat, bright daylight through the windows, slightly flushed face.',
  },
  {
    name: 'Scott Reynolds',
    slug: 'scott-reynolds',
    gender: 'male',
    age: 48,
    ethnicity: 'White/American',
    style: 'Polo and khakis guy',
    setting: 'Home office, zoom background',
    voiceId: 'English_ManWithDeepVoice',
    description: 'Corporate American man working from home',
    promptDetails: 'Selfie photo of a white American man, 48 years old, fair skin, thinning brown hair with gray at the temples, wearing reading glasses and a navy polo shirt. He is in a home office with a bookshelf, a family photo, and a half-closed laptop visible behind him, flat overhead light, slightly washed out.',
  },
  // 50s-60s women
  {
    name: 'Deborah Harris',
    slug: 'deborah-harris',
    gender: 'female',
    age: 55,
    ethnicity: 'White/American',
    style: 'Reading glasses, cardigan',
    setting: 'Living room, couch',
    voiceId: 'English_Wiselady',
    description: 'Warm American woman in her 50s on the couch',
    promptDetails: 'Selfie photo of a white American woman, 55 years old, fair skin with visible smile lines, short salt-and-pepper hair, wearing reading glasses and a soft rose-colored cardigan. She is on a living room couch with a book face-down on the cushion, a throw blanket, and a small dog partially visible beside her, warm lamp light.',
  },
  {
    name: 'Pamela Turner',
    slug: 'pamela-turner',
    gender: 'female',
    age: 62,
    ethnicity: 'White/American',
    style: 'Garden outfit, sun hat off',
    setting: 'Garden, outdoor',
    voiceId: 'English_GracefulLady',
    description: 'Active American woman in her 60s gardening',
    promptDetails: 'Selfie photo of a white American woman, 62 years old, lightly tanned skin with wrinkles, gray hair with blonde highlights in a short layered cut, wearing a denim button-up shirt with the sleeves rolled. She is in a garden with tomato plants, a watering can, and garden gloves on a bench beside her, bright overcast outdoor light.',
  },
  // 50s-60s men
  {
    name: 'Gary Sullivan',
    slug: 'gary-sullivan',
    gender: 'male',
    age: 57,
    ethnicity: 'White/American',
    style: 'Fleece pullover, dad vibes',
    setting: 'Garage, weekend project',
    voiceId: 'Deep_Voice_Man',
    description: 'American dad in his late 50s working on a weekend project',
    promptDetails: 'Selfie photo of a white American man, 57 years old, fair skin, mostly gray hair, wearing a quarter-zip fleece pullover and reading glasses on top of his head. He is in a garage with a power tool on the workbench, lumber stacked against the wall, and his truck bumper slightly visible, overhead shop light.',
  },
  {
    name: 'Richard Hayes',
    slug: 'richard-hayes',
    gender: 'male',
    age: 63,
    ethnicity: 'White/American',
    style: 'Retired look, casual',
    setting: 'Kitchen, morning coffee',
    voiceId: 'English_WiseScholar',
    description: 'Recently retired American man enjoying his morning',
    promptDetails: 'Selfie photo of a white American man, 63 years old, fair skin, full gray hair neatly combed, wearing a simple navy sweatshirt. He is in a kitchen with a coffee pot, a newspaper on the counter, and a window with morning light behind him, warm domestic atmosphere, slightly yellow kitchen light.',
  },
  // 70s-80s women
  {
    name: 'Patricia Henley',
    slug: 'patricia-henley',
    gender: 'female',
    age: 73,
    ethnicity: 'White/American',
    style: 'Grandma sweater, pearls',
    setting: 'Dining room table',
    voiceId: 'English_Wiselady',
    description: 'Classic American grandmother at the dining table',
    promptDetails: 'Selfie photo of a white American woman, 73 years old, fair wrinkled skin, white curly permed hair, wearing a pastel pink cardigan over a white blouse with a simple pearl necklace. She is at a dining room table with a lace tablecloth, a vase of flowers, and china cabinet slightly visible behind her, warm afternoon indoor light.',
  },
  {
    name: 'Margaret Ann Kelly',
    slug: 'margaret-kelly',
    gender: 'female',
    age: 81,
    ethnicity: 'White/American',
    style: 'Housecoat, warm smile',
    setting: 'Kitchen, morning',
    voiceId: 'English_Wiselady',
    description: 'Beloved elderly American grandmother in her kitchen',
    promptDetails: 'Selfie photo of a white American woman, 81 years old, very fair wrinkled skin with age spots, thin white hair in a soft set, wearing a light floral housecoat. She is in a dated kitchen with vintage cabinets, a toaster, and a dish towel hanging on the oven handle, warm yellowish overhead light, slightly cluttered but homey.',
  },
  // 70s-80s men
  {
    name: 'Donald Crawford',
    slug: 'donald-crawford',
    gender: 'male',
    age: 74,
    ethnicity: 'White/American',
    style: 'Veterans cap, polo',
    setting: 'Porch, morning',
    voiceId: 'English_ManWithDeepVoice',
    description: 'American grandfather on his porch',
    promptDetails: 'Selfie photo of a white American man, 74 years old, weathered fair skin with deep wrinkles, thin gray hair, wearing a dark navy veterans cap and a simple white polo shirt. He is on a front porch with an American flag, a wicker chair, and a newspaper on the small table beside him, soft morning light.',
  },
  {
    name: 'Earl Jacobson',
    slug: 'earl-jacobson',
    gender: 'male',
    age: 79,
    ethnicity: 'White/American',
    style: 'Suspenders, flannel',
    setting: 'Living room, recliner',
    voiceId: 'English_WiseScholar',
    description: 'Elderly American man in his living room recliner',
    promptDetails: 'Selfie photo of a white American man, 79 years old, fair wrinkled skin with age spots, thin white hair combed over, wearing suspenders over a flannel shirt. He is in a living room recliner with a TV remote on the armrest, a side table with prescription bottles and a glass of water, warm table lamp light, slightly dim room.',
  },
];

// ---- UGC EVERYDAY AMERICANS (20) ----
// Natural UGC look, NOT holding phones, diverse US locations and common places
const UGC_EVERYDAY_CHARACTERS: AvatarCharacter[] = [
  // Young women
  {
    name: 'Chloe Martinez',
    slug: 'chloe-martinez-ugc',
    gender: 'female',
    age: 23,
    ethnicity: 'Latina',
    style: 'Gym outfit, ponytail',
    setting: 'Gym lobby',
    voiceId: 'Lovely_Girl',
    description: 'Young Latina woman at the gym between sets',
    promptDetails: 'Portrait photo of a young Latina woman, 23 years old, warm tan skin, dark hair in a high ponytail, light sheen of sweat, wearing a fitted black athletic tank top with wireless earbuds in. She is standing in a gym lobby with weight racks and mirrors slightly blurred behind her, harsh overhead gym fluorescent lighting.',
  },
  {
    name: 'Destiny Brown',
    slug: 'destiny-brown-ugc',
    gender: 'female',
    age: 26,
    ethnicity: 'Black/American',
    style: 'Scrubs, badge',
    setting: 'Hospital break room',
    voiceId: 'Wise_Woman',
    description: 'Young Black American nurse on her break',
    promptDetails: 'Portrait photo of a Black American woman, 26 years old, medium brown skin, hair pulled back neatly, wearing teal hospital scrubs with a name badge clipped to the front. She is in a hospital break room with a vending machine and a microwave slightly visible behind her, flat fluorescent overhead light, looking slightly tired but warm.',
  },
  {
    name: 'Haley Simmons',
    slug: 'haley-simmons-ugc',
    gender: 'female',
    age: 29,
    ethnicity: 'White/American',
    style: 'Apron, hair up',
    setting: 'Coffee shop counter',
    voiceId: 'Inspirational_girl',
    description: 'Barista or coffee shop worker behind the counter',
    promptDetails: 'Portrait photo of a white American woman, 29 years old, light skin, light brown hair in a messy bun, wearing a brown canvas apron over a black t-shirt. She is behind a coffee shop counter with an espresso machine, stacked paper cups, and a chalkboard menu slightly blurred behind her, warm cafe lighting.',
  },
  // Young men
  {
    name: 'Jamal Lewis',
    slug: 'jamal-lewis-ugc',
    gender: 'male',
    age: 24,
    ethnicity: 'Black/American',
    style: 'Hard hat, safety vest',
    setting: 'Construction site',
    voiceId: 'Casual_Guy',
    description: 'Young Black American construction worker on site',
    promptDetails: 'Portrait photo of a Black American man, 24 years old, dark brown skin, short fade haircut, wearing a yellow hard hat and an orange high-vis safety vest over a dusty gray t-shirt. He is at a construction site with scaffolding and a partly built structure slightly blurred behind him, bright outdoor midday sun, slightly dusty air.',
  },
  {
    name: 'Dylan Cooper',
    slug: 'dylan-cooper-ugc',
    gender: 'male',
    age: 22,
    ethnicity: 'White/American',
    style: 'College hoodie',
    setting: 'Library study area',
    voiceId: 'English_DecentYoungMan',
    description: 'College student studying at the library',
    promptDetails: 'Portrait photo of a young white American man, 22 years old, fair skin, sandy brown hair slightly messy, wearing a faded university hoodie and wired headphones around his neck. He is in a library study area with textbooks, a laptop, and a coffee cup on the table, soft diffused library lighting, bookshelves blurred behind him.',
  },
  // 30s women
  {
    name: 'Jasmine Washington',
    slug: 'jasmine-washington-ugc',
    gender: 'female',
    age: 35,
    ethnicity: 'Black/American',
    style: 'Business casual, laptop bag',
    setting: 'Airport terminal',
    voiceId: 'English_ConfidentWoman',
    description: 'Professional Black American woman at the airport',
    promptDetails: 'Portrait photo of a Black American woman, 35 years old, medium brown skin, straightened dark hair in a low bun, wearing a navy blazer over a white blouse. She is in an airport terminal with departure screens, rows of seats, and large windows showing the tarmac slightly blurred behind her, bright flat overhead terminal light.',
  },
  {
    name: 'Amanda Nelson',
    slug: 'amanda-nelson-ugc',
    gender: 'female',
    age: 31,
    ethnicity: 'White/American',
    style: 'Yoga pants, messy bun',
    setting: 'Park bench',
    voiceId: 'Calm_Woman',
    description: 'Young mom at the park',
    promptDetails: 'Portrait photo of a white American woman, 31 years old, light skin with a few freckles, strawberry blonde hair in a messy bun, wearing black yoga pants and a gray zip-up hoodie. She is sitting on a park bench with playground equipment and green trees slightly blurred behind her, soft natural outdoor light, slightly overcast.',
  },
  // 30s men
  {
    name: 'Marcus Rivera',
    slug: 'marcus-rivera-ugc',
    gender: 'male',
    age: 33,
    ethnicity: 'Latino',
    style: 'Work uniform, name tag',
    setting: 'Auto repair shop',
    voiceId: 'English_Jovialman',
    description: 'Latino mechanic at his auto shop',
    promptDetails: 'Portrait photo of a Latino man, 33 years old, tan skin, dark hair, light stubble, wearing a dark blue mechanic uniform with a name patch and slightly greasy hands. He is in an auto repair shop with a car on a lift, tool chests, and fluorescent shop lights slightly blurred behind him, industrial workshop lighting.',
  },
  {
    name: 'Trevor Johnson',
    slug: 'trevor-johnson-ugc',
    gender: 'male',
    age: 36,
    ethnicity: 'White/American',
    style: 'Polo shirt, clean cut',
    setting: 'Suburban driveway',
    voiceId: 'Deep_Voice_Man',
    description: 'Suburban American dad in his driveway',
    promptDetails: 'Portrait photo of a white American man, 36 years old, fair skin, short brown hair neatly cut, clean-shaven, wearing a maroon polo shirt. He is standing in a suburban driveway with a two-car garage, a minivan, and a basketball hoop slightly blurred behind him, late afternoon golden light.',
  },
  // 40s women
  {
    name: 'Michelle Taylor',
    slug: 'michelle-taylor-ugc',
    gender: 'female',
    age: 43,
    ethnicity: 'Black/American',
    style: 'Church outfit, earrings',
    setting: 'Church foyer',
    voiceId: 'English_Wiselady',
    description: 'Elegant Black American woman at church',
    promptDetails: 'Portrait photo of a Black American woman, 43 years old, rich brown skin, hair styled in soft waves, wearing a deep purple dress with statement gold earrings. She is in a church foyer with stained glass light and wooden paneling slightly blurred behind her, warm mixed natural and indoor light.',
  },
  {
    name: 'Kristen Meyer',
    slug: 'kristen-meyer-ugc',
    gender: 'female',
    age: 41,
    ethnicity: 'White/American',
    style: 'Scrubs, stethoscope',
    setting: 'Doctor office',
    voiceId: 'English_GracefulLady',
    description: 'American doctor or PA in her office',
    promptDetails: 'Portrait photo of a white American woman, 41 years old, fair skin, shoulder-length brown hair, wearing blue medical scrubs with a stethoscope around her neck. She is in a medical office with an exam table, anatomical chart, and hand sanitizer dispenser slightly blurred behind her, bright clinical overhead light.',
  },
  // 40s men
  {
    name: 'Carlos Gutierrez',
    slug: 'carlos-gutierrez-ugc',
    gender: 'male',
    age: 45,
    ethnicity: 'Latino',
    style: 'Chef coat, kitchen',
    setting: 'Restaurant kitchen',
    voiceId: 'Determined_Man',
    description: 'Latino chef in a restaurant kitchen',
    promptDetails: 'Portrait photo of a Latino man, 45 years old, tan skin, dark hair with a slight gray, neatly trimmed goatee, wearing a white chef coat slightly splattered. He is in a restaurant kitchen with stainless steel counters, hanging pots, and a blazing gas burner slightly blurred behind him, warm overhead kitchen heat lamps.',
  },
  {
    name: 'James Patterson',
    slug: 'james-patterson-ugc',
    gender: 'male',
    age: 47,
    ethnicity: 'White/American',
    style: 'Button down, dad bod',
    setting: 'Little league bleachers',
    voiceId: 'English_PatientMan',
    description: 'American dad at his kids baseball game',
    promptDetails: 'Portrait photo of a white American man, 47 years old, fair skin, slightly receding light brown hair, wearing a wrinkled button-down shirt with the sleeves rolled and a team cap. He is on metal bleachers at a little league baseball field with a chain-link backstop and green grass visible behind him, bright outdoor afternoon sun.',
  },
  // 50s women
  {
    name: 'Linda Chen-Williams',
    slug: 'linda-chen-williams-ugc',
    gender: 'female',
    age: 52,
    ethnicity: 'Chinese/American',
    style: 'Real estate blazer',
    setting: 'Open house, living room',
    voiceId: 'English_ConfidentWoman',
    description: 'Chinese American real estate agent at an open house',
    promptDetails: 'Portrait photo of a Chinese American woman, 52 years old, fair skin with fine lines, dark hair with some gray in a professional blow-out, wearing a fitted red blazer over a white blouse with a name tag. She is in a staged living room with furniture, flowers, and large windows behind her, bright well-lit real estate showing light.',
  },
  {
    name: 'Tammy Brooks',
    slug: 'tammy-brooks-ugc',
    gender: 'female',
    age: 56,
    ethnicity: 'White/American',
    style: 'Nurse scrubs, glasses',
    setting: 'Hospital hallway',
    voiceId: 'English_Wiselady',
    description: 'Experienced American nurse in the hospital',
    promptDetails: 'Portrait photo of a white American woman, 56 years old, fair skin with smile lines, short graying blonde hair, wearing maroon scrubs and reading glasses on top of her head. She is in a hospital hallway with medical equipment carts and room doors slightly blurred behind her, bright clinical hallway lighting.',
  },
  // 50s men
  {
    name: 'Andre Jackson',
    slug: 'andre-jackson-ugc',
    gender: 'male',
    age: 54,
    ethnicity: 'Black/American',
    style: 'Coach polo, whistle',
    setting: 'High school gym',
    voiceId: 'English_ManWithDeepVoice',
    description: 'Black American high school coach in the gym',
    promptDetails: 'Portrait photo of a Black American man, 54 years old, dark brown skin, closely cropped graying hair, wearing a school-branded polo shirt with a whistle on a lanyard around his neck. He is in a high school gymnasium with basketball hoops, bleachers, and a waxed wood floor blurred behind him, harsh overhead gym lights.',
  },
  {
    name: 'Mike Sullivan',
    slug: 'mike-sullivan-ugc',
    gender: 'male',
    age: 58,
    ethnicity: 'White/American',
    style: 'Trucker cap, work jacket',
    setting: 'Farm, barn door',
    voiceId: 'Deep_Voice_Man',
    description: 'American farmer at the barn',
    promptDetails: 'Portrait photo of a white American man, 58 years old, deeply tanned weathered skin, full gray mustache, wearing a faded trucker cap and a brown Carhartt work jacket. He is standing by a red barn door with hay bales, a tractor tire, and fenced pasture slightly blurred behind him, warm late afternoon farm light.',
  },
  // 60s+ women
  {
    name: 'Sharon Davis',
    slug: 'sharon-davis-ugc',
    gender: 'female',
    age: 64,
    ethnicity: 'Black/American',
    style: 'Sunday best, hat',
    setting: 'Community center',
    voiceId: 'English_Wiselady',
    description: 'Distinguished Black American woman at a community event',
    promptDetails: 'Portrait photo of a Black American woman, 64 years old, rich brown skin with expression lines, short silver natural hair, wearing a cream blazer with a colorful brooch and small pearl earrings. She is in a community center with folding tables, an American flag, and a podium slightly blurred behind her, mixed fluorescent and natural window light.',
  },
  // 60s+ men
  {
    name: 'Tom Richardson',
    slug: 'tom-richardson-ugc',
    gender: 'male',
    age: 66,
    ethnicity: 'White/American',
    style: 'Fishing vest, cap',
    setting: 'Lake dock',
    voiceId: 'English_WiseScholar',
    description: 'Retired American man at the lake',
    promptDetails: 'Portrait photo of a white American man, 66 years old, tanned weathered skin with wrinkles, thick gray hair under a fishing cap, wearing a khaki fishing vest over a flannel shirt. He is on a wooden lake dock with calm water, a tackle box, and pine trees on the far shore blurred behind him, soft golden morning light.',
  },
  {
    name: 'Roberto Morales',
    slug: 'roberto-morales-ugc',
    gender: 'male',
    age: 61,
    ethnicity: 'Latino',
    style: 'Cowboy hat, ranch wear',
    setting: 'Ranch fence',
    voiceId: 'Patient_Man',
    description: 'Latino rancher leaning on a fence',
    promptDetails: 'Portrait photo of a Latino man, 61 years old, deeply tanned weathered skin, thick white mustache, wearing a straw cowboy hat and a denim work shirt with the sleeves rolled. He is leaning on a wooden ranch fence with cattle and rolling Texas hills slightly blurred behind him, warm bright outdoor ranch light.',
  },
];

// ---- HYPER-REALISTIC TEST AVATARS (3) ----
// Ultra-photorealistic, cinematic, indistinguishable from real photos
// Inspired by top-tier UGC influencer content with skin micro-detail, gold jewelry, luxury environments
const HYPER_REALISTIC_CHARACTERS: AvatarCharacter[] = [
  {
    name: 'Isabella Reyes',
    slug: 'isabella-reyes-hr',
    gender: 'female',
    age: 28,
    ethnicity: 'Latina',
    style: 'Black strapless top, gold jewelry',
    setting: 'Luxury apartment, evening',
    voiceId: 'Lovely_Girl',
    description: 'Stunning young Latina content creator in a modern luxury apartment',
    promptDetails: 'Ultra-realistic portrait of a young Latina woman, 28 years old, warm olive skin with a natural healthy sheen, visible pores on her forehead and cheeks, a faint beauty mark near her jawline, subtle redness around her nose. Dark wavy hair falling just past her shoulders with natural movement and individual strands catching the warm light. She is wearing a simple black strapless top, small gold hoop earrings, a delicate thin gold chain necklace with a small pendant, and a thin gold bracelet on her wrist. Her lips are natural with a soft pink tone and realistic moisture texture, slightly parted as if mid-sentence. Her eyebrows are natural and full with visible individual hairs. She is sitting at a glass table with a subtle reflection visible on the surface, in a modern luxury apartment with cream-colored sofas, warm recessed amber ceiling lights, and floor-to-ceiling windows showing an evening cityscape softly blurred behind her. The lighting is warm and ambient from the ceiling downlights, creating soft golden highlights on her cheekbones and collarbone, with gentle realistic shadow falloff on one side of her face.',
  },
  {
    name: 'Natasha Cole',
    slug: 'natasha-cole-hr',
    gender: 'female',
    age: 31,
    ethnicity: 'White/European',
    style: 'Gray ribbed tank, gold accessories',
    setting: 'Modern white home office',
    voiceId: 'Inspirational_girl',
    description: 'Polished European content creator in her modern home office setup',
    promptDetails: 'Ultra-realistic portrait of a European woman, 31 years old, fair skin with subtle warmth and natural texture, faint under-eye shadows from real life, visible skin pores, a tiny mole on her neck. Long straight dark hair past her shoulders with natural shine and a few flyaway strands. Striking green-hazel eyes with sharp realistic light reflections in the pupils and natural eyelashes. She is wearing a gray ribbed knit tank top with visible fabric texture and weave, layered delicate gold necklaces including a thin chain and a pendant, a gold watch on her left wrist, stacked thin gold rings on her fingers, and a small gold bracelet. Her hands are clasped naturally in front of her chest with realistic skin creases and natural nails. She is at a clean modern white desk in a minimalist home office, with a laptop open beside her showing a screen glow, a small green plant in a white pot, and a circular ring light behind her creating a soft warm halo glow. The walls are clean white with soft natural daylight coming from a window to the side, creating gentle directional lighting on her face.',
  },
  {
    name: 'Marcus Thompson',
    slug: 'marcus-thompson-hr',
    gender: 'male',
    age: 35,
    ethnicity: 'Black/American',
    style: 'Black crew neck, gold chain',
    setting: 'Upscale modern kitchen, evening',
    voiceId: 'Deep_Voice_Man',
    description: 'Confident Black American man in an upscale modern kitchen',
    promptDetails: 'Ultra-realistic portrait of a Black American man, 35 years old, rich deep brown skin with a natural healthy sheen, visible skin texture and pores, realistic light reflections on his cheekbones and forehead, subtle razor bumps along his jawline from a recent shave. Short neat fade haircut with crisp clean edges and natural hair texture visible. Dark brown eyes with sharp realistic light reflections in the pupils. He is wearing a fitted black crew-neck t-shirt with visible cotton fabric texture, a simple gold Cuban link chain necklace, and a clean silver watch on his wrist. His expression is natural and confident, mouth slightly open as if mid-conversation, showing a glimpse of his teeth. He is in an upscale modern kitchen with dark matte cabinets, a white marble countertop with subtle gray veining, warm brass pendant lights hanging above, and a glass of red wine on the counter beside him. Through a large window behind him, an evening city skyline with warm building lights is softly blurred into creamy bokeh. The lighting comes from the warm pendant lights above, casting golden highlights on his face and creating soft dimensional shadows.',
  },
  {
    name: 'Ava Chen',
    slug: 'ava-chen-hr',
    gender: 'female',
    age: 24,
    ethnicity: 'East Asian',
    style: 'Cream cable-knit sweater, gold studs',
    setting: 'Cozy café, morning',
    voiceId: 'Sweet_Girl_2',
    description: 'Young East Asian woman in a cozy café on a rainy morning',
    promptDetails: 'Ultra-realistic portrait of a young East Asian woman, 24 years old, fair porcelain skin with faint natural redness on her cheeks, subtle dark under-eye circles, visible pores on her nose and forehead, no makeup at all. Straight dark hair in a loose low ponytail with wispy bangs framing her face and a few loose strands falling near her temples. Dark brown eyes with sharp realistic light reflections in the pupils. She is wearing a cream oversized cable-knit sweater with clearly visible weave texture and soft fuzz on the fabric, a thin gold chain necklace with a tiny round pendant, and small gold stud earrings. She is sitting at a wooden café table with a ceramic latte cup with latte art beside her, near a rain-streaked window with a blurred rainy street scene visible outside. Warm indoor pendant lighting creates a soft golden glow on her face, with the cooler daylight from the window creating gentle fill light from the side.',
  },
  {
    name: 'Jordan Ellis',
    slug: 'jordan-ellis-hr',
    gender: 'male',
    age: 32,
    ethnicity: 'White/American',
    style: 'Dress shirt loosened, silver watch',
    setting: 'Car, golden hour after work',
    voiceId: 'English_FriendlyPerson',
    description: 'American man in his car after work at golden hour',
    promptDetails: 'Ultra-realistic portrait of a white American man, 32 years old, fair skin with a slight sun flush on his cheeks and nose, visible pores, faint horizontal forehead lines, five o\'clock shadow with individual stubble hairs visible. Short brown hair slightly mussed from a long day. Blue-gray eyes with sharp realistic light reflections. He is wearing a light blue dress shirt with the top two buttons undone and sleeves casually rolled up revealing a silver watch on his left wrist, showing visible fabric wrinkles and collar creases from the day. He is sitting in the driver seat of a car with a leather steering wheel partially visible, seatbelt on, a takeout coffee cup in the center console cupholder. Warm golden hour sunlight streams directly through the driver side window, casting strong warm directional light on his face with realistic sun glow on his skin and deep warm shadows on the opposite side. A suburban neighborhood with trees is softly blurred through the windshield.',
  },
  {
    name: 'Amara Osei',
    slug: 'amara-osei-hr',
    gender: 'female',
    age: 27,
    ethnicity: 'Ghanaian/Black',
    style: 'Sage linen shirt, gold jewelry',
    setting: 'Bright living room, afternoon',
    voiceId: 'Lively_Girl',
    description: 'Vibrant Ghanaian woman in a bright modern living room',
    promptDetails: 'Ultra-realistic portrait of a Ghanaian woman, 27 years old, rich dark brown skin with a beautiful natural glow, visible skin texture and pores, realistic light reflecting off her cheekbones and the bridge of her nose, subtle natural lip color. Long box braids with honey-blonde tips, some braids pulled over her left shoulder and the rest falling behind. Dark brown eyes with sharp glossy reflections in the pupils. She is wearing a sage green oversized linen shirt with visible fabric texture and natural wrinkles, layered delicate gold necklaces of different lengths, small gold hoop earrings, and natural unpolished nails. She is sitting on a cream textured bouclé sofa in a bright modern living room with a large fiddle leaf fig plant beside her, tall windows with sheer white curtains letting in bright natural afternoon sunlight that floods the room and creates soft warm highlights on her skin and gentle shadows.',
  },
  {
    name: 'Diego Morales',
    slug: 'diego-morales-hr',
    gender: 'male',
    age: 41,
    ethnicity: 'Latino',
    style: 'Leather jacket, silver ring',
    setting: 'Restaurant bar, evening',
    voiceId: 'Determined_Man',
    description: 'Mature Latino man at an upscale restaurant bar',
    promptDetails: 'Ultra-realistic portrait of a Latino man, 41 years old, warm tan skin with the beginning of crow\'s feet around his eyes, visible pores, natural oil sheen on his forehead, slight stubble shadow along his jaw and chin. Dark wavy hair pushed back from his forehead with a few distinguished gray strands visible at the temples. Dark brown eyes with warm realistic light reflections. He is wearing a dark brown leather jacket with visible grain and wear marks over a plain black crew-neck t-shirt, and a thick silver ring on his right hand. He is sitting at a dark wood bar counter in an upscale restaurant with an amber-colored cocktail in a rocks glass beside him, warm Edison bulb string lights creating golden bokeh points in the background, an exposed brick wall softly blurred behind him. The lighting is warm and moody from the Edison bulbs above, creating rich golden highlights on his face and the leather jacket with deep atmospheric shadows.',
  },
  {
    name: 'Sophie Laurent',
    slug: 'sophie-laurent-hr',
    gender: 'female',
    age: 35,
    ethnicity: 'French/European',
    style: 'White linen robe, no makeup',
    setting: 'Bedroom, morning light',
    voiceId: 'English_GracefulLady',
    description: 'French woman in her bedroom on a bright morning',
    promptDetails: 'Ultra-realistic portrait of a French European woman, 35 years old, fair skin with natural freckles scattered across her nose and cheeks, a slight pillow crease still visible on her left cheek, visible pores, dewy morning skin with no makeup at all. Tousled medium-length light brown hair with natural waves, messy and undone from sleep, some strands falling across her forehead. Hazel-green eyes with soft morning light reflecting in the pupils. She is wearing a white oversized linen robe loosely tied at the waist with visible fabric folds and draping, and a delicate thin gold chain necklace she slept in. She is sitting up in bed with rumpled white linen bedsheets around her, a cream upholstered headboard behind her, a bedside table with a glass of water and a paperback book. Soft warm morning sunlight pours through tall windows with sheer curtains, creating a bright ethereal glow and gentle warm highlights on her face and hair.',
  },
  {
    name: 'Elijah Brooks',
    slug: 'elijah-brooks-hr',
    gender: 'male',
    age: 29,
    ethnicity: 'Black/American',
    style: 'White tee, gold chain, Apple Watch',
    setting: 'Modern apartment, daylight',
    voiceId: 'Casual_Guy',
    description: 'Young Black American man in his modern apartment',
    promptDetails: 'Ultra-realistic portrait of a Black American man, 29 years old, medium brown skin with warm undertones, natural sheen on his forehead, visible pores and fine skin texture, a subtle razor line visible at the base of his neck. Short twists hairstyle, well-maintained with natural hair texture clearly visible. Dark brown eyes with sharp glossy light reflections. He is wearing a clean white crew-neck t-shirt with visible cotton fabric texture and subtle collar stretch, a simple thin gold chain necklace, and a dark-banded Apple Watch on his left wrist. He is in a modern apartment living room with a gray sectional sofa, a concrete-look coffee table with a hardcover book on it, a tall indoor monstera plant, and large floor-to-ceiling windows with a city view. Bright natural midday light fills the room from the windows, creating clean even lighting on his face with soft natural shadows.',
  },
  {
    name: 'Priya Anand',
    slug: 'priya-anand-hr',
    gender: 'female',
    age: 33,
    ethnicity: 'Indian',
    style: 'Burgundy silk camisole, gold jhumkas',
    setting: 'Modern kitchen, evening',
    voiceId: 'Calm_Woman',
    description: 'Indian woman in her modern kitchen on a warm evening',
    promptDetails: 'Ultra-realistic portrait of an Indian woman, 33 years old, warm medium brown skin with a natural healthy glow, visible skin texture and pores, a tiny beauty mole just above her upper lip on the left side, natural lip color with realistic moisture. Long dark hair, straight and glossy with natural shine, parted in the middle and falling past her shoulders. Dark brown eyes with warm golden light reflections in the pupils, subtle eyeliner on the upper lash line. She is wearing a burgundy silk camisole top with visible fabric sheen and delicate strap detail, small gold jhumka earrings catching the light, thin gold bangles on her right wrist. She is standing at a white marble kitchen island with a wooden cutting board with fresh herbs on it, copper pendant lights hanging above, a glass of white wine on the counter. Warm evening light comes from the copper pendants above and a soft golden glow from the window behind her, creating rich warm tones across the scene.',
  },
  {
    name: 'Ryan Gallagher',
    slug: 'ryan-gallagher-hr',
    gender: 'male',
    age: 47,
    ethnicity: 'White/Irish-American',
    style: 'Green quarter-zip, glasses on head',
    setting: 'Home study, evening lamp',
    voiceId: 'English_WiseScholar',
    description: 'Mature Irish-American man in his warm home study',
    promptDetails: 'Ultra-realistic portrait of a white Irish-American man, 47 years old, fair skin with ruddy warm undertones, visible laugh lines and crow\'s feet, light freckles on his nose and upper cheeks, natural skin texture with some fine lines on his forehead. Thick salt-and-pepper hair, slightly wavy, neatly but naturally styled. Blue-green eyes with warm amber light reflections. He is wearing a dark forest green quarter-zip fleece pullover with visible fleece texture, reading glasses pushed up on top of his head, and a gold wedding band on his left ring finger. He is in a warm home study with dark wooden bookshelves filled with books behind him, a leather desk chair visible, a warm brass desk lamp casting a golden pool of light, a crystal whiskey glass on a leather coaster on the desk, and a small framed family photo on the shelf. The lighting is rich and warm from the desk lamp, creating deep amber tones with gentle shadows.',
  },
  {
    name: 'Mia Nakamura',
    slug: 'mia-nakamura-hr',
    gender: 'female',
    age: 26,
    ethnicity: 'Japanese/American',
    style: 'Tan blazer, pearl studs',
    setting: 'Park bench, autumn golden hour',
    voiceId: 'English_SereneWoman',
    description: 'Japanese American woman on a park bench in autumn',
    promptDetails: 'Ultra-realistic portrait of a Japanese American woman, 26 years old, fair skin with warm undertones, faint sun freckles on the bridge of her nose, natural lip color, visible pores, no makeup. Shoulder-length dark hair with subtle auburn highlights catching the sunlight, slightly wind-blown with a few strands across her face. Dark brown eyes with golden autumn light reflections in the pupils. She is wearing a tan oversized structured blazer over a simple white crew-neck t-shirt, small pearl stud earrings, and a thin gold bracelet on her wrist. She is sitting on a wooden park bench with fallen golden and orange autumn leaves scattered on the ground around her, autumn trees with warm orange, yellow, and red foliage softly blurred behind her, a winding path and green grass visible. Soft golden afternoon sun backlight illuminates her hair and creates a warm rim light around her silhouette, with gentle warm fill light on her face.',
  },
  {
    name: 'Ahmad Hassan',
    slug: 'ahmad-hassan-hr',
    gender: 'male',
    age: 38,
    ethnicity: 'Middle Eastern',
    style: 'Navy henley, trimmed beard',
    setting: 'Balcony, evening city lights',
    voiceId: 'Patient_Man',
    description: 'Middle Eastern man on his apartment balcony at dusk',
    promptDetails: 'Ultra-realistic portrait of a Middle Eastern man, 38 years old, olive skin with warm undertones, visible pores, natural stubble texture in his well-groomed beard area with clean trimmed cheek lines, slight natural shine on his nose and forehead. Short dark hair neatly styled with a slight wave. Dark brown eyes with warm city light reflections in the pupils. He is wearing a fitted dark navy henley shirt with the top two buttons casually undone showing his collarbone, a silver watch on his left wrist. He is on a modern apartment balcony with a sleek glass railing, a city skyline at dusk visible behind him with warm building lights and a deep blue-to-orange gradient sky, a small outdoor café table with a white espresso cup and saucer, and a potted olive plant in the corner. The lighting is a mix of warm ambient glow from the apartment interior behind him and the soft cool twilight from the sky, creating a cinematic contrast of warm and cool tones on his face.',
  },
  // ---- HYPER-REAL V2 — ULTRA-REALISM PUSH (5 WOMEN) ----
  // Even more micro-imperfections, wet hair, dewy skin, raw UGC aesthetic
  {
    name: 'Valentina Cruz',
    slug: 'valentina-cruz-hr2',
    gender: 'female',
    age: 27,
    ethnicity: 'Latina/Mixed',
    style: 'Black strapless top, wet hair, gold jewelry',
    setting: 'Bedroom, soft afternoon light',
    voiceId: 'Lovely_Girl',
    description: 'Beautiful young Latina woman on her bed with wet slicked-back hair',
    promptDetails: 'Ultra-realistic, true-to-life cinematic photography of a beautiful young Latina mixed-race woman, 27 years old, sitting on a bed with cream and beige linen cushions and pillows behind her. Her hair is wet and slicked back naturally from a shower, with realistic damp strands clumping together and subtle shine from moisture, individual wet hair strands visible along her hairline and temples. Her skin is warm olive-toned with hyper-realistic micro-detail — visible pores on her nose, cheeks, and forehead, natural oil sheen on her forehead and the bridge of her nose, faint redness around her nostrils, a tiny blemish on her chin, and subtle collarbone definition with realistic skin texture. Her lips have a natural soft pink tone with realistic moisture and subtle lip texture, slightly parted as if speaking. Light natural eye bags visible under her dark brown eyes which have sharp glossy reflections. She is wearing a simple black strapless top with visible fabric tension and folds, small gold chunky hoop earrings, a delicate gold chain necklace with a small coin pendant, and a thin gold ring on her finger. Soft warm natural afternoon daylight pours through tall windows with sheer curtains behind her, creating gentle warm highlights on her damp skin and soft realistic shadows. The bed has rumpled linen texture and the room feels lived-in and warm. Shot on a full-frame camera with a 50mm lens, shallow depth of field, hyper-realistic skin pores and hair strands, 8K photorealism, UGC beauty influencer aesthetic. No cartoon, no CGI, no plastic skin, no over-smoothing, no beauty filters.',
  },
  {
    name: 'Sienna Moore',
    slug: 'sienna-moore-hr2',
    gender: 'female',
    age: 30,
    ethnicity: 'White/American',
    style: 'Oversized gray hoodie, no makeup',
    setting: 'Bathroom, mirror light',
    voiceId: 'Calm_Woman',
    description: 'Natural American woman in her bathroom with no makeup',
    promptDetails: 'Ultra-realistic, raw, unfiltered close-up portrait of a beautiful white American woman, 30 years old, in her modern bathroom. Her hair is medium brown, pulled back in a messy low bun with baby hairs and flyaway strands visible along her hairline and temples. Her skin is completely bare with zero makeup — visible pores across her nose and cheeks, faint dark circles under her hazel-green eyes, natural redness around her nose and chin, a small blemish near her jawline, subtle freckles across her nose bridge, and a natural dewy sheen on her forehead and upper lip from skincare. Her lips are natural with realistic texture and a slight glossy sheen from lip balm. She is wearing an oversized heather gray hoodie with visible cotton fleece texture, drawstrings hanging loose. She is in a modern bathroom with a round LED-backlit mirror creating a soft warm halo glow behind her head, white subway tile, a green potted plant on the counter, and a glass shower door partially visible. The lighting is soft and even from the LED mirror behind her with gentle bathroom overhead light filling in, creating a raw authentic selfie-like quality. Shot as if captured on an iPhone Pro front camera, raw unfiltered UGC TikTok aesthetic, hyper-realistic skin pores and hair strands, 8K photorealism, natural imperfections. No cartoon, no CGI, no plastic skin, no beauty retouching, no glamour lighting.',
  },
  {
    name: 'Jasmine Okafor',
    slug: 'jasmine-okafor-hr2',
    gender: 'female',
    age: 25,
    ethnicity: 'Nigerian/British',
    style: 'White crop tee, gold layered jewelry',
    setting: 'Modern apartment, golden hour',
    voiceId: 'Lively_Girl',
    description: 'Gorgeous young Nigerian-British woman in golden hour apartment light',
    promptDetails: 'Ultra-realistic, cinematic beauty portrait of a gorgeous young Nigerian-British woman, 25 years old, with rich deep brown skin that has a beautiful natural luminous glow. Her skin shows true-to-life micro-detail — visible pores, natural oil sheen catching golden light on her cheekbones, forehead, and the bridge of her nose, subtle hyperpigmentation on her cheeks, and realistic skin texture on her neck and collarbone. Her hair is in fresh medium-length twists with a few golden-brown highlights, some twists framing her face. Her dark brown eyes are sharp and glossy with warm golden light reflections in the pupils, natural full lashes, and well-shaped natural eyebrows with individual hairs visible. She is wearing a fitted white crop t-shirt with visible cotton ribbed texture, multiple layered gold necklaces of varying lengths including a thin choker and a longer pendant chain, small gold huggie hoop earrings, and a gold bracelet stack on her wrist. She is sitting on a modern cream bouclé armchair in a bright apartment with large floor-to-ceiling windows, golden hour sunlight streaming directly in from the side creating strong warm directional light on her face with rich golden highlights on her skin and deep warm shadows on the other side, architectural city buildings visible but soft through the window. Shot on a full-frame DSLR with a 35mm prime lens at f/1.8, ultra-shallow depth of field, 8K photorealism, hyper-realistic skin pores and hair texture, indistinguishable from a real photograph. No cartoon, no CGI, no plastic skin, no over-smoothing.',
  },
  {
    name: 'Elena Vasquez',
    slug: 'elena-vasquez-hr2',
    gender: 'female',
    age: 33,
    ethnicity: 'Colombian/Latina',
    style: 'Cream knit top, minimal gold',
    setting: 'Kitchen counter, morning coffee',
    voiceId: 'Inspirational_girl',
    description: 'Beautiful Colombian woman having morning coffee in her kitchen',
    promptDetails: 'Ultra-realistic, true-to-life cinematic photography of a beautiful Colombian woman, 33 years old, leaning slightly on a white marble kitchen counter with a ceramic coffee mug beside her. Her skin is warm golden-olive with hyper-realistic detail — visible pores on her forehead, nose, and cheeks, natural oil sheen on her T-zone catching the morning light, a faint beauty mark on her left cheekbone, subtle smile lines beginning around her mouth, and realistic skin texture on her exposed collarbone and shoulders. Her hair is dark brown with natural subtle highlights, long and slightly wavy, loose and unstyled with natural bedhead volume and a few strands falling across her face. Her brown eyes have warm morning light reflections with natural lashes and slightly puffy morning eyelids. She is wearing a cream ribbed knit long-sleeve top pushed up at the sleeves with visible fabric texture and natural stretch, a single delicate gold necklace with a small pendant, and small gold stud earrings. The kitchen has white cabinets, a marble countertop, a French press coffee maker, morning light flooding through a large window creating bright warm highlights and long soft shadows across the counter. The overall mood is calm, intimate, morning routine. Shot on a full-frame camera with a 50mm lens, shallow depth of field with creamy bokeh, warm natural color grading, 8K photorealism, hyper-realistic skin texture and hair strands. No cartoon, no CGI, no plastic skin, no beauty filters, no over-smoothing.',
  },
  {
    name: 'Leila Farsi',
    slug: 'leila-farsi-hr2',
    gender: 'female',
    age: 29,
    ethnicity: 'Persian/Middle Eastern',
    style: 'Black silk cami, damp hair, gold hoops',
    setting: 'Living room sofa, evening',
    voiceId: 'English_ConfidentWoman',
    description: 'Stunning Persian woman on her sofa in the evening with damp hair',
    promptDetails: 'Ultra-realistic, cinematic beauty UGC portrait of a stunning Persian woman, 29 years old, sitting casually on a modern velvet sofa in a warm, dimly lit living room in the evening. Her hair is dark and damp from a recent shower, slicked back with some strands loosely falling forward, showing realistic wet hair texture with individual strands clumping naturally and subtle moisture shine. Her skin is fair olive with a warm undertone, showing hyper-realistic micro-detail — visible pores, natural dewiness on her freshly washed face, faint redness on her cheeks, subtle natural eyebrow hairs, and a tiny beauty mark near her upper lip. Her eyes are deep brown with sharp warm reflections from the room lighting, with natural full dark lashes and the faintest trace of leftover eyeliner at her lash line. She is wearing a black silk camisole top with realistic fabric sheen and delicate thin straps, medium gold hoop earrings, a layered gold necklace with a small charm, and a thin gold bangle. The living room has a dark green velvet sofa with textured throw pillows, a lit candle on the coffee table, warm ambient light from a floor lamp creating a soft golden glow on her face with intimate cozy shadows. The background is softly blurred with creamy warm bokeh from the lamp light. Shot on a full-frame DSLR with an 85mm portrait lens at f/2, ultra-shallow depth of field, 8K photorealism, hyper-realistic skin pores and wet hair strands, true-to-life textures, indistinguishable from real photography. No cartoon, no CGI, no plastic skin, no beauty retouching, no over-smoothing, no Instagram filter look.',
  },
  // ---- HYPER-REAL V3 — RAW IMPERFECT REALISM (5 WOMEN) ----
  // No beauty language. Harsher lighting. Normal rooms. Specific asymmetry. Real-person energy.
  {
    name: 'Camila Rojas',
    slug: 'camila-rojas-hr3',
    gender: 'female',
    age: 26,
    ethnicity: 'Latina',
    style: 'Black tube top, damp slicked hair',
    setting: 'Bedroom, warm ambient',
    voiceId: 'Lovely_Girl',
    description: 'Young Latina woman on her bed with damp slicked-back hair',
    promptDetails: 'Photorealistic close-up of a real Latina woman, 26 years old, sitting on her bed with beige linen pillows and a rumpled duvet behind her. This is not a model — she looks like a real person you would see on TikTok. Her dark hair is damp and slicked back tightly from a shower, wet strands clumping along her hairline, water droplets faintly visible near her temples, baby hairs along her forehead. Her skin is warm olive with imperfections everywhere — enlarged pores visible on her nose and inner cheeks, natural oil sheen across her entire T-zone, faint acne scarring on her left cheek, a red blemish on her chin, subtle redness and uneven skin tone around her nose and mouth, visible peach fuzz on her upper lip and jawline catching the light. Her lips are slightly chapped with natural uneven color. Light under-eye bags with a slight purple-blue tint. Her eyebrows are slightly asymmetrical — the left one slightly higher than the right. She is wearing a plain black tube top with wrinkled fabric, small gold hoop earrings, and a thin gold chain necklace with a tiny pendant. The bedroom is normal — not luxury — with a wrinkled duvet, a phone charger cable on the nightstand, and warm yellow light from a bedside lamp creating uneven lighting with one side of her face brighter than the other. Shot on iPhone 15 Pro front camera, raw selfie quality, no filter, no retouching, 8K detail. Absolutely no airbrushing, no smooth skin, no symmetrical face, no CGI, no cartoon, no beauty filter, no glamour lighting. This must look like a real unedited phone photo of a real person.',
  },
  {
    name: 'Tara Singh',
    slug: 'tara-singh-hr3',
    gender: 'female',
    age: 31,
    ethnicity: 'Indian/American',
    style: 'Gray crewneck sweatshirt, messy bun',
    setting: 'Kitchen table, overhead light',
    voiceId: 'Calm_Woman',
    description: 'Indian-American woman at her kitchen table under harsh overhead light',
    promptDetails: 'Photorealistic close-up of a real Indian-American woman, 31 years old, sitting at a normal kitchen table with a mug of tea and her laptop partially visible. This is not a model — she is an ordinary person talking to camera. Her dark hair is in a messy bun with loose strands falling around her face and neck, hair texture slightly frizzy and not styled. Her skin is warm medium-brown with real imperfections — visible open pores across her nose and forehead, dark circles and puffiness under her brown eyes, uneven skin tone with slight hyperpigmentation on her cheeks, a small dark mole on her right cheek near her ear, natural oil sheen on her nose, tiny blackheads on her nose if you look closely, and peach fuzz visible on her upper lip and sideburns. No makeup at all. Her lips are natural with slightly dry texture. She is wearing a worn heather gray crewneck sweatshirt with pilling on the fabric and a stretched-out collar, no jewelry except a simple nose stud. The kitchen has plain white walls, a wooden table with water rings, and a harsh overhead ceiling light creating flat, unflattering lighting with slight shadows under her eyes and nose. The refrigerator and a paper towel roll are visible in the blurred background. Shot on a smartphone front camera, harsh overhead kitchen light, raw and unedited quality, 8K resolution. No beauty filter, no smooth skin, no airbrushing, no perfect symmetry, no CGI, no cartoon, no glamour lighting. This looks like a real person filmed a video in their kitchen.',
  },
  {
    name: 'Nicole Brennan',
    slug: 'nicole-brennan-hr3',
    gender: 'female',
    age: 28,
    ethnicity: 'White/American',
    style: 'Oversized flannel, bare face',
    setting: 'Car, overcast daylight',
    voiceId: 'Inspirational_girl',
    description: 'American woman filming in her car on an overcast day',
    promptDetails: 'Photorealistic close-up of a real white American woman, 28 years old, sitting in the driver seat of a normal car. This is not a model — she is an everyday person filming a car video. Her light brown hair is down and slightly greasy, not freshly washed, with visible roots slightly darker than the rest, some strands tucked behind her ear showing her earlobe. Her skin is fair with very real imperfections — visible pores on her forehead, nose, and chin, dry patches on her cheeks, natural redness across her nose and cheeks from the cold, a small cluster of tiny bumps on her forehead, faint freckles, slightly chapped lips with uneven natural color, and dark circles under her blue-gray eyes. No makeup. Her eyebrows are natural and slightly uneven, not perfectly shaped. She is wearing an oversized red and black flannel shirt that looks lived-in with a wrinkled collar, and small silver stud earrings. The car interior is a normal Honda or Toyota — gray cloth seats, a seatbelt across her chest, the steering wheel logo visible, a water bottle in the cupholder, and receipts in the center console. Flat overcast daylight comes through the windshield and side windows creating even, unflattering, shadowless lighting that shows every skin detail. Shot on iPhone front camera, completely unedited, raw quality, 8K resolution. No beauty filter, no retouching, no smooth skin, no perfect lighting, no CGI, no cartoon. This must look indistinguishable from a real person\'s unfiltered car selfie video.',
  },
  {
    name: 'Ayana Williams',
    slug: 'ayana-williams-hr3',
    gender: 'female',
    age: 24,
    ethnicity: 'Black/American',
    style: 'White tank top, natural hair',
    setting: 'Bedroom, ring light',
    voiceId: 'Lively_Girl',
    description: 'Young Black American woman in her bedroom with a ring light',
    promptDetails: 'Photorealistic close-up of a real young Black American woman, 24 years old, in her bedroom sitting on her bed or at her desk. This is not a model — she looks like a real college-age content creator. Her natural hair is in a fresh twist-out with defined curls, some sections slightly frizzy and others more defined, showing real hair texture. Her skin is medium-dark brown with real imperfections — visible pores on her nose and forehead, a few dark spots from old acne on her jawline, subtle hyperpigmentation on her cheeks, natural oil sheen on her forehead and nose, and real skin texture visible on her neck and collarbone. Her lips have natural fullness with slightly uneven natural pigmentation — the lower lip slightly darker than the upper. Faint dark circles under her dark brown eyes. She is wearing a plain white ribbed tank top with visible fabric texture and a slightly stretched neckline, small gold huggie earrings, and a thin layered gold necklace. The room has a ring light visible behind the camera creating circular catchlights in her eyes and even front-facing light, but also a desk lamp creating slight warm side light. Her bedroom has a normal look — tapestry on the wall, some clutter on the desk, a water bottle, and fairy lights. Shot on a smartphone with ring light illumination, TikTok creator quality, 8K resolution. No beauty filter, no skin smoothing, no airbrushing, no CGI, no cartoon, no glamour. This looks like a real person filming content in their bedroom.',
  },
  {
    name: 'Dina Hadid',
    slug: 'dina-hadid-hr3',
    gender: 'female',
    age: 30,
    ethnicity: 'Lebanese/Middle Eastern',
    style: 'Black long sleeve, wet hair, gold hoops',
    setting: 'Living room couch, evening lamp',
    voiceId: 'English_ConfidentWoman',
    description: 'Lebanese woman on her couch in the evening with damp hair',
    promptDetails: 'Photorealistic close-up of a real Lebanese woman, 30 years old, sitting on a normal couch in her living room in the evening. This is not a model. Her dark hair is damp and slicked back loosely from a shower, individual wet strands visible along her temples and behind her ears, some shorter pieces starting to dry and curl slightly at her hairline. Her skin is light olive with prominent real imperfections — visible pores everywhere on her face, natural oil and dewiness on her freshly washed face, faint redness on her cheeks and around her nose, slight dark circles under her dark brown eyes, a small mole near her upper lip, uneven skin tone, and visible peach fuzz on her cheeks catching the lamp light from the side. Her lips are natural with realistic texture, slightly dry. She is wearing a fitted black long-sleeve top with fabric creases at the elbows, medium gold hoop earrings, and a simple gold chain. The living room is normal — a regular fabric couch with throw pillows that don\'t match, a coffee table with a remote control and a glass of water, a floor lamp creating warm but uneven side lighting that illuminates one side of her face more than the other with visible shadows. The wall behind has a framed print slightly crooked. Shot on iPhone Pro camera, evening indoor lighting, raw unedited quality, 8K resolution. No beauty filter, no retouching, no skin smoothing, no perfect symmetry, no CGI, no cartoon, no glamour lighting. This must look like a real unedited photo of a real person on their couch.',
  },
  // ---- HYPER-REAL V4 — CONTENT CREATOR REALISM (5 WOMEN) ----
  // Sweet spot: attractive but real, warm backlight/side light, close intimate framing, natural glow
  {
    name: 'Gabriela Santos',
    slug: 'gabriela-santos-hr4',
    gender: 'female',
    age: 26,
    ethnicity: 'Brazilian/Latina',
    style: 'Black strapless top, damp hair, gold pendant',
    setting: 'Apartment, warm evening backlight',
    voiceId: 'Lovely_Girl',
    description: 'Young Brazilian woman in her apartment with damp slicked-back hair and warm backlight',
    promptDetails: 'Ultra-realistic close-up portrait of a young Brazilian woman, 26 years old, framed from upper chest up, filling most of the frame in an intimate close distance. She is sitting at a glass table in her apartment in the evening. Her dark hair is damp and slicked back from a shower, with wet strands clumping naturally along her hairline and behind her ears, moisture shine visible on the hair. Her skin is warm olive with a natural healthy glow — visible pores on her nose and cheeks, subtle natural oil sheen on her forehead and cheekbones catching the warm light, faint redness around her nose, a tiny mole near her jaw, and realistic skin texture visible on her neck and collarbone. Her dark brown eyes are slightly glossy with warm reflections. Her lips are natural with soft pink tone and realistic texture, slightly parted mid-sentence. She is wearing a simple black strapless top, small gold chunky hoop earrings, a thin gold chain necklace with a small coin pendant, and a gold bracelet on her wrist. The key lighting: warm recessed ceiling downlights from slightly behind and above create a soft warm glow on the top of her head, shoulders, and the edges of her face, while gentle ambient light fills in the front creating soft dimensional shadows under her cheekbones and jaw. The glass table shows a subtle reflection. Behind her, a cream sofa and warm apartment interior are softly blurred with creamy bokeh from the warm ceiling lights. Shot on a 50mm lens at f/1.8, shallow depth of field, 8K photorealism, natural skin texture with pores and sheen, realistic hair strands. No cartoon, no CGI, no plastic skin, no over-smoothing, no beauty filter.',
  },
  {
    name: 'Alina Petrov',
    slug: 'alina-petrov-hr4',
    gender: 'female',
    age: 30,
    ethnicity: 'Eastern European',
    style: 'Gray knit top, gold layered necklaces',
    setting: 'White desk, soft side light with ring light behind',
    voiceId: 'Inspirational_girl',
    description: 'Eastern European woman at her desk with soft side window light and ring light behind',
    promptDetails: 'Ultra-realistic close-up portrait of an Eastern European woman, 30 years old, framed from upper chest up, filling the frame in a close intimate distance. She is sitting at a clean white desk in a modern minimal room. Her long straight dark hair falls past her shoulders with natural shine and a few flyaway strands. Her skin is fair with subtle warm undertone — visible pores, natural skin texture, faint under-eye shadows, a tiny mole on her neck, and a natural healthy sheen on her forehead and nose. Her green eyes are striking with sharp realistic reflections. Her lips are natural with a soft rose tone, slightly parted as if mid-conversation. She is wearing a gray ribbed knit top with visible fabric texture, layered delicate gold necklaces including a thin chain and a coin pendant, a gold watch on her wrist, stacked thin gold rings, and a small gold bracelet. Her hands are clasped naturally in front of her chest showing realistic skin creases and natural nails. The key lighting: soft natural daylight comes from a window to her left side, creating gentle directional light on one side of her face with soft shadow falloff on the other side. Behind her, a circular ring light creates a soft warm halo glow, and a laptop and small green plant on the desk are slightly visible. The room is clean white and modern. Shot on a 50mm lens at f/1.8, shallow depth of field with the background softly blurred, 8K photorealism, natural skin texture with visible pores. No cartoon, no CGI, no plastic skin, no over-smoothing, no beauty filter.',
  },
  {
    name: 'Nadia Okoye',
    slug: 'nadia-okoye-hr4',
    gender: 'female',
    age: 28,
    ethnicity: 'Nigerian/Black',
    style: 'White off-shoulder top, gold hoops, natural hair',
    setting: 'Living room, warm window backlight',
    voiceId: 'Wise_Woman',
    description: 'Nigerian woman in her living room with warm natural window backlight',
    promptDetails: 'Ultra-realistic close-up portrait of a Nigerian woman, 28 years old, framed from upper chest up, close intimate distance. She is sitting on a couch in her living room. Her natural hair is in defined locs pulled to one side, a few shorter pieces framing her face. Her skin is rich deep brown with a natural luminous glow — visible pores and real skin texture, natural oil sheen on her forehead and cheekbones beautifully catching the warm light, subtle uneven skin tone, and realistic skin texture visible on her neck, shoulders, and collarbone. Her dark brown eyes have warm golden reflections with natural full lashes. Her lips are full with natural pigmentation and realistic texture, slightly parted. She is wearing a white off-shoulder ribbed top with visible fabric texture showing her collarbones, medium gold hoop earrings, and a single delicate gold chain necklace. The key lighting: warm late afternoon sunlight comes from a large window BEHIND her, creating a soft golden rim light along the edges of her hair, shoulders, and face, while softer ambient bounce light from the room fills in the front of her face with warm tones and gentle shadows. The window behind shows a warm golden sky, and the living room has a neutral couch with cushions softly blurred in the background. Shot on an 85mm lens at f/2, very shallow depth of field, creamy warm bokeh background, 8K photorealism, natural skin texture with pores and natural glow. No cartoon, no CGI, no plastic skin, no over-smoothing, no beauty filter.',
  },
  {
    name: 'Sara Mizrahi',
    slug: 'sara-mizrahi-hr4',
    gender: 'female',
    age: 27,
    ethnicity: 'Israeli/Middle Eastern',
    style: 'Black silk cami, wet slicked hair, gold jewelry',
    setting: 'Bedroom on bed, soft warm lamp backlight',
    voiceId: 'English_ConfidentWoman',
    description: 'Israeli woman on her bed with wet hair and warm lamp backlight',
    promptDetails: 'Ultra-realistic close-up portrait of an Israeli woman, 27 years old, framed from upper chest up, filling the frame at a close intimate distance. She is sitting on her bed with cream linen pillows behind her. Her dark hair is wet and slicked back tightly from a shower, damp strands clumping along her hairline, moisture visible on the individual hair strands near her temples and ears. Her skin is light olive with a warm dewy freshness — visible pores on her nose and cheeks, natural oil sheen from freshly washed skin catching the light on her forehead and cheekbones, faint redness on her cheeks, a small mole near her upper lip, and realistic skin texture on her neck and exposed collarbone. Her dark brown eyes have warm reflections with natural lashes. Her lips are natural with realistic moisture texture, slightly parted. She is wearing a black silk camisole with visible fabric sheen and thin straps, small gold hoop earrings, a delicate gold necklace with a small charm, and a thin gold ring. The key lighting: a warm bedside lamp behind and to her right creates a soft golden backlight that rims the edge of her hair, shoulder, and cheek, while softer ambient room light and window twilight fill in the front of her face with gentle warm tones and subtle shadows. The bed linens and pillows behind her are softly blurred with warm creamy tones. Shot on a 50mm lens at f/1.8, shallow depth of field, 8K photorealism, hyper-realistic skin texture with pores and natural dewy sheen, realistic wet hair strands. No cartoon, no CGI, no plastic skin, no over-smoothing, no beauty filter.',
  },
  {
    name: 'Maya Rivera',
    slug: 'maya-rivera-hr4',
    gender: 'female',
    age: 24,
    ethnicity: 'Puerto Rican/Latina',
    style: 'Cream oversized sweater, minimal jewelry',
    setting: 'Couch, soft window side light',
    voiceId: 'Lively_Girl',
    description: 'Young Puerto Rican woman on her couch with soft window side light',
    promptDetails: 'Ultra-realistic close-up portrait of a young Puerto Rican woman, 24 years old, framed from upper chest up, filling the frame at a close intimate distance. She is sitting casually on a couch with neutral cushions. Her dark wavy hair is loose and slightly messy, falling just past her shoulders with natural volume and a few strands across her face, showing individual hair strand detail. Her skin is warm golden-olive with a natural glow — visible pores on her forehead and nose, subtle natural oil sheen on her T-zone, faint dark circles under her dark brown eyes, a beauty mark on her left cheek, and realistic skin texture on her neck. Her eyes are dark brown with soft natural reflections and natural lashes. Her lips are natural with soft warm color and realistic texture, mouth slightly open mid-sentence. She is wearing a cream oversized cable-knit sweater with visible knit texture that falls slightly off one shoulder showing her collarbone, small gold stud earrings, and a single thin gold chain necklace. The key lighting: soft natural daylight from a large window to her left side creates beautiful directional lighting — one side of her face gently illuminated with warm soft light, the other side falling into gentle shadow, creating dimensional depth on her face. The light catches the natural sheen on her skin and the texture of her sweater. Behind her, neutral couch cushions and a warm living room interior are softly blurred. Shot on an 85mm lens at f/1.8, very shallow depth of field, soft creamy background bokeh, 8K photorealism, natural skin texture with pores and glow. No cartoon, no CGI, no plastic skin, no over-smoothing, no beauty filter.',
  },

  // ---- V5: Smartphone UGC / Influencer Realism (5 women) ----
  // Key shift: smartphone camera perspective, candid UGC selfie/recording feel,
  // "indistinguishable from real photography", softer negatives, natural environment details
  {
    name: 'Camila Vargas',
    slug: 'camila-vargas-hr5',
    gender: 'female',
    age: 27,
    ethnicity: 'Colombian/Latina',
    style: 'Black strapless top, gold jewelry, wet slicked-back hair',
    setting: 'Luxury bathroom, warm ambient lighting',
    voiceId: 'Lovely_Girl',
    description: 'Young Colombian influencer in luxury bathroom with wet hair and warm ambient light',
    promptDetails: 'Ultra-realistic female lifestyle influencer standing in a luxury home bathroom, mid-gesture as if reacting naturally to the camera, mouth slightly open in a candid expression. Shot on a vertical smartphone camera, chest-up framing, eye-level angle. Wet, slicked-back dark brown hair suggesting just stepped out of the shower, individual wet strands clinging to her temples and neck, moisture visible on hair. Natural glowing tanned skin with visible texture, pores on nose and cheeks, subtle highlights on cheekbones and shoulders, natural blush, slight redness around nose. Minimal makeup, soft natural brows, soft lips with natural pink tone. Wearing a simple black strapless top, small gold chunky hoop earrings, delicate layered gold necklaces with a small coin pendant, gold bracelet on wrist. Background features a high-end modern bathroom with polished marble walls, warm ambient lighting from recessed ceiling lights above and behind her, and rectangular mirrors with soft LED backlighting creating depth. Reflections visible but not distracting. Warm indoor lighting with gentle highlights and soft shadows on her face, realistic color tones. Authentic influencer UGC vibe — not posed, not studio-lit, feels like a spontaneous phone recording moment. Hyper-realistic smartphone camera quality, shallow depth of field, 4K realism, natural skin imperfections preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Valentina Rossi',
    slug: 'valentina-rossi-hr5',
    gender: 'female',
    age: 24,
    ethnicity: 'Italian/European',
    style: 'Gray knit tank top, gold necklaces, casual content creator',
    setting: 'White desk with ring light halo behind, laptop visible',
    voiceId: 'English_GracefulLady',
    description: 'Young Italian content creator at her desk with ring light behind creating halo effect',
    promptDetails: 'A realistic smartphone-quality photo of an attractive young Italian woman, 24 years old, sitting at a clean white desk, framed from mid-torso to top of head. She is gesturing naturally with her hands interlocked in front of her as if explaining something mid-conversation, mouth slightly open, engaged expression looking directly into the camera. Shot on a smartphone camera, natural arm-length distance, eye-level perspective. Long dark brown hair worn loose with soft natural waves, volume at the roots, a few strands falling across her shoulder. Defined dark eyebrows, natural makeup with subtle mascara, warm brown eyes with real light reflections. Skin shows authentic texture — visible pores on nose, natural blush on cheeks, slight redness, realistic highlights on cheekbones from the light, no airbrushing. Wearing a fitted gray ribbed knit tank top, layered gold necklaces — a thin chain and a longer one with a coin pendant — gold watch on her wrist, small gold hoop earrings. Behind her on the white desk: an open MacBook laptop showing a social media feed, a small green plant, and a ring light creating a soft circular halo glow in the background. White clean walls, bright and airy room. Soft warm indoor lighting from overhead and the ring light behind her creating gentle rim light on her hair and shoulders. Background slightly out of focus with natural depth of field. Sharp focus on her face. High resolution, candid, believable smartphone photography with no retouching. 4K realism, indistinguishable from a real content creator recording. No smoothing, no filters, no artificial glow.',
  },
  {
    name: 'Zara Okafor',
    slug: 'zara-okafor-hr5',
    gender: 'female',
    age: 26,
    ethnicity: 'Nigerian/Black',
    style: 'Black fitted top, gold jewelry, natural glowing skin',
    setting: 'Modern apartment, warm evening window light behind',
    voiceId: 'Lively_Girl',
    description: 'Young Nigerian woman in modern apartment with warm evening backlight from window',
    promptDetails: 'A natural smartphone-quality recording of an attractive young Nigerian woman, 26 years old, sitting on a cream modern sofa in her apartment, framed from upper chest up filling most of the frame in an intimate close distance. She has a calm, confident expression with softly parted lips as if about to speak, looking directly into the camera. Shot on a smartphone camera at eye level, realistic perspective. Rich dark brown skin with a natural healthy glow — visible skin texture and pores, realistic light catching her cheekbones and the bridge of her nose, subtle natural highlights, real skin imperfections. Dark brown eyes with realistic light reflections, natural lashes, groomed eyebrows. Long dark hair in loose natural waves falling past her shoulders, some strands over one shoulder, natural texture and shine. Wearing a simple black fitted scoop-neck top, small gold chunky hoop earrings, thin layered gold chain necklaces, gold bangle on wrist. Behind her: large apartment windows showing warm golden evening light streaming in from behind and slightly to the side, creating a warm rim light effect on the edges of her hair and one shoulder. Modern apartment interior with cream tones, a tall green plant, and warm ambient light — all softly out of focus with natural depth of field. The warm window backlight creates dimensional shadows on her face while soft ambient light fills in the front. Sharp focus on her face. Candid, authentic UGC influencer feel, indistinguishable from a real phone recording. 4K realism, realistic color tones, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Leila Hadid',
    slug: 'leila-hadid-hr5',
    gender: 'female',
    age: 23,
    ethnicity: 'Lebanese/Middle Eastern',
    style: 'Black sleeveless top, gold accessories, sun-kissed skin',
    setting: 'Bright modern apartment, large windows, natural daylight',
    voiceId: 'Calm_Woman',
    description: 'Young Lebanese woman in bright apartment with natural daylight and sun-kissed skin',
    promptDetails: 'Ultra-realistic close-up of an attractive young Lebanese woman, 23 years old, in a bright modern apartment, framed from upper chest up at an intimate close distance. She has a confident, slightly serious expression with lips naturally parted, looking directly into the camera with warm dark brown eyes that have realistic light reflections. Shot on a smartphone camera, natural perspective, slight natural grain. Long dark glossy hair flowing naturally around her shoulders, softly framing her face with a slight middle part, natural volume and a few flyaways catching the light. Sun-kissed warm olive skin with natural tan, subtle freckles across her nose and cheeks, visible pores, natural blush, realistic skin texture — no smoothing, no filters. Strong defined brows, natural makeup with subtle winged eyeliner, soft natural lips. Wearing a fitted black sleeveless top showing natural skin texture on her shoulders and collarbone, a delicate beaded choker necklace with a small heart pendant, thin gold chain bracelet, small gold rings on her fingers. The environment is a bright modern apartment with large floor-to-ceiling windows behind her, warm natural daylight flooding the scene from behind and the side, creating soft highlights on her hair and the edges of her face. Neutral interior with a cream sofa and wooden table visible but softly out of focus. Natural depth of field keeping attention on her face. Photorealistic lighting, true-to-life proportions, hyper-detailed skin pores, natural color grading. The overall feel is candid, personal, and indistinguishable from real photography. 4K ultra-high detail, cinematic realism. No smoothing, no plastic look, no AI artifacts.',
  },
  {
    name: 'Natasha Volkov',
    slug: 'natasha-volkov-hr5',
    gender: 'female',
    age: 25,
    ethnicity: 'Russian/Eastern European',
    style: 'Black casual sweatshirt, minimal jewelry, no makeup',
    setting: 'Car interior, natural daylight from side window',
    voiceId: 'English_SereneWoman',
    description: 'Young Russian woman taking a casual selfie in her car with natural daylight',
    promptDetails: 'A natural smartphone selfie taken inside a parked car during the day, framed from the shoulders up with the camera held slightly below eye level. A young Russian woman, 25 years old, seated in the front seat, head subtly tilted back and turned slightly to the side, one hand resting casually in her hair near the top of her head. Eyes looking slightly upward as if thinking or daydreaming, calm neutral expression with softly parted lips. Soft daylight enters from the side window, creating gentle even illumination across her face with natural highlights on the cheeks and nose and no harsh shadows. Lighting feels unplanned and realistic, like a quick photo taken between moments. Skin texture fully preserved — visible pores, natural blush, light redness on nose and cheeks, real skin imperfections. Fair skin with subtle warmth. No smoothing, no filters, no artificial glow. Makeup is minimal and natural — barely there, just subtle mascara on natural lashes, soft defined brows. Hair is dark brown, shoulder-length with natural loose waves, slightly tousled, falling naturally around her face with a few strands across her forehead. She wears a casual black crewneck sweatshirt, relaxed and unstyled, small simple stud earrings, thin gold chain necklace barely visible at the collar. The car interior is clearly visible: light-colored roof lining, grab handle above, window frame, seatbelt. Background through the window remains softly out of focus with green trees and sky while her face stays sharp. Shot on a smartphone camera with realistic perspective, slight natural grain, and true-to-life color. The overall feel is candid, personal, and indistinguishable from a real selfie taken in the moment. 4K realism, natural imperfections preserved. No retouching, no beauty filter.',
  },

  // ---- V5b: Expanded Smartphone UGC batch (5F + 5M) ----
  {
    name: 'Adriana Mendez',
    slug: 'adriana-mendez-hr5b',
    gender: 'female',
    age: 29,
    ethnicity: 'Mexican/Latina',
    style: 'White linen shirt over tank, gold hoops, thin chain',
    setting: 'Modern apartment kitchen, warm evening',
    voiceId: 'Lovely_Girl',
    description: 'Young Mexican woman in her kitchen with warm evening light and gold jewelry',
    promptDetails: 'A natural smartphone-quality recording of an attractive young Mexican woman, 29 years old, standing at a modern apartment kitchen counter, framed from upper chest up at an intimate close distance. She has a warm natural smile with lips slightly parted mid-sentence, looking directly into the camera with warm dark brown eyes that have realistic light reflections. Shot on a smartphone camera, eye-level perspective, natural distance. Long dark brown hair with loose natural waves, middle part, natural volume and a few strands across her collarbone. Warm golden-tan skin with visible pores on nose and cheeks, natural blush, subtle freckles across the bridge of her nose, realistic highlights on cheekbones from the warm light, natural lip color. Wearing a white oversized linen shirt unbuttoned over a black tank top, small gold chunky hoop earrings, thin gold chain necklace with a tiny charm pendant. Behind her: white marble countertop with a cutting board and sliced lemon, a wine glass, copper pendant lights hanging above the island. Large kitchen window behind and to the side shows warm golden evening light streaming in, creating a soft warm glow on her hair and the edges of her face. The warm overhead pendant lights add gentle highlights. Background slightly out of focus with natural depth of field. Sharp focus on her face. Candid, authentic UGC influencer feel, indistinguishable from a real phone recording. 4K realism, natural skin imperfections preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Kai Robinson',
    slug: 'kai-robinson-hr5b',
    gender: 'male',
    age: 31,
    ethnicity: 'Black/American',
    style: 'White crew-neck tee, thin gold chain, Apple Watch',
    setting: 'Modern apartment couch, natural afternoon light',
    voiceId: 'Casual_Guy',
    description: 'Young Black American man on his couch with natural afternoon light and relaxed vibe',
    promptDetails: 'A natural smartphone-quality photo of an attractive young Black American man, 31 years old, sitting casually on a gray modern sectional sofa, framed from upper chest up filling most of the frame. He has a calm, relaxed expression with a slight natural smile, mouth slightly open as if mid-conversation, looking directly into the camera. Shot on a smartphone camera at eye level, natural perspective. Short dark twists, well-maintained with natural texture, clean hairline. Medium brown skin with warm undertones — natural sheen on his forehead, visible pores on his nose and cheeks, subtle razor line at the neckline, realistic skin texture. Wearing a clean white crew-neck t-shirt with visible cotton texture, a simple thin gold chain around his neck, Apple Watch on his left wrist. Behind him: large apartment windows letting in bright natural midday light from behind and to the side, a tall green indoor plant, concrete coffee table with a book on it. The natural daylight creates soft warm illumination with gentle highlights on one side of his face. Background softly out of focus with natural depth of field. Sharp focus on his face. Candid, authentic, indistinguishable from a real phone photo. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Sana Abbasi',
    slug: 'sana-abbasi-hr5b',
    gender: 'female',
    age: 25,
    ethnicity: 'Pakistani',
    style: 'Cream oversized sweater, gold studs, delicate chain',
    setting: 'Bright bedroom, soft morning window light',
    voiceId: 'Sweet_Girl_2',
    description: 'Young Pakistani woman in her bedroom with soft morning light and cozy sweater',
    promptDetails: 'A natural smartphone-quality photo of a young Pakistani woman, 25 years old, sitting on her bed in a bright bedroom, framed from upper chest up at a close intimate distance. She has a soft, gentle expression with lips naturally parted, looking directly into the camera with warm dark brown eyes. Shot on a smartphone camera, slightly above eye level, natural arm-length distance. Long straight dark hair, loose with a slight natural wave at the ends, falling past her shoulders, some strands framing her face. Warm medium brown skin with a natural glow — visible pores, subtle dark circles under her eyes suggesting she just woke up, no makeup, natural lip color, realistic skin texture on her neck. Wearing a cream oversized cable-knit sweater with visible knit texture, small gold stud earrings, a delicate thin gold chain necklace. Behind her: white linen bedsheets slightly rumpled, cream upholstered headboard, bedside table with a glass of water and a paperback book. Soft morning light streams through tall windows with sheer white curtains, creating gentle diffused illumination that feels warm and peaceful. The light softly illuminates one side of her face. Background softly out of focus. Sharp focus on her face. The overall feel is candid, personal, like a morning selfie shared with close friends. 4K realism, natural skin imperfections preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Jake Morrison',
    slug: 'jake-morrison-hr5b',
    gender: 'male',
    age: 28,
    ethnicity: 'White/American',
    style: 'Dark green flannel over white tee, stubble, simple watch',
    setting: 'Coffee shop window seat, warm indoor light',
    voiceId: 'English_FriendlyPerson',
    description: 'Young American man at a coffee shop window seat with warm pendant lighting',
    promptDetails: 'A natural smartphone-quality photo of a young white American man, 28 years old, sitting at a wooden table by a window in a coffee shop, framed from upper chest up. He has a friendly open expression, slight natural smile, looking directly into the camera. Shot on a smartphone camera at eye level, natural perspective. Light brown hair, slightly wavy and slightly messy, natural texture with a few strands falling across his forehead. Fair skin with a slight sun flush on his cheeks and nose, visible pores, short stubble along his jaw, faint forehead lines, natural skin texture — no smoothing. Wearing a dark green flannel shirt unbuttoned over a plain white t-shirt, a simple leather-strap watch on his wrist. Behind him: a ceramic coffee cup on the wooden table, a window showing a blurred street scene outside, a warm pendant light hanging above casting gentle warm light. Mixed lighting — natural daylight from the window to one side and warm café pendant light from above creating gentle shadows under his cheekbones. Background softly out of focus while his face stays sharp. Candid, authentic, like a real photo someone took of him at the café. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Amara Diallo',
    slug: 'amara-diallo-hr5b',
    gender: 'female',
    age: 28,
    ethnicity: 'Senegalese/Black',
    style: 'Olive green ribbed top, layered gold necklaces, gold hoops',
    setting: 'Modern living room, warm afternoon window backlight',
    voiceId: 'Lively_Girl',
    description: 'Young Senegalese woman in modern living room with warm afternoon window backlight',
    promptDetails: 'A natural smartphone-quality recording of an attractive young Senegalese woman, 28 years old, sitting on a cream textured sofa in a modern living room, framed from upper chest up filling most of the frame at an intimate close distance. She has a confident warm expression with softly parted lips as if about to speak, looking directly into the camera with dark brown eyes that have natural light reflections. Shot on a smartphone camera at eye level. Long box braids with honey-blonde tips, some pulled over one shoulder, others falling behind. Rich dark brown skin with a natural healthy glow — realistic light catching her cheekbones and the bridge of her nose, visible skin texture and pores, subtle natural highlights, no artificial smoothing. Wearing a fitted olive green ribbed top, layered gold necklaces — a thin chain and a chunky one, small gold hoop earrings. Behind her: a large fiddle leaf fig plant in the corner, tall windows with sheer white curtains letting in bright natural afternoon light from behind and to the side. The warm backlight creates a soft golden rim light effect on her braids and shoulders while ambient light fills the front of her face. Background softly out of focus with natural depth of field. Sharp focus on her face. Candid, authentic UGC influencer feel, indistinguishable from a real phone recording. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Ethan Park',
    slug: 'ethan-park-hr5b',
    gender: 'male',
    age: 33,
    ethnicity: 'Korean/American',
    style: 'Navy henley, simple watch, clean-shaven',
    setting: 'Home office desk, natural side window light',
    voiceId: 'English_ReservedYoungMan',
    description: 'Korean American man at his home office desk with natural window side light',
    promptDetails: 'A natural smartphone-quality photo of a Korean American man, 33 years old, sitting at a clean home office desk, framed from upper chest up. He has a calm, composed expression with a slight professional smile, looking directly into the camera. Shot on a smartphone camera at eye level, natural perspective. Short dark hair, neatly styled with slight natural texture on top. Fair skin with warm undertones — visible pores on nose, natural skin texture, slight shine on his nose and forehead, clean-shaven with smooth jawline. Wearing a navy blue henley shirt with the top buttons undone, a simple silver watch on his wrist. Behind him: a clean white desk with a monitor edge visible, a small potted succulent plant, minimal modern decor. A window to his side lets in natural daylight creating gentle directional lighting — one side of his face softly illuminated, the other in gentle shadow, giving dimensional depth. Background softly out of focus. Sharp focus on his face. Candid, natural, like a real video call screenshot or phone photo. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Elena Kovac',
    slug: 'elena-kovac-hr5b',
    gender: 'female',
    age: 30,
    ethnicity: 'Croatian/European',
    style: 'Black tank top, gold chain with pendant, sunglasses on head',
    setting: 'Outdoor café terrace, golden hour side light',
    voiceId: 'English_GracefulLady',
    description: 'Young Croatian woman at outdoor café terrace in golden hour light',
    promptDetails: 'A natural smartphone-quality photo of an attractive young Croatian woman, 30 years old, sitting at a small round table on an outdoor café terrace, framed from upper chest up at a close distance. She has a relaxed confident expression with lips slightly parted, head tilted very slightly, looking directly into the camera with green-hazel eyes. Shot on a smartphone camera at eye level. Medium-length light brown hair with natural waves, slightly wind-tousled, golden highlights from the sun. Fair skin with a natural warm tan — freckles scattered across her nose and cheeks, visible pores, dewy natural glow, subtle redness on her cheeks from the sun, no heavy makeup. Wearing a black fitted tank top, thin gold chain necklace with a small round pendant, small gold hoop earrings, oversized sunglasses pushed up on top of her head. Behind her: a small espresso cup on the round café table, a wrought-iron terrace railing, trees and a blurred street scene. Warm golden hour sunlight comes from the side, backlighting her hair with a golden glow and creating warm highlights on one side of her face while the other side falls into soft gentle shadow. Background softly out of focus with warm golden tones. Sharp focus on her face. The feel is candid, effortless, like a real travel photo on Instagram. 4K realism, natural skin imperfections preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Marcus Chen',
    slug: 'marcus-chen-hr5b',
    gender: 'male',
    age: 27,
    ethnicity: 'Chinese/American',
    style: 'Black crewneck sweatshirt, gold stud earring, casual',
    setting: 'Parked car, afternoon natural daylight',
    voiceId: 'Decent_Boy',
    description: 'Young Chinese American man taking a casual selfie in his parked car',
    promptDetails: 'A natural smartphone selfie taken inside a parked car during the afternoon, framed from the shoulders up with the camera held at eye level. A young Chinese American man, 27 years old, seated in the front seat, looking directly into the camera with a calm relaxed expression, lips naturally together with a very slight half-smile. Soft afternoon daylight enters from the side window, creating gentle even illumination across his face with natural highlights on the cheekbones and nose, no harsh shadows. Lighting feels natural and unplanned. Skin texture fully preserved — fair skin with warm undertones, visible pores on nose and cheeks, natural oil sheen on his T-zone, real skin texture. Short dark hair with slight natural texture, clean and casual. Small gold stud earring in his left ear. Wearing a black crewneck sweatshirt, relaxed and comfortable. The car interior is clearly visible: steering wheel partially visible, dashboard, seatbelt strap, light-colored seat fabric. Background through the windows shows blurred green trees and sky. Sharp focus on his face. Shot on a smartphone camera with realistic perspective, slight natural grain, true-to-life color. Candid, personal, indistinguishable from a real selfie. 4K realism, natural imperfections preserved. No smoothing, no filters, no retouching.',
  },
  {
    name: 'Ines Moreira',
    slug: 'ines-moreira-hr5b',
    gender: 'female',
    age: 26,
    ethnicity: 'Portuguese/Brazilian',
    style: 'Black sleeveless fitted top, gold bangle, dangling earrings',
    setting: 'Bathroom, warm ambient lighting with LED mirror',
    voiceId: 'Exuberant_Girl',
    description: 'Young Portuguese-Brazilian woman in a modern bathroom with warm ambient mirror lighting',
    promptDetails: 'A realistic smartphone photo of an attractive young Portuguese-Brazilian woman, 26 years old, in a modern bathroom, framed from mid-torso to top of head, captured as if in real time. She stands slightly angled, arm relaxed at her side, looking directly into the camera with a calm confident expression, softly parted lips, no smile. Shot on a smartphone camera, eye-level perspective, natural distance. Shoulder-length dark wavy hair with natural volume, middle part, a few strands framing her face. Warm olive skin with a natural tan — visible pores, natural blush on cheeks, subtle freckles, realistic skin texture on her neck and collarbone, no heavy makeup, natural brows, soft natural lip color. Wearing a black sleeveless fitted top, a gold bangle bracelet on her right wrist, small dangling gold earrings. Clean bathroom background with white walls, a circular mirror with soft LED backlight creating a gentle halo behind her, a towel hanging on a rack, light gray tiles. Warm overhead recessed lights provide soft even illumination with gentle highlights on her cheekbones and nose, subtle shadows under jaw. Background softly out of focus. Sharp focus on face. High resolution, candid, believable smartphone photography with no retouching. 4K realism, indistinguishable from a real bathroom selfie. No smoothing, no filters, no artificial glow.',
  },
  {
    name: 'Daniel Osei',
    slug: 'daniel-osei-hr5b',
    gender: 'male',
    age: 35,
    ethnicity: 'Ghanaian',
    style: 'Dark navy t-shirt, silver watch, groomed short beard',
    setting: 'Modern apartment balcony, evening city lights behind',
    voiceId: 'English_Diligent_Man',
    description: 'Ghanaian man on his apartment balcony with evening city skyline behind him',
    promptDetails: 'A natural smartphone-quality photo of a Ghanaian man, 35 years old, standing on a modern apartment balcony in the evening, framed from upper chest up. He has a warm confident expression with a slight natural smile, looking directly into the camera with dark brown eyes that have realistic light reflections from the city lights. Shot on a smartphone camera at eye level, natural perspective. Short dark hair with a clean fade, well-groomed short beard trimmed with clean lines on the cheeks. Rich dark brown skin with visible pores, natural sheen on his forehead and nose, warm undertones, realistic skin texture — no smoothing. Wearing a fitted dark navy crew-neck t-shirt, a silver watch on his wrist. Behind him: a glass balcony railing, city skyline at dusk showing warm yellow-orange building lights and a deep blue-purple sky, a small outdoor café table with a white espresso cup. Warm ambient glow from the apartment interior behind him lights his back slightly, while the soft diffused city light and apartment ambient light illuminate his face from the front. Background softly blurred with natural depth of field, city lights creating gentle bokeh. Sharp focus on his face. Candid, natural, like a real evening balcony selfie. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },

  // ---- V5c: Age-Diverse Women + More (8 total: 6F + 2M) ----
  {
    name: 'Rachel Torres',
    slug: 'rachel-torres-hr5c',
    gender: 'female',
    age: 38,
    ethnicity: 'Mexican-American/Latina',
    style: 'Cream silk blouse, gold jewelry, polished but natural',
    setting: 'Modern kitchen island, warm evening pendant lights',
    voiceId: 'Calm_Woman',
    description: 'Mexican-American woman in her late 30s at kitchen island with warm pendant lighting',
    promptDetails: 'A natural smartphone-quality recording of an attractive Mexican-American woman, 38 years old, standing at a modern kitchen island, framed from upper chest up at an intimate close distance. She has a warm approachable expression with a slight natural smile, lips softly parted, looking directly into the camera with warm brown eyes. Shot on a smartphone camera at eye level. Dark brown hair, shoulder-length with natural waves, a few gray strands mixed in naturally, middle part, tucked behind one ear on one side. Warm olive skin showing natural age — fine lines at the corners of her eyes when she smiles, visible pores, natural blush, slight sun spots on her cheeks, realistic skin texture on her neck. No heavy makeup, just natural brows and soft lip color. Wearing a cream silk button-up blouse loosely tucked, small gold hoop earrings, layered thin gold chain necklaces, a nice watch on her wrist. Behind her: white marble kitchen island with a glass of red wine, a wooden cutting board, copper pendant lights hanging above casting warm pools of light. Evening window behind shows warm golden-blue dusk light. The overhead pendant lights create warm highlights on her hair and gentle shadows under her cheekbones. Background softly out of focus. Sharp focus on her face. Candid, real, like a content creator recording after dinner. 4K realism, natural skin imperfections preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Angela Davis-Wright',
    slug: 'angela-davis-wright-hr5c',
    gender: 'female',
    age: 45,
    ethnicity: 'Black/American',
    style: 'Fitted black turtleneck, gold statement earrings, elegant natural',
    setting: 'Living room, soft lamp light evening',
    voiceId: 'Wise_Woman',
    description: 'Black American woman in her mid-40s in elegant living room with warm lamp light',
    promptDetails: 'A natural smartphone-quality photo of an attractive Black American woman, 45 years old, sitting on a dark leather sofa in a warm living room, framed from upper chest up filling the frame. She has a confident warm expression with a knowing slight smile, looking directly into the camera with dark brown eyes that have deep warm reflections. Shot on a smartphone camera at eye level. Natural hair in a stylish short tapered cut with defined curls on top, a few silver strands mixed in naturally. Rich dark brown skin with warm undertones — visible expression lines around her eyes and mouth that show character, natural glow on her cheekbones, visible pores, subtle natural highlights. Wearing a fitted black turtleneck that emphasizes her elegant posture, bold gold geometric statement earrings, a thin gold bangle. Behind her: warm living room with a floor lamp casting soft amber light from behind and to the side, creating a warm rim glow on the edge of her hair and one shoulder. Cream throw pillows on the sofa, a stack of art books on the coffee table, a framed abstract painting on the wall — all softly blurred. The warm lamp light creates dimensional shadows on her face. Sharp focus on her face. Sophisticated, real, like a lifestyle influencer recording in the evening. 4K realism, natural skin texture and age lines preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Catherine Moore',
    slug: 'catherine-moore-hr5c',
    gender: 'female',
    age: 52,
    ethnicity: 'White/American',
    style: 'Soft gray cashmere sweater, pearl studs, natural elegance',
    setting: 'Home study, warm desk lamp and window light',
    voiceId: 'English_Wiselady',
    description: 'White American woman in her early 50s in home study with warm desk lamp light',
    promptDetails: 'A natural smartphone-quality photo of an attractive white American woman, 52 years old, sitting at a wooden desk in a cozy home study, framed from upper chest up. She has a warm genuine expression with natural crow\'s feet visible when she smiles, looking directly into the camera with blue-gray eyes. Shot on a smartphone camera at eye level. Shoulder-length hair that is a natural blend of dark blonde and silver-gray, worn loose with a soft natural wave, tucked behind her ears. Fair skin showing natural age gracefully — visible smile lines, fine forehead lines, natural pores, subtle redness on her cheeks, a few light age spots. No heavy makeup — just mascara and a touch of lip color. Wearing a soft heathered gray cashmere v-neck sweater, small pearl stud earrings, a simple thin gold wedding band. Behind her: dark wooden bookshelves filled with books, a brass desk lamp casting warm directional light from the side, a family photo in a silver frame, a ceramic mug of tea on the desk. The desk lamp creates warm golden side lighting on one side of her face while soft daylight from a window fills the other side. Background softly blurred. Sharp focus on her face. Real, warm, like a professional woman recording a casual video at home. 4K realism, natural age lines and skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Nkechi Adeyemi',
    slug: 'nkechi-adeyemi-hr5c',
    gender: 'female',
    age: 42,
    ethnicity: 'Nigerian',
    style: 'Warm rust-orange wrap top, bold gold accessories',
    setting: 'Bright modern apartment, natural afternoon window light',
    voiceId: 'English_ConfidentWoman',
    description: 'Nigerian woman in her early 40s in bright apartment with warm afternoon light',
    promptDetails: 'A natural smartphone-quality recording of an attractive Nigerian woman, 42 years old, sitting in a bright modern apartment, framed from upper chest up at a close intimate distance. She has a warm confident expression, lips slightly parted as if about to share something, looking directly into the camera with deep brown eyes. Shot on a smartphone camera at eye level. Long dark hair in medium-sized twists, pulled to one side, some falling over her shoulder. Rich dark brown skin with natural glow — visible skin texture, natural highlights on her cheekbones from the window light, subtle expression lines around her eyes showing warmth, visible pores. Wearing a warm rust-orange wrap top that drapes naturally, bold gold statement hoop earrings, layered gold chain necklaces. Behind her: large apartment windows with sheer white curtains letting in bright natural afternoon light from behind and to the side, creating a soft warm backlight on the edges of her hair and shoulders. Modern minimalist decor — cream sofa edge visible, a tall green monstera plant. The warm backlight creates dimensional lighting with soft shadows on her face. Background softly out of focus. Sharp focus on her face. Confident, authentic, like a successful woman recording content in her apartment. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Maria Conti',
    slug: 'maria-conti-hr5c',
    gender: 'female',
    age: 48,
    ethnicity: 'Italian/Mediterranean',
    style: 'White linen blouse, delicate gold chain, effortless Mediterranean style',
    setting: 'Outdoor terrace, warm golden hour Mediterranean light',
    voiceId: 'English_GracefulLady',
    description: 'Italian woman in her late 40s on outdoor terrace with golden Mediterranean light',
    promptDetails: 'A natural smartphone-quality photo of an attractive Italian woman, 48 years old, sitting at an outdoor terrace table, framed from upper chest up. She has a relaxed elegant expression, slight natural smile with visible laugh lines, looking directly into the camera with warm hazel-brown eyes. Shot on a smartphone camera at eye level. Dark brown hair with visible natural gray streaks woven through, medium-length, loose with natural waves, slightly wind-tousled. Warm olive Mediterranean skin — visible smile lines around her mouth, crow\'s feet at her eyes, sun freckles on her cheeks and nose, natural skin texture, slight sun glow. No heavy makeup, natural brows, soft lip color. Wearing a white linen blouse with the top buttons open showing her collarbone, a delicate thin gold chain necklace, small gold hoop earrings. Behind her: terracotta pot with rosemary, a small espresso cup on the stone table, a wrought-iron terrace railing with green vines, warm golden hour sunlight streaming from the side backlighting her hair with a golden glow. The Mediterranean golden light creates warm tones across the entire scene. Background softly blurred with warm golden tones. Sharp focus on her face. Effortless, real, like a photo from a European vacation. 4K realism, natural age lines and sun freckles preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Sandra Kim',
    slug: 'sandra-kim-hr5c',
    gender: 'female',
    age: 55,
    ethnicity: 'Korean/American',
    style: 'Navy blazer over cream top, simple gold jewelry, professional warmth',
    setting: 'Bright home office, natural daylight from window',
    voiceId: 'English_SereneWoman',
    description: 'Korean American woman in her mid-50s in bright home office with natural daylight',
    promptDetails: 'A natural smartphone-quality photo of an attractive Korean American woman, 55 years old, sitting at a clean home office desk, framed from upper chest up. She has a warm composed expression with a gentle professional smile, visible natural expression lines, looking directly into the camera with dark brown eyes behind stylish thin-framed reading glasses pushed slightly down her nose. Shot on a smartphone camera at eye level. Dark hair with prominent silver-gray streaks, shoulder-length, straight with a slight natural wave at the ends, neatly styled with a side part. Fair skin with warm undertones — visible fine lines around her eyes and forehead, natural age spots, visible pores, natural lip color, minimal makeup. Wearing a fitted navy blazer over a cream silk shell top, small gold stud earrings, a delicate gold chain necklace. Behind her: a clean white desk with a sleek monitor, a small succulent plant in a ceramic pot, a window to the side letting in bright natural daylight that illuminates her face with soft even light from one side. The natural daylight creates gentle directional lighting. Background clean and slightly blurred. Sharp focus on her face. Professional, real, like a business leader on a video call. 4K realism, natural age and skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Omar Khalil',
    slug: 'omar-khalil-hr5c',
    gender: 'male',
    age: 40,
    ethnicity: 'Egyptian/Middle Eastern',
    style: 'Dark fitted polo, silver watch, groomed beard',
    setting: 'Modern restaurant, warm ambient evening light',
    voiceId: 'Determined_Man',
    description: 'Egyptian man in his 40s at a modern restaurant with warm ambient evening light',
    promptDetails: 'A natural smartphone-quality photo of an Egyptian man, 40 years old, sitting at a table in a modern restaurant, framed from upper chest up. He has a confident relaxed expression with a slight smile, looking directly into the camera with warm dark brown eyes. Shot on a smartphone camera at eye level. Short dark hair neatly styled, well-groomed short beard with clean cheek lines, a few gray hairs visible in the beard. Olive skin with warm undertones — visible pores, natural oil sheen on his nose, subtle stubble texture in the beard area, faint expression lines on his forehead, realistic skin texture. Wearing a dark fitted polo shirt, a silver watch on his wrist. Behind him: warm restaurant interior with ambient Edison bulb lighting creating warm golden pools, a dark wood table, a cocktail glass, exposed brick wall in the background. The warm ambient restaurant light creates a cozy golden tone with soft shadows. Background softly blurred. Sharp focus on his face. Candid, authentic, like a real dinner photo. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'David Andersson',
    slug: 'david-andersson-hr5c',
    gender: 'male',
    age: 36,
    ethnicity: 'Swedish/European',
    style: 'Light gray crewneck sweater, minimal, clean-shaven',
    setting: 'Modern apartment, large window natural light',
    voiceId: 'English_Gentle-voiced_man',
    description: 'Swedish man in his mid-30s in modern apartment with bright natural window light',
    promptDetails: 'A natural smartphone-quality photo of a Swedish man, 36 years old, standing near a large window in a modern apartment, framed from upper chest up. He has a calm friendly expression with a natural relaxed smile, looking directly into the camera with light blue-gray eyes. Shot on a smartphone camera at eye level. Light brown hair, short on the sides and slightly longer on top, neatly styled with natural texture. Fair skin with slight Nordic flush on his cheeks — visible pores, light stubble along his jaw, a faint scar near his eyebrow, natural skin texture, subtle redness on the tip of his nose. Wearing a light heathered gray crewneck sweater with visible knit texture. Behind him: bright modern apartment with clean white walls, a large window letting in bright overcast natural daylight from behind and to the side, creating soft even illumination. Simple modern furniture — a wooden shelf with a few plants. The bright daylight wraps softly around him creating a clean bright Scandinavian feel. Background softly blurred. Sharp focus on his face. Clean, natural, like a real FaceTime screenshot. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },

  // ---- V5d: More diversity (5F + 5M) ----
  {
    name: 'Yuki Ishikawa',
    slug: 'yuki-ishikawa-hr5d',
    gender: 'female',
    age: 28,
    ethnicity: 'Japanese',
    style: 'Cream oversized knit cardigan, delicate gold chain, minimal',
    setting: 'Bright minimalist apartment, soft morning window light',
    voiceId: 'English_SereneWoman',
    description: 'Young Japanese woman in minimalist apartment with soft morning window light',
    promptDetails: 'A natural smartphone-quality photo of a young Japanese woman, 28 years old, sitting cross-legged on a low cream sofa in a bright minimalist apartment, framed from upper chest up at a close intimate distance. She has a soft gentle expression with a slight natural smile, looking directly into the camera with dark brown eyes. Shot on a smartphone camera at eye level. Straight dark hair, shoulder-length with a clean middle part, natural shine, a few strands tucked behind one ear showing a small gold stud earring. Fair porcelain skin with natural subtle warmth — visible pores, faint natural redness on her cheeks, subtle dark circles under her eyes, no makeup, natural lip color, realistic skin texture. Wearing a cream oversized knit cardigan over a simple white tee, a delicate thin gold chain necklace. Behind her: bright minimalist apartment with clean white walls, a single framed art print, a small ceramic vase with dried flowers on a low wooden shelf, large window letting in soft diffused morning light. The soft morning light creates gentle even illumination with no harsh shadows. Background softly out of focus. Sharp focus on her face. Quiet, intimate, like a real morning selfie. 4K realism, natural skin imperfections preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Priya Mehta',
    slug: 'priya-mehta-hr5d',
    gender: 'female',
    age: 31,
    ethnicity: 'Indian',
    style: 'Burgundy silk cami top, gold jhumka earrings, bangles',
    setting: 'Modern apartment, warm evening lamp and window light',
    voiceId: 'Calm_Woman',
    description: 'Young Indian woman in her apartment with warm evening light and gold jewelry',
    promptDetails: 'A natural smartphone-quality recording of an attractive young Indian woman, 31 years old, sitting on a modern sofa in her apartment, framed from upper chest up filling most of the frame. She has a warm natural expression with softly parted lips as if about to speak, looking directly into the camera with deep warm brown eyes. Shot on a smartphone camera at eye level. Long dark hair, straight and glossy with natural shine, parted in the middle, falling past her shoulders. Warm medium brown skin with a natural healthy glow — visible skin texture and pores on her nose, tiny beauty mole above her lip on the left side, natural lip color with soft pink tone, subtle dark circles under her eyes, realistic highlights on her cheekbones. Wearing a burgundy silk camisole top with thin straps, small gold jhumka earrings that catch the light, thin gold bangles on her wrist, a delicate gold nose stud. Behind her: warm living room with a cream sofa, a floor lamp casting warm amber light from behind and to the side creating a soft warm rim glow on her hair, a window showing warm evening blue-hour light. The warm lamp light creates dimensional shadows on one side of her face. Background softly out of focus with warm tones. Sharp focus on her face. Real, warm, like a casual evening recording. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Tyler Brooks',
    slug: 'tyler-brooks-hr5d',
    gender: 'male',
    age: 24,
    ethnicity: 'Mixed race (Black/White)',
    style: 'Black hoodie, small gold hoop earring, casual',
    setting: 'Bedroom, soft LED ambient light',
    voiceId: 'Casual_Guy',
    description: 'Young mixed-race man in his bedroom with soft ambient LED lighting',
    promptDetails: 'A natural smartphone selfie of a young mixed-race man, 24 years old, sitting on his bed in his bedroom, framed from shoulders up with the camera held at arm length slightly above eye level. He has a relaxed casual expression with a slight half-smile, looking directly into the camera with warm hazel-brown eyes. Light brown skin with warm undertones — visible pores, natural texture, slight stubble along his jawline, a small mole on his cheek, natural oil sheen on his forehead. Short curly dark hair, natural texture, well-maintained with a clean fade on the sides. Small gold hoop earring in his left ear. Wearing a plain black hoodie, relaxed and comfortable. Behind him: bedroom with a gray headboard, a pillow, warm LED strip light along the wall casting a soft warm ambient glow, a phone charger on the nightstand. The warm LED ambient light creates a cozy low-key feel with soft warm tones. Background slightly out of focus. Sharp focus on his face. Casual, personal, like a real late-night selfie. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Nina Johansson',
    slug: 'nina-johansson-hr5d',
    gender: 'female',
    age: 34,
    ethnicity: 'Swedish/Scandinavian',
    style: 'Black turtleneck, simple gold studs, minimalist chic',
    setting: 'Modern kitchen, bright overcast daylight',
    voiceId: 'English_GracefulLady',
    description: 'Scandinavian woman in her mid-30s in modern kitchen with bright natural daylight',
    promptDetails: 'A natural smartphone-quality photo of a Scandinavian woman, 34 years old, leaning against a kitchen counter in a modern bright kitchen, framed from upper chest up. She has a composed confident expression with a subtle natural smile, looking directly into the camera with light green-blue eyes. Shot on a smartphone camera at eye level. Light blonde hair, shoulder-length, straight with a slight natural wave, pulled loosely behind her ears, natural texture. Fair skin with light freckles across her nose and cheeks — visible pores, natural subtle flush, fine lines starting around her eyes, realistic skin texture, minimal makeup with just mascara. Wearing a fitted black turtleneck, small gold stud earrings, no other jewelry — clean Scandinavian minimalism. Behind her: modern white kitchen with clean lines, a stainless steel faucet, ceramic mug on the counter, a window letting in bright overcast natural daylight that floods the space evenly. The bright even daylight creates clean soft illumination with no harsh shadows. Background softly out of focus. Sharp focus on her face. Clean, effortless, like a real morning kitchen selfie. 4K realism, natural skin imperfections preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Andre Williams',
    slug: 'andre-williams-hr5d',
    gender: 'male',
    age: 29,
    ethnicity: 'Black/American',
    style: 'Fitted olive bomber jacket, gold chain, clean groomed',
    setting: 'City street, golden hour natural light',
    voiceId: 'English_Diligent_Man',
    description: 'Young Black American man on a city street in golden hour light',
    promptDetails: 'A natural smartphone-quality photo of a young Black American man, 29 years old, standing on a city sidewalk, framed from upper chest up. He has a confident cool expression with lips together in a relaxed natural way, looking directly into the camera with dark brown eyes. Shot on a smartphone camera at eye level. Short dark hair with a clean lineup, neatly groomed with defined edges. Dark brown skin with rich warm undertones — natural sheen on his forehead and cheekbones, visible pores, clean-shaven with smooth skin, realistic texture. Wearing a fitted olive green bomber jacket with a zipper, a gold chain visible at the collar. Behind him: blurred city street with warm building facades, a few pedestrians out of focus, golden hour sunlight coming from behind and to the side creating warm rim light on the edge of his jacket and one side of his face. The golden hour light bathes everything in warm orange tones. Background softly blurred with warm urban bokeh. Sharp focus on his face. Cool, authentic, like a real street photo. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Mei-Lin Zhang',
    slug: 'mei-lin-zhang-hr5d',
    gender: 'female',
    age: 26,
    ethnicity: 'Chinese',
    style: 'White off-shoulder blouse, pearl earrings, natural elegance',
    setting: 'Café window seat, rainy day, warm indoor light',
    voiceId: 'English_Soft-spokenGirl',
    description: 'Young Chinese woman at a café window on a rainy day with warm indoor light',
    promptDetails: 'A natural smartphone-quality photo of a young Chinese woman, 26 years old, sitting at a café window seat, framed from upper chest up at an intimate distance. She has a soft thoughtful expression with lips gently parted, looking directly into the camera with dark brown almond-shaped eyes. Shot on a smartphone camera at eye level. Straight dark hair, long past her shoulders, with a natural shine and a slight side part, some strands falling across her collarbone. Fair skin with porcelain undertones — visible pores on her nose, faint natural redness on her cheeks, subtle dark circles, no heavy makeup, just natural brows and soft lip tint. Wearing a white off-shoulder knit blouse showing her collarbone, small pearl stud earrings, a delicate thin gold bracelet. Behind her: café window showing rain streaks and a blurred gray rainy street scene outside, a ceramic latte cup and a book on the wooden table, warm pendant light hanging above casting a soft golden glow. The warm indoor café light contrasts with the cool gray rainy day outside. Background softly out of focus. Sharp focus on her face. Cozy, intimate, like a real rainy day café selfie. 4K realism, natural skin imperfections preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Lucas Fernandez',
    slug: 'lucas-fernandez-hr5d',
    gender: 'male',
    age: 26,
    ethnicity: 'Brazilian/Latino',
    style: 'White linen shirt, tan skin, relaxed beach-adjacent vibe',
    setting: 'Outdoor patio, warm afternoon natural light',
    voiceId: 'English_Jovialman',
    description: 'Young Brazilian man on outdoor patio with warm afternoon light',
    promptDetails: 'A natural smartphone-quality photo of a young Brazilian man, 26 years old, sitting at an outdoor wooden patio table, framed from upper chest up. He has a warm genuine smile showing natural teeth, looking directly into the camera with dark brown eyes. Shot on a smartphone camera at eye level. Dark wavy hair, medium length, slightly tousled and natural with volume, a few strands falling across his forehead. Warm tan skin with a natural sun-kissed glow — visible pores, slight stubble along his jaw and upper lip, natural redness on his cheeks from the sun, a small mole near his ear, realistic skin texture. Wearing a white linen shirt with the top buttons undone showing his collarbone, sleeves casually rolled. Behind him: outdoor wooden patio with green tropical plants, a cold drink with condensation on the table, warm bright afternoon sunlight creating dappled light through overhead foliage. The natural sunlight creates warm highlights on one side of his face with gentle leaf shadows. Background softly out of focus with warm green and golden tones. Sharp focus on his face. Relaxed, real, like a vacation photo. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Aisha Ibrahim',
    slug: 'aisha-ibrahim-hr5d',
    gender: 'female',
    age: 33,
    ethnicity: 'Somali/East African',
    style: 'Earth-toned hijab, gold earrings visible, warm natural makeup',
    setting: 'Bright modern living room, natural window light',
    voiceId: 'English_ConfidentWoman',
    description: 'Somali woman in bright modern living room with natural window light and elegant hijab',
    promptDetails: 'A natural smartphone-quality recording of an attractive Somali woman, 33 years old, sitting in a bright modern living room, framed from upper chest up. She has a warm confident expression with a natural genuine smile, looking directly into the camera with striking dark brown eyes with long natural lashes. Shot on a smartphone camera at eye level. Wearing a beautifully draped earth-toned hijab in warm caramel-brown, neatly styled with soft folds, framing her face elegantly. Rich dark brown skin with a natural luminous glow — visible pores, natural highlights on her high cheekbones, realistic skin texture, soft natural makeup with subtle eyeliner and warm lip color. Small gold drop earrings visible where the hijab frames her face. Behind her: bright modern living room with a large window letting in natural daylight from behind, white walls, a cream sofa, a small potted plant. The natural window light creates a soft warm backlight glow around the edges of her hijab while ambient light illuminates her face. Background softly out of focus. Sharp focus on her face. Elegant, real, like a lifestyle content creator recording. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Ryan Nakamura',
    slug: 'ryan-nakamura-hr5d',
    gender: 'male',
    age: 32,
    ethnicity: 'Japanese/American',
    style: 'Dark gray henley, simple watch, glasses',
    setting: 'Coffee shop, warm afternoon light',
    voiceId: 'English_PatientMan',
    description: 'Japanese American man at coffee shop with warm afternoon light and glasses',
    promptDetails: 'A natural smartphone-quality photo of a Japanese American man, 32 years old, sitting at a coffee shop table, framed from upper chest up. He has a calm friendly expression with a natural slight smile, looking directly into the camera with dark brown eyes behind modern thin-framed rectangular glasses. Shot on a smartphone camera at eye level. Short dark hair, neatly styled with a subtle side part, clean and professional. Fair skin with warm undertones — visible pores, slight five o\'clock shadow, natural skin texture, realistic light reflections on his glasses. Wearing a dark charcoal gray henley shirt, a simple watch on his wrist. Behind him: coffee shop interior with exposed brick, a wooden table with a ceramic coffee cup and a laptop edge visible, warm overhead pendant lights creating pools of warm light. The café lighting creates warm tones with gentle shadows. Background softly blurred with warm amber tones. Sharp focus on his face. Real, approachable, like a casual photo at a coffee meeting. 4K realism, natural skin texture preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
  {
    name: 'Jasmine Williams',
    slug: 'jasmine-williams-hr5d',
    gender: 'female',
    age: 24,
    ethnicity: 'Mixed race (Black/Latina)',
    style: 'Fitted white tank top, layered gold necklaces, natural curls',
    setting: 'Apartment, golden hour window light from behind',
    voiceId: 'English_PlayfulGirl',
    description: 'Young mixed-race woman in apartment with golden hour window backlight',
    promptDetails: 'A natural smartphone-quality recording of a young mixed-race woman, 24 years old, sitting on her bed in her apartment, framed from upper chest up at a close intimate distance. She has a playful warm expression with a natural genuine smile, lips slightly parted, looking directly into the camera with warm light brown eyes. Shot on a smartphone camera slightly below eye level. Voluminous natural curly dark hair with golden-brown highlights, loose and free-flowing around her face and shoulders, individual curls catching the light. Light brown caramel skin with warm golden undertones — visible pores, natural blush, a few beauty marks on her neck, realistic skin texture, natural lip color with a warm pink tone, minimal makeup. Wearing a fitted white ribbed tank top, layered gold chain necklaces — a choker and a longer one with a small pendant, small gold hoop earrings. Behind her: apartment bedroom with cream bedding, a large window showing warm golden hour sunset light streaming in from behind, creating a beautiful warm golden backlight that illuminates the edges of her curly hair like a halo. The golden light bathes the scene in warm amber tones. Background softly out of focus with warm golden glow. Sharp focus on her face. Vibrant, real, youthful, like a real golden hour selfie. 4K realism, natural skin imperfections preserved. No smoothing, no filters, no artificial glow, no retouching.',
  },
];

// ---------- fal.ai Image Generation ----------

interface FalImageResponse {
  images: Array<{
    url: string;
    width: number;
    height: number;
    content_type: string;
  }>;
}

async function generateImage(prompt: string): Promise<string> {
  console.log(`  Calling fal.ai Nano Banana Pro...`);

  const response = await fetch('https://fal.run/fal-ai/nano-banana-pro', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${FAL_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: '16:9',
      resolution: '1K',
      output_format: 'png',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`fal.ai error ${response.status}: ${errorText}`);
  }

  const result: FalImageResponse = await response.json();

  if (!result.images || result.images.length === 0) {
    throw new Error('No images returned from fal.ai');
  }

  return result.images[0].url;
}

// ---------- Supabase Upload ----------

async function uploadToSupabase(imageUrl: string, slug: string): Promise<string> {
  console.log(`  Downloading image...`);

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const timestamp = Date.now();
  const storagePath = `avatar-templates/ugc/${slug}_${timestamp}.png`;

  console.log(`  Uploading to Supabase storage: ${storagePath}`);

  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(storagePath, imageBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('images')
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
}

// ---------- Database Insert ----------

async function insertAvatarTemplate(character: AvatarCharacter, thumbnailUrl: string): Promise<string> {
  console.log(`  Inserting into avatar_templates...`);

  const { data, error } = await supabase
    .from('avatar_templates')
    .insert({
      name: character.name,
      description: character.description,
      category: 'custom',
      gender: character.gender,
      age_range: ageToRange(character.age),
      ethnicity: character.ethnicity,
      voice_provider: 'elevenlabs',
      voice_id: character.voiceId,
      thumbnail_url: thumbnailUrl,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`DB insert failed: ${error.message}`);
  }

  return data.id;
}

// ---------- Main Process ----------

async function processCharacter(character: AvatarCharacter, index: number, total: number, promptSuffix: string = PROMPT_SUFFIX): Promise<void> {
  console.log(`\n[${index + 1}/${total}] ${character.name} (${character.gender}, ${character.ethnicity})`);

  try {
    const fullPrompt = `${character.promptDetails} ${promptSuffix}`;

    // Step 1: Generate image
    const imageUrl = await generateImage(fullPrompt);
    console.log(`  Generated: ${imageUrl}`);

    // Step 2: Upload to Supabase storage
    const thumbnailUrl = await uploadToSupabase(imageUrl, character.slug);
    console.log(`  Uploaded: ${thumbnailUrl}`);

    // Step 3: Insert into database
    const templateId = await insertAvatarTemplate(character, thumbnailUrl);
    console.log(`  Inserted: ${templateId}`);

    console.log(`  Done: ${character.name}`);
  } catch (error) {
    console.error(`  FAILED: ${character.name} - ${error instanceof Error ? error.message : error}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--test';

  let characters: AvatarCharacter[];
  let promptSuffix = PROMPT_SUFFIX;

  if (mode === '--test') {
    // Test with 1 female + 1 male
    characters = [
      CHARACTERS[0],  // Sofia Martinez (female, Latina)
      CHARACTERS[15], // James Cooper (male, White/American)
    ];
    console.log('=== TEST MODE: Generating 2 test avatars ===\n');
  } else if (mode === '--all') {
    characters = CHARACTERS;
    console.log(`=== FULL MODE: Generating all ${CHARACTERS.length} avatars ===\n`);
  } else if (mode === '--selfie') {
    characters = SELFIE_CHARACTERS;
    promptSuffix = SELFIE_PROMPT_SUFFIX;
    console.log(`=== SELFIE MODE: Generating ${SELFIE_CHARACTERS.length} selfie-style avatars ===\n`);
  } else if (mode === '--seniors') {
    characters = [...OVER_50_CHARACTERS, ...OVER_65_CHARACTERS, ...OVER_75_CHARACTERS];
    promptSuffix = SELFIE_PROMPT_SUFFIX;
    console.log(`=== SENIORS MODE: Generating ${characters.length} senior avatars (50+, 65+, 75-80+) ===\n`);
  } else if (mode === '--whiteus') {
    characters = WHITE_US_CHARACTERS;
    promptSuffix = SELFIE_PROMPT_SUFFIX;
    console.log(`=== WHITE US MODE: Generating ${WHITE_US_CHARACTERS.length} white/common US demographic avatars ===\n`);
  } else if (mode === '--everyday') {
    characters = UGC_EVERYDAY_CHARACTERS;
    promptSuffix = PROMPT_SUFFIX;
    console.log(`=== EVERYDAY MODE: Generating ${UGC_EVERYDAY_CHARACTERS.length} everyday American avatars ===\n`);
  } else if (mode === '--hyperreal') {
    characters = HYPER_REALISTIC_CHARACTERS;
    promptSuffix = HYPER_REALISTIC_PROMPT_SUFFIX;
    console.log(`=== HYPER-REALISTIC MODE: Generating ${HYPER_REALISTIC_CHARACTERS.length} hyper-realistic avatars ===\n`);
  } else if (mode === '--hyperreal2') {
    characters = HYPER_REALISTIC_CHARACTERS.filter(c => c.slug.endsWith('-hr2'));
    promptSuffix = HYPER_REALISTIC_PROMPT_SUFFIX;
    console.log(`=== HYPER-REALISTIC V2 MODE: Generating ${characters.length} ultra-realistic women ===\n`);
  } else if (mode === '--hyperreal3') {
    characters = HYPER_REALISTIC_CHARACTERS.filter(c => c.slug.endsWith('-hr3'));
    promptSuffix = HYPER_REALISTIC_PROMPT_SUFFIX;
    console.log(`=== HYPER-REALISTIC V3 MODE: Generating ${characters.length} raw imperfect realism women ===\n`);
  } else if (mode === '--hyperreal4') {
    characters = HYPER_REALISTIC_CHARACTERS.filter(c => c.slug.endsWith('-hr4'));
    promptSuffix = HYPER_REALISTIC_PROMPT_SUFFIX;
    console.log(`=== HYPER-REALISTIC V4 MODE: Generating ${characters.length} content creator realism women ===\n`);
  } else if (mode === '--hyperreal5') {
    characters = HYPER_REALISTIC_CHARACTERS.filter(c => c.slug.endsWith('-hr5'));
    promptSuffix = ''; // V5 prompts are fully self-contained — no suffix needed
    console.log(`=== HYPER-REALISTIC V5 MODE: Generating ${characters.length} smartphone UGC influencer women ===\n`);
  } else if (mode === '--hyperreal5b') {
    characters = HYPER_REALISTIC_CHARACTERS.filter(c => c.slug.endsWith('-hr5b'));
    promptSuffix = ''; // V5b prompts are fully self-contained — no suffix needed
    console.log(`=== HYPER-REALISTIC V5b MODE: Generating ${characters.length} expanded smartphone UGC batch (5F+5M) ===\n`);
  } else if (mode === '--hyperreal5c') {
    characters = HYPER_REALISTIC_CHARACTERS.filter(c => c.slug.endsWith('-hr5c'));
    promptSuffix = ''; // V5c prompts are fully self-contained — no suffix needed
    console.log(`=== HYPER-REALISTIC V5c MODE: Generating ${characters.length} age-diverse smartphone UGC batch ===\n`);
  } else if (mode === '--hyperreal5d') {
    characters = HYPER_REALISTIC_CHARACTERS.filter(c => c.slug.endsWith('-hr5d'));
    promptSuffix = '';
    console.log(`=== HYPER-REALISTIC V5d MODE: Generating ${characters.length} more diverse smartphone UGC batch ===\n`);
  } else if (mode === '--retry') {
    const slug = process.argv[3];
    if (!slug) {
      console.log('Usage: --retry <slug>');
      return;
    }
    const allChars = [...CHARACTERS, ...SELFIE_CHARACTERS, ...OVER_50_CHARACTERS, ...OVER_65_CHARACTERS, ...OVER_75_CHARACTERS, ...WHITE_US_CHARACTERS, ...UGC_EVERYDAY_CHARACTERS, ...HYPER_REALISTIC_CHARACTERS];
    const found = allChars.find(c => c.slug === slug);
    if (!found) {
      console.log(`Character not found: ${slug}`);
      return;
    }
    // Use appropriate suffix based on character source
    const isSelfieStyle = [...SELFIE_CHARACTERS, ...OVER_50_CHARACTERS, ...OVER_65_CHARACTERS, ...OVER_75_CHARACTERS, ...WHITE_US_CHARACTERS].some(c => c.slug === slug);
    const isHyperReal = HYPER_REALISTIC_CHARACTERS.some(c => c.slug === slug);
    promptSuffix = isHyperReal ? HYPER_REALISTIC_PROMPT_SUFFIX : isSelfieStyle ? SELFIE_PROMPT_SUFFIX : PROMPT_SUFFIX;
    characters = [found];
    console.log(`=== RETRY MODE: Retrying ${found.name} ===\n`);
  } else if (mode === '--seed-only') {
    console.log('=== SEED-ONLY MODE: Not implemented yet (needs image URLs) ===');
    return;
  } else {
    console.log('Usage: npx tsx src/scripts/generate-avatar-library.ts [--test|--all|--selfie|--seniors|--whiteus|--everyday|--hyperreal|--hyperreal2|--hyperreal3|--hyperreal4|--hyperreal5|--retry <slug>|--seed-only]');
    return;
  }

  console.log(`Characters to process: ${characters.length}`);
  console.log(`fal.ai model: nano-banana-pro`);
  console.log(`Storage: images/avatar-templates/ugc/`);
  console.log(`Prompt style: ${mode === '--selfie' ? 'selfie/handheld' : 'standard portrait'}`);

  // Process sequentially to avoid rate limits
  for (let i = 0; i < characters.length; i++) {
    await processCharacter(characters[i], i, characters.length, promptSuffix);

    // Small delay between requests
    if (i < characters.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n=== Generation complete ===');
}

main().catch(console.error);
