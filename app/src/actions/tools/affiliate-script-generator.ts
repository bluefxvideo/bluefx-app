'use server';

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { createClient } from '@/app/supabase/server';
import { getPromptForScriptType, getRefinementPrompt } from '@/lib/affiliate-toolkit/prompts';
import type { AffiliateOffer, ScriptType } from '@/lib/affiliate-toolkit/types';

interface GenerateScriptRequest {
  offer: AffiliateOffer;
  scriptType: ScriptType;
  customPrompt?: string;
}

interface GenerateScriptResponse {
  success: boolean;
  script?: string;
  error?: string;
}

interface RefineScriptRequest {
  currentScript: string;
  refinementInstructions: string;
}

/**
 * Server action for generating affiliate marketing scripts
 * Uses Gemini 2.0 Flash for fast, high-quality content generation
 */
export async function generateAffiliateScript(
  request: GenerateScriptRequest
): Promise<GenerateScriptResponse> {
  console.log('🚀 Server Action: generateAffiliateScript called');

  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // Build the prompt
    const prompt = getPromptForScriptType(
      request.scriptType,
      request.offer,
      request.customPrompt
    );

    console.log('📝 Generating script with Gemini...');

    // Generate content using Gemini 2.0 Flash
    const { text } = await generateText({
      model: google('gemini-2.0-flash-exp'),
      prompt: prompt,
      maxTokens: 4096,
      temperature: 0.7,
    });

    console.log('✅ Script generated successfully');

    return {
      success: true,
      script: text
    };

  } catch (error) {
    console.error('💥 Script generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Script generation failed'
    };
  }
}

/**
 * Server action for refining existing scripts
 */
export async function refineAffiliateScript(
  request: RefineScriptRequest
): Promise<GenerateScriptResponse> {
  console.log('🔄 Server Action: refineAffiliateScript called');

  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // Build the refinement prompt
    const prompt = getRefinementPrompt(
      request.currentScript,
      request.refinementInstructions
    );

    console.log('📝 Refining script with Gemini...');

    // Generate refined content using Gemini 2.0 Flash
    const { text } = await generateText({
      model: google('gemini-2.0-flash-exp'),
      prompt: prompt,
      maxTokens: 4096,
      temperature: 0.7,
    });

    console.log('✅ Script refined successfully');

    return {
      success: true,
      script: text
    };

  } catch (error) {
    console.error('💥 Script refinement error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Script refinement failed'
    };
  }
}

/**
 * Server action to fetch affiliate offers
 */
export async function fetchAffiliateOffers(): Promise<{
  success: boolean;
  offers?: AffiliateOffer[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('affiliate_toolkit_offers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching offers:', error);
      return {
        success: false,
        error: 'Failed to fetch offers'
      };
    }

    return {
      success: true,
      offers: data || []
    };
  } catch (error) {
    console.error('Error fetching offers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch offers'
    };
  }
}
