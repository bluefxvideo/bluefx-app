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
    aspect_ratio: '16:9' | '9:16' | '1:1' | '4:3' | '4:5';
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
  failed_segments?: Array<{
    segment_id: string;
    error: string;
    prompt: string;
  }>;
  credits_used: number;
  total_generation_time_ms: number;
  partial_failure?: boolean;
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

        // Try generation with safe prompt first
        let prediction;
        let completedPrediction;
        let attemptCount = 0;
        const maxAttempts = 2;
        let lastError: string | undefined;

        while (attemptCount < maxAttempts) {
          attemptCount++;

          try {
            // Use progressively safer prompt if retrying
            const promptToUse = attemptCount === 1
              ? enhancedPrompt
              : sanitizePromptForSafety(enhancedPrompt);

            if (attemptCount > 1) {
              console.log(`🔄 Retrying with sanitized prompt (attempt ${attemptCount}/${maxAttempts})`);
            }

            // Create FLUX prediction with higher safety tolerance
            prediction = await createFluxKontextPrediction({
              prompt: promptToUse,
              aspect_ratio: convertAspectRatio(request.style_settings.aspect_ratio),
              output_format: 'png',
              safety_tolerance: attemptCount === 1 ? 4 : 6, // Higher tolerance since we pre-sanitize in orchestrator
              prompt_upsampling: request.style_settings.quality === 'premium',
              seed: undefined // Random generation for variety
            });

            // Wait for completion
            completedPrediction = await waitForFluxKontextCompletion(
              prediction.id,
              300000, // 5 minute timeout
              3000    // 3 second polling
            );

            if (completedPrediction.status === 'succeeded' && completedPrediction.output) {
              // Success! Break out of retry loop
              break;
            }

            // Check if it's a content policy error
            const errorMessage = completedPrediction.error || 'No output';
            if (errorMessage.toLowerCase().includes('sensitive') ||
                errorMessage.toLowerCase().includes('nsfw') ||
                errorMessage.toLowerCase().includes('safety') ||
                errorMessage.toLowerCase().includes('content policy')) {
              lastError = errorMessage;
              console.warn(`⚠️ Content flagged as sensitive, will retry with sanitized prompt`);
              // Continue to next attempt
            } else {
              // Non-content error, throw immediately
              throw new Error(`Image generation failed: ${errorMessage}`);
            }
          } catch (error) {
            if (attemptCount === maxAttempts) {
              // Final attempt failed
              throw error;
            }
            // Continue to next attempt
            lastError = error instanceof Error ? error.message : String(error);
          }
        }

        if (!completedPrediction || completedPrediction.status !== 'succeeded' || !completedPrediction.output) {
          throw new Error(`Image generation failed after ${attemptCount} attempts: ${lastError || 'No output'}`);
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

    // Wait for all images to complete - use allSettled to handle partial failures
    const results = await Promise.allSettled(imagePromises);
    
    const successfulImages: Array<{
      segment_id: string;
      image_url: string;
      prompt: string;
      prediction_id: string;
      generation_time_ms: number;
    }> = [];
    
    const failedSegments: Array<{
      segment_id: string;
      error: string;
      prompt: string;
    }> = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulImages.push(result.value);
      } else {
        const segment = request.segments[index];
        const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failedSegments.push({
          segment_id: segment.id,
          error: errorMessage,
          prompt: segment.visual_description
        });
        console.error(`❌ Failed to generate image for segment ${segment.id}:`, errorMessage);
      }
    });
    
    generatedImages.push(...successfulImages);
    totalCredits = successfulImages.length * getCreditsPerImage(request.style_settings.quality);

    const totalTime = Date.now() - startTime;
    
    if (failedSegments.length > 0) {
      console.log(`⚠️ Generated ${generatedImages.length} images successfully, ${failedSegments.length} failed in ${totalTime}ms`);
      failedSegments.forEach(failed => {
        console.log(`   ❌ Segment ${failed.segment_id}: ${failed.error}`);
      });
    } else {
      console.log(`✅ Generated ${generatedImages.length} images in ${totalTime}ms`);
    }

    return {
      success: generatedImages.length > 0, // Success if at least one image was generated
      generated_images: generatedImages,
      failed_segments: failedSegments,
      credits_used: totalCredits,
      total_generation_time_ms: totalTime,
      partial_failure: failedSegments.length > 0
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

    // Try with normal prompt first, then sanitized if needed
    let prediction;
    let completedPrediction;
    let promptToUse = enhancedPrompt;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (attempt === 2) {
          promptToUse = sanitizePromptForSafety(enhancedPrompt);
          console.log(`🔄 Retrying with sanitized prompt`);
        }

        prediction = await createFluxKontextPrediction({
          prompt: promptToUse,
          aspect_ratio: convertAspectRatio(style_settings.aspect_ratio),
          output_format: 'png',
          safety_tolerance: attempt === 1 ? 4 : 6, // Higher tolerance since we pre-sanitize
          prompt_upsampling: style_settings.quality === 'premium'
        });

        completedPrediction = await waitForFluxKontextCompletion(prediction.id);

        if (completedPrediction.status === 'succeeded' && completedPrediction.output) {
          break; // Success!
        }

        const error = completedPrediction.error || 'No output';
        if (!error.toLowerCase().includes('sensitive') &&
            !error.toLowerCase().includes('nsfw') &&
            !error.toLowerCase().includes('safety')) {
          throw new Error(`Image regeneration failed: ${error}`);
        }
      } catch (error) {
        if (attempt === 2) throw error; // Final attempt failed
      }
    }

    if (!completedPrediction || completedPrediction.status !== 'succeeded' || !completedPrediction.output) {
      throw new Error(`Image regeneration failed after retries`);
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

/**
 * Lightweight sanitizer as last-resort fallback
 * Only used if the AI-generated prompt still triggers content filters
 */
function sanitizePromptForSafety(prompt: string): string {
  console.log(`🛡️ Applying last-resort safety sanitization`);

  // Since the orchestrator should already generate safe prompts,
  // this is just a final fallback that adds extra safety tags
  // and removes any obvious problem words that slipped through

  // Quick replacements for edge cases
  const quickFixes: Record<string, string> = {
    'killed it': 'succeeded',
    'dead serious': 'very serious',
    'shooting': 'filming',
    'shot': 'scene',
  };

  let sanitized = prompt;

  // Apply quick fixes
  for (const [pattern, replacement] of Object.entries(quickFixes)) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
    sanitized = sanitized.replace(regex, replacement);
  }

  // Add extra safety tags if not already present
  const safetyTags = [
    'professional',
    'appropriate',
    'family-friendly',
    'suitable for all audiences',
    'no violence',
    'no explicit content',
    'safe for work'
  ];

  // Check which tags are missing and add them
  const missingTags = safetyTags.filter(tag => !sanitized.toLowerCase().includes(tag));
  if (missingTags.length > 0) {
    sanitized = `${sanitized}, ${missingTags.join(', ')}`;
  }

  console.log(`✅ Applied fallback safety tags`);
  return sanitized;
}

function convertAspectRatio(ratio: string): string {
  // FLUX Kontext Pro uses different format
  const ratioMap: Record<string, string> = {
    '16:9': '16:9',
    '9:16': '9:16', 
    '1:1': '1:1',
    '4:3': '4:3',
    '4:5': '4:5'
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