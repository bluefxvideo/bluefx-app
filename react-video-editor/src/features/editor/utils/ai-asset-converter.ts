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
  aiAssets: AIGeneratedAssets
): EditorCompositionPayload {
  console.log('🔄 Converting AI assets to editor format:', aiAssets);
  
  if (!aiAssets.success || !aiAssets.segments || !aiAssets.timeline_data) {
    throw new Error('Invalid AI assets data');
  }

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
          background: "transparent",
          width: 1920,
          height: 1080,
          opacity: 100,
          transform: "translate(0px, 0px) scale(1) rotate(0deg)",
          border: "none",
          borderRadius: 0,
          boxShadow: {
            color: "#000000",
            x: 0,
            y: 0,
            blur: 0
          },
          top: "0px",
          left: "0px",
          transformOrigin: "center center",
          crop: {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080
          },
          blur: 0,
          brightness: 100,
          flipX: false,
          flipY: false,
          rotate: "0deg",
          visibility: "visible"
        },
        metadata: {
          aiGenerated: true,
          generationType: 'image',
          prompt: img.prompt,
          segmentId: segment.id,
          segmentText: segment.text
        },
        duration: segment.duration * 1000
      };

      trackItems.push(imageTrack);
      console.log(`✅ Added image track ${index + 1}:`, img.url);
    });
  }

  // 3. Create Caption Track (using the exact format from caption-loader.ts)
  if (aiAssets.segments) {
    const captionSegments = createCaptionSegments(aiAssets);
    
    const captionTrack: ITrackItem = {
      id: generateId(),
      type: "text", // Keep as text type (same as working caption loader)
      name: "🎬 AI CAPTIONS TRACK",
      display: {
        from: 0,
        to: totalDurationMs
      },
      details: {
        text: "🎬 AI CAPTIONS TRACK", // Clear indicator this is captions
        fontSize: 48,
        width: 800,
        fontUrl: "", // Will use default font
        fontFamily: "Inter",
        textAlign: "center",
        wordWrap: "break-word",
        
        // Caption highlighting colors (matching mock data structure)
        color: "#E0E0E0",           // Default text color (light gray)
        
        // Visual styling
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        borderColor: "#4A9EFF",
        borderWidth: 2,
        height: 100,
        top: 100, // Distance from bottom
        left: 50, // Center horizontally
        
        // Shadow effect
        boxShadow: {
          color: "#000000",
          x: 2,
          y: 2,
          blur: 4,
        },
        
        // Caption track marker (using any type to bypass strict checking)
        ...(({ 
          isCaptionTrack: true,
          captionSegments: captionSegments // Store segments in details for automatic loading
        } as any))
      },
      metadata: {
        aiGenerated: true,
        generationType: 'captions',
        totalSegments: aiAssets.segments.length,
        resourceId: aiAssets.video_id || '',
        duration: totalDurationMs,
        
        // Additional metadata for caption system (matching mock structure)
        sourceUrl: aiAssets.audio_url || null,
        parentId: `audio-${aiAssets.video_id || 'ai-generated'}`,
        
        // Caption metadata for compatibility
        caption_metadata: {
          segments: captionSegments,
          sourceUrl: aiAssets.audio_url || null,
          parentId: null
        }
      },
      duration: totalDurationMs
    };

    trackItems.push(captionTrack);
    console.log(`✅ Added caption track with ${captionSegments.length} segments`);
  }

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
    size: { width: 1920, height: 1080 },
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
 * Create caption segments with word-level timing (if available)
 * NEW: Uses separate caption chunks instead of visual segments
 */
function createCaptionSegments(aiAssets: AIGeneratedAssets) {
  // NEW: Use separate caption chunks if available
  if (aiAssets.caption_chunks?.chunks && aiAssets.caption_chunks.chunks.length > 0) {
    console.log(`🎬 Using ${aiAssets.caption_chunks.chunks.length} separate caption chunks`);
    
    return aiAssets.caption_chunks.chunks.map(chunk => {
      // Use word_timings from the chunk if available
      const words = chunk.word_timings && chunk.word_timings.length > 0 
        ? chunk.word_timings.map((wt: any) => ({
            word: wt.word,
            start: wt.start * 1000, // Convert to milliseconds
            end: wt.end * 1000,
            confidence: wt.confidence || 1.0
          }))
        : generateMockWordTimings(
            chunk.display_text || chunk.text_content, 
            chunk.start_time * 1000, 
            chunk.end_time * 1000
          );

      return {
        start: chunk.start_time * 1000, // Convert to milliseconds
        end: chunk.end_time * 1000,
        text: chunk.display_text || chunk.text_content,
        words: words, // Word-level timing for highlighting
        style: {
          fontSize: 48,
          activeColor: "#00FF88",    // Green for active word
          appearedColor: "#FFFFFF",  // White for completed words
          color: "#E0E0E0",          // Light gray for default
          ...chunk.style_properties  // Apply custom styling if available
        },
        // Additional metadata from the caption chunk
        metadata: {
          chunk_index: chunk.chunk_index,
          confidence_score: chunk.confidence_score,
          quality_score: chunk.quality_score,
          generation_method: chunk.generation_method,
          primary_segment_id: chunk.primary_segment_id
        }
      };
    });
  }
  
  // FALLBACK: Use visual segments if no separate captions available (backward compatibility)
  if (!aiAssets.segments) return [];
  
  console.log(`📝 Fallback: Using ${aiAssets.segments.length} visual segments as captions`);

  return aiAssets.segments.map(segment => {
    // Try to get word timings from Whisper analysis
    const wordTimings = aiAssets.word_timings?.find(
      wt => wt.segment_id === segment.id
    )?.word_timings || [];

    // Convert word timings to the exact format expected by caption system
    const words = wordTimings.length > 0 ? wordTimings.map(wt => ({
      word: wt.word,
      start: wt.start * 1000, // Convert to milliseconds
      end: wt.end * 1000,
      confidence: wt.confidence
    })) : generateMockWordTimings(segment.text, segment.start_time * 1000, segment.end_time * 1000);

    return {
      start: segment.start_time * 1000, // Convert to milliseconds
      end: segment.end_time * 1000,
      text: segment.text,
      words: words, // Word-level timing for highlighting
      style: {
        fontSize: 48,
        activeColor: "#00FF88",    // Green for active word (same as mock data)
        appearedColor: "#FFFFFF",  // White for completed words
        color: "#E0E0E0"          // Light gray for default
      }
    };
  });
}

/**
 * Generate mock word timings when Whisper data is not available
 * Splits the segment text and estimates timing for each word
 */
function generateMockWordTimings(text: string, startMs: number, endMs: number) {
  const words = text.split(' ').filter(word => word.length > 0);
  if (words.length === 0) return [];
  
  const totalDuration = endMs - startMs;
  const durationPerWord = totalDuration / words.length;
  
  return words.map((word, index) => ({
    word: word,
    start: Math.round(startMs + (index * durationPerWord)),
    end: Math.round(startMs + ((index + 1) * durationPerWord)),
    confidence: 0.95 // Mock confidence
  }));
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