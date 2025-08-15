/**
 * Test file for AI Asset Conversion
 * This demonstrates how to use the data conversion layer
 */

import { convertAIAssetsToEditorFormat, createMockAIComposition, validateAIAssets } from './ai-asset-converter';

/**
 * Example: Convert your ScriptToVideoResponse to React Video Editor format
 */
export function testAIConversion() {
  console.log('🧪 Testing AI to Editor conversion...');

  // 1. Create sample AI assets (matches your ScriptToVideoResponse format)
  const mockAIAssets = createMockAIComposition();
  console.log('📝 Mock AI Assets:', mockAIAssets);

  // 2. Validate the AI assets
  if (!validateAIAssets(mockAIAssets)) {
    console.error('❌ AI assets validation failed');
    return;
  }

  // 3. Convert to editor format
  const editorPayload = convertAIAssetsToEditorFormat(mockAIAssets);
  console.log('🎬 Editor Payload:', editorPayload);

  console.log('✅ Conversion test completed successfully!');
  
  return editorPayload;
}

/**
 * Example: Real AI assets from your database
 */
export function createRealisticsAIAssets() {
  // This would be your actual ScriptToVideoResponse from the orchestrator
  return {
    success: true,
    video_id: "abc123-def456-ghi789",
    video_url: "https://storage.example.com/videos/generated-video.mp4",
    audio_url: "https://storage.example.com/audio/voice-narration.mp3",
    generated_images: [
      {
        url: "https://storage.example.com/images/segment-1-mountain.jpg",
        segment_index: 0,
        prompt: "Majestic mountain landscape at golden hour with snow-capped peaks"
      },
      {
        url: "https://storage.example.com/images/segment-2-forest.jpg", 
        segment_index: 1,
        prompt: "Dense evergreen forest with morning mist and sunlight filtering through trees"
      },
      {
        url: "https://storage.example.com/images/segment-3-lake.jpg",
        segment_index: 2, 
        prompt: "Crystal clear mountain lake reflecting pine trees and blue sky"
      }
    ],
    final_script: "Welcome to nature's most breathtaking landscapes. From towering mountains to pristine forests, these environments showcase the raw beauty of our natural world.",
    was_script_generated: true,
    segments: [
      {
        id: "segment-1",
        text: "Welcome to nature's most breathtaking landscapes.",
        start_time: 0,
        end_time: 4.2,
        duration: 4.2,
        image_prompt: "Majestic mountain landscape at golden hour with snow-capped peaks"
      },
      {
        id: "segment-2",
        text: "From towering mountains to pristine forests,",
        start_time: 4.2,
        end_time: 7.8,
        duration: 3.6,
        image_prompt: "Dense evergreen forest with morning mist and sunlight filtering through trees"
      },
      {
        id: "segment-3",
        text: "these environments showcase the raw beauty of our natural world.",
        start_time: 7.8,
        end_time: 12.0,
        duration: 4.2,
        image_prompt: "Crystal clear mountain lake reflecting pine trees and blue sky"
      }
    ],
    timeline_data: {
      total_duration: 12.0,
      segment_count: 3,
      frame_count: 360 // 12 seconds * 30fps
    },
    // Whisper word timings (optional but recommended for better captions)
    word_timings: [
      {
        segment_id: "segment-1",
        text: "Welcome to nature's most breathtaking landscapes.",
        start_time: 0,
        end_time: 4.2,
        duration: 4.2,
        word_timings: [
          { word: "Welcome", start: 0, end: 0.8, confidence: 0.99 },
          { word: "to", start: 0.8, end: 1.0, confidence: 0.98 },
          { word: "nature's", start: 1.0, end: 1.6, confidence: 0.97 },
          { word: "most", start: 1.6, end: 2.0, confidence: 0.99 },
          { word: "breathtaking", start: 2.0, end: 3.2, confidence: 0.96 },
          { word: "landscapes.", start: 3.2, end: 4.2, confidence: 0.98 }
        ]
      }
      // ... more segments with word timings
    ],
    prediction_id: "pred-abc123",
    batch_id: "batch-def456", 
    credits_used: 25,
    generation_time_ms: 45000
  };
}

// Run test (uncomment to test in console)
// testAIConversion();