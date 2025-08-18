'use server';

import { WhisperAnalysisResponse, SegmentTiming } from './whisper-analysis-service';

export interface RealignedSegment {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
  duration: number;
  image_prompt: string;
  word_timings?: any[];
}

/**
 * Realign segments to match actual voice timing from Whisper analysis
 * This fixes the sync issue where segments have estimated timing but voice has real timing
 */
export async function realignSegmentsWithVoiceTiming(
  originalSegments: any[],
  whisperData: WhisperAnalysisResponse
): Promise<RealignedSegment[]> {
  console.log('🔄 Enhancing segments with word-level timing (preserving segment boundaries)...');
  
  const realignedSegments: RealignedSegment[] = [];
  
  // IMPORTANT: We should preserve the original segment boundaries
  // Only add word-level timing for caption synchronization
  // The segments already have good start/end times from createStoryBasedSegments
  
  // Get all word timings from Whisper
  const allWordTimings = whisperData.segment_timings.flatMap(seg => seg.word_timings || []);
  
  if (!allWordTimings.length) {
    console.warn('⚠️ No word timings available, using original segments with their existing timing');
    return originalSegments.map(seg => ({
      ...seg,
      word_timings: []
    }));
  }
  
  // For each original segment, ADD word timings but PRESERVE original boundaries
  for (const segment of originalSegments) {
    const segmentText = segment.text.toLowerCase().trim();
    const segmentWords = segmentText.split(/\s+/);
    
    // Find where these words appear in the Whisper timeline
    let matchedWords = [];
    let searchStartIndex = 0;
    
    for (const word of segmentWords) {
      // Find this word in the Whisper data (starting from where we left off)
      for (let i = searchStartIndex; i < allWordTimings.length; i++) {
        const whisperWord = allWordTimings[i];
        const whisperText = (whisperWord.word || whisperWord.text || '').toLowerCase().replace(/[.,!?;:]/g, '');
        const targetWord = word.toLowerCase().replace(/[.,!?;:]/g, '');
        
        if (whisperText === targetWord || whisperText.includes(targetWord) || targetWord.includes(whisperText)) {
          matchedWords.push(whisperWord);
          searchStartIndex = i + 1; // Continue search from next word
          break;
        }
      }
    }
    
    // ALWAYS preserve original segment boundaries
    // Only use word timings for caption synchronization
    realignedSegments.push({
      id: segment.id,
      text: segment.text,
      start_time: segment.start_time, // KEEP ORIGINAL
      end_time: segment.end_time,     // KEEP ORIGINAL
      duration: segment.duration || (segment.end_time - segment.start_time),
      image_prompt: segment.image_prompt,
      word_timings: matchedWords // Add word timings for captions
    });
    
    if (matchedWords.length > 0) {
      console.log(`✅ Segment "${segment.text.substring(0, 30)}..." enhanced with ${matchedWords.length} word timings`);
      console.log(`   Boundaries preserved: ${segment.start_time.toFixed(2)}s - ${segment.end_time.toFixed(2)}s`);
    }
  }
  
  // No need to adjust overlaps - we're preserving original boundaries
  console.log(`🎯 Enhancement complete: ${realignedSegments.length} segments with preserved boundaries and word timings`);
  
  return realignedSegments;
}

/**
 * Update segment timing in the database after realignment
 */
export async function updateSegmentTimingInDatabase(
  videoId: string,
  realignedSegments: RealignedSegment[]
): Promise<boolean> {
  try {
    // This would update the segments in the database
    // For now, we'll store them in the segments field of the result
    
    console.log(`💾 Would update ${realignedSegments.length} segments for video ${videoId}`);
    
    // TODO: Implement actual database update
    // await supabase
    //   .from('script_video_results')
    //   .update({ 
    //     segments: realignedSegments,
    //     realigned_at: new Date().toISOString()
    //   })
    //   .eq('id', videoId);
    
    return true;
  } catch (error) {
    console.error('Failed to update segment timing:', error);
    return false;
  }
}