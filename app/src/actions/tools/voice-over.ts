'use server';

import { createClient } from '@/app/supabase/server';
import { uploadImageToStorage } from '@/actions/supabase-storage';

// Request/Response types for Voice Over
export interface VoiceOverRequest {
  script_text: string;
  voice_id: string;
  voice_settings?: {
    speed?: number; // 0.25 to 4.0
    pitch?: number; // -20 to 20 semitones
    volume?: number; // 0.0 to 1.0
    emphasis?: 'strong' | 'moderate' | 'none';
  };
  export_format?: 'mp3' | 'wav' | 'ogg';
  quality?: 'standard' | 'hd';
  use_ssml?: boolean;
  user_id: string;
}

export interface VoiceOverResponse {
  success: boolean;
  generated_audio?: {
    id: string;
    audio_url: string;
    voice_id: string;
    voice_name: string;
    script_text: string;
    duration_seconds: number;
    file_size_mb: number;
    export_format: string;
    created_at: string;
  };
  voice_options?: VoiceOption[];
  batch_id: string;
  generation_time_ms: number;
  credits_used: number;
  remaining_credits: number;
  warnings?: string[];
  error?: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  accent: string;
  preview_url?: string;
  description: string;
  category: 'natural' | 'professional' | 'expressive' | 'character';
  supports_ssml: boolean;
}

export interface GeneratedVoice {
  id: string;
  user_id: string;
  script_text: string;
  voice_id: string;
  voice_name: string;
  audio_url: string;
  duration_seconds: number;
  file_size_mb: number;
  export_format: string;
  voice_settings?: any;
  batch_id: string;
  credits_used: number;
  created_at: string;
}

/**
 * Voice Over - AI orchestrator for professional voice generation
 * 
 * Features:
 * - Advanced OpenAI TTS with custom settings
 * - Multiple export formats (MP3, WAV, OGG)
 * - SSML support for advanced speech control
 * - Professional voice options and settings
 * - Credit cost calculation (2 credits per voice generation)
 * - Voice history and management
 */
export async function executeVoiceOver(
  request: VoiceOverRequest
): Promise<VoiceOverResponse> {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    // Get authenticated user from server session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        success: false,
        error: 'Authentication required',
        batch_id: '',
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Use server-side authenticated user ID
    const authenticatedRequest = {
      ...request,
      user_id: user.id,
    };
    
    // Generate unique batch ID
    const batch_id = `voice_over_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate credit costs
    const creditCosts = calculateVoiceOverCreditCost(authenticatedRequest);
    
    // Verify user has sufficient credits
    const userCredits = await getUserCredits(supabase, user.id);
    if (userCredits < creditCosts.total) {
      return {
        success: false,
        error: `Insufficient credits. Required: ${creditCosts.total}, Available: ${userCredits}`,
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: userCredits,
      };
    }

    // Generate single voice
    const voiceId = authenticatedRequest.voice_id;
    let generatedAudio: any = null;
    let totalCreditsUsed = 0;

    try {
      console.log(`🎙️ Generating voice for: ${voiceId}`);
      
      // Generate audio with enhanced settings
      const audioUrl = await generateEnhancedVoiceAudio(
        authenticatedRequest.script_text,
        voiceId,
        authenticatedRequest.voice_settings,
        authenticatedRequest.export_format || 'mp3',
        authenticatedRequest.quality || 'standard',
        authenticatedRequest.use_ssml || false
      );

      // Get voice details
      const voiceDetails = getVoiceDetails(voiceId);
      
      // Calculate audio duration and file size (estimate)
      const wordCount = authenticatedRequest.script_text.trim().split(/\s+/).length;
      const estimatedDuration = Math.ceil(wordCount / 2.5); // ~2.5 words per second
      const estimatedFileSize = estimatedDuration * 0.125; // ~125KB per second for MP3

      // Create database record
      const { data: voiceRecord, error: dbError } = await supabase
        .from('generated_voices')
        .insert({
          id: `${batch_id}_${voiceId}`,
          user_id: user.id,
          text_content: authenticatedRequest.script_text,
          script_text: authenticatedRequest.script_text,
          voice_id: voiceId,
          voice_name: voiceDetails.name,
          voice_provider: 'openai',
          audio_format: authenticatedRequest.export_format || 'mp3',
          audio_url: audioUrl,
          duration_seconds: estimatedDuration,
          file_size_mb: Number(estimatedFileSize.toFixed(2)),
          export_format: authenticatedRequest.export_format || 'mp3',
          voice_settings: authenticatedRequest.voice_settings,
          batch_id,
          credits_used: creditCosts.per_voice,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database insert error:', dbError);
        throw new Error('Failed to save voice generation record');
      }

      generatedAudio = {
        id: voiceRecord.id,
        audio_url: audioUrl,
        voice_id: voiceId,
        voice_name: voiceDetails.name,
        script_text: authenticatedRequest.script_text,
        duration_seconds: estimatedDuration,
        file_size_mb: estimatedFileSize,
        export_format: authenticatedRequest.export_format || 'mp3',
        created_at: voiceRecord.created_at,
      };

      totalCreditsUsed = creditCosts.per_voice;
      
    } catch (error) {
      console.error(`Voice generation failed for ${voiceId}:`, error);
      throw error;
    }

    // Deduct credits only for successful generations
    if (totalCreditsUsed > 0) {
      await deductCredits(supabase, user.id, totalCreditsUsed, batch_id, 'voice_over_generation');
    }

    return {
      success: generatedAudio !== null,
      generated_audio: generatedAudio,
      voice_options: getVoiceOptions(),
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: totalCreditsUsed,
      remaining_credits: userCredits - totalCreditsUsed,
    };

  } catch (error) {
    console.error('Voice Over execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Voice generation failed',
      batch_id: `error_${Date.now()}`,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

/**
 * Generate enhanced voice audio with advanced settings
 */
async function generateEnhancedVoiceAudio(
  scriptText: string,
  voiceId: string,
  settings: VoiceOverRequest['voice_settings'] = {},
  format: string = 'mp3',
  quality: string = 'standard',
  useSSML: boolean = false
): Promise<string> {
  try {
    // Prepare the input text with SSML if enabled
    let inputText = scriptText;
    if (useSSML && !scriptText.includes('<speak>')) {
      inputText = `<speak>${scriptText}</speak>`;
    }

    // Apply voice settings through SSML
    if (settings.speed && settings.speed !== 1.0) {
      inputText = `<prosody rate="${settings.speed}">${inputText}</prosody>`;
    }
    if (settings.pitch && settings.pitch !== 0) {
      const pitchValue = settings.pitch > 0 ? `+${settings.pitch}st` : `${settings.pitch}st`;
      inputText = `<prosody pitch="${pitchValue}">${inputText}</prosody>`;
    }
    if (settings.emphasis && settings.emphasis !== 'none') {
      inputText = `<emphasis level="${settings.emphasis}">${inputText}</emphasis>`;
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: quality === 'hd' ? 'tts-1-hd' : 'tts-1',
        input: inputText,
        voice: voiceId,
        response_format: format,
        speed: settings.speed || 1.0,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS API error: ${response.status} ${response.statusText}`);
    }

    // Get the audio blob
    const audioBlob = await response.blob();
    
    // Upload to Supabase Storage
    const audioFile = new File([audioBlob], `voice_${Date.now()}.${format}`, { 
      type: format === 'mp3' ? 'audio/mpeg' : `audio/${format}` 
    });
    
    const uploadResult = await uploadImageToStorage(audioFile, {
      bucket: 'audio',
      folder: 'voice-overs',
      filename: `voice_over_${Date.now()}.${format}`,
      contentType: format === 'mp3' ? 'audio/mpeg' : `audio/${format}`,
    });

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Audio upload failed');
    }

    return uploadResult.url || '';

  } catch (error) {
    console.error('Enhanced voice generation error:', error);
    throw error;
  }
}

/**
 * Get available voice options with enhanced details
 */
function getVoiceOptions(): VoiceOption[] {
  return [
    {
      id: 'alloy',
      name: 'Alloy',
      gender: 'female',
      accent: 'neutral',
      description: 'Natural and versatile voice, great for narration',
      category: 'natural',
      supports_ssml: true,
      preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/female_01.mp3'
    },
    {
      id: 'nova',
      name: 'Nova',
      gender: 'female',
      accent: 'neutral',
      description: 'Warm and engaging voice, perfect for presentations',
      category: 'professional',
      supports_ssml: true,
      preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/female_2.mp3'
    },
    {
      id: 'shimmer',
      name: 'Shimmer',
      gender: 'female',
      accent: 'neutral',
      description: 'Bright and expressive voice, ideal for storytelling',
      category: 'expressive',
      supports_ssml: true,
      preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/female_3.mp3'
    },
    {
      id: 'echo',
      name: 'Echo',
      gender: 'male',
      accent: 'neutral',
      description: 'Deep and resonant voice, excellent for documentaries',
      category: 'professional',
      supports_ssml: true,
      preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/male_1.mp3'
    },
    {
      id: 'onyx',
      name: 'Onyx',
      gender: 'male',
      accent: 'neutral',
      description: 'Professional and clear voice, perfect for business',
      category: 'professional',
      supports_ssml: true,
      preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/male_2.mp3'
    },
    {
      id: 'fable',
      name: 'Fable',
      gender: 'neutral',
      accent: 'neutral',
      description: 'Versatile storytelling voice with character',
      category: 'character',
      supports_ssml: true,
      preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/neutral_1.mp3'
    }
  ];
}

/**
 * Get voice details by ID
 */
function getVoiceDetails(voiceId: string): VoiceOption {
  const voices = getVoiceOptions();
  return voices.find(v => v.id === voiceId) || voices[0];
}

/**
 * Calculate credit costs for voice over operations
 */
function calculateVoiceOverCreditCost(request: VoiceOverRequest) {
  const wordCount = request.script_text.trim().split(/\s+/).length;
  const baseCost = 2; // Base cost per voice generation
  
  // Quality multiplier
  let qualityMultiplier = 1;
  if (request.quality === 'hd') {
    qualityMultiplier = 1.5;
  }
  
  // Format multiplier
  let formatMultiplier = 1;
  if (request.export_format === 'wav') {
    formatMultiplier = 1.2; // WAV files are larger
  }
  
  // Length multiplier (for very long content)
  let lengthMultiplier = 1;
  if (wordCount > 500) {
    lengthMultiplier = 1 + ((wordCount - 500) * 0.001); // Small increase for long content
  }
  
  const perVoiceCost = Math.ceil(baseCost * qualityMultiplier * formatMultiplier * lengthMultiplier);
  const voiceCount = 1;
  const total = perVoiceCost * voiceCount;
  
  return {
    base: baseCost,
    per_voice: perVoiceCost,
    quality_multiplier: qualityMultiplier,
    format_multiplier: formatMultiplier,
    length_multiplier: lengthMultiplier,
    voice_count: voiceCount,
    total,
    word_count: wordCount
  };
}

/**
 * Get user's available credits
 */
async function getUserCredits(supabase: any, userId: string): Promise<number> {
  const { data: userCredits } = await supabase
    .from('user_credits')
    .select('available_credits')
    .eq('user_id', userId)
    .single();
  
  return userCredits?.available_credits || 0;
}

/**
 * Deduct credits from user account
 */
async function deductCredits(
  supabase: any,
  userId: string,
  amount: number,
  batchId: string,
  operation: string
) {
  // Deduct from available credits
  await supabase
    .from('user_credits')
    .update({
      available_credits: supabase.raw('available_credits - ?', [amount]),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  // Log credit usage
  await supabase
    .from('credit_usage')
    .insert({
      user_id: userId,
      credits_used: amount,
      operation_type: operation,
      batch_id: batchId,
      created_at: new Date().toISOString()
    });
}