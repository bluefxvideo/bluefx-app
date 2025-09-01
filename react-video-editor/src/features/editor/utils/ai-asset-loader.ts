import { dispatch } from "@designcombo/events";
import { DESIGN_LOAD, ADD_ITEMS, DESIGN_RESIZE } from "@designcombo/state";
import { convertAIAssetsToEditorFormat, validateAIAssets, createMockAIComposition } from "./ai-asset-converter";
import { fixAllAIAssetPositioning } from "./ai-positioning-fix";

/**
 * AI Asset Loader
 * Fetches AI-generated assets and loads them into the React Video Editor
 */

// Prevent duplicate loading
let isLoading = false;

export interface AIAssetLoadOptions {
  video_id?: string;
  loadMockData?: boolean;
  onProgress?: (stage: string, progress: number) => void;
  onError?: (error: string) => void;
  onSuccess?: (video_id: string) => void;
}

/**
 * Load AI-generated assets into the editor
 */
export async function loadAIGeneratedAssets(options: AIAssetLoadOptions = {}) {
  const { video_id, loadMockData = false, onProgress, onError, onSuccess } = options;
  
  console.log('🎬 Loading AI-generated assets...', { video_id, loadMockData });
  
  try {
    onProgress?.('Fetching AI assets...', 20);
    
    let aiAssets;
    
    if (loadMockData) {
      // Load mock data for testing
      console.log('📝 Loading mock AI composition for testing');
      aiAssets = createMockAIComposition();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    } else if (video_id) {
      // Fetch real AI-generated assets from your database
      console.log('🔍 Fetching AI assets for video:', video_id);
      aiAssets = await fetchAIAssetsFromDatabase(video_id);
    } else {
      throw new Error('Either video_id or loadMockData must be provided');
    }
    
    onProgress?.('Validating assets...', 40);
    
    // Validate the AI assets
    if (!validateAIAssets(aiAssets)) {
      throw new Error('Invalid AI assets format');
    }
    
    onProgress?.('Converting to editor format...', 60);
    
    // Convert AI assets to editor format  
    // Use default 16:9 for general loader (legacy path)
    const editorPayload = convertAIAssetsToEditorFormat(aiAssets, '16:9');
    
    onProgress?.('Loading into editor...', 80);
    
    // Load audio/base composition with DESIGN_LOAD first
    console.log('📤 Dispatching DESIGN_LOAD from general loader...');
    
    // Create base composition with just audio and structure
    const basePayload = {
      ...editorPayload,
      trackItems: editorPayload.trackItems.filter(item => item.type === 'audio'),
      trackItemsMap: Object.fromEntries(
        Object.entries(editorPayload.trackItemsMap).filter(([_, item]) => item.type === 'audio')
      ),
      trackItemIds: editorPayload.trackItemIds.filter(id => editorPayload.trackItemsMap[id]?.type === 'audio'),
      tracks: editorPayload.tracks.filter(track => track.type === 'audio')
    };
    
    dispatch(DESIGN_LOAD, { payload: basePayload });
    
    // Add images individually using ADD_ITEMS (like sidebar does) for proper centering
    setTimeout(() => {
      const imageItems = editorPayload.trackItems.filter(item => item.type === 'image');
      console.log(`📤 Adding ${imageItems.length} images individually via ADD_ITEMS...`);
      
      imageItems.forEach((imageItem, index) => {
        setTimeout(() => {
          console.log(`📤 Adding image ${index + 1}: ${imageItem.details.src}`);
          dispatch(ADD_ITEMS, {
            payload: {
              trackItems: [{
                ...imageItem,
                details: {
                  src: imageItem.details.src
                  // Minimal details like sidebar images
                }
              }]
            }
          });
        }, index * 100); // Stagger the additions
      });
    }, 200);
    
    onProgress?.('Complete!', 100);
    onSuccess?.(aiAssets.video_id || 'mock-video');
    
    console.log('🎉 AI assets loaded successfully into editor!');
    return {
      success: true,
      video_id: aiAssets.video_id,
      trackCount: editorPayload.trackItems.length,
      duration: editorPayload.duration
    };
    
  } catch (error) {
    console.error('❌ Failed to load AI assets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    onError?.(errorMessage);
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Fetch AI assets from your Script-to-Video database
 */
async function fetchAIAssetsFromDatabase(video_id: string) {
  console.log('🗄️ Fetching from database...', video_id);
  
  try {
    // This should match your API endpoint for fetching script-video results
    const response = await fetch(`/api/script-video/${video_id}`);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'API returned error');
    }
    
    console.log('✅ AI assets fetched from database:', {
      video_id: data.video_id,
      segments: data.segments?.length || 0,
      images: data.generated_images?.length || 0,
      hasAudio: !!data.audio_url
    });
    
    return data;
    
  } catch (error) {
    console.error('❌ Database fetch error:', error);
    throw new Error(`Failed to fetch AI assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load AI assets from URL parameters
 * Handles BlueFX redirect format: /?videoId=ID&userId=ID&apiUrl=URL
 * Also supports legacy format: ?loadAI=VIDEO_ID
 */
export function loadAIAssetsFromURL(): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      // Prevent duplicate loading
      if (isLoading) {
        console.log('⏭️ Already loading AI assets, skipping...');
        resolve({ skipped: true, reason: 'Already loading' });
        return;
      }
      
      // Set a timeout to reset loading flag in case of hang
      const loadingTimeout = setTimeout(() => {
        if (isLoading) {
          console.warn('⚠️ Loading timeout - resetting flag');
          isLoading = false;
        }
      }, 30000); // 30 second timeout
      
      console.log('🔍 STEP 1: Checking URL for parameters');
      console.log('🔍 Current URL:', window.location.href);
      console.log('🔍 Search params:', window.location.search);
      
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check for BlueFX format first
      const videoId = urlParams.get('videoId');
      const userId = urlParams.get('userId');
      const apiUrl = urlParams.get('apiUrl');
      
      console.log('🔍 STEP 2: Parsed BlueFX parameters:', { videoId, userId, apiUrl });
      
      // Check for legacy format
      const legacyVideoId = urlParams.get('loadAI');
      const mockMode = urlParams.get('mock') === 'true';
      
      console.log('🔍 STEP 3: Legacy parameters:', { legacyVideoId, mockMode });
      
      if (videoId && userId && apiUrl) {
        // BlueFX format - fetch from BlueFX API
        console.log('🔗 Loading AI assets from BlueFX:', { videoId, userId, apiUrl });
        isLoading = true;
        
        loadAIAssetsFromBlueFX({
          videoId,
          userId,
          apiUrl,
          onProgress: (stage, progress) => {
            console.log(`📊 BlueFX Loading progress: ${stage} (${progress}%)`);
          },
          onSuccess: (id) => {
            console.log('🎉 BlueFX-based loading completed:', id);
            isLoading = false;
            clearTimeout(loadingTimeout);
            resolve({ success: true, video_id: id });
          },
          onError: (error) => {
            console.error('❌ BlueFX-based loading failed:', error);
            isLoading = false;
            clearTimeout(loadingTimeout);
            reject(new Error(error));
          }
        });
        
      } else if (legacyVideoId || mockMode) {
        // Legacy format
        console.log('🔗 Loading AI assets from URL (legacy):', { videoId: legacyVideoId, mockMode });
        isLoading = true;
        
        loadAIGeneratedAssets({
          video_id: legacyVideoId || undefined,
          loadMockData: mockMode,
          onProgress: (stage, progress) => {
            console.log(`📊 Loading progress: ${stage} (${progress}%)`);
          },
          onSuccess: (id) => {
            console.log('🎉 URL-based loading completed:', id);
            isLoading = false;
            clearTimeout(loadingTimeout);
            resolve({ success: true, video_id: id });
          },
          onError: (error) => {
            console.error('❌ URL-based loading failed:', error);
            isLoading = false;
            clearTimeout(loadingTimeout);
            reject(new Error(error));
          }
        });
        
      } else {
        clearTimeout(loadingTimeout);
        resolve({ skipped: true, reason: 'No video parameters found in URL' });
        return;
      }
      
    } catch (error) {
      console.error('❌ URL parsing error:', error);
      reject(error);
    }
  });
}

/**
 * Load AI assets from BlueFX API
 */
async function loadAIAssetsFromBlueFX({
  videoId,
  userId,
  apiUrl,
  onProgress,
  onSuccess,
  onError
}: {
  videoId: string;
  userId: string;
  apiUrl: string;
  onProgress?: (stage: string, progress: number) => void;
  onSuccess?: (video_id: string) => void;
  onError?: (error: string) => void;
}) {
  console.log('🚀 Starting BlueFX asset loading:', { videoId, userId, apiUrl });
  
  try {
    onProgress?.('Checking for saved composition...', 5);
    
    // FIRST: Check if there's a saved composition
    console.log('🔍 Checking for saved composition first...');
    // Ensure no double slashes in URL construction
    const cleanApiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const savedUrl = `${cleanApiUrl}/api/script-video/save-composition?user_id=${userId}&video_id=${videoId}`;
    console.log('🔗 Saved composition URL:', savedUrl);
    let savedResponse;
    try {
      savedResponse = await fetch(savedUrl, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });
    } catch (fetchError) {
      console.warn('⚠️ Failed to fetch saved composition, continuing with AI assets:', fetchError);
      savedResponse = null;
    }
    
    if (savedResponse && savedResponse.ok) {
      const savedData = await savedResponse.json();
      console.log('🔍 Saved composition response:', savedData);
      
      if (savedData.success && savedData.data && savedData.data.composition_data) {
        console.log('✅ Found saved composition! Loading that instead of AI assets.');
        console.log('🔍 Composition data structure:', {
          hasCompositionData: !!savedData.data.composition_data,
          hasTrackItemsMap: !!savedData.data.composition_data?.trackItemsMap,
          keys: savedData.data.composition_data ? Object.keys(savedData.data.composition_data) : []
        });
        
        onProgress?.('Loading saved composition...', 50);
        
        // Validate composition data structure before loading
        if (savedData.data.composition_data.trackItemsMap) {
          // Load the saved composition directly
          dispatch(DESIGN_LOAD, { 
            payload: savedData.data.composition_data 
          });
          
          onProgress?.('Complete!', 100);
          onSuccess?.(videoId);
          
          console.log('🎉 Saved composition loaded successfully!');
          return; // Exit early - we loaded the saved version
        } else {
          console.log('⚠️ Saved composition missing trackItemsMap, falling back to AI asset loading');
        }
      } else {
        console.log('ℹ️ No saved composition found, proceeding with AI asset loading');
      }
    }
    
    console.log('📭 No saved composition found, loading AI assets...');
    onProgress?.('Connecting to BlueFX...', 10);
    
    console.log('🔗 Fetching video data from BlueFX API:', `${cleanApiUrl}/api/script-video/editor-data`);
    console.log('🔗 Request payload:', { user_id: userId, videoId: videoId });
    
    // Fetch video data from BlueFX API
    const response = await fetch(`${cleanApiUrl}/api/script-video/editor-data`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ user_id: userId, videoId: videoId })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ BlueFX API error:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`BlueFX API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    onProgress?.('Processing video data...', 30);
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'BlueFX API returned error');
    }
    
    const videoData = data.data;
    console.log('✅ Received BlueFX video data:', {
      videoId: videoData.videoId,
      script: videoData.script?.substring(0, 100) + '...',
      voiceUrl: videoData.voice?.url,
      imageCount: videoData.images?.urls?.length || 0,
      captionCount: 0 // Captions now generated on-demand in editor
    });
    
    onProgress?.('Converting to editor format...', 60);
    
    // Convert BlueFX data to AI assets format
    const aiAssets = convertBlueFXDataToAIAssets(videoData);
    console.log('🔄 Converted AI assets:', {
      video_id: aiAssets.video_id,
      hasScript: !!aiAssets.script,
      imageCount: aiAssets.generated_images?.length || 0,
      hasAudio: !!aiAssets.audio_url,
      segmentCount: aiAssets.segments?.length || 0
    });
    
    // Extract aspect ratio from video data
    const aspectRatio = videoData.imageData?.generation_params?.aspect_ratio || 
                       videoData.image_data?.generation_params?.aspect_ratio || 
                       '9:16'; // Default based on main app preference
    console.log('🔍 Extracted aspect ratio:', aspectRatio);
    console.log('🔍 Video data structure:', {
      imageData: videoData.imageData,
      image_data: videoData.image_data,
      generation_params_imageData: videoData.imageData?.generation_params,
      generation_params_image_data: videoData.image_data?.generation_params
    });
    
    // Validate the converted assets
    console.log('🔍 Validating converted assets...');
    const isValid = validateAIAssets(aiAssets);
    console.log('🔍 Validation result:', isValid);
    
    if (!isValid) {
      console.error('❌ Asset validation failed:', aiAssets);
      throw new Error('Invalid converted assets format - check console for details');
    }
    
    onProgress?.('Loading into editor...', 80);
    
    // Convert to editor format and dispatch directly (avoid duplicate loading)
    console.log('🔄 Converting to editor format...');
    const editorPayload = convertAIAssetsToEditorFormat(aiAssets, aspectRatio);
    console.log('✅ Editor payload created:', {
      trackItems: editorPayload?.trackItems?.length || 0,
      duration: editorPayload?.duration || 0,
      fps: editorPayload?.fps || 0,
      audioItems: editorPayload?.trackItems?.filter(item => item.type === 'audio').length || 0,
      imageItems: editorPayload?.trackItems?.filter(item => item.type === 'image').length || 0,
      canvasSize: editorPayload?.size,
      aspectRatioUsed: aspectRatio
    });
    
    console.log('🔍 DEBUG: All track items by type:', {
      audio: editorPayload?.trackItems?.filter(item => item.type === 'audio').map(item => ({
        id: item.id,
        src: item.details?.src,
        duration: item.duration
      })) || [],
      image: editorPayload?.trackItems?.filter(item => item.type === 'image').length || 0
    });
    
    console.log('📤 Dispatching DESIGN_LOAD from BlueFX loader...');
    
    // Load base composition with proper track structure (audio first, then add images to separate tracks)
    const basePayload = {
      ...editorPayload,
      trackItems: editorPayload.trackItems.filter(item => item.type === 'audio'),
      trackItemsMap: Object.fromEntries(
        Object.entries(editorPayload.trackItemsMap).filter(([_, item]) => item.type === 'audio')
      ),
      trackItemIds: editorPayload.trackItemIds.filter(id => editorPayload.trackItemsMap[id]?.type === 'audio'),
      tracks: editorPayload.tracks.filter(track => track.type === 'audio')
    };
    
    console.log(`📤 Loading base composition with ${basePayload.trackItems.length} audio items...`);
    console.log('🔍 DEBUG: Base payload audio items:', basePayload.trackItems.map(item => ({
      id: item.id,
      type: item.type,
      src: item.details?.src,
      duration: item.duration
    })));
    console.log('🔍 DEBUG: Audio tracks:', basePayload.tracks);
    
    dispatch(DESIGN_LOAD, { payload: basePayload });
    
    // Ensure canvas size matches the aspect ratio (since StateManager might be initialized with default size)
    // Add delay to ensure DESIGN_LOAD is fully processed and all state is settled
    setTimeout(() => {
      console.log('📐 Dispatching DESIGN_RESIZE to match aspect ratio:', editorPayload.size);
      console.log('📐 DESIGN_RESIZE payload:', {
        width: editorPayload.size.width,
        height: editorPayload.size.height,
        name: aspectRatio
      });
      console.log('📐 DESIGN_RESIZE event being dispatched now...');
      dispatch(DESIGN_RESIZE, {
        payload: {
          width: editorPayload.size.width,
          height: editorPayload.size.height,
          name: aspectRatio
        }
      });
      console.log('📐 DESIGN_RESIZE dispatched successfully');
    }, 500); // Increased delay to ensure all loading is complete
    
    // Add images to separate tracks using ADD_ITEMS (with small delay to avoid conflicts)
    const imageItems = editorPayload.trackItems.filter(item => item.type === 'image');
    console.log(`📤 Adding ${imageItems.length} images to separate tracks...`);
    
    // Add images after base composition is loaded to avoid overriding audio
    if (imageItems.length > 0) {
      setTimeout(() => {
        console.log('📤 Now adding images after audio is settled...');
        console.log('🔍 DEBUG: About to dispatch ADD_ITEMS for images');
        dispatch(ADD_ITEMS, {
          payload: {
            trackItems: imageItems.map(imageItem => ({
              ...imageItem,
              details: {
                src: imageItem.details.src
                // Keep minimal details for proper track separation
              }
            }))
          }
        });
        console.log('✅ ADD_ITEMS dispatched for images');
      }, 100); // Small delay to let audio settle
    }

    // Check for existing captions before completing (will auto-generate if missing)
    onProgress?.('Checking for existing captions...', 90);
    await checkAndLoadExistingCaptions(videoData, userId, cleanApiUrl, onProgress, aiAssets.timeline_data.total_duration);
    
    onProgress?.('Complete!', 100);
    onSuccess?.(videoData.videoId);
    
    console.log('🎉 BlueFX video data loaded successfully into editor!');
    
  } catch (error) {
    console.error('❌ Failed to load BlueFX assets:', error);
    console.error('❌ Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    onError?.(errorMessage);
    throw error;
  }
}

/**
 * Convert BlueFX video data to AI assets format
 */
function convertBlueFXDataToAIAssets(videoData: any) {
  console.log('🔄 Converting BlueFX data to AI assets format');
  
  // Convert images to expected format
  console.log('🔍 Converting images - raw videoData.images:', videoData.images);
  console.log('🔍 URLs array:', videoData.images?.urls);
  
  const generated_images = (videoData.images?.urls || []).map((url: any, index: number) => {
    console.log(`🔍 Processing image ${index}:`, { url, type: typeof url });
    
    // Ensure URL is a string
    const imageUrl = typeof url === 'string' ? url : (url?.url || String(url));
    console.log(`🔍 Final image URL ${index}:`, imageUrl);
    
    return {
      url: imageUrl,
      segment_index: index,
      prompt: videoData.images?.segments?.[index]?.image_prompt || `Image ${index + 1}`
    };
  });
  
  // Convert segments to expected format
  console.log('🔍 Converting segments - raw videoData.images?.segments:', videoData.images?.segments);
  
  const segments = (videoData.images?.segments || []).map((segment: any, index: number) => {
    console.log(`🔍 Processing segment ${index}:`, {
      id: segment.id,
      text: segment.text,
      start_time: segment.start_time,
      end_time: segment.end_time,
      duration: segment.duration
    });
    
    // Fix null start_time by using word_timings data or calculating from whisper analysis
    let calculatedStartTime = segment.start_time;
    let calculatedEndTime = segment.end_time;
    let calculatedDuration = segment.duration;
    
    if (!calculatedStartTime && segment.word_timings && segment.word_timings.length > 0) {
      // Use first word's start time
      calculatedStartTime = segment.word_timings[0].start;
      console.log(`🔧 Fixed start_time for segment ${index} using word timings: ${calculatedStartTime}`);
    }
    
    if (!calculatedStartTime) {
      // Fallback: use index-based timing
      calculatedStartTime = index * 5;
      console.log(`🔧 Fallback start_time for segment ${index}: ${calculatedStartTime}`);
    }
    
    if (!calculatedDuration && calculatedEndTime && calculatedStartTime) {
      calculatedDuration = calculatedEndTime - calculatedStartTime;
    } else if (!calculatedDuration) {
      calculatedDuration = 5; // Default 5 seconds
    }
    
    const convertedSegment = {
      id: segment.id || `segment-${index}`,
      text: segment.text || `Segment ${index + 1}`,
      start_time: calculatedStartTime,
      end_time: calculatedEndTime || (calculatedStartTime + calculatedDuration),
      duration: calculatedDuration,
      image_prompt: segment.image_prompt || segment.visual_description || `Image prompt ${index + 1}`
    };
    
    console.log(`🔍 Final segment ${index}:`, convertedSegment);
    return convertedSegment;
  });
  
  // Calculate total duration based on actual segment end times
  const calculatedDurationFromSegments = segments.length > 0 
    ? Math.max(...segments.map(s => s.end_time || 0))
    : 0;
    
  let totalDuration = calculatedDurationFromSegments || 
                        videoData.metadata?.totalDuration || 
                        Math.max(segments.length * 5, 30); // Fallback
  
  console.log('🔍 Duration calculation:', {
    calculatedFromSegments: calculatedDurationFromSegments,
    metadataDuration: videoData.metadata?.totalDuration,
    fallbackDuration: Math.max(segments.length * 5, 30),
    finalDuration: totalDuration,
    lastSegmentEndTime: segments.length > 0 ? segments[segments.length - 1].end_time : 'none'
  });
  
  // TEMPORARY FIX: Use Whisper analysis duration if available and segments seem truncated
  if (videoData.whisperData?.total_duration && 
      videoData.whisperData.total_duration > totalDuration + 5) {
    console.log(`🔧 TIMING OVERRIDE: Using Whisper duration ${videoData.whisperData.total_duration}s instead of segment duration ${totalDuration}s`);
    const whisperDuration = videoData.whisperData.total_duration;
    
    // Proportionally extend segments to match Whisper duration
    const scaleFactor = whisperDuration / totalDuration;
    segments.forEach((segment, idx) => {
      const originalEnd = segment.end_time;
      segment.start_time = segment.start_time * scaleFactor;
      segment.end_time = segment.end_time * scaleFactor;
      segment.duration = segment.end_time - segment.start_time;
      console.log(`📐 Extended segment ${idx + 1}: ${originalEnd}s → ${segment.end_time.toFixed(2)}s`);
    });
    
    totalDuration = whisperDuration;
  }
  
  return {
    success: true, // Important: this is required by validateAIAssets
    video_id: videoData.videoId,
    final_script: videoData.script,
    audio_url: videoData.voice?.url,
    generated_images,
    segments,
    timeline_data: {
      total_duration: totalDuration,
      segment_count: segments.length,
      frame_count: Math.floor(totalDuration * (videoData.metadata?.frameRate || 30))
    },
    word_timings: [], // Word timings now come from on-demand Whisper analysis
    caption_chunks: {
      total_chunks: 0,
      chunks: [], // Captions generated on-demand via AI Caption Generator
      quality_score: 0,
      avg_words_per_chunk: 0
    },
    whisper_data: videoData.voice?.whisperData,
    metadata: {
      totalDuration: totalDuration,
      frameRate: videoData.metadata?.frameRate || 30,
      wordCount: videoData.metadata?.wordCount || 0,
      speakingRate: videoData.metadata?.speakingRate || 0,
      creditsUsed: videoData.metadata?.creditsUsed || 0
    }
  };
}

/**
 * Clear current composition and prepare for new AI assets
 */
export function clearEditorForAIAssets(aspectRatio: string = '16:9') {
  console.log('🧹 Clearing editor for new AI assets with aspect ratio:', aspectRatio);
  
  // Calculate canvas size based on aspect ratio
  const getCanvasSizeForAspectRatio = (ratio: string): { width: number; height: number } => {
    const aspectRatioMap: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1920, height: 1080 },
      '9:16': { width: 1080, height: 1920 },
      '1:1': { width: 1080, height: 1080 },
      '4:3': { width: 1440, height: 1080 },
      '4:5': { width: 1080, height: 1350 },
    };
    return aspectRatioMap[ratio] || aspectRatioMap['16:9'];
  };
  
  const canvasSize = getCanvasSizeForAspectRatio(aspectRatio);
  console.log('📐 Clearing with canvas size:', canvasSize);
  
  // Load empty composition to clear the editor (proper DESIGN_LOAD format)
  dispatch(DESIGN_LOAD, {
    payload: {
      // Design properties
      fps: 30,
      size: canvasSize,
      duration: 30000, // Default 30 seconds
      
      // Track items (empty)
      trackItems: [],
      trackItemsMap: {},
      trackItemIds: [],
      
      // Tracks structure (empty)
      tracks: [],
      
      // Selection and transitions (empty)
      activeIds: [],
      transitionsMap: {},
      transitionIds: [],
      
      // Timeline scale (default)
      scale: {
        index: 7,
        unit: 300,
        zoom: 1 / 300,
        segments: 5
      },
      
      // Background (default)
      background: {
        type: "color",
        value: "transparent"
      },
      
      // Structure (empty)
      structure: []
    }
  });
}

/**
 * Utility: Check if editor has AI-generated content
 */
export function hasAIGeneratedContent(trackItemsMap: Record<string, any>): boolean {
  return Object.values(trackItemsMap).some(
    (item: any) => item.metadata?.aiGenerated === true
  );
}

/**
 * Utility: Get AI generation info from editor content
 */
export function getAIGenerationInfo(trackItemsMap: Record<string, any>) {
  const aiTracks = Object.values(trackItemsMap).filter(
    (item: any) => item.metadata?.aiGenerated === true
  );
  
  return {
    hasAIContent: aiTracks.length > 0,
    totalAITracks: aiTracks.length,
    audioTracks: aiTracks.filter((t: any) => t.type === 'audio').length,
    imageTracks: aiTracks.filter((t: any) => t.type === 'image').length,
    captionTracks: aiTracks.filter((t: any) => t.type === 'text' && t.details?.isCaptionTrack).length,
    videoId: aiTracks.find((t: any) => t.metadata?.resourceId)?.metadata?.resourceId
  };
}

/**
 * Development helper: Load test AI assets
 */
export function loadTestAIAssets() {
  console.log('🧪 Loading test AI assets for development');
  return loadAIGeneratedAssets({ loadMockData: true });
}

/**
 * Add generated captions to the editor timeline using the correct format
 */
async function addCaptionsToEditor(captions: any[], audioDuration?: number) {
  console.log('🎬 Adding captions to editor:', captions.length);
  console.log('🎬 Audio duration:', audioDuration, 'seconds');
  
  try {
    // Import the proper caption conversion function
    const { captionsToTrackItems } = await import('../../../hooks/use-caption-generator');
    
    // Convert captions to unified track format (same as sidebar system)
    const captionTrackItems = captionsToTrackItems(captions, 'auto-generated-captions');
    
    // If we have audio duration, ensure the caption track matches it
    if (audioDuration && captionTrackItems.length > 0) {
      const audioDurationMs = Math.round(audioDuration * 1000);
      const audioDurationFrames = Math.round(audioDuration * 30); // 30 FPS
      
      console.log('🎬 Adjusting caption track duration:', {
        originalDurationFrames: captionTrackItems[0].duration,
        newDurationFrames: audioDurationFrames,
        audioDurationSeconds: audioDuration
      });
      
      // Update the caption track duration and display range to match audio
      captionTrackItems[0].duration = audioDurationFrames;
      captionTrackItems[0].display = {
        from: 0,
        to: audioDurationMs
      };
    }
    
    console.log('🎬 Final caption track items:', captionTrackItems);
    
    // Add captions using ADD_ITEMS dispatch
    dispatch(ADD_ITEMS, {
      payload: {
        trackItems: captionTrackItems
      }
    });
    
    console.log('✅ Captions dispatched to editor as unified track');
    
  } catch (error) {
    console.error('❌ Error adding captions to editor:', error);
  }
}

/**
 * Auto-generate captions when none exist
 */
async function autoGenerateCaptions(
  videoData: any,
  userId: string, 
  apiUrl: string,
  onProgress?: (stage: string, progress: number) => void,
  totalDuration?: number
) {
  console.log('🎬 Starting auto caption generation...');
  console.log('🎬 Video data structure for captions:', {
    hasVoice: !!videoData.voice,
    hasVoiceUrl: !!videoData.voice?.url,
    hasWhisperData: !!videoData.voice?.whisperData,
    voiceKeys: videoData.voice ? Object.keys(videoData.voice) : [],
    userId,
    videoId: videoData.videoId
  });
  
  try {
    onProgress?.('Generating captions...', 92);
    
    // Get audio URL from the loaded video data
    const audioUrl = videoData.voice?.url || videoData.voice?.whisperData?.audio_url;
    
    if (!audioUrl) {
      console.warn('⚠️ No audio URL found for caption generation');
      console.warn('⚠️ Available video data:', videoData);
      return;
    }
    
    console.log('🎬 Audio URL for captions:', audioUrl);
    
    // Import caption generation functions
    const { generateCaptionsFromRequest } = await import('../../../actions/generate-captions');
    
    // Generate captions using the same request format as the UI component
    const captionRequest = {
      audioUrl: audioUrl,
      userId: userId,
      videoId: videoData.videoId,
      options: {
        style: 'modern' as const,
        position: 'bottom' as const,
        fontSize: 'medium' as const,
        maxWordsPerLine: 6,
        generator: 'whisper-caption-orchestrator' as const,
        audioDuration: totalDuration // Pass audio duration for proper caption boundary checking
      }
    };
    
    console.log('🎬 Caption generation request:', captionRequest);
    
    const result = await generateCaptionsFromRequest(captionRequest);
    
    console.log('🎬 Caption generation result:', result);
    
    if (result.success && result.captions?.length > 0) {
      console.log('✅ Auto caption generation successful:', {
        chunks: result.captions.length,
        totalDuration: result.total_duration,
        avgWordsPerChunk: result.avg_words_per_chunk
      });
      
      onProgress?.('Captions generated successfully!', 95);
      
      // Add captions to the editor timeline
      console.log('🎬 Adding captions to editor timeline...');
      await addCaptionsToEditor(result.captions, result.total_duration);
      console.log('✅ Captions added to editor timeline');
    } else {
      console.warn('⚠️ Caption generation failed:');
      console.warn('⚠️ Result object:', result);
      console.warn('⚠️ Result.error:', result.error);
      console.warn('⚠️ Result.success:', result.success);
    }
    
  } catch (error) {
    console.error('❌ Auto caption generation error:', error);
  }
}

/**
 * Check for existing captions in database and load them if found
 */
async function checkAndLoadExistingCaptions(
  videoData: any, 
  userId: string, 
  apiUrl: string, 
  onProgress?: (stage: string, progress: number) => void,
  totalDuration?: number
) {
  console.log('🔍 Checking for existing captions in database...');
  
  try {
    // Check both script_to_video_history.caption_data and video_editor_compositions.caption_chunks
    const videoId = videoData.videoId;
    
    // Method 1: Check saved composition for caption data
    const savedCaptionsUrl = `${apiUrl}/api/script-video/save-composition?user_id=${userId}&video_id=${videoId}`;
    console.log('🔗 Checking saved composition for captions:', savedCaptionsUrl);
    
    try {
      const savedResponse = await fetch(savedCaptionsUrl, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (savedResponse.ok) {
        const savedData = await savedResponse.json();
        console.log('🔍 Saved composition caption check:', {
          success: savedData.success,
          hasData: !!savedData.data,
          hasCaptionChunks: savedData.data?.caption_chunks?.length > 0,
          hasCaptionMetadata: !!savedData.data?.caption_metadata,
          captionCount: savedData.data?.caption_chunks?.length || 0
        });
        
        if (savedData.success && savedData.data?.caption_chunks?.length > 0) {
          console.log('✅ Found existing captions in saved composition! Loading them...');
          onProgress?.('Loading existing captions...', 95);
          
          // Convert database caption chunks to timeline format
          const captionChunks = savedData.data.caption_chunks;
          const captionSegments = captionChunks.map((chunk: any, index: number) => ({
            id: chunk.id || `caption-${index}`,
            start: Math.round((chunk.start_time || 0) * 1000), // Convert to milliseconds
            end: Math.round((chunk.end_time || chunk.start_time + chunk.duration || 0) * 1000),
            text: chunk.text || '',
            words: [], // Word boundaries not stored in this format
            confidence: 0.9,
            style: {
              fontSize: 48,
              color: '#FFFFFF',
              activeColor: '#FFFF00',
              appearedColor: '#FFFFFF'
            }
          }));
          
          if (captionSegments.length > 0) {
            // Calculate total duration
            const totalDuration = Math.max(...captionSegments.map(seg => seg.end));
            
            // Create caption track item for timeline
            const captionTrackItem = {
              id: 'db-captions',
              type: 'text',
              start: 0,
              duration: Math.round(totalDuration / 1000 * 30), // Convert to frames
              details: {
                text: '💾 Database Captions',
                fontSize: 48,
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                color: '#00FF88',
                textAlign: 'center',
                isCaptionTrack: true,
                top: '75%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80%',
                captionSegments: captionSegments
              },
              metadata: {
                source: 'database-loaded',
                totalCaptions: captionSegments.length,
                fromSavedComposition: true
              }
            };
            
            // Add caption track to editor
            setTimeout(() => {
              console.log('📤 Adding database captions to editor...');
              dispatch(ADD_ITEMS, {
                payload: {
                  trackItems: [captionTrackItem]
                }
              });
              console.log('✅ Database captions loaded successfully!');
            }, 200);
            
            return; // Exit early - we found and loaded existing captions
          }
        }
      } else {
        console.log('⚠️ Saved composition request failed:', savedResponse.status);
      }
    } catch (fetchError) {
      console.warn('⚠️ Failed to check saved composition captions:', fetchError);
    }
    
    // Method 2: Check script_to_video_history table directly (if needed in the future)
    // This would require a separate API endpoint to check the main video record
    
    console.log('ℹ️ No existing captions found in database - generating automatically...');
    
    // Auto-generate captions when none exist (with proper error isolation)
    console.log('🎬 Starting caption auto-generation...');
    autoGenerateCaptions(videoData, userId, apiUrl, onProgress, totalDuration)
      .then(() => {
        console.log('✅ Caption auto-generation completed successfully');
      })
      .catch((captionError) => {
        console.warn('⚠️ Caption auto-generation failed (non-blocking):', captionError);
      });
    
  } catch (error) {
    console.warn('⚠️ Error checking for existing captions, continuing without them:', error);
  }
}