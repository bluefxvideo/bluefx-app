import { usage } from './usage';

/**
 * Ready-made music beds for the free video funnel (owner 2026-10-06: a new song for every free video ad is not
 * essential, $0.08 each). Instrumental tracks made once with the same music model and prompt format as The
 * Phantom's own music (scripts/generate-music-library-free.ts), stored as smart-video/music-library/<id>.mp3. A free
 * job asks a small model which track fits the director's musicPrompt; paying users keep music made for their video.
 */
const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ihzcmpngyjxraxzmckiv.supabase.co'}/storage/v1/object/public/script-videos/smart-video/music-library`;

export interface LibraryTrack {
  id: string;
  bpm: number;
  /** The bed in the director's own format (BPM, named instruments, attitude); MUSIC_RULES is added when it is made. */
  prompt: string;
  /** What the made track sounds like, heard by a model when it was made: the music model does not always follow the prompt. */
  heard?: string;
}

const track = (id: string, bpm: number, bed: string, instruments: string, attitude: string): LibraryTrack => ({
  id,
  bpm,
  prompt: `${bpm} BPM, ${bed} instrumental bed. Instruments: ${instruments}. Attitude: ${attitude}.`,
});

const TRACKS: LibraryTrack[] = [
  track('friendly-1', 108, 'light', 'muted electric guitar plucks, soft rhodes piano, finger snaps, brushed drums, warm bass', 'friendly, optimistic, tidy'),
  track('friendly-2', 116, 'cheerful', 'ukulele, hand claps, glockenspiel, light kick drum, round bass', 'cheerful, warm, welcoming'),
  track('acoustic-1', 96, 'warm acoustic', 'fingerpicked acoustic guitar, soft shaker, upright bass, light piano', 'warm, honest, homey'),
  track('acoustic-2', 88, 'heartfelt acoustic', 'strummed acoustic guitar, mandolin, soft tambourine, cello', 'heartfelt, trustworthy, down-to-earth'),
  track('trust-1', 100, 'professional', 'clean electric piano, soft synth pads, muted guitar, light drums, warm bass', 'professional, trustworthy, confident'),
  track('drive-1', 128, 'driving rock', 'punchy drums, crunchy electric guitar riff, bass guitar, hand claps', 'energetic, bold, motivating'),
  track('elegant-1', 80, 'elegant', 'grand piano, soft strings, warm cello, light harp', 'refined, calm, luxurious'),
  track('elegant-2', 72, 'graceful', 'string quartet, soft piano, gentle harp', 'graceful, premium, serene'),
  track('playful-1', 120, 'bouncy', 'ukulele, glockenspiel, pizzicato strings, hand claps, light kick drum', 'happy, playful, bright'),
  track('playful-2', 112, 'quirky', 'marimba, xylophone, bouncy bass, toy piano, finger snaps', 'fun, curious, lighthearted'),
  track('calm-1', 70, 'soothing', 'soft ambient pads, gentle piano, light chimes, warm synth bass', 'calm, soothing, clean'),
  track('calm-2', 76, 'peaceful', 'acoustic guitar harmonics, soft pads, light hand drum, airy flute', 'peaceful, gentle, restful'),
  track('trattoria-1', 104, 'festive Italian', 'mandolin, accordion, acoustic guitar, upright bass, light tambourine', 'warm, festive, family-style'),
  track('bistro-1', 96, 'cozy jazz', 'jazz piano, upright bass, brushed drums, muted trumpet', 'cozy, classy, relaxed'),
  track('latin-1', 108, 'sunny Latin', 'nylon-string guitar, congas, bongos, marimba, bass', 'sunny, lively, festive'),
  track('bossa-1', 98, 'smooth bossa nova', 'nylon-string guitar, soft brushes, shaker, electric piano, bass', 'smooth, breezy, warm'),
  track('tech-1', 110, 'sleek electronic', 'arpeggiated synths, clean electronic drums, sub bass, soft pads', 'innovative, sleek, forward-looking'),
  track('tech-2', 100, 'minimal electronic', 'minimal electronic beat, glassy plucks, warm pads, soft bass', 'smart, clean, futuristic'),
  track('inspire-1', 90, 'hopeful', 'piano ostinato, soft strings, light percussion, warm bass', 'hopeful, inspiring, uplifting'),
  track('inspire-2', 100, 'heartfelt', 'strummed acoustic guitar, piano, light drums, cello', 'heartfelt, motivating, human'),
  track('country-1', 104, 'friendly country', 'acoustic guitar, banjo, upright bass, light drums, fiddle', 'friendly, down-home, honest'),
  track('country-2', 92, 'rugged Americana', 'slide guitar, acoustic guitar, brushed snare, bass', 'rugged, dependable, warm'),
  track('funk-1', 112, 'groovy funk', 'funky clean guitar, slap bass, tight drums, clavinet', 'groovy, fun, confident'),
  track('soul-1', 104, 'feel-good soul', 'wah guitar, Hammond organ, bass, drums, light horns', 'soulful, feel-good, upbeat'),
  track('chic-1', 118, 'chic deep house', 'soft four-on-the-floor kick, warm bass, rhodes chords, airy pads', 'stylish, upscale, smooth'),
  track('lofi-1', 84, 'lo-fi', 'lo-fi drums, warm rhodes, soft bass, light vinyl texture', 'relaxed, cozy, modern'),
  track('kids-1', 116, 'bright', 'piano, xylophone, light drums, bass, hand claps', 'happy, encouraging, safe'),
  track('community-1', 76, 'gentle', 'warm piano, soft organ, strings', 'hopeful, gentle, reverent'),
];

/**
 * What each made track sounds like (heard by gemini-3.6-flash when it was made, 2026-10-06). Left out because a voice
 * kept coming back (singing or vocal chops): drive-2, urban-2, trust-2, urban-1. friendly-1, tech-1 and tech-2 were
 * made again after the strict double listen (hasVoices) flagged the first takes. The picker reads these, not the prompts.
 */
const HEARD: Record<string, string> = {
  'acoustic-1': "Mid-tempo acoustic folk-pop track featuring acoustic guitar fingerpicking and strumming, warm bass, and soft percussion, creating a cheerful, relaxed, and uplifting mood.",
  'acoustic-2': "Mid-tempo, warm fingerpicked acoustic guitar performance with a soothing, peaceful folk melody.",
  'bistro-1': "A slow, laid-back jazz ballad featuring a melodic trumpet solo supported by expressive piano chords, acoustic bass, and soft brush drums, creating a mellow, romantic mood.",
  'bossa-1': "A mid-tempo, upbeat acoustic folk track featuring fingerpicked acoustic guitars, delivering a warm, cheerful, and relaxing mood.",
  'calm-1': "Slow and gentle solo piano piece with a peaceful, melancholic, and soothing atmosphere.",
  'calm-2': "A serene, slow-tempo world acoustic track featuring gentle plucked strings, soft percussion, and subtle synth pads, creating a calm and reflective atmosphere.",
  'chic-1': "Upbeat synthwave and nu-disco track featuring funky synth basslines, retro synth melodies, and punchy electronic drums with an energetic, groovy mood.",
  'community-1': "A gentle and melancholic solo piano melody with a slow tempo and a romantic, peaceful mood.",
  'country-1': "An upbeat acoustic folk track featuring fingerpicked guitar, banjo, and mandolin with a cheerful, rustic mood.",
  'country-2': "A relaxed, mid-tempo gypsy jazz track featuring acoustic guitar lead melodies over warm acoustic rhythm guitar.",
  'drive-1': "An upbeat, groovy synth-pop track featuring funk guitar riffs, synth bass, and a driving electronic drum beat.",
  'elegant-1': "A gentle, slow instrumental waltz featuring violin and acoustic guitar with a nostalgic and peaceful mood.",
  'elegant-2': "A slow, emotional classical piece featuring a lyrical violin melody accompanied by delicate piano arpeggios, creating a serene and nostalgic mood.",
  'friendly-1': "Mid-tempo lo-fi neo-soul track with clean electric guitar melodies, smooth basslines, and a relaxed, jazzy groove.",
  'friendly-2': "An upbeat and cheerful acoustic track driven by bright ukulele, light percussion, warm bass, and playful glockenspiel, evoking an optimistic and carefree mood.",
  'funk-1': "An upbeat, groovy funk track featuring rhythmic electric guitar riffs, a bouncy bassline, punchy brass hits, and dynamic drums creating a cheerful and energetic mood.",
  'inspire-1': "An upbeat and cheerful acoustic guitar track featuring acoustic strumming and melodic fingerpicking with a warm, bright, and folk-inspired mood.",
  'inspire-2': "Mid-tempo acoustic folk track featuring fingerpicked guitar and a sweet violin melody that creates a warm, nostalgic mood.",
  'kids-1': "Upbeat mid-tempo jazz-pop track featuring piano, acoustic guitar, upright bass, and lively percussion with a playful, cheerful, and breezy mood.",
  'latin-1': "An upbeat and cheerful Brazilian choro acoustic guitar instrumental with a lively, syncopated rhythm and warm, festive mood.",
  'lofi-1': "A relaxed, mellow lo-fi hip-hop track featuring warm electric piano chords, smooth bass, atmospheric synth pads, and a laid-back drum beat with a nostalgic mood.",
  'playful-1': "Upbeat and cheerful acoustic pop track with strumming ukulele, light synth melodies, claps, and a playful, happy mood.",
  'playful-2': "An upbeat and cheerful acoustic pop track featuring playful acoustic guitar strumming, ukulele, bouncy bass, and a lively whistling melody.",
  'soul-1': "A mid-tempo funky instrumental track featuring catchy electric guitar riffs, smooth basslines, and steady drums in a cheerful, laid-back mood.",
  'tech-1': "An upbeat synthwave track featuring pulsating synth bass, warm synth pads, and a driving electronic drum beat.",
  'tech-2': "Midtempo lo-fi hip-hop track featuring chilled guitar riffs, smooth synth leads, bouncy bass, and relaxed drums with a sunny, carefree vibe.",
  'trattoria-1': "An upbeat and cheerful gypsy jazz track featuring a lively accordion melody, rhythmic acoustic guitar strumming, and a playful upright bass line.",
  'trust-1': "Mid-tempo smooth jazz bossa nova track featuring electric guitar lead, bass, and warm percussion with a relaxed, pleasant mood.",
};

export const MUSIC_LIBRARY: LibraryTrack[] = TRACKS.map((t) => ({ ...t, heard: HEARD[t.id] }));

export const libraryUrl = (id: string) => `${BASE}/${id}.mp3`;

const PICK_MODEL = 'gemini-3.5-flash-lite';
const STOP = new Set(['bpm', 'instrumental', 'bed', 'instruments', 'attitude', 'and', 'with', 'the', 'a', 'soft', 'light', 'warm', 'no', 'steady', 'energy', 'build', 'ups', 'drops', 'vocals', 'sits', 'under', 'voice', 'over', 'about', 'seconds']);
const wordsOf = (text: string) => new Set(text.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 2 && !STOP.has(word)));
const bpmOf = (text: string) => Number(/(\d{2,3})\s*BPM/i.exec(text)?.[1]) || null;

/** The track whose tempo and words are closest to the prompt: the answer when the model call fails. */
export function closestTrack(musicPrompt: string, tracks: LibraryTrack[] = MUSIC_LIBRARY): LibraryTrack {
  const wanted = wordsOf(musicPrompt);
  const bpm = bpmOf(musicPrompt);
  let best = tracks[0];
  let bestScore = -Infinity;
  for (const candidate of tracks) {
    const shared = [...wordsOf(`${candidate.prompt} ${candidate.heard || ''}`)].filter((word) => wanted.has(word)).length;
    const score = shared - (bpm ? Math.abs(candidate.bpm - bpm) / 8 : 0);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/**
 * The library track that fits the director's music prompt: one small model call (about $0.0003), else closestTrack.
 * With the video ad's `script`, what the business sells and the mood of the message come first (owner 2026-10-08: an AI
 * receptionist ad about $8,700 of missed calls got the playful whistling track because the whiteboard look asked for
 * "playful"; the lead wrote back "the music in the background didn't work for me").
 */
export async function pickLibraryTrack(musicPrompt: string, tracks: LibraryTrack[] = MUSIC_LIBRARY, script = ''): Promise<LibraryTrack> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return closestTrack(musicPrompt, tracks);
  const list = tracks.map((t) => `${t.id}: ${t.bpm} BPM. ${t.heard || t.prompt}`).join('\n');
  const prompt = script.trim()
    ? `A video ad says this:\n"${script.trim()}"\n\nThe script writer asked for this background music:\n${musicPrompt}\n\nPick the track from this list that fits what the business sells and the mood of the message first: business software, AI, and money or time problems sound confident and modern; food, families and local services sound warm; luxury sounds elegant. The playful tracks (playful-1, playful-2) fit only businesses for children, pets, toys or parties, even when the request asks for playful music. Then match the tempo, then the instruments. Answer with the id only.\n\n${list}`
    : `A video ad needs this background music:\n${musicPrompt}\n\nPick the closest track from this list. Tempo and mood matter most, then the instruments. Answer with the id only.\n\n${list}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${PICK_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`${PICK_MODEL} failed (${res.status})`);
    const json = await res.json();
    usage.musicPick();
    const answer = String(json.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toLowerCase();
    return tracks.find((t) => answer.includes(t.id)) ?? closestTrack(musicPrompt, tracks);
  } catch (error) {
    console.warn('⚠️ Music pick failed, using the closest track:', String(error).slice(0, 120));
    return closestTrack(musicPrompt, tracks);
  }
}

/** The picked track's address, checked to be in storage (a missing file would break the render): null when it is not. */
export async function libraryTrackUrl(musicPrompt: string, script = ''): Promise<string | null> {
  const picked = await pickLibraryTrack(musicPrompt, MUSIC_LIBRARY, script);
  const url = libraryUrl(picked.id);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      console.log(`🎵 Music from the library: ${picked.id} (${picked.bpm} BPM)`);
      return url;
    }
  } catch {
    // Falls through: the song is made for this video instead.
  }
  console.warn(`⚠️ Library track ${picked.id} is not in storage; making a song instead`);
  return null;
}
