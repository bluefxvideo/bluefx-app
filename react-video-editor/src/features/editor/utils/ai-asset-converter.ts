import { generateId } from "@designcombo/timeline";
import { ITrackItem } from "@designcombo/types";
import { loadFonts } from "./fonts";

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
  // Pre-generated video clips (e.g. from Ad Creator)
  video_clips?: Array<{
    url: string;
    segment_index: number;
    prompt?: string;
    duration?: number; // seconds
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
  // Background music (separate from voiceover)
  music?: {
    url: string;
    volume: number;
  } | null;
  // Listing metadata for intro/outro overlays
  listing?: {
    address?: string;
    price?: string;
    beds?: number;
    baths?: number;
    sqft?: number;
  } | null;
  introText?: string | null;
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
export async function convertAIAssetsToEditorFormat(
  aiAssets: AIGeneratedAssets,
  aspectRatio?: string
): Promise<EditorCompositionPayload> {
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
    console.log('✅ Added voiceover audio track:', audioTrack.details.src);
  }

  // 1b. Create Background Music Track (if available)
  if (aiAssets.music?.url) {
    // Use a generous trim.to so the user can extend the track on the timeline.
    // The actual playable length is capped by the source file duration (handled by the player).
    // 10 minutes is a safe upper bound — most music tracks are 2-5 minutes.
    const maxMusicTrimMs = 10 * 60 * 1000; // 10 minutes
    const musicTrack: ITrackItem = {
      id: generateId(),
      type: "audio",
      name: "Background Music",
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
        src: aiAssets.music.url,
        volume: aiAssets.audio_url ? 15 : Math.round((aiAssets.music.volume || 0.3) * 100)
      },
      metadata: {
        backgroundMusic: true,
      },
      duration: maxMusicTrimMs,
      isMain: false
    };

    trackItems.push(musicTrack);
    console.log('✅ Added background music track:', musicTrack.details.src, `volume: ${musicTrack.details.volume}%`);
  }

  // Build a set of segment indices that have video clips (to skip creating images for them)
  const videoClipSegmentIndices = new Set<number>();
  if (aiAssets.video_clips) {
    aiAssets.video_clips.forEach((clip) => {
      if (clip.url) videoClipSegmentIndices.add(clip.segment_index);
    });
  }

  // 2. Create Image Tracks (only for segments WITHOUT a video clip)
  if (aiAssets.generated_images && aiAssets.segments) {
    aiAssets.generated_images.forEach((img, index) => {
      // Skip if this segment has an animated video clip
      if (videoClipSegmentIndices.has(index)) {
        console.log(`⏭️ Skipping image ${index + 1} — has video clip`);
        return;
      }

      const segment = aiAssets.segments![index];
      if (!segment) {
        console.warn(`No segment found for image ${index}`);
        return;
      }

      // Map camera_motion from analysis → Ken Burns preset
      const cameraMotion = (segment as any).camera_motion;
      const motionToPreset: Record<string, string> = {
        dolly_in: 'zoom-in',
        dolly_out: 'zoom-out',
        dolly_left: 'pan-left',
        dolly_right: 'pan-right',
        jib_up: 'pan-up',
        jib_down: 'pan-down',
        static: 'zoom-in',
        focus_shift: 'zoom-in',
        none: 'zoom-in',
      };
      const selectedPreset = motionToPreset[cameraMotion] || 'zoom-in';
      const intensity = 40;

      // Use canvas height for width to ensure tall photos fit fully visible.
      // For 16:9 canvas with 4:3 photos, stretching width avoids harsh top/bottom crop.
      // objectFit: cover in the renderer will handle the rest.
      const imgW = canvasSize.width;
      const imgH = canvasSize.height;

      const imageTrack: ITrackItem = {
        id: generateId(),
        type: "image",
        name: `AI Image ${index + 1}`,
        display: {
          from: segment.start_time * 1000,
          to: segment.end_time * 1000
        },
        details: {
          src: img.url,
          width: imgW,
          height: imgH,
          left: 0,
          top: 0,
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

  // 2b. Create Video Tracks (animated clips from LTX or Ad Creator)
  if (aiAssets.video_clips && aiAssets.segments) {
    aiAssets.video_clips.forEach((clip, index) => {
      const segIndex = clip.segment_index ?? index;
      const segment = aiAssets.segments![segIndex];
      if (!segment || !clip.url) return;

      const videoTrack: ITrackItem = {
        id: generateId(),
        type: "video",
        name: `Video Clip ${index + 1}`,
        display: {
          from: segment.start_time * 1000,
          to: segment.end_time * 1000
        },
        trim: {
          from: 0,
          to: segment.duration * 1000
        },
        playbackRate: 1,
        details: {
          src: clip.url,
          width: canvasSize.width,
          height: canvasSize.height,
          volume: 0, // Muted — audio comes from background music track
          blur: 0,
          brightness: 100,
          flipX: false,
          flipY: false,
          rotate: "0deg",
          visibility: "visible" as const,
        },
        metadata: {
          aiGenerated: true,
          generationType: 'video',
          prompt: clip.prompt || segment.image_prompt,
          segmentId: segment.id,
          segmentText: segment.text,
        },
        duration: segment.duration * 1000,
        isMain: false,
      };

      trackItems.push(videoTrack);
      console.log(`✅ Added video track ${index + 1}:`, clip.url);
    });
  }

  // 3. Create Intro/Outro text overlays for ReelEstate listings
  if (aiAssets.listing || aiAssets.introText) {
    const listing = aiAssets.listing;
    const firstSegment = aiAssets.segments![0];
    const lastSegment = aiAssets.segments![aiAssets.segments!.length - 1];

    // Pre-load fonts for intro/outro overlays
    await loadFonts([
      { name: "Montserrat-BlackItalic", url: "https://fonts.gstatic.com/s/montserrat/v18/JTUPjIg1_i6t8kCHKm459WxZSgnD-_xxrCq7qg.ttf" },
      { name: "Roboto-Bold", url: "https://fonts.gstatic.com/s/roboto/v29/KFOlCnqEu92Fr1MmWUlvAx05IsDqlA.ttf" },
    ]);

    // ─── INTRO: "Big and Bold" style — large centered text on first photo ───
    const introAddress = aiAssets.introText || listing?.address || '';
    if (introAddress && firstSegment) {
      const introFromMs = firstSegment.start_time * 1000;
      const introToMs = firstSegment.end_time * 1000;

      // Large address text — "Big and Bold" style: white, heavy italic, strong shadow
      // Bottom of screen, 140 font size, visible from the very start
      const addressTrack: ITrackItem = {
        id: generateId(),
        type: "text",
        name: "Intro - Address",
        display: { from: introFromMs, to: introToMs },
        details: {
          text: introAddress,
          fontSize: 140,
          width: canvasSize.width * 0.9,
          height: 300,
          fontFamily: "Montserrat-BlackItalic",
          fontUrl: "https://fonts.gstatic.com/s/montserrat/v18/JTUPjIg1_i6t8kCHKm459WxZSgnD-_xxrCq7qg.ttf",
          color: "#ffffff",
          textAlign: "center",
          wordWrap: "break-word",
          top: `${Math.round(canvasSize.height * 0.70)}px`,
          left: `${Math.round(canvasSize.width * 0.05)}px`,
          borderWidth: 2,
          borderColor: "rgba(0,0,0,0.4)",
          boxShadow: { color: "rgba(0,0,0,0.85)", x: 3, y: 3, blur: 20 },
        },
        metadata: { introOverlay: true, editable: true },
        duration: introToMs - introFromMs,
      };
      trackItems.push(addressTrack);

      // Price + details line (smaller, below address)
      const detailParts: string[] = [];
      if (listing?.beds) detailParts.push(`${listing.beds} Beds`);
      if (listing?.baths) detailParts.push(`${listing.baths} Baths`);
      if (listing?.sqft) detailParts.push(`${listing.sqft.toLocaleString()} sqft`);

      if (detailParts.length > 0) {
        // Details appear around 15 second mark (or at 60% of intro if intro < 15s)
        // Stay visible until the end of the last segment (not intro — intro is only first segment)
        const totalDurationMs = aiAssets.timeline_data.total_duration * 1000;
        const detailsFromMs = Math.min(15000, introToMs * 0.6); // Clamp to 60% of intro if intro < 15s
        const detailsToMs = totalDurationMs; // Visible until the end of the video
        const detailsTrack: ITrackItem = {
          id: generateId(),
          type: "text",
          name: "Intro - Details",
          display: { from: detailsFromMs, to: detailsToMs },
          details: {
            text: detailParts.join('  •  '),
            fontSize: 100,
            width: canvasSize.width * 0.90,
            height: 160,
            fontFamily: "Montserrat-BlackItalic",
            fontUrl: "https://fonts.gstatic.com/s/montserrat/v18/JTUPjIg1_i6t8kCHKm459WxZSgnD-_xxrCq7qg.ttf",
            color: "#ffffff",
            textAlign: "center",
            wordWrap: "break-word",
            top: `${Math.round(canvasSize.height * 0.75)}px`,
            left: `${Math.round(canvasSize.width * 0.05)}px`,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.3)",
            boxShadow: { color: "rgba(0,0,0,0.85)", x: 2, y: 2, blur: 14 },
          },
          metadata: { introOverlay: true, editable: true },
          duration: detailsToMs - detailsFromMs,
        };
        trackItems.push(detailsTrack);
      }

      console.log('✅ Added intro text overlays (Big and Bold):', { address: introAddress, details: detailParts.join(' • ') });
    }

    // ─── OUTRO: CTA on last photo — large centered text ───
    if (lastSegment) {
      const outroFromMs = lastSegment.start_time * 1000;
      const outroToMs = lastSegment.end_time * 1000;

      const outroTrack: ITrackItem = {
        id: generateId(),
        type: "text",
        name: "Outro - CTA",
        display: { from: outroFromMs, to: outroToMs },
        details: {
          text: "Schedule a Showing Today",
          fontSize: 100,
          width: canvasSize.width * 0.90,
          height: 220,
          fontFamily: "Montserrat-BlackItalic",
          fontUrl: "https://fonts.gstatic.com/s/montserrat/v18/JTUPjIg1_i6t8kCHKm459WxZSgnD-_xxrCq7qg.ttf",
          color: "#ffffff",
          textAlign: "center",
          wordWrap: "break-word",
          top: `${Math.round(canvasSize.height * 0.70)}px`,
          left: `${Math.round(canvasSize.width * 0.05)}px`,
          borderWidth: 2,
          borderColor: "rgba(0,0,0,0.4)",
          boxShadow: { color: "rgba(0,0,0,0.85)", x: 3, y: 3, blur: 20 },
        },
        metadata: { outroOverlay: true, editable: true },
        duration: outroToMs - outroFromMs,
      };
      trackItems.push(outroTrack);
      console.log('✅ Added outro text overlay (Big and Bold)');
    }
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
  const videoItems = trackItems.filter(item => item.type === 'video').map(item => item.id);
  const imageItems = trackItems.filter(item => item.type === 'image').map(item => item.id);
  const textItems = trackItems.filter(item => item.type === 'text').map(item => item.id);

  const tracks = [];

  // Separate voiceover and music into distinct tracks
  const voiceoverItems = trackItems
    .filter(item => item.type === 'audio' && item.metadata?.generationType === 'voice')
    .map(item => item.id);
  const musicItems = trackItems
    .filter(item => item.type === 'audio' && item.metadata?.backgroundMusic)
    .map(item => item.id);
  const otherAudioItems = trackItems
    .filter(item => item.type === 'audio' && !item.metadata?.generationType && !item.metadata?.backgroundMusic)
    .map(item => item.id);

  if (voiceoverItems.length > 0) {
    tracks.push({
      id: generateId(),
      name: 'Voiceover',
      type: 'audio',
      items: voiceoverItems,
      accepts: ['audio'],
      magnetic: false,
      static: false
    });
  }

  if (musicItems.length > 0) {
    tracks.push({
      id: generateId(),
      name: 'Music',
      type: 'audio',
      items: musicItems,
      accepts: ['audio'],
      magnetic: false,
      static: false
    });
  }

  if (otherAudioItems.length > 0) {
    tracks.push({
      id: generateId(),
      name: 'Audio',
      type: 'audio',
      items: otherAudioItems,
      accepts: ['audio'],
      magnetic: false,
      static: false
    });
  }

  if (videoItems.length > 0) {
    tracks.push({
      id: generateId(),
      name: 'Video Clips',
      type: 'video',
      items: videoItems,
      accepts: ['video'],
      magnetic: false,
      static: false
    });
  }

  if (imageItems.length > 0) {
    tracks.push({
      id: generateId(),
      name: 'Images',
      type: 'image',
      items: imageItems,
      accepts: ['image'],
      magnetic: false,
      static: false
    });
  }

  if (textItems.length > 0) {
    tracks.push({
      id: generateId(),
      name: 'Captions',
      type: 'text',
      items: textItems,
      accepts: ['text', 'caption'],
      magnetic: false,
      static: false
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
    videoTracks: trackItems.filter(t => t.type === 'video').length,
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