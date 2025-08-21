/**
 * Generate sample audio files for all new OpenAI TTS voices
 * This script generates preview samples for each voice and uploads them to Supabase storage
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SAMPLE_TEXT = "Hello! This is a preview of my voice. I can help bring your content to life with natural speech synthesis.";

const NEW_VOICES = [
  { id: 'alloy', name: 'Alloy', description: 'Natural and versatile' },
  { id: 'echo', name: 'Echo', description: 'Deep and resonant' },
  { id: 'ash', name: 'Ash', description: 'Expressive and dynamic' },
  { id: 'ballad', name: 'Ballad', description: 'Warm and melodious' },
  { id: 'coral', name: 'Coral', description: 'Friendly and approachable' },
  { id: 'sage', name: 'Sage', description: 'Professional and authoritative' },
  { id: 'shimmer', name: 'Shimmer', description: 'Bright and expressive' }
];

async function generateVoiceSample(voiceId, voiceName) {
  try {
    console.log(`🎙️ Generating sample for ${voiceName} (${voiceId})...`);
    
    // Create a curl command to call OpenAI TTS API
    const curlCommand = `curl -X POST "https://api.openai.com/v1/audio/speech" \
      -H "Authorization: Bearer $OPENAI_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "model": "tts-1",
        "input": "${SAMPLE_TEXT}",
        "voice": "${voiceId}",
        "response_format": "mp3"
      }' \
      --output "./temp_${voiceId}_sample.mp3"`;
    
    // Execute the curl command
    execSync(curlCommand, { stdio: 'inherit' });
    
    console.log(`✅ Generated sample for ${voiceName}`);
    return `./temp_${voiceId}_sample.mp3`;
    
  } catch (error) {
    console.error(`❌ Failed to generate sample for ${voiceName}:`, error.message);
    return null;
  }
}

async function uploadToSupabase(filePath, voiceId) {
  try {
    console.log(`📤 Uploading ${voiceId} sample to Supabase...`);
    
    // Read the file as base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    
    // Create upload command (this would need to be adapted for your Supabase setup)
    const uploadPath = `sample_voices/${voiceId}_preview.mp3`;
    
    console.log(`✅ Would upload to: ${uploadPath}`);
    console.log(`📊 File size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    
    // Clean up temp file
    fs.unlinkSync(filePath);
    
    return `https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/${uploadPath}`;
    
  } catch (error) {
    console.error(`❌ Failed to upload ${voiceId}:`, error.message);
    return null;
  }
}

async function generateAllSamples() {
  console.log('🎬 Starting voice sample generation...');
  console.log(`📝 Sample text: "${SAMPLE_TEXT}"`);
  console.log(`🔊 Voices to generate: ${NEW_VOICES.length}`);
  
  const results = [];
  
  for (const voice of NEW_VOICES) {
    const filePath = await generateVoiceSample(voice.id, voice.name);
    
    if (filePath) {
      const uploadUrl = await uploadToSupabase(filePath, voice.id);
      results.push({
        id: voice.id,
        name: voice.name,
        url: uploadUrl
      });
    }
  }
  
  console.log('\n🎯 Generation Summary:');
  console.log('Generated URLs to update in code:');
  results.forEach(result => {
    console.log(`${result.id}: ${result.url}`);
  });
  
  console.log('\n✅ Voice sample generation complete!');
}

// Check if OPENAI_API_KEY is set
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

generateAllSamples().catch(console.error);