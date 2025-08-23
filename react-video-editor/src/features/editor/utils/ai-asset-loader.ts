import { dispatch } from "@designcombo/events";
import { DESIGN_LOAD } from "@designcombo/state";
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
    const editorPayload = convertAIAssetsToEditorFormat(aiAssets);
    
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
    const savedResponse = await fetch(savedUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (savedResponse.ok) {
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
      headers: { 'Content-Type': 'application/json' },
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
    const editorPayload = convertAIAssetsToEditorFormat(aiAssets);
    console.log('✅ Editor payload created:', {
      trackItems: editorPayload?.trackItems?.length || 0,
      duration: editorPayload?.duration || 0,
      fps: editorPayload?.fps || 0
    });
    
    console.log('📤 Dispatching DESIGN_LOAD from BlueFX loader...');
    
    // Load the complete composition all at once (more reliable than staggered loading)
    console.log(`📤 Loading complete BlueFX composition with ${editorPayload.trackItems.length} items...`);
    dispatch(DESIGN_LOAD, { payload: editorPayload });
    
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
export function clearEditorForAIAssets() {
  console.log('🧹 Clearing editor for new AI assets');
  
  // Load empty composition to clear the editor (proper DESIGN_LOAD format)
  dispatch(DESIGN_LOAD, {
    payload: {
      // Design properties
      fps: 30,
      size: { width: 1920, height: 1080 },
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