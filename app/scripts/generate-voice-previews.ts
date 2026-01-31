/**
 * Batch Voice Preview Generator
 *
 * Generates 5-10 second audio samples for all Minimax voices
 * and uploads them to Supabase storage.
 *
 * Run with: npx tsx scripts/generate-voice-previews.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';

// Initialize clients
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// All voice IDs and their sample scripts
const VOICE_SAMPLES: Record<string, { name: string; script: string }> = {
  // Professional Voices
  'Wise_Woman': {
    name: 'Victoria (Wise)',
    script: "Hello, I'm Victoria. I bring wisdom and authority to your professional content. Let me help you create something meaningful."
  },
  'Deep_Voice_Man': {
    name: 'Marcus (Deep)',
    script: "Hello, I'm Marcus. My deep, resonant voice commands attention and brings gravitas to your narration."
  },
  'Patient_Man': {
    name: 'Thomas (Patient)',
    script: "Hi there, I'm Thomas. I speak with patience and clarity, perfect for tutorials and educational content."
  },
  'Determined_Man': {
    name: 'David (Determined)',
    script: "Hello, I'm David. My focused and driven voice is perfect for motivational and inspiring content."
  },
  'Elegant_Man': {
    name: 'Sebastian (Elegant)',
    script: "Good day, I'm Sebastian. My refined and sophisticated voice adds elegance to luxury content."
  },

  // Natural Voices
  'Friendly_Person': {
    name: 'Alex (Friendly)',
    script: "Hey there! I'm Alex, and I'm warm and approachable. I make conversational content feel natural and engaging."
  },
  'Calm_Woman': {
    name: 'Serena (Calm)',
    script: "Hello, I'm Serena. My soothing and relaxed voice is ideal for meditation, wellness, and calming content."
  },
  'Casual_Guy': {
    name: 'Jake (Casual)',
    script: "Hey, what's up? I'm Jake. I keep things laid-back and conversational. Perfect for casual, everyday content."
  },
  'Lovely_Girl': {
    name: 'Sophie (Lovely)',
    script: "Hi! I'm Sophie. I have a sweet and pleasant voice that's perfect for friendly, approachable content."
  },
  'Decent_Boy': {
    name: 'Ethan (Clear)',
    script: "Hello, I'm Ethan. I speak clearly and politely, making me great for educational and informative content."
  },
  'Sweet_Girl_2': {
    name: 'Lily (Sweet)',
    script: "Hi there! I'm Lily. My gentle and friendly voice is perfect for approachable, welcoming content."
  },

  // Expressive Voices
  'Inspirational_girl': {
    name: 'Maya (Inspiring)',
    script: "Hello! I'm Maya, and I'm here to inspire and motivate you. Let's create something uplifting together!"
  },
  'Lively_Girl': {
    name: 'Zoe (Lively)',
    script: "Hey everyone! I'm Zoe! I bring energy and enthusiasm to everything I say. Let's make something exciting!"
  },
  'Exuberant_Girl': {
    name: 'Bella (Joyful)',
    script: "Hi! I'm Bella! I'm absolutely joyful and animated. I love bringing happiness to your content!"
  },

  // Character Voices
  'Young_Knight': {
    name: 'Aria (Adventurous)',
    script: "Hello, I'm Aria. I'll take you on adventurous journeys through storytelling."
  },
  'Imposing_Manner': {
    name: 'Miranda (Epic)',
    script: "Hello, I'm Miranda. My voice brings grand drama to epic narratives."
  },
  'Abbess': {
    name: 'Eleanor (Serene)',
    script: "Peace be with you. I am Eleanor. My wise and serene voice is suited for spiritual and thoughtful content."
  },

  // Extended Professional Voices
  'English_Trustworth_Man': {
    name: 'Ryan (Trustworthy)',
    script: "Hello, I'm Ryan. You can count on my reliable and confident voice for your corporate content."
  },
  'English_Diligent_Man': {
    name: 'Raj (Diligent)',
    script: "Hello, I'm Raj. My focused and diligent approach makes me ideal for instructional content."
  },
  'English_Graceful_Lady': {
    name: 'Grace (Graceful)',
    script: "Hello, I'm Grace. My elegant and poised voice brings sophistication to any content."
  },
  'English_ManWithDeepVoice': {
    name: 'Victor (Deep Voice)',
    script: "Hello, I'm Victor. My rich baritone voice makes a lasting impact in any narration."
  },
  'English_MaturePartner': {
    name: 'Michael (Mature)',
    script: "Hello, I'm Michael. My experienced and trustworthy voice is perfect for business content."
  },
  'English_MatureBoss': {
    name: 'Rhonda (Boss)',
    script: "Hello, I'm Rhonda. I bring authority and leadership presence to your professional content."
  },
  'English_Debator': {
    name: 'Nathaniel (Pirate)',
    script: "Ahoy, I'm Nathaniel. Bold and swashbuckling, ready for adventure!"
  },
  'English_Steadymentor': {
    name: 'William (Mentor)',
    script: "Hello, I'm William. My wise and guiding voice is perfect for educational mentorship."
  },
  'English_Deep-VoicedGentleman': {
    name: 'Henry (Gentleman)',
    script: "Good day, I'm Henry. My refined and distinguished voice adds class to luxury content."
  },
  'English_Wiselady': {
    name: 'Catherine (Wise Lady)',
    script: "Hello, I'm Catherine. My knowledgeable and insightful voice is ideal for advisory content."
  },
  'English_WiseScholar': {
    name: 'Edward (Scholar)',
    script: "Greetings, I'm Edward. My academic and learned voice brings depth to educational content."
  },
  'English_ConfidentWoman': {
    name: 'Olivia (Confident)',
    script: "Hello, I'm Olivia. My self-assured and bold voice empowers and inspires."
  },
  'English_PatientMan': {
    name: 'Benjamin (Patient)',
    script: "Hello, I'm Benjamin. My calm and understanding voice is perfect for tutorial content."
  },
  'English_BossyLeader': {
    name: 'Marcus (Leader)',
    script: "Hello, I'm Marcus. I deliver commanding authority for leadership content."
  },

  // Extended Natural Voices
  'English_CalmWoman': {
    name: 'Diana (Calm)',
    script: "Hello, I'm Diana. My peaceful and soothing voice brings relaxation to your content."
  },
  'English_Gentle-voiced_man': {
    name: 'Oliver (Gentle)',
    script: "Hello, I'm Oliver. My soft-spoken and kind voice is perfect for sensitive topics."
  },
  'English_ReservedYoungMan': {
    name: 'Liam (Reserved)',
    script: "Hello, I'm Liam. My quiet and thoughtful voice suits introspective content well."
  },
  'English_FriendlyPerson': {
    name: 'Jordan (Friendly)',
    script: "Hey there! I'm Jordan. I'm warm and welcoming, perfect for conversational content."
  },
  'English_LovelyGirl': {
    name: 'Chloe (Lovely)',
    script: "Hi! I'm Chloe. My sweet and charming voice makes friendly content shine."
  },
  'English_DecentYoungMan': {
    name: 'Lucas (Decent)',
    script: "Hello, I'm Lucas. My polite and respectful voice is ideal for formal content."
  },
  'English_Soft-spokenGirl': {
    name: 'Ivy (Soft-Spoken)',
    script: "Hello, I'm Ivy. My gentle, whisper-like voice is perfect for ASMR and intimate content."
  },
  'English_SereneWoman': {
    name: 'Aurora (Serene)',
    script: "Hello, I'm Aurora. My tranquil and peaceful voice guides meditation and relaxation."
  },
  'English_Kind-heartedGirl': {
    name: 'Emily (Kind)',
    script: "Hi! I'm Emily. My compassionate and caring voice brings warmth to heartfelt content."
  },

  // Extended Expressive Voices
  'English_UpsetGirl': {
    name: 'Mia (Upset)',
    script: "I'm Mia. Sometimes emotions run deep, and my voice captures those intense dramatic moments."
  },
  'English_Whispering_girl': {
    name: 'Luna (Whisper)',
    script: "Shh, I'm Luna. My soft whisper is perfect for intimate moments and ASMR content."
  },
  'English_PlayfulGirl': {
    name: 'Emma (Playful)',
    script: "Hey! I'm Emma! I'm fun and a little mischievous. Let's make something entertaining!"
  },
  'English_CaptivatingStoryteller': {
    name: 'Charles (Storyteller)',
    script: "Hello, I'm Charles. I'm a confident storyteller for captivating narratives."
  },
  'English_SentimentalLady': {
    name: 'Isabella (Sentimental)',
    script: "Hello, I'm Isabella. My emotional and touching voice is perfect for heartfelt moments."
  },
  'English_SadTeen': {
    name: 'Nate (Direct)',
    script: "Hey, I'm Nate. Energetic, direct, and ready to cut to the chase."
  },
  'English_Strong-WilledBoy': {
    name: 'Daniel (Strong-Willed)',
    script: "Hey, I'm Daniel! I'm determined and passionate about motivational content!"
  },
  'English_StressedLady': {
    name: 'Rachel (Stressed)',
    script: "Oh, hi! I'm Rachel. I bring urgency and tension to dramatic scenes. It's intense!"
  },
  'English_Jovialman': {
    name: 'George (Friendly)',
    script: "Hello, I'm George. My deep, friendly voice is perfect for warm content."
  },
  'English_WhimsicalGirl': {
    name: 'Poppy (Whimsical)',
    script: "Hi! I'm Poppy! I'm quirky and imaginative, perfect for creative and playful content!"
  },

  // Extended Character Voices
  'English_Aussie_Bloke': {
    name: 'Jack (Aussie)',
    script: "G'day mate! I'm Jack. My Australian accent brings a casual, friendly vibe to your content."
  },
  'English_ImposingManner': {
    name: 'Maxine (Imposing)',
    script: "Hello, I'm Maxine. Grand and commanding for your epic narratives."
  },
  'English_PassionateWarrior': {
    name: 'Alexander (Warrior)',
    script: "I am Alexander! My fierce and brave voice is ready for action and adventure content!"
  },
  'English_Comedian': {
    name: 'Charlie (Comedian)',
    script: "Hey folks, I'm Charlie! I bring the laughs with my witty delivery. Comedy's my game!"
  },
  'English_AssertiveQueen': {
    name: 'Elizabeth (Queen)',
    script: "I am Elizabeth. My royal and commanding presence brings authority to regal content."
  },
  'English_AnimeCharacter': {
    name: 'Hiro (Anime)',
    script: "Hey! I'm Hiro! My anime-style voice is perfect for animated and fun content!"
  }
};

async function generateVoicePreview(voiceId: string, script: string): Promise<string | null> {
  try {
    console.log(`🎤 Generating preview for ${voiceId}...`);

    // Generate audio using Minimax
    const result = await replicate.run('minimax/speech-2.6-hd', {
      input: {
        text: script,
        voice_id: voiceId,
        speed: 1.0,
        pitch: 0,
        volume: 1, // Low volume to prevent clipping
        emotion: 'auto',
        output_format: 'mp3'
      }
    });
    const output = result as unknown as string;

    if (!output) {
      throw new Error('No audio output received');
    }

    console.log(`📥 Received audio from Minimax`);

    // Download the audio file
    const response = await fetch(output);
    const audioBuffer = await response.arrayBuffer();

    // Upload to Supabase
    const storagePath = `voices/minimax/${voiceId.toLowerCase()}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from('script-videos')
      .upload(storagePath, Buffer.from(audioBuffer), {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('script-videos')
      .getPublicUrl(storagePath);

    console.log(`✅ Uploaded: ${urlData.publicUrl}`);

    return urlData.publicUrl;

  } catch (error) {
    console.error(`❌ Failed for ${voiceId}:`, error);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting voice preview generation...\n');

  const voiceIds = Object.keys(VOICE_SAMPLES);
  const results: Record<string, string> = {};
  const failed: string[] = [];

  // Process voices sequentially to avoid rate limiting
  for (let i = 0; i < voiceIds.length; i++) {
    const voiceId = voiceIds[i];
    const { script } = VOICE_SAMPLES[voiceId];

    console.log(`\n[${i + 1}/${voiceIds.length}] Processing ${voiceId}`);

    const previewUrl = await generateVoicePreview(voiceId, script);

    if (previewUrl) {
      results[voiceId] = previewUrl;
    } else {
      failed.push(voiceId);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n\n=== GENERATION COMPLETE ===\n');
  console.log(`✅ Successful: ${Object.keys(results).length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed voices:', failed.join(', '));
  }

  console.log('\n\n=== COPY THESE URLs TO voice-constants.ts ===\n');

  for (const [voiceId, url] of Object.entries(results)) {
    console.log(`  '${voiceId}': '${url}',`);
  }
}

main().catch(console.error);
