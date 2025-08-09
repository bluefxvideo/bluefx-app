'use server';

import { createIdeogramV3TurboPrediction, waitForIdeogramV3TurboCompletion } from '../models/ideogram-v3-turbo';
import { uploadImageToStorage } from '../supabase-storage';
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

    // Step 4: AI Decision - Smart Prompt Construction
    const logoPrompt = constructLogoPrompt(request, referenceImageUrl);
    console.log(`📝 AI Prompt: ${logoPrompt}`);
    
    // Step 5: AI Decision - Logo Generation
    console.log(`🎨 AI Decision: Generating logo with Ideogram V3 Turbo`);
    
    const prediction = await createIdeogramV3TurboPrediction({
      prompt: logoPrompt,
      aspect_ratio: request.aspect_ratio || '1:1',
      style_type: 'Design', // Optimal for logo generation
      magic_prompt_option: 'Auto', // Let Ideogram enhance the prompt
      seed: request.seed,
      ...(referenceImageUrl && { image: referenceImageUrl }), // Use reference image if available
      webhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/replicate-ai`,
    });

    // Update prediction record with actual Replicate ID
    await createPredictionRecord({
      prediction_id: prediction.id,
      user_id: request.user_id,
      tool_id: 'logo-machine',
      service_id: request.workflow_intent || 'generate',
      model_version: 'ideogram-v3-turbo',
      status: 'processing',
      input_data: request as unknown as Json,
    });

    // Step 6: Wait for Completion
    console.log(`⏳ Waiting for Ideogram completion: ${prediction.id}`);
    const completed_prediction = await waitForIdeogramV3TurboCompletion(prediction.id);
    
    if (completed_prediction.status !== 'succeeded') {
      throw new Error(`Logo generation failed: ${completed_prediction.error || 'Unknown error'}`);
    }

    // Step 7: Process Generated Logo
    const logoUrl = completed_prediction.output?.[0];
    if (!logoUrl) {
      throw new Error('No logo generated in response');
    }

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
      logo_url: logo.url,
      batch_id: logo.batch_id,
      style: logo.style,
      settings: {
        prompt: logoPrompt,
        style: request.style,
        color_scheme: request.color_scheme,
        industry: request.industry,
        workflow_intent: request.workflow_intent,
        generation_parameters: request as unknown as Json,
      } as unknown as Json,
      status: 'completed',
    });

    // Step 10: Record Analytics
    await recordLogoMetrics({
      user_id: request.user_id,
      batch_id,
      model_version: 'ideogram-v3-turbo',
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
      prediction_id: prediction.id,
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

// Smart prompt construction based on company name and style preferences
function constructLogoPrompt(request: LogoMachineRequest, referenceImageUrl?: string): string {
  const { company_name, style, color_scheme, industry, recreate_options } = request;
  
  let prompt = '';
  
  // Base prompt structure
  if (request.workflow_intent === 'recreate' && referenceImageUrl && recreate_options) {
    // Recreation prompt
    prompt = `Professional logo recreation for "${company_name}" company. `;
    if (recreate_options.modifications) {
      prompt += `${recreate_options.modifications}. `;
    }
    if (recreate_options.maintain_style) {
      prompt += `Maintain the original style and aesthetic. `;
    }
    if (recreate_options.maintain_concept) {
      prompt += `Keep the core concept and symbolism. `;
    }
  } else {
    // Standard generation prompt
    prompt = `Professional logo design for "${company_name}" company. `;
  }
  
  // Add style preferences
  if (style) {
    const styleDescriptions = {
      modern: 'Clean, contemporary design with sharp lines and modern typography',
      minimalist: 'Simple, clean design with minimal elements and plenty of white space',
      vintage: 'Classic, retro-inspired design with traditional elements',
      playful: 'Fun, creative design with vibrant colors and dynamic elements',
      professional: 'Sophisticated, business-appropriate design with elegant typography',
      creative: 'Artistic, unique design with innovative visual elements'
    };
    prompt += `${styleDescriptions[style] || 'Modern and professional design'}. `;
  }
  
  // Add color scheme
  if (color_scheme) {
    prompt += `Color scheme: ${color_scheme}. `;
  }
  
  // Add industry context
  if (industry) {
    const industryContext = {
      tech: 'Technology-focused with digital, innovative elements',
      restaurant: 'Food service with appetizing, welcoming design',
      fitness: 'Health and fitness with energetic, strong design',
      creative: 'Creative agency with artistic, imaginative elements'
    };
    prompt += `${industryContext[industry as keyof typeof industryContext] || `${industry} industry appropriate design`}. `;
  }
  
  // Add technical requirements
  prompt += 'High-quality vector design, scalable, suitable for business use across digital and print media. Professional logo design with clear typography and iconic elements.';
  
  return prompt;
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