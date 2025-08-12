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
  console.log('🔄 Realigning segments with actual voice timing...');
  
  const realignedSegments: RealignedSegment[] = [];
  
  // Get all word timings from Whisper
  const allWordTimings = whisperData.segment_timings.flatMap(seg => seg.word_timings || []);
  
  if (!allWordTimings.length) {
    console.warn('⚠️ No word timings available, using original segments');
    return originalSegments;
  }
  
  // For each original segment, find its actual timing based on the words it contains
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
    
    if (matchedWords.length > 0) {
      // Calculate actual timing based on matched words
      const startTime = Math.min(...matchedWords.map(w => w.start || w.start_time));
      const endTime = Math.max(...matchedWords.map(w => w.end || w.end_time));
      
      realignedSegments.push({
        id: segment.id,
        text: segment.text,
        start_time: startTime,
        end_time: endTime,
        duration: endTime - startTime,
        image_prompt: segment.image_prompt,
        word_timings: matchedWords
      });
      
      console.log(`✅ Segment "${segment.text.substring(0, 30)}..." realigned: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s (was ${segment.start_time.toFixed(2)}s - ${segment.end_time.toFixed(2)}s)`);
    } else {
      // Couldn't match words, keep original timing but log warning
      console.warn(`⚠️ Could not match words for segment: "${segment.text.substring(0, 30)}..."`);
      realignedSegments.push({
        ...segment,
        word_timings: []
      });
    }
  }
  
  // Ensure segments don't overlap and fill gaps
  for (let i = 0; i < realignedSegments.length - 1; i++) {
    const currentSegment = realignedSegments[i];
    const nextSegment = realignedSegments[i + 1];
    
    // If there's a gap, extend current segment to meet the next
    if (currentSegment.end_time < nextSegment.start_time) {
      const gap = nextSegment.start_time - currentSegment.end_time;
      if (gap < 0.5) { // Small gap, just extend
        currentSegment.end_time = nextSegment.start_time;
        currentSegment.duration = currentSegment.end_time - currentSegment.start_time;
      }
    }
    
    // If there's overlap, trim current segment
    if (currentSegment.end_time > nextSegment.start_time) {
      currentSegment.end_time = nextSegment.start_time;
      currentSegment.duration = currentSegment.end_time - currentSegment.start_time;
    }
  }
  
  console.log(`🎯 Realignment complete: ${realignedSegments.length} segments with accurate voice timing`);
  
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