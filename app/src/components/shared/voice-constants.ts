/**
 * Shared Voice Constants - Minimax Speech 2.6 HD Voice Options
 *
 * Complete set of Minimax Text-to-Speech voices for consistent use across all tools:
 * - Script-to-Video Generator
 * - Talking Avatar Generator
 * - Voice-Over Generator
 *
 * Updated January 2025 with 17 core + 39 extended English voices (56 total)
 */

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  description: string;
  preview_url: string;
  category?: 'natural' | 'professional' | 'expressive' | 'character';
}

export type MinimaxEmotion = 'auto' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'neutral';

// Complete Minimax TTS voice options - 17 core + 39 extended English voices
export const MINIMAX_VOICE_OPTIONS: VoiceOption[] = [
  // Professional Voices
  {
    id: 'Wise_Woman',
    name: 'Victoria (Wise)',
    gender: 'female',
    description: 'Mature and authoritative, great for professional content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/wise_woman.mp3',
    category: 'professional'
  },
  {
    id: 'Deep_Voice_Man',
    name: 'Marcus (Deep)',
    gender: 'male',
    description: 'Deep and commanding voice for impactful narration',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/deep_voice_man.mp3',
    category: 'professional'
  },
  {
    id: 'Patient_Man',
    name: 'Thomas (Patient)',
    gender: 'male',
    description: 'Steady and reassuring, perfect for tutorials',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/patient_man.mp3',
    category: 'professional'
  },
  {
    id: 'Determined_Man',
    name: 'David (Determined)',
    gender: 'male',
    description: 'Focused and driven voice for motivational content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/determined_man.mp3',
    category: 'professional'
  },
  {
    id: 'Elegant_Man',
    name: 'Sebastian (Elegant)',
    gender: 'male',
    description: 'Refined and sophisticated for luxury content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/elegant_man.mp3',
    category: 'professional'
  },

  // Natural Voices
  {
    id: 'Friendly_Person',
    name: 'Alex (Friendly)',
    gender: 'neutral',
    description: 'Warm and approachable for conversational content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/friendly_person.mp3',
    category: 'natural'
  },
  {
    id: 'Calm_Woman',
    name: 'Serena (Calm)',
    gender: 'female',
    description: 'Soothing and relaxed for meditation or wellness',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/calm_woman.mp3',
    category: 'natural'
  },
  {
    id: 'Casual_Guy',
    name: 'Jake (Casual)',
    gender: 'male',
    description: 'Laid-back and conversational for casual content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/casual_guy.mp3',
    category: 'natural'
  },
  {
    id: 'Lovely_Girl',
    name: 'Sophie (Lovely)',
    gender: 'female',
    description: 'Sweet and pleasant for friendly content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/lovely_girl.mp3',
    category: 'natural'
  },
  {
    id: 'Decent_Boy',
    name: 'Ethan (Clear)',
    gender: 'male',
    description: 'Polite and clear for educational content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/decent_boy.mp3',
    category: 'natural'
  },
  {
    id: 'Sweet_Girl_2',
    name: 'Lily (Sweet)',
    gender: 'female',
    description: 'Gentle and friendly for approachable content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/sweet_girl_2.mp3',
    category: 'natural'
  },

  // Expressive Voices
  {
    id: 'Inspirational_girl',
    name: 'Maya (Inspiring)',
    gender: 'female',
    description: 'Motivating and uplifting for inspiring content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/inspirational_girl.mp3',
    category: 'expressive'
  },
  {
    id: 'Lively_Girl',
    name: 'Zoe (Lively)',
    gender: 'female',
    description: 'Energetic and enthusiastic for engaging content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/lively_girl.mp3',
    category: 'expressive'
  },
  {
    id: 'Exuberant_Girl',
    name: 'Bella (Joyful)',
    gender: 'female',
    description: 'Joyful and animated for fun content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/exuberant_girl.mp3',
    category: 'expressive'
  },

  // Character Voices
  {
    id: 'Young_Knight',
    name: 'Aria (Adventurous)',
    gender: 'female',
    description: 'Youthful and adventurous for storytelling',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/young_knight.mp3?v=2',
    category: 'character'
  },
  {
    id: 'Imposing_Manner',
    name: 'Miranda (Epic)',
    gender: 'female',
    description: 'Grand and dramatic for epic narratives',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/imposing_manner.mp3?v=2',
    category: 'character'
  },
  {
    id: 'Abbess',
    name: 'Eleanor (Serene)',
    gender: 'female',
    description: 'Wise and serene for spiritual content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/abbess.mp3',
    category: 'character'
  },

  // ============================================
  // Extended English Voices (39 additional voices)
  // ============================================

  // Extended Professional Voices
  {
    id: 'English_Trustworth_Man',
    name: 'Ryan (Trustworthy)',
    gender: 'male',
    description: 'Reliable and confident for corporate content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_trustworth_man.mp3',
    category: 'professional'
  },
  {
    id: 'English_Diligent_Man',
    name: 'Raj (Diligent)',
    gender: 'male',
    description: 'Focused instructional voice with Indian English accent',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_diligent_man.mp3?v=2',
    category: 'professional'
  },
  {
    id: 'English_Graceful_Lady',
    name: 'Grace (Graceful)',
    gender: 'female',
    description: 'Elegant and poised for sophisticated content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_graceful_lady.mp3',
    category: 'professional'
  },
  {
    id: 'English_ManWithDeepVoice',
    name: 'Victor (Deep Voice)',
    gender: 'male',
    description: 'Rich baritone for impactful narration',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_manwithdeepvoice.mp3',
    category: 'professional'
  },
  {
    id: 'English_MaturePartner',
    name: 'Michael (Mature)',
    gender: 'male',
    description: 'Experienced and trustworthy for business content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_maturepartner.mp3',
    category: 'professional'
  },
  {
    id: 'English_MatureBoss',
    name: 'Rhonda (Boss)',
    gender: 'female',
    description: 'Authoritative African American executive, 40-50, for leadership content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_matureboss.mp3?v=2',
    category: 'professional'
  },
  {
    id: 'English_Debator',
    name: 'Nathaniel (Pirate)',
    gender: 'male',
    description: 'Bold and swashbuckling, pirate-style delivery',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_debator.mp3?v=2',
    category: 'character'
  },
  {
    id: 'English_Steadymentor',
    name: 'William (Mentor)',
    gender: 'male',
    description: 'Wise and guiding for educational content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_steadymentor.mp3',
    category: 'professional'
  },
  {
    id: 'English_Deep-VoicedGentleman',
    name: 'Henry (Gentleman)',
    gender: 'male',
    description: 'Refined and distinguished for luxury content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_deep-voicedgentleman.mp3',
    category: 'professional'
  },
  {
    id: 'English_Wiselady',
    name: 'Catherine (Wise Lady)',
    gender: 'female',
    description: 'Knowledgeable and insightful for advisory content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_wiselady.mp3',
    category: 'professional'
  },
  {
    id: 'English_WiseScholar',
    name: 'Edward (Scholar)',
    gender: 'male',
    description: 'Academic and learned for educational content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_wisescholar.mp3',
    category: 'professional'
  },
  {
    id: 'English_ConfidentWoman',
    name: 'Olivia (Confident)',
    gender: 'female',
    description: 'Self-assured and bold for empowering content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_confidentwoman.mp3',
    category: 'professional'
  },
  {
    id: 'English_PatientMan',
    name: 'Benjamin (Patient)',
    gender: 'male',
    description: 'Calm and understanding for tutorial content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_patientman.mp3',
    category: 'professional'
  },
  {
    id: 'English_BossyLeader',
    name: 'Marcus (Leader)',
    gender: 'male',
    description: 'Commanding and authoritative for leadership content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_bossyleader.mp3?v=2',
    category: 'professional'
  },

  // Extended Natural Voices
  {
    id: 'English_CalmWoman',
    name: 'Diana (Calm)',
    gender: 'female',
    description: 'Peaceful and soothing for relaxation content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_calmwoman.mp3',
    category: 'natural'
  },
  {
    id: 'English_Gentle-voiced_man',
    name: 'Oliver (Gentle)',
    gender: 'male',
    description: 'Soft-spoken and kind for sensitive content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_gentle-voiced_man.mp3',
    category: 'natural'
  },
  {
    id: 'English_ReservedYoungMan',
    name: 'Liam (Reserved)',
    gender: 'male',
    description: 'Quiet and thoughtful for introspective content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_reservedyoungman.mp3',
    category: 'natural'
  },
  {
    id: 'English_FriendlyPerson',
    name: 'Jordan (Friendly)',
    gender: 'neutral',
    description: 'Warm and welcoming for conversational content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_friendlyperson.mp3',
    category: 'natural'
  },
  {
    id: 'English_LovelyGirl',
    name: 'Chloe (Lovely)',
    gender: 'female',
    description: 'Sweet and charming for friendly content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_lovelygirl.mp3',
    category: 'natural'
  },
  {
    id: 'English_DecentYoungMan',
    name: 'Lucas (Decent)',
    gender: 'male',
    description: 'Polite and respectful for formal content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_decentyoungman.mp3',
    category: 'natural'
  },
  {
    id: 'English_Soft-spokenGirl',
    name: 'Ivy (Soft-Spoken)',
    gender: 'female',
    description: 'Gentle whisper-like voice for ASMR content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_soft-spokengirl.mp3',
    category: 'natural'
  },
  {
    id: 'English_SereneWoman',
    name: 'Aurora (Serene)',
    gender: 'female',
    description: 'Tranquil and peaceful for meditation content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_serenewoman.mp3',
    category: 'natural'
  },
  {
    id: 'English_Kind-heartedGirl',
    name: 'Emily (Kind)',
    gender: 'female',
    description: 'Compassionate and caring for heartfelt content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_kind-heartedgirl.mp3',
    category: 'natural'
  },

  // Extended Expressive Voices
  {
    id: 'English_UpsetGirl',
    name: 'Mia (Upset)',
    gender: 'female',
    description: 'Emotional and distressed for dramatic content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_upsetgirl.mp3',
    category: 'expressive'
  },
  {
    id: 'English_Whispering_girl',
    name: 'Luna (Whisper)',
    gender: 'female',
    description: 'Soft whisper for intimate or ASMR content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_whispering_girl.mp3',
    category: 'expressive'
  },
  {
    id: 'English_PlayfulGirl',
    name: 'Emma (Playful)',
    gender: 'female',
    description: 'Fun and mischievous for entertaining content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_playfulgirl.mp3',
    category: 'expressive'
  },
  {
    id: 'English_CaptivatingStoryteller',
    name: 'Charles (Storyteller)',
    gender: 'male',
    description: 'Confident male narrator for captivating stories',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_captivatingstoryteller.mp3?v=2',
    category: 'expressive'
  },
  {
    id: 'English_SentimentalLady',
    name: 'Isabella (Sentimental)',
    gender: 'female',
    description: 'Emotional and touching for heartfelt content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_sentimentallady.mp3',
    category: 'expressive'
  },
  {
    id: 'English_SadTeen',
    name: 'Nate (Direct)',
    gender: 'male',
    description: 'Energetic, cutting, and direct delivery',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_sadteen.mp3?v=2',
    category: 'expressive'
  },
  {
    id: 'English_Strong-WilledBoy',
    name: 'Daniel (Strong-Willed)',
    gender: 'male',
    description: 'Determined and passionate for motivational content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_strong-willedboy.mp3',
    category: 'expressive'
  },
  {
    id: 'English_StressedLady',
    name: 'Rachel (Stressed)',
    gender: 'female',
    description: 'Anxious and hurried for dramatic scenes',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_stressedlady.mp3',
    category: 'expressive'
  },
  {
    id: 'English_Jovialman',
    name: 'George (Friendly)',
    gender: 'male',
    description: 'Deep and friendly voice for warm content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_jovialman.mp3?v=2',
    category: 'natural'
  },
  {
    id: 'English_WhimsicalGirl',
    name: 'Poppy (Whimsical)',
    gender: 'female',
    description: 'Quirky and imaginative for creative content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_whimsicalgirl.mp3',
    category: 'expressive'
  },

  // Extended Character Voices
  {
    id: 'English_Aussie_Bloke',
    name: 'Jack (Aussie)',
    gender: 'male',
    description: 'Australian accent for casual, friendly content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_aussie_bloke.mp3',
    category: 'character'
  },
  {
    id: 'English_ImposingManner',
    name: 'Maxine (Imposing)',
    gender: 'female',
    description: 'Grand and commanding for epic narratives',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_imposingmanner.mp3?v=2',
    category: 'character'
  },
  {
    id: 'English_PassionateWarrior',
    name: 'Alexander (Warrior)',
    gender: 'male',
    description: 'Fierce and brave for action content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_passionatewarrior.mp3',
    category: 'character'
  },
  {
    id: 'English_Comedian',
    name: 'Charlie (Comedian)',
    gender: 'male',
    description: 'Funny and witty for comedy content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_comedian.mp3',
    category: 'character'
  },
  {
    id: 'English_AssertiveQueen',
    name: 'Elizabeth (Queen)',
    gender: 'female',
    description: 'Royal and commanding for regal content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_assertivequeen.mp3',
    category: 'character'
  },
  {
    id: 'English_AnimeCharacter',
    name: 'Hiro (Anime)',
    gender: 'neutral',
    description: 'Anime-style voice for animated content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/english_animecharacter.mp3',
    category: 'character'
  }
];

// Voice settings interface for Minimax controls
export interface VoiceSettings {
  voice_id: string;
  speed: number; // 0.5 - 2.0
  pitch: number; // -12 to 12 semitones
  volume: number; // 0 to 10
  emotion: MinimaxEmotion;
}

// Export format options
export type VoiceExportFormat = 'mp3' | 'wav' | 'flac';
export type VoiceQuality = 'standard' | 'hd';

// Emotion options for UI
export const EMOTION_OPTIONS: { value: MinimaxEmotion; label: string }[] = [
  { value: 'auto', label: 'Auto (Natural)' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'happy', label: 'Happy' },
  { value: 'sad', label: 'Sad' },
  { value: 'angry', label: 'Angry' },
  { value: 'fearful', label: 'Fearful' },
  { value: 'disgusted', label: 'Disgusted' },
  { value: 'surprised', label: 'Surprised' }
];

// Helper functions
export const getVoicesByGender = (gender: 'male' | 'female' | 'neutral') =>
  MINIMAX_VOICE_OPTIONS.filter(voice => voice.gender === gender);

export const getVoicesByCategory = (category: VoiceOption['category']) =>
  MINIMAX_VOICE_OPTIONS.filter(voice => voice.category === category);

export const getVoiceById = (id: string) =>
  MINIMAX_VOICE_OPTIONS.find(voice => voice.id === id);

// Default voice settings for Minimax
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voice_id: 'Friendly_Person',
  speed: 1.0,
  pitch: 0,
  volume: 1,  // Low volume to prevent clipping
  emotion: 'auto'
};

// Speed preset mappings
export const SPEED_PRESETS = {
  slower: 0.75,
  normal: 1.0,
  faster: 1.25
} as const;
