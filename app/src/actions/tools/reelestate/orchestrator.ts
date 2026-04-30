'use server';

import { createClient } from '@/app/supabase/server';
import { getUserCredits } from '@/actions/credit-management';
import { deductCredits } from '@/actions/database/cinematographer-database';
import { createListing, updateListing, deleteSavedComposition } from '@/actions/database/reelestate-database';
import { scrapeZillowListing } from './zillow-scraper';
import { scrapeRealtorListing } from './realtor-scraper';
import { analyzeListingImages } from './image-interpreter';
import { generateListingScript } from './script-generator';
import { generateAllListingClips } from './clip-generator';
import { cleanupPhoto } from './photo-cleanup';
import { generateVoiceForScript } from '@/actions/services/voice-generation-service';
import { startRemotionRender, checkRemotionProgress, downloadAndStoreVideo } from '@/actions/services/remotion-render-service';
import type {
  ZillowListingData,
  ImageAnalysis,
  ClipGenerationRequest,
  ClipStatus,
  CleanupPreset,
  CleanupResult,
  TargetDuration,
  ScriptGenerationResult,
  ImageAnalysisResult,
} from '@/types/reelestate';
import { cameraMotionToKenBurns } from '@/types/reelestate';
import type { Json } from '@/types/database';

// ═══════════════════════════════════════════
// Credit Costs
// ═══════════════════════════════════════════

const CREDITS = {
  SCRAPE: 1,
  ANALYZE_PER_BATCH: 1, // per 5 photos
  SCRIPT: 1,
  CLIP: 6, // per clip (6 seconds @ 1080p, 1 credit/sec)
  VOICEOVER: 2,
  ASSEMBLY: 2,
  CLEANUP: 2, // per photo
};

export async function estimateTotalCredits(photoCount: number): Promise<number> {
  const analyzeBatches = Math.ceil(photoCount / 5);
  return CREDITS.SCRAPE + (analyzeBatches * CREDITS.ANALYZE_PER_BATCH) +
    CREDITS.SCRIPT + (photoCount * CREDITS.CLIP) + CREDITS.VOICEOVER + CREDITS.ASSEMBLY;
}

// ═══════════════════════════════════════════
// Step 0: Create Empty Project (no photos yet)
// ═══════════════════════════════════════════

export async function createEmptyProject(name: string): Promise<{
  success: boolean;
  listing_id?: string;
  name?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required' };

    const trimmedName = name.trim() || `Untitled Project — ${new Date().toLocaleDateString()}`;

    const result = await createListing({
      user_id: user.id,
      name: trimmedName,
      source_type: 'manual',
      photo_urls: [],
    });

    if (!result.success || !result.id) {
      return { success: false, error: result.error || 'Failed to create project' };
    }

    return { success: true, listing_id: result.id, name: trimmedName };
  } catch (error) {
    console.error('❌ Create empty project error:', error);
    return { success: false, error: 'Failed to create project' };
  }
}

export async function renameProject(
  listingId: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Name cannot be empty' };

  const { updateListing } = await import('@/actions/database/reelestate-database');
  return updateListing(listingId, { name: trimmed });
}

// ═══════════════════════════════════════════
// Step 1: Start Project (Scrape or Manual)
// ═══════════════════════════════════════════

export async function startListingProject(input: {
  zillow_url?: string;
  manual_photos?: string[];
  manual_listing_data?: Partial<ZillowListingData>;
}): Promise<{
  success: boolean;
  listing_id?: string;
  listing?: ZillowListingData;
  photos?: string[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required' };

    let listing: ZillowListingData | undefined;
    let photos: string[] = [];
    let sourceType: 'zillow' | 'manual' = 'manual';

    if (input.zillow_url) {
      // Determine source: Zillow or Realtor.com
      const isRealtor = input.zillow_url.includes('realtor.com');
      sourceType = 'zillow'; // Reuse the same source type for DB compatibility

      // Check credits for scraping
      const creditCheck = await getUserCredits(user.id);
      if (!creditCheck.success || (creditCheck.credits || 0) < CREDITS.SCRAPE) {
        return { success: false, error: 'Insufficient credits for scraping' };
      }

      const scrapeResult = isRealtor
        ? await scrapeRealtorListing(input.zillow_url)
        : await scrapeZillowListing(input.zillow_url);
      if (!scrapeResult.success || !scrapeResult.listing) {
        return { success: false, error: scrapeResult.error || 'Scrape failed' };
      }

      listing = scrapeResult.listing;
      photos = listing.photo_urls;

      // Deduct scrape credits
      await deductCredits(user.id, CREDITS.SCRAPE, 'reelestate-scrape', {
        url: input.zillow_url,
        photo_count: photos.length,
      } as unknown as Json);
    } else if (input.manual_photos?.length) {
      // Manual upload
      photos = input.manual_photos;
      if (input.manual_listing_data) {
        listing = {
          address: input.manual_listing_data.address || '',
          city: input.manual_listing_data.city || '',
          state: input.manual_listing_data.state || '',
          zip: input.manual_listing_data.zip || '',
          price: input.manual_listing_data.price || 0,
          price_formatted: input.manual_listing_data.price_formatted || '',
          beds: input.manual_listing_data.beds || 0,
          baths: input.manual_listing_data.baths || 0,
          sqft: input.manual_listing_data.sqft || 0,
          property_type: input.manual_listing_data.property_type || 'Residential',
          description: input.manual_listing_data.description || '',
          photo_urls: photos,
          status: 'For Sale',
        };
      }
    } else {
      return { success: false, error: 'Provide a Zillow or Realtor.com URL, or upload photos' };
    }

    // Create listing record
    const createResult = await createListing({
      user_id: user.id,
      name: listing?.address || (input.zillow_url ? 'Zillow Listing' : 'Manual Upload'),
      zillow_url: input.zillow_url,
      source_type: sourceType,
      listing_data: listing,
      photo_urls: photos,
    });

    if (!createResult.success || !createResult.id) {
      return { success: false, error: createResult.error || 'Failed to save listing' };
    }

    return {
      success: true,
      listing_id: createResult.id,
      listing,
      photos,
    };
  } catch (error) {
    console.error('❌ Start project error:', error);
    return { success: false, error: 'Failed to start project' };
  }
}

// ═══════════════════════════════════════════
// Step 2: Analyze Photos
// ═══════════════════════════════════════════

export async function analyzeListingPhotos(
  listingId: string,
  photoUrls: string[],
  listingData?: ZillowListingData,
): Promise<ImageAnalysisResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, analyses: [], error: 'Authentication required' };

    // Credit check
    const batchCount = Math.ceil(photoUrls.length / 5);
    const cost = batchCount * CREDITS.ANALYZE_PER_BATCH;
    const creditCheck = await getUserCredits(user.id);
    if (!creditCheck.success || (creditCheck.credits || 0) < cost) {
      return { success: false, analyses: [], error: `Insufficient credits. Need ${cost}, have ${creditCheck.credits || 0}` };
    }

    await updateListing(listingId, { status: 'analyzing' });

    const result = await analyzeListingImages(photoUrls, listingData);

    if (!result.success) {
      await updateListing(listingId, { status: 'failed', error_message: result.error });
      return result;
    }

    // Save analysis and auto-select usable photos
    const usableIndices = result.analyses
      .filter(a => a.is_usable && a.quality_score >= 4)
      .map(a => a.index);

    await updateListing(listingId, {
      image_analysis: result.analyses as unknown as ImageAnalysis[],
      selected_indices: usableIndices,
      status: 'analyzed',
    } as Record<string, unknown>);

    // Deduct credits
    await deductCredits(user.id, cost, 'reelestate-analyze', {
      listing_id: listingId,
      photo_count: photoUrls.length,
    } as unknown as Json);

    return result;
  } catch (error) {
    console.error('❌ Analyze error:', error);
    return { success: false, analyses: [], error: 'Failed to analyze photos' };
  }
}

// ═══════════════════════════════════════════
// Step 3: Generate Script
// ═══════════════════════════════════════════

export async function generateScript(
  listingId: string,
  selectedAnalyses: ImageAnalysis[],
  listingData: ZillowListingData | null,
  targetDuration: TargetDuration = 30,
): Promise<ScriptGenerationResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required' };

    const creditCheck = await getUserCredits(user.id);
    if (!creditCheck.success || (creditCheck.credits || 0) < CREDITS.SCRIPT) {
      return { success: false, error: 'Insufficient credits' };
    }

    await updateListing(listingId, { status: 'scripting' });

    const result = await generateListingScript(selectedAnalyses, listingData, targetDuration);

    if (!result.success || !result.script) {
      await updateListing(listingId, { status: 'analyzed', error_message: result.error });
      return result;
    }

    await updateListing(listingId, {
      script_segments: result.script.segments as unknown as Record<string, unknown>[],
      status: 'script_ready',
    } as Record<string, unknown>);

    await deductCredits(user.id, CREDITS.SCRIPT, 'reelestate-script', {
      listing_id: listingId,
      segment_count: result.script.segments.length,
    } as unknown as Json);

    return result;
  } catch (error) {
    console.error('❌ Script generation error:', error);
    return { success: false, error: 'Failed to generate script' };
  }
}

// ═══════════════════════════════════════════
// Step 4: Generate Clips
// ═══════════════════════════════════════════

export async function generateClips(
  listingId: string,
  clipRequests: ClipGenerationRequest[],
): Promise<{ success: boolean; clips: ClipStatus[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, clips: [], error: 'Authentication required' };

    const totalCost = clipRequests.length * CREDITS.CLIP;
    const creditCheck = await getUserCredits(user.id);
    if (!creditCheck.success || (creditCheck.credits || 0) < totalCost) {
      return { success: false, clips: [], error: `Insufficient credits. Need ${totalCost}, have ${creditCheck.credits || 0}` };
    }

    await updateListing(listingId, { status: 'generating_clips' });

    const result = await generateAllListingClips(clipRequests);

    if (result.clips.length > 0) {
      await updateListing(listingId, {
        clip_predictions: result.clips as unknown as Record<string, unknown>[],
      } as Record<string, unknown>);
    }

    // Deduct credits for successfully started clips
    const startedCount = result.clips.filter(c => c.status !== 'failed').length;
    if (startedCount > 0) {
      await deductCredits(user.id, startedCount * CREDITS.CLIP, 'reelestate-clips', {
        listing_id: listingId,
        clip_count: startedCount,
      } as unknown as Json);
    }

    return result;
  } catch (error) {
    console.error('❌ Clip generation error:', error);
    return { success: false, clips: [], error: 'Failed to generate clips' };
  }
}

// ═══════════════════════════════════════════
// Step 5: Generate Voiceover
// ═══════════════════════════════════════════

export async function generateListingVoiceover(
  listingId: string,
  scriptText: string,
  voiceId: string,
  speed: number = 1.0,
): Promise<{ success: boolean; audio_url?: string; duration?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required' };

    const creditCheck = await getUserCredits(user.id);
    if (!creditCheck.success || (creditCheck.credits || 0) < CREDITS.VOICEOVER) {
      return { success: false, error: 'Insufficient credits for voiceover' };
    }

    await updateListing(listingId, { status: 'generating_voiceover' });

    const result = await generateVoiceForScript(
      scriptText,
      { voice_id: voiceId, speed },
      user.id,
    );

    if (!result.success || !result.audio_url) {
      await updateListing(listingId, { status: 'script_ready', error_message: result.error });
      return { success: false, error: result.error || 'Voiceover generation failed' };
    }

    // Save voiceover to listing
    await updateListing(listingId, {
      voiceover_url: result.audio_url,
      voiceover_duration_seconds: result.duration || null,
      status: 'script_ready',
    } as Record<string, unknown>);

    // Invalidate saved editor composition — new voiceover means entire timeline is stale
    await deleteSavedComposition(listingId);

    // Deduct credits
    await deductCredits(user.id, CREDITS.VOICEOVER, 'reelestate-voiceover', {
      listing_id: listingId,
      voice_id: voiceId,
    } as unknown as Json);

    return {
      success: true,
      audio_url: result.audio_url,
      duration: result.duration,
    };
  } catch (error) {
    console.error('❌ Voiceover generation error:', error);
    return { success: false, error: 'Failed to generate voiceover' };
  }
}

// ═══════════════════════════════════════════
// Photo Cleanup (inline from video pipeline)
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// Step 6: Render Video (Remotion)
// ═══════════════════════════════════════════

/**
 * Build Remotion input props and start a render on the Remotion server.
 * Uses photos (with cleaned versions swapped in) + Ken Burns + voiceover.
 */
export async function renderListingVideo(
  listingId: string,
  overrides?: {
    mediaUrls?: Record<number, string>; // video clip or photo URLs (overrides DB photos)
    musicUrl?: string | null;
    musicVolume?: number;
    introText?: string | null;
  },
): Promise<{ success: boolean; renderId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required' };

    // Credit check
    const creditCheck = await getUserCredits(user.id);
    if (!creditCheck.success || (creditCheck.credits || 0) < CREDITS.ASSEMBLY) {
      return { success: false, error: 'Insufficient credits for video rendering' };
    }

    // Load listing data from DB
    const { data: listing, error: fetchError } = await supabase
      .from('reelestate_listings')
      .select('*')
      .eq('id', listingId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !listing) {
      return { success: false, error: 'Listing not found' };
    }

    const segments = listing.script_segments as unknown as { index: number; image_index: number; voiceover: string; duration_seconds: number }[];
    const analyses = (listing.image_analysis || []) as unknown as ImageAnalysis[];
    const photos = listing.photo_urls as string[];
    const selectedIndices = listing.selected_indices as number[];
    const voiceoverUrl = listing.voiceover_url as string | null;
    const listingData = listing.listing_data as unknown as ZillowListingData | null;
    const aspectRatio = (listing.aspect_ratio as '16:9' | '9:16') || '16:9';

    // Allow rendering without voiceover (music-only mode)
    if (!selectedIndices?.length) {
      return { success: false, error: 'Please select photos before rendering' };
    }

    // Build segment timing — from voiceover script OR equal-duration auto-segments
    let remotionSegments: { startTime: number; endTime: number; duration: number; kenBurns: string }[];
    let totalDuration: number;

    if (segments?.length && voiceoverUrl) {
      // Voiceover mode: use script segment timing
      const selectedSegments = segments.filter(s => selectedIndices.includes(s.image_index));
      let currentTime = 0;
      remotionSegments = selectedSegments.map((seg) => {
        const analysis = analyses.find(a => a.index === seg.image_index);
        // Force zoom_in for all photos — pan/jib variants warp images and create artifacts
        const kenBurns = 'zoom_in';
        void analysis; // analysis kept for future per-photo tuning, but motion is fixed
        const duration = seg.duration_seconds;
        const startTime = currentTime;
        currentTime += duration;
        return { startTime, endTime: currentTime, duration, kenBurns };
      });
      totalDuration = currentTime;
    } else {
      // Music-only mode: auto-segments with equal duration per photo
      const targetDur = (listing.target_duration as number) || 30;
      const durationPerPhoto = targetDur / selectedIndices.length;
      let currentTime = 0;
      remotionSegments = selectedIndices.map((photoIdx) => {
        const analysis = analyses.find(a => a.index === photoIdx);
        // Force zoom_in for all photos — pan/jib variants warp images and create artifacts
        const kenBurns = 'zoom_in';
        void analysis; // analysis kept for future per-photo tuning, but motion is fixed
        const startTime = currentTime;
        currentTime += durationPerPhoto;
        return { startTime, endTime: currentTime, duration: durationPerPhoto, kenBurns };
      });
      totalDuration = currentTime;
    }

    // Build media map: use override URLs (video clips) or fall back to photos
    const photoMap: Record<number, string> = {};
    if (overrides?.mediaUrls && Object.keys(overrides.mediaUrls).length > 0) {
      // Use provided media URLs (video clips from AI animation)
      console.log('🎬 Using animated clip URLs:', overrides.mediaUrls);
      Object.entries(overrides.mediaUrls).forEach(([key, url]) => { photoMap[Number(key)] = url; });
    } else if (segments?.length && voiceoverUrl) {
      const selectedSegments = segments.filter(s => selectedIndices.includes(s.image_index));
      selectedSegments.forEach((seg, i) => { photoMap[i] = photos[seg.image_index]; });
    } else {
      selectedIndices.forEach((photoIdx, i) => { photoMap[i] = photos[photoIdx]; });
    }

    // Music & intro: use overrides (from UI) or fall back to DB values
    const musicUrl = overrides?.musicUrl !== undefined ? overrides.musicUrl : (listing.music_url as string | null);
    const musicVolume = overrides?.musicVolume !== undefined ? overrides.musicVolume : ((listing.music_volume as number) || 0.3);
    const introText = overrides?.introText !== undefined ? overrides.introText : (listing.intro_text as string | null);

    // Build Remotion input props
    const inputProps = {
      photos: photoMap,
      segments: remotionSegments,
      audioUrl: voiceoverUrl || '',
      backgroundMusic: musicUrl ? { url: musicUrl, volume: voiceoverUrl ? 0.15 : musicVolume } : null,
      introText,
      listing: listingData ? {
        address: listingData.address,
        beds: listingData.beds,
        baths: listingData.baths,
        sqft: listingData.sqft,
      } : null,
      totalDuration,
      aspectRatio,
    };

    await updateListing(listingId, { status: 'rendering', error_message: null });

    // Start async render
    const renderResult = await startRemotionRender({
      compositionId: 'ReelEstateVideo',
      inputProps,
      userId: user.id,
    });

    if (!renderResult.success || !renderResult.renderId) {
      await updateListing(listingId, { status: 'script_ready', error_message: renderResult.error });
      return { success: false, error: renderResult.error || 'Failed to start render' };
    }

    // Save render ID to DB
    await updateListing(listingId, {
      render_id: renderResult.renderId,
    } as Record<string, unknown>);

    return { success: true, renderId: renderResult.renderId };
  } catch (error) {
    console.error('❌ Render listing video error:', error);
    return { success: false, error: 'Failed to start video render' };
  }
}

/**
 * Check the render progress for a listing. When completed, downloads the video
 * from the Remotion server, uploads to Supabase Storage, and saves the URL.
 */
export async function checkListingRenderProgress(
  listingId: string,
): Promise<{
  success: boolean;
  status: string;
  progress: number;
  videoUrl?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, status: 'failed', progress: 0, error: 'Authentication required' };

    // Get render ID from DB
    const { data: listing, error: fetchError } = await supabase
      .from('reelestate_listings')
      .select('render_id, final_video_url')
      .eq('id', listingId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !listing) {
      return { success: false, status: 'failed', progress: 0, error: 'Listing not found' };
    }

    // If already completed, return the stored URL
    if (listing.final_video_url) {
      return { success: true, status: 'completed', progress: 1, videoUrl: listing.final_video_url };
    }

    const renderId = listing.render_id as string | null;
    if (!renderId) {
      return { success: false, status: 'failed', progress: 0, error: 'No render in progress' };
    }

    // Poll Remotion server
    const progress = await checkRemotionProgress(renderId);

    if (progress.status === 'failed') {
      await updateListing(listingId, { status: 'script_ready', error_message: progress.error });
      return { success: false, status: 'failed', progress: 0, error: progress.error };
    }

    if (progress.status === 'completed' && progress.videoUrl) {
      // Download from Remotion → upload to Supabase Storage
      const storagePath = `${user.id}/${listingId}/final_${Date.now()}.mp4`;
      const storeResult = await downloadAndStoreVideo(
        progress.videoUrl,
        storagePath,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any,
      );

      if (storeResult.success && storeResult.publicUrl) {
        await updateListing(listingId, {
          final_video_url: storeResult.publicUrl,
          status: 'completed',
        });

        // Deduct credits
        await deductCredits(user.id, CREDITS.ASSEMBLY, 'reelestate-render', {
          listing_id: listingId,
        } as unknown as Json);

        return { success: true, status: 'completed', progress: 1, videoUrl: storeResult.publicUrl };
      } else {
        // Fallback: use Remotion server URL directly
        await updateListing(listingId, {
          final_video_url: progress.videoUrl,
          status: 'completed',
        });

        await deductCredits(user.id, CREDITS.ASSEMBLY, 'reelestate-render', {
          listing_id: listingId,
        } as unknown as Json);

        return { success: true, status: 'completed', progress: 1, videoUrl: progress.videoUrl };
      }
    }

    // Still rendering
    return {
      success: true,
      status: progress.status,
      progress: progress.progress,
    };
  } catch (error) {
    console.error('❌ Check render progress error:', error);
    return { success: false, status: 'failed', progress: 0, error: 'Failed to check render progress' };
  }
}

// ═══════════════════════════════════════════
// Photo Cleanup (inline from video pipeline)
// ═══════════════════════════════════════════

export async function cleanupListingPhoto(
  listingId: string | undefined,
  imageUrl: string,
  preset: CleanupPreset,
  photoIndex?: number,
): Promise<CleanupResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, original_url: imageUrl, preset, error: 'Authentication required' };

    const creditCheck = await getUserCredits(user.id);
    if (!creditCheck.success || (creditCheck.credits || 0) < CREDITS.CLEANUP) {
      return { success: false, original_url: imageUrl, preset, error: 'Insufficient credits' };
    }

    const result = await cleanupPhoto(imageUrl, preset);

    if (result.success && result.cleaned_url) {
      await deductCredits(user.id, CREDITS.CLEANUP, 'reelestate-cleanup', {
        listing_id: listingId,
        preset,
      } as unknown as Json);

      // Persist cleaned URL to the listing's photo_urls array in the database
      // so the editor loads the cleaned version instead of the original
      if (listingId && photoIndex !== undefined) {
        try {
          const { data: listing } = await supabase
            .from('reelestate_listings')
            .select('photo_urls')
            .eq('id', listingId)
            .single();

          if (listing?.photo_urls) {
            const urls = [...(listing.photo_urls as string[])];
            if (photoIndex < urls.length) {
              urls[photoIndex] = result.cleaned_url;
              await supabase
                .from('reelestate_listings')
                .update({ photo_urls: urls, updated_at: new Date().toISOString() })
                .eq('id', listingId);
              console.log(`✅ Persisted cleaned URL to DB for photo index ${photoIndex}`);
            }
          }
        } catch (dbErr) {
          console.error('⚠️ Failed to persist cleaned URL to DB (cleanup still succeeded):', dbErr);
        }
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return { success: false, original_url: imageUrl, preset, error: 'Failed to clean photo' };
  }
}
