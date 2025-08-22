'use server';

import { generateLogo as generateOpenAILogo, recreateLogo as recreateOpenAILogo } from '../models/openai-image';
import { uploadImageToStorage, downloadAndUploadImage } from '../supabase-storage';
import { 
  storeLogoResults, 
  createPredictionRecord, 
  recordLogoMetrics,
  getUserCredits,
  deductCredits 
} from '../database/logo-database';
import { Json } from '@/types/database';

/**
 * Unified Logo Machine Server Action
 * Orchestrates all logo-related operations with AI-driven workflow decisions
 */

export interface LogoMachineRequest {
  // Core generation
  company_name: string;
  
  // Reference image upload (for recreate functionality)
  reference_image?: string | File; // base64, File object, or URL
  
  // Custom description (optional)
  custom_description?: string; // User's descriptive text about their desired logo
  
  // Logo style and options
  style?: 'modern' | 'minimalist' | 'vintage' | 'playful' | 'professional' | 'creative';
  color_scheme?: string; // e.g., "blue and white", "monochrome", "colorful"
  industry?: string; // e.g., "tech", "restaurant", "fitness", "creative"
  
  // Advanced options  
  aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3';
  output_format?: 'webp' | 'jpg' | 'png';
  quality?: number; // 1-100
  seed?: number;
  
  // Workflow intent
  workflow_intent?: 'generate' | 'recreate' | 'variation';
  
  // Recreation options (for recreate tab)
  recreate_options?: {
    modifications?: string; // "make it more modern", "change colors to blue"
    maintain_style?: boolean;
    maintain_concept?: boolean;
  };
  
  // User context (for credit system)
  user_id: string;
}

export interface LogoMachineResponse {
  success: boolean;
  
  // Generated logo
  logo?: {
    id: string;
    url: string;
    company_name: string;
    style: string;
    batch_id: string;
  };
  
  // Metadata
  prediction_id: string;
  batch_id: string;
  credits_used: number;
  remaining_credits?: number;
  generation_time_ms: number;
  
  // Error handling
  error?: string;
  warnings?: string[];
}

// Credit constants (from legacy system analysis)
const LOGO_GENERATION_CREDITS = 3;
const LOGO_RECREATION_CREDITS = 4;

/**
 * AI Orchestrator - Replaces 3 Legacy Edge Functions
 * Intelligent workflow decisions for logo generation and recreation
 */
export async function generateLogo(
  request: LogoMachineRequest
): Promise<LogoMachineResponse> {
  const startTime = Date.now();
  const batch_id = crypto.randomUUID();
  let total_credits = 0;
  const warnings: string[] = [];

  try {
    console.log(`🎨 AI Logo Orchestrator: Starting workflow for company "${request.company_name}"`);

    // Step 1: Credit Validation
    const creditCheck = await getUserCredits(request.user_id);
    if (!creditCheck.success) {
      throw new Error('Unable to verify credit balance');
    }

    const estimatedCredits = calculateEstimatedCredits(request);
    if ((creditCheck.credits || 0) < estimatedCredits) {
      throw new Error(`Insufficient credits. Need ${estimatedCredits}, have ${creditCheck.credits || 0}`);
    }

    console.log(`💳 Credits validated: ${creditCheck.credits} available, ${estimatedCredits} estimated`);

    // Step 2: AI Decision - Reference Image Processing (for recreate workflow)
    let referenceImageUrl: string | undefined;
    if (request.reference_image && request.workflow_intent === 'recreate') {
      console.log('🖼️ AI Decision: Processing reference image for recreation');
      
      const uploadResult = await uploadImageToStorage(request.reference_image, {
        folder: 'logos/references',
        filename: `ref_${batch_id}.png`
      });

      if (uploadResult.success && uploadResult.url) {
        referenceImageUrl = uploadResult.url;
        console.log(`✅ Reference image uploaded: ${referenceImageUrl}`);
      } else {
        warnings.push('Reference image upload failed, proceeding with standard generation');
        console.warn('⚠️ Reference image upload failed');
      }
    }

    // Step 3: Create Prediction Record
    await createPredictionRecord({
      prediction_id: batch_id,
      user_id: request.user_id,
      tool_id: 'logo-machine',
      service_id: request.workflow_intent || 'generate',
      model_version: 'ideogram-v3-turbo',
      status: 'starting',
      input_data: request as unknown as Json,
    });

    // Step 4: AI Decision - OpenAI Logo Generation
    console.log(`🎨 AI Decision: Generating logo with OpenAI ${request.workflow_intent === 'recreate' ? 'recreation' : 'generation'}`);
    
    let openAIResult;
    const openAI_batch_id = crypto.randomUUID();

    if (request.workflow_intent === 'recreate' && referenceImageUrl) {
      // Step 5: OpenAI Recreation Workflow
      console.log(`🔄 OpenAI Recreation: Processing reference image for "${request.company_name}"`);
      
      openAIResult = await recreateOpenAILogo(
        referenceImageUrl,
        request.company_name,
        request.recreate_options?.modifications,
        request.user_id
      );
    } else {
      // Step 5: OpenAI Generation Workflow
      console.log(`✨ OpenAI Generation: Creating logo for "${request.company_name}"`);
      
      openAIResult = await generateOpenAILogo(
        request.company_name,
        {
          customDescription: request.custom_description,
          style: request.style,
          industry: request.industry,
          colorScheme: request.color_scheme,
          model: 'dall-e-3',
          size: mapAspectRatioToSize(request.aspect_ratio),
          user: request.user_id,
        }
      );
    }

    // Update prediction record with OpenAI response
    await createPredictionRecord({
      prediction_id: openAI_batch_id,
      user_id: request.user_id,
      tool_id: 'logo-machine',
      service_id: request.workflow_intent || 'generate',
      model_version: 'dall-e-3',
      status: 'processing',
      input_data: request as unknown as Json,
    });

    // Step 6: Process OpenAI Results (handle both url and b64_json formats like legacy)
    const imageData = openAIResult.data?.[0];
    if (!imageData) {
      throw new Error('No image data in OpenAI response');
    }

    let openaiLogoUrl;
    if (imageData.url) {
      // Direct URL format
      openaiLogoUrl = imageData.url;
      console.log(`📥 Using direct URL from OpenAI: ${openaiLogoUrl}`);
    } else if (imageData.b64_json) {
      // Base64 format - convert to data URL temporarily for download
      openaiLogoUrl = `data:image/png;base64,${imageData.b64_json}`;
      console.log(`📥 Using base64 data from OpenAI (${imageData.b64_json.length} chars)`);
    } else {
      throw new Error('No valid image data (url or b64_json) in OpenAI response');
    }
    console.log(`📥 Downloading and storing OpenAI logo in Supabase Storage`);

    // Step 7: Download and Store in Supabase Storage (same pattern as thumbnail machine)
    const storageResult = await downloadAndUploadImage(
      openaiLogoUrl,
      'logo-machine',
      `${batch_id}_logo`,
      {
        folder: 'logos/generated',
        bucket: 'images'
      }
    );

    if (!storageResult.success || !storageResult.url) {
      console.warn(`⚠️ Failed to store logo, using original OpenAI URL`);
      // Fallback to original URL if storage fails
    }

    const logoUrl = storageResult.success && storageResult.url ? storageResult.url : openaiLogoUrl;
    console.log(`✅ Logo stored successfully: ${logoUrl}`);

    const logo = {
      id: `${batch_id}_logo`,
      url: logoUrl,
      company_name: request.company_name,
      style: request.style || 'modern',
      batch_id,
    };

    console.log(`✅ Generated logo for "${request.company_name}"`);
    total_credits += request.workflow_intent === 'recreate' ? LOGO_RECREATION_CREDITS : LOGO_GENERATION_CREDITS;

    // Step 8: Deduct Credits
    const creditDeduction = await deductCredits(
      request.user_id,
      total_credits,
      'logo-generation',
      { batch_id, company_name: request.company_name, workflow: request.workflow_intent }
    );

    if (!creditDeduction.success) {
      warnings.push('Credit deduction failed - please contact support');
    }

    // Step 9: Store Results in Database
    await storeLogoResults({
      user_id: request.user_id,
      company_name: request.company_name,
      logo_url: logo.url, // This is now our Supabase Storage URL
      batch_id: logo.batch_id,
      style: logo.style,
      settings: {
        model: 'dall-e-3',
        custom_description: request.custom_description,
        style: request.style,
        color_scheme: request.color_scheme,
        industry: request.industry,
        workflow_intent: request.workflow_intent,
        aspect_ratio: request.aspect_ratio,
        generation_parameters: request as unknown as Json,
        openai_response: {
          created: openAIResult.created,
          usage: openAIResult.usage,
          revised_prompt: openAIResult.data[0]?.revised_prompt,
          original_url: openaiLogoUrl, // Keep the original OpenAI URL for reference
        },
        storage_info: {
          stored_in_supabase: storageResult.success,
          supabase_url: storageResult.url,
          original_openai_url: openaiLogoUrl,
        },
      } as unknown as Json,
      status: 'completed',
    });

    // Step 10: Record Analytics
    await recordLogoMetrics({
      user_id: request.user_id,
      batch_id,
      model_version: 'dall-e-3',
      company_name: request.company_name,
      style_type: request.style || 'modern',
      generation_time_ms: Date.now() - startTime,
      credits_used: total_credits,
      workflow_type: request.workflow_intent || 'generate',
      has_reference_image: !!referenceImageUrl,
      industry: request.industry,
    });

    const generation_time_ms = Date.now() - startTime;
    console.log(`🎉 AI Logo Orchestrator: Workflow completed in ${generation_time_ms}ms`);

    return {
      success: true,
      logo,
      prediction_id: openAI_batch_id,
      batch_id,
      credits_used: total_credits,
      remaining_credits: creditDeduction.remainingCredits,
      generation_time_ms,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

  } catch (error) {
    console.error('🚨 AI Logo Orchestrator error:', error);
    
    return {
      success: false,
      prediction_id: '',
      batch_id,
      credits_used: total_credits,
      generation_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Logo generation failed',
    };
  }
}

/**
 * AI Helper Functions for Smart Logo Generation
 */

// Calculate estimated credits before starting workflow
function calculateEstimatedCredits(request: LogoMachineRequest): number {
  return request.workflow_intent === 'recreate' ? LOGO_RECREATION_CREDITS : LOGO_GENERATION_CREDITS;
}

// Map aspect ratios to OpenAI image sizes
function mapAspectRatioToSize(aspect_ratio?: string): '1024x1024' | '1792x1024' | '1024x1792' {
  switch (aspect_ratio) {
    case '16:9':
    case '3:2':
      return '1792x1024'; // Landscape
    case '9:16':
    case '2:3':
      return '1024x1792'; // Portrait
    case '1:1':
    case '4:3':
    case '3:4':
    default:
      return '1024x1024'; // Square - optimal for logos
  }
}

/**
 * Simplified logo generation for basic use cases
 */
export async function generateBasicLogo(
  company_name: string,
  user_id: string,
  options?: {
    style?: 'modern' | 'minimalist' | 'vintage' | 'playful' | 'professional' | 'creative';
    color_scheme?: string;
    industry?: string;
  }
): Promise<LogoMachineResponse> {
  return generateLogo({
    company_name,
    user_id,
    style: options?.style,
    color_scheme: options?.color_scheme,
    industry: options?.industry,
    workflow_intent: 'generate',
  });
}

/**
 * Logo recreation with reference image
 */
export async function recreateLogo(
  company_name: string,
  reference_image: string | File,
  user_id: string,
  options?: {
    modifications?: string;
    maintain_style?: boolean;
    maintain_concept?: boolean;
  }
): Promise<LogoMachineResponse> {
  return generateLogo({
    company_name,
    user_id,
    reference_image,
    workflow_intent: 'recreate',
    recreate_options: options,
  });
}