'use server';

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { createClient } from '@/app/supabase/server';
import { getPromptForScriptType, getRefinementPrompt } from '@/lib/affiliate-toolkit/prompts';
import type { AffiliateOffer, ScriptType, SavedScript, OfferMediaFile, OfferYouTubeTranscript } from '@/lib/affiliate-toolkit/types';
import { aggregateOfferContent } from '@/lib/affiliate-toolkit/types';

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

    // Determine maxTokens based on script type
    let maxTokens = 4096;
    if (request.scriptType === 'content_calendar') {
      maxTokens = 8000; // 30-day calendar needs more tokens
    }

    console.log('📝 Generating script with Gemini...', { scriptType: request.scriptType, maxTokens });

    // Generate content using Gemini 2.0 Flash
    const { text } = await generateText({
      model: google('gemini-2.0-flash-exp'),
      prompt: prompt,
      maxTokens: maxTokens,
      temperature: 0.7,
    });

    console.log('✅ Script generated successfully');

    // Auto-save the script to the library
    try {
      await supabase
        .from('affiliate_toolkit_saved_scripts')
        .insert([{
          user_id: user.id,
          offer_id: request.offer.id,
          offer_name: request.offer.name,
          script_type: request.scriptType,
          content: text,
          custom_prompt: request.customPrompt || null,
          is_favorite: false
        }]);
      console.log('💾 Script auto-saved to library');
    } catch (saveError) {
      // Don't fail the generation if auto-save fails
      console.error('⚠️ Auto-save failed (non-blocking):', saveError);
    }

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

    // Ensure arrays are properly initialized for each offer
    const offers = (data || []).map(offer => ({
      ...offer,
      media_files: offer.media_files || [],
      youtube_transcripts: offer.youtube_transcripts || [],
    }));

    return {
      success: true,
      offers
    };
  } catch (error) {
    console.error('Error fetching offers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch offers'
    };
  }
}

/**
 * Server action to create a new affiliate offer
 */
export async function createAffiliateOffer(offer: {
  name: string;
  niche: string;
  offer_content: string;
  media_files?: OfferMediaFile[];
  youtube_transcripts?: OfferYouTubeTranscript[];
  aggregated_content?: string; // Allow passing edited master document directly
}): Promise<{
  success: boolean;
  offer?: AffiliateOffer;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Use provided aggregated_content or build from sources
    const aggregated_content = offer.aggregated_content || aggregateOfferContent({
      offer_content: offer.offer_content,
      media_files: offer.media_files || [],
      youtube_transcripts: offer.youtube_transcripts || [],
    });

    const { data, error } = await supabase
      .from('affiliate_toolkit_offers')
      .insert([{
        name: offer.name,
        niche: offer.niche,
        offer_content: offer.offer_content,
        media_files: offer.media_files || [],
        youtube_transcripts: offer.youtube_transcripts || [],
        aggregated_content: aggregated_content || null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating offer:', error);
      return { success: false, error: 'Failed to create offer' };
    }

    return {
      success: true,
      offer: {
        ...data,
        media_files: data.media_files || [],
        youtube_transcripts: data.youtube_transcripts || [],
      }
    };
  } catch (error) {
    console.error('Error creating offer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create offer'
    };
  }
}

/**
 * Server action to update an existing affiliate offer
 */
export async function updateAffiliateOffer(
  id: string,
  updates: {
    name?: string;
    niche?: string;
    offer_content?: string;
    media_files?: OfferMediaFile[];
    youtube_transcripts?: OfferYouTubeTranscript[];
    aggregated_content?: string; // Allow passing edited master document directly
  }
): Promise<{
  success: boolean;
  offer?: AffiliateOffer;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // If aggregated_content is explicitly provided, use it directly
    // Otherwise, rebuild from sources if any content fields are being updated
    let aggregated_content: string | undefined = updates.aggregated_content;

    if (aggregated_content === undefined && (updates.offer_content !== undefined || updates.media_files !== undefined || updates.youtube_transcripts !== undefined)) {
      // Need to get current data to merge with updates
      const { data: currentOffer } = await supabase
        .from('affiliate_toolkit_offers')
        .select('offer_content, media_files, youtube_transcripts')
        .eq('id', id)
        .single();

      if (currentOffer) {
        aggregated_content = aggregateOfferContent({
          offer_content: updates.offer_content ?? currentOffer.offer_content,
          media_files: updates.media_files ?? currentOffer.media_files ?? [],
          youtube_transcripts: updates.youtube_transcripts ?? currentOffer.youtube_transcripts ?? [],
        });
      }
    }

    const updateData: Record<string, unknown> = { ...updates };
    if (aggregated_content !== undefined) {
      updateData.aggregated_content = aggregated_content || null;
    }

    const { data, error } = await supabase
      .from('affiliate_toolkit_offers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating offer:', error);
      return { success: false, error: 'Failed to update offer' };
    }

    return {
      success: true,
      offer: {
        ...data,
        media_files: data.media_files || [],
        youtube_transcripts: data.youtube_transcripts || [],
      }
    };
  } catch (error) {
    console.error('Error updating offer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update offer'
    };
  }
}

/**
 * Server action to delete an affiliate offer
 */
export async function deleteAffiliateOffer(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { error } = await supabase
      .from('affiliate_toolkit_offers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting offer:', error);
      return { success: false, error: 'Failed to delete offer' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting offer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete offer'
    };
  }
}

// ============================================
// SAVED SCRIPTS CRUD OPERATIONS
// ============================================

/**
 * Server action to fetch saved scripts for the current user
 */
export async function fetchSavedScripts(options?: {
  search?: string;
  scriptType?: string;
  favoritesOnly?: boolean;
}): Promise<{
  success: boolean;
  scripts?: SavedScript[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    let query = supabase
      .from('affiliate_toolkit_saved_scripts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (options?.scriptType && options.scriptType !== 'all') {
      query = query.eq('script_type', options.scriptType);
    }

    if (options?.favoritesOnly) {
      query = query.eq('is_favorite', true);
    }

    if (options?.search) {
      query = query.or(`offer_name.ilike.%${options.search}%,content.ilike.%${options.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching saved scripts:', error);
      return { success: false, error: 'Failed to fetch saved scripts' };
    }

    return { success: true, scripts: data || [] };
  } catch (error) {
    console.error('Error fetching saved scripts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch saved scripts'
    };
  }
}

/**
 * Server action to save a script to the library
 */
export async function saveScriptToLibrary(script: {
  offer_id: string | null;
  offer_name: string;
  script_type: string;
  content: string;
  custom_angle?: string;
  custom_prompt?: string;
}): Promise<{
  success: boolean;
  script?: SavedScript;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await supabase
      .from('affiliate_toolkit_saved_scripts')
      .insert([{
        user_id: user.id,
        offer_id: script.offer_id,
        offer_name: script.offer_name,
        script_type: script.script_type,
        content: script.content,
        custom_angle: script.custom_angle || null,
        custom_prompt: script.custom_prompt || null,
        is_favorite: false
      }])
      .select()
      .single();

    if (error) {
      console.error('Error saving script:', error);
      return { success: false, error: 'Failed to save script' };
    }

    return { success: true, script: data };
  } catch (error) {
    console.error('Error saving script:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save script'
    };
  }
}

/**
 * Server action to toggle favorite status of a saved script
 */
export async function toggleScriptFavorite(id: string): Promise<{
  success: boolean;
  is_favorite?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // First get current favorite status
    const { data: current, error: fetchError } = await supabase
      .from('affiliate_toolkit_saved_scripts')
      .select('is_favorite')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !current) {
      return { success: false, error: 'Script not found' };
    }

    // Toggle the status
    const newStatus = !current.is_favorite;
    const { error: updateError } = await supabase
      .from('affiliate_toolkit_saved_scripts')
      .update({ is_favorite: newStatus })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error toggling favorite:', updateError);
      return { success: false, error: 'Failed to update favorite status' };
    }

    return { success: true, is_favorite: newStatus };
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle favorite'
    };
  }
}

/**
 * Server action to delete a saved script
 */
export async function deleteSavedScript(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { error } = await supabase
      .from('affiliate_toolkit_saved_scripts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting script:', error);
      return { success: false, error: 'Failed to delete script' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting script:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete script'
    };
  }
}
