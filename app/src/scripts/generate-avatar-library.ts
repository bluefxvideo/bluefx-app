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
  } else if (mode === '--retry') {
    const slug = process.argv[3];
    if (!slug) {
      console.log('Usage: --retry <slug>');
      return;
    }
    const allChars = [...CHARACTERS, ...SELFIE_CHARACTERS, ...OVER_50_CHARACTERS, ...OVER_65_CHARACTERS, ...OVER_75_CHARACTERS, ...WHITE_US_CHARACTERS, ...UGC_EVERYDAY_CHARACTERS];
    const found = allChars.find(c => c.slug === slug);
    if (!found) {
      console.log(`Character not found: ${slug}`);
      return;
    }
    // Use selfie suffix for selfie/seniors/whiteus characters, standard for others
    const isSelfieStyle = [...SELFIE_CHARACTERS, ...OVER_50_CHARACTERS, ...OVER_65_CHARACTERS, ...OVER_75_CHARACTERS, ...WHITE_US_CHARACTERS].some(c => c.slug === slug);
    promptSuffix = isSelfieStyle ? SELFIE_PROMPT_SUFFIX : PROMPT_SUFFIX;
    characters = [found];
    console.log(`=== RETRY MODE: Retrying ${found.name} ===\n`);
  } else if (mode === '--seed-only') {
    console.log('=== SEED-ONLY MODE: Not implemented yet (needs image URLs) ===');
    return;
  } else {
    console.log('Usage: npx tsx src/scripts/generate-avatar-library.ts [--test|--all|--selfie|--seniors|--whiteus|--everyday|--retry <slug>|--seed-only]');
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
