'use server';

import type { 
  GenerateCaptionsRequest, 
  CaptionGenerationResponse, 
  ProfessionalCaptionChunk 
} from '../types/caption-types';

/**
 * Mock Caption Generator for Testing UI
 * This will be replaced with the real Whisper-based implementation
 */

export async function generateCaptionsFromRequest(
  request: GenerateCaptionsRequest
): Promise<CaptionGenerationResponse> {
  console.log('🧪 Mock: Generating captions for:', request.audioUrl);
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Generate mock professional captions
  const mockCaptions: ProfessionalCaptionChunk[] = [
    {
      id: 'caption-0',
      text: 'Ever wonder why we end up',
      start_time: 0.0,
      end_time: 2.1,
      duration: 2.1,
      word_count: 6,
      char_count: 25,
      lines: ['Ever wonder why we end up'],
      confidence: 0.95,
      word_boundaries: [
        { word: 'Ever', start: 0.0, end: 0.3, confidence: 0.95 },
        { word: 'wonder', start: 0.3, end: 0.8, confidence: 0.97 },
        { word: 'why', start: 0.8, end: 1.1, confidence: 0.92 },
        { word: 'we', start: 1.1, end: 1.3, confidence: 0.98 },
        { word: 'end', start: 1.3, end: 1.7, confidence: 0.96 },
        { word: 'up', start: 1.7, end: 2.1, confidence: 0.94 }
      ]
    },
    {
      id: 'caption-1', 
      text: 'with only 24 chunks from',
      start_time: 2.1,
      end_time: 4.5,
      duration: 2.4,
      word_count: 5,
      char_count: 24,
      lines: ['with only 24 chunks from'],
      confidence: 0.93,
      word_boundaries: [
        { word: 'with', start: 2.1, end: 2.4, confidence: 0.96 },
        { word: 'only', start: 2.4, end: 2.8, confidence: 0.91 },
        { word: '24', start: 2.8, end: 3.2, confidence: 0.89 },
        { word: 'chunks', start: 3.2, end: 3.8, confidence: 0.94 },
        { word: 'from', start: 3.8, end: 4.5, confidence: 0.97 }
      ]
    },
    {
      id: 'caption-2',
      text: 'our video captions? Let\'s investigate',
      start_time: 4.5,
      end_time: 7.2,
      duration: 2.7,
      word_count: 5,
      char_count: 36,
      lines: ['our video captions?', 'Let\'s investigate'],
      confidence: 0.91,
      word_boundaries: [
        { word: 'our', start: 4.5, end: 4.8, confidence: 0.95 },
        { word: 'video', start: 4.8, end: 5.3, confidence: 0.92 },
        { word: 'captions?', start: 5.3, end: 6.1, confidence: 0.88 },
        { word: 'Let\'s', start: 6.1, end: 6.5, confidence: 0.93 },
        { word: 'investigate', start: 6.5, end: 7.2, confidence: 0.89 }
      ]
    }
  ];

  // Simulate quality metrics
  const totalWords = mockCaptions.reduce((sum, caption) => sum + caption.word_count, 0);
  const avgConfidence = mockCaptions.reduce((sum, caption) => 
    sum + caption.confidence, 0) / mockCaptions.length;

  console.log('✅ Mock: Generated', mockCaptions.length, 'caption chunks');

  return {
    success: true,
    captions: mockCaptions,
    total_chunks: mockCaptions.length,
    total_duration: mockCaptions[mockCaptions.length - 1].end_time,
    avg_words_per_chunk: totalWords / mockCaptions.length,
    quality_metrics: {
      avg_confidence: avgConfidence,
      timing_precision: 98.5, // Frame-aligned mock data
      readability_score: 87.3 // Good readable chunks
    }
  };
}