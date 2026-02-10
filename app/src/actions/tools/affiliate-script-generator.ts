'use server';

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { createClient } from '@/app/supabase/server';
import { getPromptForScriptType, getRefinementPrompt } from '@/lib/affiliate-toolkit/prompts';
import type { AffiliateOffer, LibraryProduct, UserBusinessOffer, ScriptType, SavedScript, OfferMediaFile, OfferYouTubeTranscript } from '@/lib/affiliate-toolkit/types';
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

    // Generate content using Gemini 3 Flash
    const { text } = await generateText({
      model: google('gemini-3-flash-preview'),
      prompt: prompt,
      maxOutputTokens: maxTokens,
      temperature: 0.9,
    });

    console.log('✅ Script generated successfully');

    // Auto-save the script to the library
    try {
      const { error: saveError } = await supabase
        .from('affiliate_toolkit_saved_scripts')
        .insert([{
          user_id: user.id,
          offer_id: request.offer.id === 'none' ? null : request.offer.id,
          offer_name: request.offer.name,
          script_type: request.scriptType,
          content: text,
          custom_prompt: request.customPrompt || null,
          is_favorite: false
        }]);

      if (saveError) {
        console.error('⚠️ Auto-save failed:', saveError.message, saveError.details);
      } else {
        console.log('💾 Script auto-saved to library');
      }
    } catch (saveError) {
      // Don't fail the generation if auto-save fails
      console.error('⚠️ Auto-save exception:', saveError);
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

    // Generate refined content using Gemini 3 Flash
    const { text } = await generateText({
      model: google('gemini-3-flash-preview'),
      prompt: prompt,
      maxOutputTokens: 4096,
      temperature: 0.9,
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

// ============================================
// AFFILIATE PRODUCT LIBRARY (Admin-managed)
// ============================================

/**
 * Server action to fetch library products (pre-trained affiliate offers)
 * Now includes stats from linked clickbank_offers
 */
export async function fetchLibraryProducts(): Promise<{
  success: boolean;
  products?: LibraryProduct[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Fetch library products
    const { data, error } = await supabase
      .from('affiliate_product_library')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching library products:', error);
      return {
        success: false,
        error: 'Failed to fetch library products'
      };
    }

    // Get all clickbank_ids that are linked
    const clickbankIds = (data || [])
      .map(p => p.clickbank_id)
      .filter(Boolean);

    // Fetch ClickBank stats for linked products
    let clickbankStatsMap: Record<string, {
      gravity_score: number;
      average_dollar_per_sale: number | null;
      sales_page_url: string | null;
      affiliate_page_url: string | null;
      category: string | null;
      vendor_contact_email: string | null;
    }> = {};

    if (clickbankIds.length > 0) {
      const { data: cbData } = await supabase
        .from('clickbank_offers')
        .select('clickbank_id, gravity_score, average_dollar_per_sale, sales_page_url, affiliate_page_url, category, vendor_contact_email')
        .in('clickbank_id', clickbankIds);

      if (cbData) {
        clickbankStatsMap = cbData.reduce((acc, offer) => {
          acc[offer.clickbank_id] = {
            gravity_score: offer.gravity_score,
            average_dollar_per_sale: offer.average_dollar_per_sale,
            sales_page_url: offer.sales_page_url,
            affiliate_page_url: offer.affiliate_page_url,
            category: offer.category,
            vendor_contact_email: offer.vendor_contact_email,
          };
          return acc;
        }, {} as typeof clickbankStatsMap);
      }
    }

    // Merge products with their ClickBank stats
    const products = (data || []).map(product => ({
      ...product,
      media_files: product.media_files || [],
      youtube_transcripts: product.youtube_transcripts || [],
      display_order: product.display_order || 0,
      clickbank_stats: product.clickbank_id ? clickbankStatsMap[product.clickbank_id] || null : null,
    }));

    return {
      success: true,
      products
    };
  } catch (error) {
    console.error('Error fetching library products:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch library products'
    };
  }
}

/**
 * Legacy function - fetches from library (for backwards compatibility)
 */
export async function fetchAffiliateOffers(): Promise<{
  success: boolean;
  offers?: AffiliateOffer[];
  error?: string;
}> {
  const result = await fetchLibraryProducts();
  return {
    success: result.success,
    offers: result.products,
    error: result.error
  };
}

/**
 * Fetch ClickBank offers for dropdown selection (admin linking)
 */
export async function fetchClickBankOffersForDropdown(): Promise<{
  success: boolean;
  offers?: Array<{
    clickbank_id: string;
    title: string;
    gravity_score: number;
    category: string | null;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('clickbank_offers')
      .select('clickbank_id, title, gravity_score, category')
      .eq('is_active', true)
      .order('gravity_score', { ascending: false });

    if (error) {
      console.error('Error fetching ClickBank offers:', error);
      return { success: false, error: 'Failed to fetch offers' };
    }

    return { success: true, offers: data || [] };
  } catch (error) {
    console.error('Error fetching ClickBank offers:', error);
    return { success: false, error: 'Failed to fetch offers' };
  }
}

/**
 * Server action to create a new library product (admin only)
 */
export async function createLibraryProduct(product: {
  name: string;
  niche: string;
  image_url?: string;
  offer_content: string;
  media_files?: OfferMediaFile[];
  youtube_transcripts?: OfferYouTubeTranscript[];
  aggregated_content?: string;
  display_order?: number;
  clickbank_id?: string;
}): Promise<{
  success: boolean;
  product?: LibraryProduct;
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
    const aggregated_content = product.aggregated_content || aggregateOfferContent({
      offer_content: product.offer_content,
      media_files: product.media_files || [],
      youtube_transcripts: product.youtube_transcripts || [],
    });

    const { data, error } = await supabase
      .from('affiliate_product_library')
      .insert([{
        name: product.name,
        niche: product.niche,
        image_url: product.image_url || null,
        offer_content: product.offer_content,
        media_files: product.media_files || [],
        youtube_transcripts: product.youtube_transcripts || [],
        aggregated_content: aggregated_content || null,
        display_order: product.display_order || 0,
        clickbank_id: product.clickbank_id || null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating library product:', error);
      return { success: false, error: 'Failed to create library product' };
    }

    return {
      success: true,
      product: {
        ...data,
        image_url: data.image_url || null,
        media_files: data.media_files || [],
        youtube_transcripts: data.youtube_transcripts || [],
        display_order: data.display_order || 0,
      }
    };
  } catch (error) {
    console.error('Error creating library product:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create library product'
    };
  }
}

/**
 * Legacy function - creates library product (for backwards compatibility)
 */
export async function createAffiliateOffer(offer: {
  name: string;
  niche: string;
  offer_content: string;
  media_files?: OfferMediaFile[];
  youtube_transcripts?: OfferYouTubeTranscript[];
  aggregated_content?: string;
}): Promise<{
  success: boolean;
  offer?: AffiliateOffer;
  error?: string;
}> {
  const result = await createLibraryProduct(offer);
  return {
    success: result.success,
    offer: result.product,
    error: result.error
  };
}

/**
 * Server action to update an existing library product (admin only)
 */
export async function updateLibraryProduct(
  id: string,
  updates: {
    name?: string;
    niche?: string;
    image_url?: string;
    offer_content?: string;
    media_files?: OfferMediaFile[];
    youtube_transcripts?: OfferYouTubeTranscript[];
    aggregated_content?: string;
    display_order?: number;
    clickbank_id?: string | null;
  }
): Promise<{
  success: boolean;
  product?: LibraryProduct;
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
      const { data: currentProduct } = await supabase
        .from('affiliate_product_library')
        .select('offer_content, media_files, youtube_transcripts')
        .eq('id', id)
        .single();

      if (currentProduct) {
        aggregated_content = aggregateOfferContent({
          offer_content: updates.offer_content ?? currentProduct.offer_content,
          media_files: updates.media_files ?? currentProduct.media_files ?? [],
          youtube_transcripts: updates.youtube_transcripts ?? currentProduct.youtube_transcripts ?? [],
        });
      }
    }

    const updateData: Record<string, unknown> = { ...updates };
    if (aggregated_content !== undefined) {
      updateData.aggregated_content = aggregated_content || null;
    }

    const { data, error } = await supabase
      .from('affiliate_product_library')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating library product:', error);
      return { success: false, error: 'Failed to update library product' };
    }

    return {
      success: true,
      product: {
        ...data,
        image_url: data.image_url || null,
        media_files: data.media_files || [],
        youtube_transcripts: data.youtube_transcripts || [],
        display_order: data.display_order || 0,
      }
    };
  } catch (error) {
    console.error('Error updating library product:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update library product'
    };
  }
}

/**
 * Legacy function - updates library product (for backwards compatibility)
 */
export async function updateAffiliateOffer(
  id: string,
  updates: {
    name?: string;
    niche?: string;
    offer_content?: string;
    media_files?: OfferMediaFile[];
    youtube_transcripts?: OfferYouTubeTranscript[];
    aggregated_content?: string;
  }
): Promise<{
  success: boolean;
  offer?: AffiliateOffer;
  error?: string;
}> {
  const result = await updateLibraryProduct(id, updates);
  return {
    success: result.success,
    offer: result.product,
    error: result.error
  };
}

/**
 * Server action to reorder library products (admin only)
 */
export async function reorderLibraryProducts(
  orderedIds: string[]
): Promise<{
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

    // Update each product's display_order based on its position in the array
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from('affiliate_product_library')
        .update({ display_order: i })
        .eq('id', orderedIds[i]);

      if (error) {
        console.error('Error updating display order:', error);
        return { success: false, error: `Failed to update order for product ${i}` };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error reordering products:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reorder products'
    };
  }
}

/**
 * Server action to delete a library product (admin only)
 */
export async function deleteLibraryProduct(id: string): Promise<{
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
      .from('affiliate_product_library')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting library product:', error);
      return { success: false, error: 'Failed to delete library product' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting library product:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete library product'
    };
  }
}

/**
 * Legacy function - deletes library product (for backwards compatibility)
 */
export async function deleteAffiliateOffer(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return deleteLibraryProduct(id);
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

// ============================================
// USER BUSINESS OFFERS (User's own products)
// ============================================

/**
 * Server action to fetch user's business offers
 */
export async function fetchUserBusinessOffers(): Promise<{
  success: boolean;
  offers?: UserBusinessOffer[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await supabase
      .from('user_business_offers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user business offers:', error);
      return {
        success: false,
        error: 'Failed to fetch your business offers'
      };
    }

    // Ensure arrays are properly initialized
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
    console.error('Error fetching user business offers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch your business offers'
    };
  }
}

/**
 * Server action to create a new user business offer
 */
export async function createUserBusinessOffer(offer: {
  name: string;
  niche: string;
  image_url?: string;
  offer_content: string;
  media_files?: OfferMediaFile[];
  youtube_transcripts?: OfferYouTubeTranscript[];
  aggregated_content?: string;
}): Promise<{
  success: boolean;
  offer?: UserBusinessOffer;
  error?: string;
}> {
  try {
    const supabase = await createClient();

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
      .from('user_business_offers')
      .insert([{
        user_id: user.id,
        name: offer.name,
        niche: offer.niche,
        image_url: offer.image_url || null,
        offer_content: offer.offer_content,
        media_files: offer.media_files || [],
        youtube_transcripts: offer.youtube_transcripts || [],
        aggregated_content: aggregated_content || null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating user business offer:', error);
      return { success: false, error: 'Failed to create business offer' };
    }

    return {
      success: true,
      offer: {
        ...data,
        image_url: data.image_url || null,
        media_files: data.media_files || [],
        youtube_transcripts: data.youtube_transcripts || [],
      }
    };
  } catch (error) {
    console.error('Error creating user business offer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create business offer'
    };
  }
}

/**
 * Server action to update a user business offer
 */
export async function updateUserBusinessOffer(
  id: string,
  updates: {
    name?: string;
    niche?: string;
    image_url?: string;
    offer_content?: string;
    media_files?: OfferMediaFile[];
    youtube_transcripts?: OfferYouTubeTranscript[];
    aggregated_content?: string;
  }
): Promise<{
  success: boolean;
  offer?: UserBusinessOffer;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // If aggregated_content is explicitly provided, use it directly
    let aggregated_content: string | undefined = updates.aggregated_content;

    if (aggregated_content === undefined && (updates.offer_content !== undefined || updates.media_files !== undefined || updates.youtube_transcripts !== undefined)) {
      // Need to get current data to merge with updates
      const { data: currentOffer } = await supabase
        .from('user_business_offers')
        .select('offer_content, media_files, youtube_transcripts')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (currentOffer) {
        aggregated_content = aggregateOfferContent({
          offer_content: updates.offer_content ?? currentOffer.offer_content,
          media_files: updates.media_files ?? currentOffer.media_files ?? [],
          youtube_transcripts: updates.youtube_transcripts ?? currentOffer.youtube_transcripts ?? [],
        });
      }
    }

    const updateData: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    if (aggregated_content !== undefined) {
      updateData.aggregated_content = aggregated_content || null;
    }

    const { data, error } = await supabase
      .from('user_business_offers')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user business offer:', error);
      return { success: false, error: 'Failed to update business offer' };
    }

    return {
      success: true,
      offer: {
        ...data,
        image_url: data.image_url || null,
        media_files: data.media_files || [],
        youtube_transcripts: data.youtube_transcripts || [],
      }
    };
  } catch (error) {
    console.error('Error updating user business offer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update business offer'
    };
  }
}

/**
 * Server action to delete a user business offer
 */
export async function deleteUserBusinessOffer(id: string): Promise<{
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
      .from('user_business_offers')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting user business offer:', error);
      return { success: false, error: 'Failed to delete business offer' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting user business offer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete business offer'
    };
  }
}

/**
 * Server action to fetch a single user business offer by ID
 */
export async function fetchUserBusinessOffer(id: string): Promise<{
  success: boolean;
  offer?: UserBusinessOffer;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await supabase
      .from('user_business_offers')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user business offer:', error);
      return { success: false, error: 'Business offer not found' };
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
    console.error('Error fetching user business offer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch business offer'
    };
  }
}

/**
 * Server action to fetch all offers for Content Generator
 * Combines library products and user's business offers
 */
export async function fetchAllOffersForContentGenerator(): Promise<{
  success: boolean;
  libraryProducts?: LibraryProduct[];
  userOffers?: UserBusinessOffer[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Fetch both in parallel
    const [libraryResult, userResult] = await Promise.all([
      supabase
        .from('affiliate_product_library')
        .select('*')
        .order('display_order', { ascending: true }),
      supabase
        .from('user_business_offers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    ]);

    if (libraryResult.error) {
      console.error('Error fetching library products:', libraryResult.error);
    }

    if (userResult.error) {
      console.error('Error fetching user business offers:', userResult.error);
    }

    // Process library products
    const libraryProducts = (libraryResult.data || []).map(product => ({
      ...product,
      media_files: product.media_files || [],
      youtube_transcripts: product.youtube_transcripts || [],
      display_order: product.display_order || 0,
    }));

    // Process user offers
    const userOffers = (userResult.data || []).map(offer => ({
      ...offer,
      media_files: offer.media_files || [],
      youtube_transcripts: offer.youtube_transcripts || [],
    }));

    return {
      success: true,
      libraryProducts,
      userOffers
    };
  } catch (error) {
    console.error('Error fetching all offers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch offers'
    };
  }
}

/**
 * Server action to fetch a single library product by ID
 */
export async function fetchLibraryProduct(id: string): Promise<{
  success: boolean;
  product?: LibraryProduct;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('affiliate_product_library')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching library product:', error);
      return { success: false, error: 'Library product not found' };
    }

    return {
      success: true,
      product: {
        ...data,
        media_files: data.media_files || [],
        youtube_transcripts: data.youtube_transcripts || [],
        display_order: data.display_order || 0,
      }
    };
  } catch (error) {
    console.error('Error fetching library product:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch library product'
    };
  }
}

/**
 * Server action to upload a product image to Supabase Storage
 * Returns the public URL of the uploaded image
 */
export async function uploadProductImage(formData: FormData): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Invalid file type. Please upload JPG, PNG, GIF, or WebP' };
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, error: 'File too large. Maximum size is 5MB' };
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Convert File to ArrayBuffer then to Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      return { success: false, error: 'Failed to upload image' };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(data.path);

    return {
      success: true,
      url: urlData.publicUrl
    };
  } catch (error) {
    console.error('Error uploading product image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image'
    };
  }
}
