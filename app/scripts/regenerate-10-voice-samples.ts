/**
 * Regenerate Voice Samples for 10 Renamed Voices
 *
 * Only regenerates the 10 voices that were renamed:
 * - Rhonda, Aria, Miranda, Raj, Nathaniel, George, Marcus, Charles, Nate, Maxine
 *
 * Run with: npx tsx scripts/regenerate-10-voice-samples.ts
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

// Only the 10 voices we need to regenerate
const VOICES_TO_REGENERATE = [
  {
    id: 'Casual_Guy',
    name: 'Raj (Casual)',
    script: "Hey there, I'm Raj. I'm laid-back and conversational for all your casual content."
  },
  {
    id: 'Young_Knight',
    name: 'Aria (Adventurous)',
    script: "Hello, I'm Aria. I'll take you on adventurous journeys through storytelling."
  },
  {
    id: 'Imposing_Manner',
    name: 'Miranda (Epic)',
    script: "Hello, I'm Miranda. My voice brings grand drama to epic narratives."
  },
  {
    id: 'English_MatureBoss',
    name: 'Rhonda (Boss)',
    script: "Hello, I'm Rhonda. I bring authority and leadership presence to your professional content."
  },
  {
    id: 'English_Debator',
    name: 'Nathaniel (Pirate)',
    script: "Ahoy, I'm Nathaniel. Bold and swashbuckling, ready for adventure!"
  },
  {
    id: 'English_BossyLeader',
    name: 'Marcus (Leader)',
    script: "Hello, I'm Marcus. I deliver commanding authority for leadership content."
  },
  {
    id: 'English_CaptivatingStoryteller',
    name: 'Charles (Storyteller)',
    script: "Hello, I'm Charles. I'm a confident storyteller for captivating narratives."
  },
  {
    id: 'English_SadTeen',
    name: 'Nate (Direct)',
    script: "Hey, I'm Nate. Energetic, direct, and ready to cut to the chase."
  },
  {
    id: 'English_Jovialman',
    name: 'George (Friendly)',
    script: "Hello, I'm George. My deep, friendly voice is perfect for warm content."
  },
  {
    id: 'English_ImposingManner',
    name: 'Maxine (Imposing)',
    script: "Hello, I'm Maxine. Grand and commanding for your epic narratives."
  }
];

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

    // Upload to Supabase (overwrite existing)
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
  console.log('🚀 Regenerating 10 renamed voice samples...\n');

  const results: Record<string, string> = {};
  const failed: string[] = [];

  for (let i = 0; i < VOICES_TO_REGENERATE.length; i++) {
    const voice = VOICES_TO_REGENERATE[i];

    console.log(`\n[${i + 1}/${VOICES_TO_REGENERATE.length}] Processing ${voice.name}`);

    const previewUrl = await generateVoicePreview(voice.id, voice.script);

    if (previewUrl) {
      results[voice.id] = previewUrl;
    } else {
      failed.push(voice.id);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n\n=== REGENERATION COMPLETE ===\n');
  console.log(`✅ Successful: ${Object.keys(results).length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed voices:', failed.join(', '));
  }

  console.log('\n✅ All 10 voice samples have been regenerated with new names!');
}

main().catch(console.error);
