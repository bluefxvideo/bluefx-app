'use server';

import { createClient } from '@supabase/supabase-js';
import { 
  createFluxKontextPrediction, 
  waitForFluxKontextCompletion 
} from '../models/flux-kontext-pro';

// Initialize Supabase client for server actions
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ImageGenerationRequest {
  segments: Array<{
    id: string;
    image_prompt: string;
    duration: number;
  }>;
  style_settings: {
    visual_style: 'realistic' | 'artistic' | 'minimal' | 'dynamic';
    aspect_ratio: '16:9' | '9:16' | '1:1' | '4:3';
    quality: 'draft' | 'standard' | 'premium';
  };
  user_id: string;
  batch_id: string;
}

export interface ImageGenerationResponse {
  success: boolean;
  generated_images?: Array<{
    segment_id: string;
    image_url: string;
    prompt: string;
    prediction_id: string;
    generation_time_ms: number;
  }>;
  credits_used: number;
  total_generation_time_ms: number;
  error?: string;
}

/**
 * Generate images for all video segments using FLUX Kontext Pro
 */
export async function generateImagesForAllSegments(
  request: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  const startTime = Date.now();
  const generatedImages: Array<{
    segment_id: string;
    image_url: string;
    prompt: string;
    prediction_id: string;
    generation_time_ms: number;
  }> = [];
  
  let totalCredits = 0;

  try {
    console.log(`🎨 Generating ${request.segments.length} images for script-to-video using FLUX Kontext Pro`);

    // Process segments in parallel for efficiency
    const imagePromises = request.segments.map(async (segment, index) => {
      const segmentStartTime = Date.now();
      
      try {
        // Enhance prompt based on visual style
        const enhancedPrompt = enhancePromptForStyle(segment.image_prompt, request.style_settings);
        
        console.log(`🎨 Generating image ${index + 1}/${request.segments.length}: "${enhancedPrompt}"`);

        // Create FLUX prediction
        const prediction = await createFluxKontextPrediction({
          prompt: enhancedPrompt,
          aspect_ratio: convertAspectRatio(request.style_settings.aspect_ratio),
          output_format: 'png',
          safety_tolerance: 2,
          prompt_upsampling: request.style_settings.quality === 'premium',
          seed: undefined // Random generation for variety
        });

        // Wait for completion
        const completedPrediction = await waitForFluxKontextCompletion(
          prediction.id,
          300000, // 5 minute timeout
          3000    // 3 second polling
        );

        if (completedPrediction.status !== 'succeeded' || !completedPrediction.output) {
          throw new Error(`Image generation failed: ${completedPrediction.error || 'No output'}`);
        }

        // Download and upload to Supabase Storage
        const imageUrl = await uploadImageToStorage(
          completedPrediction.output,
          request.user_id,
          request.batch_id,
          segment.id
        );

        const generationTime = Date.now() - segmentStartTime;

        return {
          segment_id: segment.id,
          image_url: imageUrl,
          prompt: enhancedPrompt,
          prediction_id: prediction.id,
          generation_time_ms: generationTime
        };

      } catch (error) {
        console.error(`Error generating image for segment ${segment.id}:`, error);
        throw error;
      }
    });

    // Wait for all images to complete
    const results = await Promise.all(imagePromises);
    generatedImages.push(...results);
    totalCredits = results.length * getCreditsPerImage(request.style_settings.quality);

    const totalTime = Date.now() - startTime;
    console.log(`✅ Generated ${generatedImages.length} images in ${totalTime}ms`);

    return {
      success: true,
      generated_images: generatedImages,
      credits_used: totalCredits,
      total_generation_time_ms: totalTime
    };

  } catch (error) {
    console.error('Image generation error:', error);
    return {
      success: false,
      credits_used: totalCredits,
      total_generation_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Image generation failed'
    };
  }
}

/**
 * Generate a single image for editing/regeneration
 */
export async function regenerateSegmentImage(
  segment_id: string,
  image_prompt: string,
  style_settings: ImageGenerationRequest['style_settings'],
  user_id: string
): Promise<{ success: boolean; image_url?: string; error?: string }> {
  try {
    console.log(`🔄 Regenerating image for segment ${segment_id}`);

    const enhancedPrompt = enhancePromptForStyle(image_prompt, style_settings);

    const prediction = await createFluxKontextPrediction({
      prompt: enhancedPrompt,
      aspect_ratio: convertAspectRatio(style_settings.aspect_ratio),
      output_format: 'png',
      safety_tolerance: 2,
      prompt_upsampling: style_settings.quality === 'premium'
    });

    const completedPrediction = await waitForFluxKontextCompletion(prediction.id);

    if (completedPrediction.status !== 'succeeded' || !completedPrediction.output) {
      throw new Error(`Image regeneration failed: ${completedPrediction.error || 'No output'}`);
    }

    const imageUrl = await uploadImageToStorage(
      completedPrediction.output,
      user_id,
      `regenerate_${Date.now()}`,
      segment_id
    );

    console.log(`✅ Regenerated image for segment ${segment_id}`);

    return {
      success: true,
      image_url: imageUrl
    };

  } catch (error) {
    console.error(`Error regenerating image for segment ${segment_id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Image regeneration failed'
    };
  }
}

/**
 * Helper Functions
 */

function enhancePromptForStyle(
  basePrompt: string, 
  styleSettings: ImageGenerationRequest['style_settings']
): string {
  const styleEnhancements = {
    realistic: 'photorealistic, high quality, detailed, professional photography',
    artistic: 'artistic, creative, stylized, beautiful composition, digital art',
    minimal: 'clean, minimal, simple, modern design, uncluttered',
    dynamic: 'dynamic, energetic, motion, vibrant colors, engaging'
  };

  const qualityEnhancements = {
    draft: '',
    standard: 'high quality, well composed',
    premium: 'ultra high quality, masterpiece, perfect composition, award winning'
  };

  // Add cinematic quality for diverse storytelling
  const cinematicPrompt = 'cinematic composition, professional storytelling, diverse camera angles, engaging visual narrative';
  
  // Add character consistency emphasis for image generation models
  const consistencyPrompt = 'maintain character consistency, same character throughout series, consistent visual identity';

  return `${basePrompt}, ${cinematicPrompt}, ${consistencyPrompt}, ${styleEnhancements[styleSettings.visual_style]}, ${qualityEnhancements[styleSettings.quality]}`.trim();
}

function convertAspectRatio(ratio: string): string {
  // FLUX Kontext Pro uses different format
  const ratioMap: Record<string, string> = {
    '16:9': '16:9',
    '9:16': '9:16', 
    '1:1': '1:1',
    '4:3': '4:3'
  };
  return ratioMap[ratio] || '16:9';
}

function getCreditsPerImage(quality: string): number {
  const creditMap = {
    draft: 3,
    standard: 4,
    premium: 6
  };
  return creditMap[quality as keyof typeof creditMap] || 4;
}

async function uploadImageToStorage(
  imageUrl: string,
  userId: string,
  batchId: string,
  segmentId: string
): Promise<string> {
  try {
    // Download the image from Replicate
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const fileName = `${userId}/images/${batchId}/${segmentId}.png`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('script-videos')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('script-videos')
      .getPublicUrl(fileName);

    console.log(`📤 Uploaded image to storage: ${urlData.publicUrl}`);
    return urlData.publicUrl;

  } catch (error) {
    console.error('Error uploading image to storage:', error);
    throw error;
  }
}