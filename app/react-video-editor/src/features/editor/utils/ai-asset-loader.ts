import { dispatch } from "@designcombo/events";
import { DESIGN_LOAD } from "@designcombo/state";
import { convertAIAssetsToEditorFormat, validateAIAssets, createMockAIComposition } from "./ai-asset-converter";

/**
 * AI Asset Loader
 * Fetches AI-generated assets and loads them into the React Video Editor
 */

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
    
    // Load into the editor using DESIGN_LOAD
    dispatch(DESIGN_LOAD, { payload: editorPayload });
    
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
 * Handles: /react-video-editor?loadAI=VIDEO_ID
 */
export function loadAIAssetsFromURL(): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('loadAI');
      const mockMode = urlParams.get('mock') === 'true';
      
      if (!videoId && !mockMode) {
        resolve({ skipped: true, reason: 'No loadAI parameter found' });
        return;
      }
      
      console.log('🔗 Loading AI assets from URL:', { videoId, mockMode });
      
      loadAIGeneratedAssets({
        video_id: videoId || undefined,
        loadMockData: mockMode,
        onProgress: (stage, progress) => {
          console.log(`📊 Loading progress: ${stage} (${progress}%)`);
        },
        onSuccess: (id) => {
          console.log('🎉 URL-based loading completed:', id);
          resolve({ success: true, video_id: id });
        },
        onError: (error) => {
          console.error('❌ URL-based loading failed:', error);
          reject(new Error(error));
        }
      });
      
    } catch (error) {
      console.error('❌ URL parsing error:', error);
      reject(error);
    }
  });
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