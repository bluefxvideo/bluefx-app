import { generateId } from "@designcombo/timeline";
import { ITrackItem } from "@designcombo/types";

/**
 * AI Asset Converter
 * Converts Script-to-Video AI orchestrator output into React Video Editor format
 */

// Types for AI-generated data (matches your ScriptToVideoResponse)
export interface AIGeneratedAssets {
  success: boolean;
  video_id?: string;
  video_url?: string;
  audio_url?: string;
  generated_images?: Array<{
    url: string;
    segment_index: number;
    prompt: string;
  }>;
  final_script?: string;
  segments?: Array<{
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    duration: number;
    image_prompt: string;
  }>;
  timeline_data?: {
    total_duration: number;
    segment_count: number;
    frame_count: number;
  };
  // Whisper word timings (if available)
  word_timings?: Array<{
    segment_id: string;
    text: string;
    start_time: number;
    end_time: number;
    duration: number;
    word_timings: Array<{
      word: string;
      start: number;
      end: number;
      confidence: number;
    }>;
  }>;
  // NEW: Separate caption chunks from new table structure
  caption_chunks?: {
    total_chunks: number;
    chunks: Array<{
      id?: string;
      text_content: string;
      start_time: number;
      end_time: number;
      duration: number;
      chunk_index: number;
      word_count?: number;
      confidence_score?: number;
      word_timings?: any[];
      speaker_id?: string;
      language_code?: string;
      display_text?: string;
      style_properties?: any;
      generation_method?: string;
      quality_score?: number;
      primary_segment_id?: string;
      related_segment_ids?: string[];
    }>;
    quality_score: number;
    avg_words_per_chunk: number;
  };
}

// React Video Editor payload format (matching DESIGN_LOAD structure)
export interface EditorCompositionPayload {
  // Design properties
  fps: number;
  size: { width: number; height: number };
  duration: number;
  
  // Track items
  trackItems: ITrackItem[];
  trackItemsMap: Record<string, ITrackItem>;
  trackItemIds: string[];
  
  // Tracks structure
  tracks: Array<{
    id: string;
    name: string;
    type: string;
    items: string[];
    accepts?: string[];
    visible?: boolean;
    locked?: boolean;
  }>;
  
  // Selection and transitions
  activeIds: string[];
  transitionsMap: Record<string, any>;
  transitionIds: string[];
  
  // Timeline scale
  scale: {
    index: number;
    unit: number;
    zoom: number;
    segments: number;
  };
  
  // Background
  background: {
    type: "color" | "image";
    value: string;
  };
  
  // Structure (for complex compositions)
  structure: any[];
}

/**
 * Main conversion function - converts AI assets to proper DESIGN_LOAD format
 */
export function convertAIAssetsToEditorFormat(
  aiAssets: AIGeneratedAssets,
  aspectRatio?: string
): EditorCompositionPayload {
  console.log('🔄 Converting AI assets to editor format:', aiAssets);
  console.log('🔄 Using aspect ratio:', aspectRatio);
  
  if (!aiAssets.success || !aiAssets.segments || !aiAssets.timeline_data) {
    throw new Error('Invalid AI assets data');
  }
  
  // Calculate dynamic canvas size based on aspect ratio
  const canvasSize = getCanvasSizeForAspectRatio(aspectRatio || '16:9');
  console.log('📐 Canvas size calculated:', canvasSize);

  const trackItems: ITrackItem[] = [];
  const totalDurationMs = aiAssets.timeline_data.total_duration * 1000; // Convert to milliseconds
  
  // 1. Create Audio Track (if available)
  if (aiAssets.audio_url) {
    const audioTrack: ITrackItem = {
      id: generateId(),
      type: "audio",
      name: "AI Generated Voice",
      display: {
        from: 0,
        to: totalDurationMs
      },
      trim: {
        from: 0,
        to: totalDurationMs
      },
      playbackRate: 1,
      details: {
        src: aiAssets.audio_url,
        volume: 100
      },
      metadata: {
        aiGenerated: true,
        generationType: 'voice',
        originalScript: aiAssets.final_script || ''
      },
      duration: totalDurationMs,
      isMain: false
    };
    
    trackItems.push(audioTrack);
    console.log('✅ Added audio track:', audioTrack.details.src);
  }

  // 2. Create Image Tracks (per segment)
  if (aiAssets.generated_images && aiAssets.segments) {
    aiAssets.generated_images.forEach((img, index) => {
      const segment = aiAssets.segments![index];
      if (!segment) {
        console.warn(`No segment found for image ${index}`);
        return;
      }

      // Use uniform zoom-in effect for all images
      const selectedPreset = 'zoom-in';
      
      // Use consistent intensity for uniform effect
      const intensity = 40; // Stronger zoom intensity for more noticeable effect

      const imageTrack: ITrackItem = {
        id: generateId(),
        type: "image",
        name: `AI Image ${index + 1}`,
        display: {
          from: segment.start_time * 1000,  // Convert to milliseconds
          to: segment.end_time * 1000
        },
        details: {
          src: img.url,
          // Set to fill entire canvas
          width: canvasSize.width,
          height: canvasSize.height,
          left: 0,
          top: 0,
          scaleMode: 'cover' // Ensure image covers entire canvas
        },
        metadata: {
          aiGenerated: true,
          generationType: 'image',
          prompt: img.prompt,
          segmentId: segment.id,
          segmentText: segment.text,
          aspectRatio: aspectRatio || '16:9',  // Store aspect ratio for regeneration
          // Add Ken Burns effect by default
          kenBurns: {
            preset: selectedPreset,
            intensity: intensity,
            smoothness: 'linear', // Linear motion for uniform effect
            speed: 1.8  // Faster default speed for more dynamic effect
          }
        },
        duration: segment.duration * 1000
      };

      trackItems.push(imageTrack);
      console.log(`✅ Added image track ${index + 1}:`, img.url);
    });
  }

  // 3. Caption tracks are now generated on-demand via AI Caption Generator
  // No automatic caption track creation

  // 4. Build the complete DESIGN_LOAD payload with proper structure
  const trackItemsMap: Record<string, ITrackItem> = {};
  const trackItemIds: string[] = [];
  
  trackItems.forEach(item => {
    trackItemsMap[item.id] = item;
    trackItemIds.push(item.id);
  });

  // Create proper tracks structure with items assigned
  const audioItems = trackItems.filter(item => item.type === 'audio').map(item => item.id);
  const imageItems = trackItems.filter(item => item.type === 'image').map(item => item.id);
  const textItems = trackItems.filter(item => item.type === 'text').map(item => item.id);

  const tracks = [];
  
  // Only create tracks that have items
  if (audioItems.length > 0) {
    tracks.push({
      id: generateId(),
      name: 'Audio',
      type: 'audio',
      items: audioItems,
      accepts: ['audio'],
      visible: true,
      locked: false
    });
  }
  
  if (imageItems.length > 0) {
    tracks.push({
      id: generateId(),
      name: 'Images', 
      type: 'image',
      items: imageItems,
      accepts: ['image'],
      visible: true,
      locked: false
    });
  }
  
  if (textItems.length > 0) {
    tracks.push({
      id: generateId(),
      name: 'Captions',
      type: 'text', 
      items: textItems,
      accepts: ['text', 'caption'],
      visible: true,
      locked: false
    });
  }

  const payload: EditorCompositionPayload = {
    // Main state structure matching DESIGN_LOAD format
    fps: 30,
    size: canvasSize,
    duration: totalDurationMs,
    
    // Track items
    trackItems,
    trackItemsMap,
    trackItemIds,
    
    // Tracks structure
    tracks,
    
    // Selection and transitions
    activeIds: [],
    transitionsMap: {},
    transitionIds: [],
    
    // Timeline scale
    scale: {
      index: 7,
      unit: 300,
      zoom: 1 / 300,
      segments: 5
    },
    
    // Background
    background: {
      type: "color",
      value: "transparent"
    },
    
    // Structure (empty for now)
    structure: []
  };

  console.log('🎉 AI to Editor conversion complete:', {
    totalTracks: trackItems.length,
    audioTracks: trackItems.filter(t => t.type === 'audio').length,
    imageTracks: trackItems.filter(t => t.type === 'image').length,
    captionTracks: trackItems.filter(t => t.type === 'text').length,
    totalDuration: totalDurationMs,
    payloadKeys: Object.keys(payload)
  });

  return payload;
}



/**
 * Utility: Create a basic composition for testing
 */
export function createMockAIComposition(): AIGeneratedAssets {
  return {
    success: true,
    video_id: "test-ai-video-123",
    audio_url: "https://storage.example.com/audio/test-voice.mp3",
    generated_images: [
      {
        url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080",
        segment_index: 0,
        prompt: "A serene mountain landscape at dawn"
      },
      {
        url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080", 
        segment_index: 1,
        prompt: "Dense forest with morning mist"
      }
    ],
    final_script: "Welcome to our AI video creation tool. This powerful system generates amazing content automatically.",
    segments: [
      {
        id: "segment-1",
        text: "Welcome to our AI video creation tool.",
        start_time: 0,
        end_time: 3.5,
        duration: 3.5,
        image_prompt: "A serene mountain landscape at dawn"
      },
      {
        id: "segment-2", 
        text: "This powerful system generates amazing content automatically.",
        start_time: 3.5,
        end_time: 7.0,
        duration: 3.5,
        image_prompt: "Dense forest with morning mist"
      }
    ],
    // Add mock word timings for testing caption highlighting
    word_timings: [
      {
        segment_id: "segment-1",
        text: "Welcome to our AI video creation tool.",
        start_time: 0,
        end_time: 3.5,
        duration: 3.5,
        word_timings: [
          { word: "Welcome", start: 0, end: 0.6, confidence: 0.98 },
          { word: "to", start: 0.6, end: 0.8, confidence: 0.99 },
          { word: "our", start: 0.8, end: 1.1, confidence: 0.97 },
          { word: "AI", start: 1.1, end: 1.4, confidence: 0.99 },
          { word: "video", start: 1.4, end: 1.9, confidence: 0.98 },
          { word: "creation", start: 1.9, end: 2.6, confidence: 0.96 },
          { word: "tool.", start: 2.6, end: 3.5, confidence: 0.98 }
        ]
      },
      {
        segment_id: "segment-2",
        text: "This powerful system generates amazing content automatically.",
        start_time: 3.5,
        end_time: 7.0,
        duration: 3.5,
        word_timings: [
          { word: "This", start: 3.5, end: 3.8, confidence: 0.97 },
          { word: "powerful", start: 3.8, end: 4.3, confidence: 0.98 },
          { word: "system", start: 4.3, end: 4.8, confidence: 0.99 },
          { word: "generates", start: 4.8, end: 5.4, confidence: 0.96 },
          { word: "amazing", start: 5.4, end: 5.9, confidence: 0.98 },
          { word: "content", start: 5.9, end: 6.4, confidence: 0.97 },
          { word: "automatically.", start: 6.4, end: 7.0, confidence: 0.95 }
        ]
      }
    ],
    timeline_data: {
      total_duration: 7.0,
      segment_count: 2,
      frame_count: 210
    }
  };
}

/**
 * Utility: Validate AI assets before conversion
 */
export function validateAIAssets(aiAssets: any): aiAssets is AIGeneratedAssets {
  if (!aiAssets || typeof aiAssets !== 'object') {
    console.error('AI assets is not an object');
    return false;
  }

  if (!aiAssets.success) {
    console.error('AI assets indicates failure');
    return false;
  }

  if (!aiAssets.segments || !Array.isArray(aiAssets.segments)) {
    console.error('AI assets missing segments array');
    return false;
  }

  if (!aiAssets.timeline_data || typeof aiAssets.timeline_data.total_duration !== 'number') {
    console.error('AI assets missing timeline_data.total_duration');
    return false;
  }

  console.log('✅ AI assets validation passed');
  return true;
}

/**
 * Calculate canvas size based on aspect ratio
 * Ensures consistency between main app generation and editor canvas
 */
function getCanvasSizeForAspectRatio(aspectRatio: string): { width: number; height: number } {
  console.log('📐 Calculating canvas size for aspect ratio:', aspectRatio);
  
  const aspectRatioMap: Record<string, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },   // Horizontal - YouTube, landscape
    '9:16': { width: 1080, height: 1920 },   // Vertical - TikTok, Instagram Stories
    '1:1': { width: 1080, height: 1080 },    // Square - Instagram posts
    '4:3': { width: 1440, height: 1080 },    // Classic TV format
    '4:5': { width: 1080, height: 1350 },    // Instagram portrait
  };
  
  const size = aspectRatioMap[aspectRatio] || aspectRatioMap['16:9'];
  console.log(`📐 Canvas size for ${aspectRatio}:`, size);
  
  return size;
}