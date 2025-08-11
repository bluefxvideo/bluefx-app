'use server';

import { WhisperAnalysisResponse, SegmentTiming } from './whisper-analysis-service';
import OpenAI from 'openai';

/**
 * Professional Caption Chunking Service
 * 
 * Based on industry standards from:
 * - Netflix Timed Text Style Guide
 * - Professional video editing tools (Premiere Pro, DaVinci Resolve, Final Cut)
 * - DCMP (Described and Captioned Media Program) guidelines
 * - W3C TTML specifications
 */

// Industry-standard caption constraints
const CAPTION_STANDARDS = {
  // Character limits (Netflix/broadcast standards)
  MAX_CHARS_PER_LINE: 42,        // Maximum characters per line
  IDEAL_CHARS_PER_LINE: 37,      // Ideal for readability
  MAX_LINES_PER_CAPTION: 2,      // Never more than 2 lines
  
  // Timing constraints (professional standards)
  MIN_CAPTION_DURATION: 0.833,    // 5/6 second minimum (20 frames at 24fps)
  MAX_CAPTION_DURATION: 7.0,      // 7 seconds maximum
  IDEAL_CAPTION_DURATION: 3.0,    // 3 seconds for ~63 characters
  MIN_GAP_BETWEEN_CAPTIONS: 0.083, // 2 frames at 24fps
  
  // Reading speed (words per minute)
  EDUCATIONAL_WPM: 130,           // Educational content
  STANDARD_WPM: 160,              // Standard content
  MAX_WPM: 180,                   // Maximum reading speed
  
  // Characters per second
  MIN_CPS: 15,                    // Minimum reading speed
  IDEAL_CPS: 20,                  // Ideal reading speed
  MAX_CPS: 25                     // Maximum for fast readers
};

export interface CaptionChunk {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
  duration: number;
  word_count: number;
  char_count: number;
  line_count: 1 | 2;
  lines?: [string, string?];      // Split into lines if needed
  confidence: number;
  type: 'dialogue' | 'pause' | 'continuation';
}

export interface ChunkedSegment {
  segment_id: string;
  original_text: string;
  caption_chunks: CaptionChunk[];
  total_chunks: number;
  avg_chunk_duration: number;
  reading_difficulty: 'easy' | 'medium' | 'hard';
}

export interface CaptionChunkingResponse {
  success: boolean;
  segments: ChunkedSegment[];
  total_chunks: number;
  avg_words_per_chunk: number;
  avg_chars_per_chunk: number;
  estimated_reading_speed: number; // WPM
  quality_score: number;           // 0-100
  error?: string;
}

/**
 * Main function to create professional caption chunks from segments
 */
export async function createProfessionalCaptions(
  whisperData: WhisperAnalysisResponse,
  contentType: 'educational' | 'standard' | 'fast' = 'standard'
): Promise<CaptionChunkingResponse> {
  try {
    console.log('📝 Creating professional caption chunks...');
    
    const targetWPM = contentType === 'educational' 
      ? CAPTION_STANDARDS.EDUCATIONAL_WPM 
      : contentType === 'fast' 
        ? CAPTION_STANDARDS.MAX_WPM 
        : CAPTION_STANDARDS.STANDARD_WPM;
    
    const chunkedSegments: ChunkedSegment[] = [];
    let totalChunks = 0;
    let totalWords = 0;
    let totalChars = 0;
    
    // Process each segment
    for (const segment of whisperData.segment_timings) {
      const chunks = await chunkSegmentIntelligently(
        segment,
        targetWPM,
        whisperData.frame_rate || 30
      );
      
      chunkedSegments.push({
        segment_id: segment.segment_id,
        original_text: segment.text,
        caption_chunks: chunks,
        total_chunks: chunks.length,
        avg_chunk_duration: chunks.reduce((sum, c) => sum + c.duration, 0) / chunks.length,
        reading_difficulty: calculateReadingDifficulty(chunks, targetWPM)
      });
      
      totalChunks += chunks.length;
      chunks.forEach(chunk => {
        totalWords += chunk.word_count;
        totalChars += chunk.char_count;
      });
    }
    
    const avgWordsPerChunk = totalWords / totalChunks;
    const avgCharsPerChunk = totalChars / totalChunks;
    const qualityScore = calculateQualityScore(chunkedSegments, targetWPM);
    
    console.log(`✅ Created ${totalChunks} caption chunks (avg ${avgWordsPerChunk.toFixed(1)} words/chunk)`);
    
    return {
      success: true,
      segments: chunkedSegments,
      total_chunks: totalChunks,
      avg_words_per_chunk: avgWordsPerChunk,
      avg_chars_per_chunk: avgCharsPerChunk,
      estimated_reading_speed: targetWPM,
      quality_score: qualityScore
    };
    
  } catch (error) {
    console.error('Caption chunking error:', error);
    return {
      success: false,
      segments: [],
      total_chunks: 0,
      avg_words_per_chunk: 0,
      avg_chars_per_chunk: 0,
      estimated_reading_speed: 0,
      quality_score: 0,
      error: error instanceof Error ? error.message : 'Caption chunking failed'
    };
  }
}

/**
 * Use AI to intelligently chunk a segment into meaningful captions
 */
async function chunkSegmentIntelligently(
  segment: SegmentTiming,
  targetWPM: number,
  frameRate: number
): Promise<CaptionChunk[]> {
  const chunks: CaptionChunk[] = [];
  
  // Clean text
  const cleanText = segment.text.replace(/\s+/g, ' ').trim();
  
  try {
    // Use AI to break text into meaningful caption chunks
    const chunkTexts = await breakTextIntoMeaningfulCaptions(cleanText);
    
    // Calculate timing for each chunk
    const totalDuration = segment.end_time - segment.start_time;
    let currentTime = segment.start_time;
    
    chunkTexts.forEach((chunkText, index) => {
      const words = chunkText.split(' ');
      const wordCount = words.length;
      
      // Calculate proportional duration based on word count
      const chunkDuration = Math.max(
        CAPTION_STANDARDS.MIN_CAPTION_DURATION,
        Math.min(
          CAPTION_STANDARDS.MAX_CAPTION_DURATION,
          (wordCount / cleanText.split(' ').length) * totalDuration
        )
      );
      
      // Split into lines if needed
      const lines = splitIntoLines(chunkText, CAPTION_STANDARDS.MAX_CHARS_PER_LINE);
      
      chunks.push({
        id: `${segment.segment_id}_chunk_${index}`,
        text: chunkText,
        start_time: alignToFrame(currentTime, frameRate),
        end_time: alignToFrame(currentTime + chunkDuration, frameRate),
        duration: chunkDuration,
        word_count: wordCount,
        char_count: chunkText.length,
        line_count: lines.length as 1 | 2,
        lines: lines.length === 2 ? [lines[0], lines[1]] : [lines[0]],
        confidence: 0.95,
        type: 'dialogue'
      });
      
      currentTime += chunkDuration;
    });
    
    return chunks;
    
  } catch (error) {
    console.warn('AI chunking failed, using simple fallback:', error);
    // Simple fallback: chunk by word count
    return createSimpleChunks(segment, targetWPM, frameRate);
  }
}

/**
 * Use AI to break text into meaningful, readable caption chunks
 */
async function breakTextIntoMeaningfulCaptions(text: string): Promise<string[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  
  const prompt = `Break this text into caption chunks for video subtitles. Each chunk should:
- Be a complete thought or meaningful phrase (4-8 words ideal)
- Break at natural linguistic boundaries
- Never end mid-thought or with articles/prepositions
- Be easy to read at a glance

Text: "${text}"

Return ONLY the chunks, one per line, no numbering or formatting.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500
    });
    
    const chunks = completion.choices[0].message.content
      ?.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0) || [];
    
    return chunks.length > 0 ? chunks : [text];
  } catch (error) {
    console.error('OpenAI caption chunking failed:', error);
    return [text]; // Return whole text as fallback
  }
}

/**
 * Simple fallback chunking by word count
 */
function createSimpleChunks(
  segment: SegmentTiming,
  targetWPM: number,
  frameRate: number
): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  const words = segment.text.split(' ');
  const wordsPerChunk = 6; // Simple 6-word chunks
  
  let currentTime = segment.start_time;
  const totalDuration = segment.end_time - segment.start_time;
  
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    const chunkText = chunkWords.join(' ');
    const chunkDuration = Math.max(
      CAPTION_STANDARDS.MIN_CAPTION_DURATION,
      Math.min(
        CAPTION_STANDARDS.MAX_CAPTION_DURATION,
        (chunkWords.length / words.length) * totalDuration
      )
    );
    
    // Split into lines if needed
    const lines = splitIntoLines(chunkText, CAPTION_STANDARDS.MAX_CHARS_PER_LINE);
    
    chunks.push({
      id: `${segment.segment_id}_chunk_${chunks.length}`,
      text: chunkText,
      start_time: alignToFrame(currentTime, frameRate),
      end_time: alignToFrame(currentTime + chunkDuration, frameRate),
      duration: chunkDuration,
      word_count: chunkWords.length,
      char_count: chunkText.length,
      line_count: lines.length as 1 | 2,
      lines: lines.length === 2 ? [lines[0], lines[1]] : [lines[0]],
      confidence: 0.8,
      type: 'dialogue'
    });
    
    currentTime += chunkDuration;
  }
  
  return chunks;
}

/**
 * DEPRECATED - Using AI-based chunking instead
 * Find natural break point for caption chunks
 */
/*
function findNaturalBreakPoint(
  words: string[],
  startIndex: number,
  idealWordCount: number,
  maxChars: number
): number {
  // Start with ideal length
  let endIndex = Math.min(startIndex + idealWordCount - 1, words.length - 1);
  
  // Build the text to check character limit
  let currentText = words.slice(startIndex, endIndex + 1).join(' ');
  
  // If we're over character limit, back up
  while (currentText.length > maxChars && endIndex > startIndex) {
    endIndex--;
    currentText = words.slice(startIndex, endIndex + 1).join(' ');
  }
  
  // Now find the best linguistic break point
  // Priority 1: Complete sentences (. ! ?)
  for (let i = endIndex; i >= startIndex + 2; i--) { // At least 3 words
    const word = words[i];
    if (word.match(/[.!?]$/)) {
      return i; // Break after sentence end
    }
  }
  
  // Priority 2: Major clause boundaries (, ; :)
  for (let i = endIndex; i >= startIndex + 2; i--) {
    const word = words[i];
    if (word.match(/[,;:]$/)) {
      // Make sure we're not breaking a short phrase
      const remainingWords = endIndex - i;
      if (remainingWords <= 2) {
        continue; // Don't leave orphaned words
      }
      return i; // Break after punctuation
    }
  }
  
  // Priority 3: Before conjunctions (and, but, or, so, because, when, while, if)
  for (let i = endIndex; i > startIndex + 1; i--) {
    const word = words[i].toLowerCase();
    if (['and', 'but', 'or', 'so', 'because', 'when', 'while', 'if', 'since', 'although'].includes(word)) {
      // Check we're not breaking too early
      if (i - startIndex >= 3) { // At least 3 words before conjunction
        return i - 1; // Break before conjunction
      }
    }
  }
  
  // Priority 4: After verbs (keep verb phrases together)
  // This is a simple heuristic - words ending in common verb endings
  for (let i = endIndex - 1; i >= startIndex + 2; i--) {
    const word = words[i].toLowerCase();
    const nextWord = words[i + 1].toLowerCase();
    
    // Don't break verb + preposition/particle pairs
    if (!['to', 'up', 'down', 'in', 'out', 'on', 'off', 'with'].includes(nextWord)) {
      if (word.match(/(ing|ed|es)$/)) {
        return i;
      }
    }
  }
  
  // Priority 5: Before prepositions (but not if they're part of a phrasal verb)
  for (let i = endIndex; i > startIndex + 2; i--) {
    const word = words[i].toLowerCase();
    const prevWord = words[i - 1].toLowerCase();
    
    if (['to', 'in', 'on', 'at', 'for', 'with', 'from', 'about'].includes(word)) {
      // Don't break phrasal verbs
      if (!prevWord.match(/(ing|ed|es)$/)) {
        return i - 1; // Break before preposition
      }
    }
  }
  
  // Fallback: Try to avoid orphaned words at the end
  const remainingWords = words.length - 1 - endIndex;
  if (remainingWords === 1 && endIndex > startIndex + 1) {
    // Include the last word to avoid orphan
    return Math.min(endIndex + 1, words.length - 1);
  }
  
  // Default: Use the calculated end index
  return endIndex;
}
*/

/**
 * Split text into lines following professional standards
 */
function splitIntoLines(text: string, maxCharsPerLine: number): string[] {
  // If text fits in one line, return as is
  if (text.length <= maxCharsPerLine) {
    return [text];
  }
  
  // Need to split into two lines
  const words = text.split(/\s+/);
  const midPoint = Math.floor(words.length / 2);
  
  // Try to find natural break point near middle
  let bestSplitIndex = midPoint;
  let bestBalance = 999;
  
  // Look for punctuation or conjunction near middle
  for (let i = midPoint - 2; i <= midPoint + 2 && i < words.length - 1; i++) {
    if (i < 1) continue;
    
    const line1 = words.slice(0, i + 1).join(' ');
    const line2 = words.slice(i + 1).join(' ');
    
    // Check if both lines fit within limits
    if (line1.length <= maxCharsPerLine && line2.length <= maxCharsPerLine) {
      // Calculate balance (prefer equal length lines)
      const balance = Math.abs(line1.length - line2.length);
      
      // Prefer breaks at punctuation or conjunctions
      const wordBeforeBreak = words[i];
      const hasGoodBreak = /[,;:]$/.test(wordBeforeBreak) || 
                           /^(and|but|or|so)$/i.test(words[i + 1]);
      
      const adjustedBalance = hasGoodBreak ? balance - 5 : balance;
      
      if (adjustedBalance < bestBalance) {
        bestSplitIndex = i;
        bestBalance = adjustedBalance;
      }
    }
  }
  
  const line1 = words.slice(0, bestSplitIndex + 1).join(' ');
  const line2 = words.slice(bestSplitIndex + 1).join(' ');
  
  // Netflix guide: upper line should preferably be shorter
  if (line1.length > line2.length && line2.length > 0) {
    // Try to rebalance by moving one word down
    if (bestSplitIndex > 0) {
      const altLine1 = words.slice(0, bestSplitIndex).join(' ');
      const altLine2 = words.slice(bestSplitIndex).join(' ');
      
      if (altLine1.length <= maxCharsPerLine && altLine2.length <= maxCharsPerLine) {
        return [altLine1, altLine2];
      }
    }
  }
  
  return line2.length > 0 ? [line1, line2] : [line1];
}

/**
 * Calculate duration for text based on reading speed
 */
function calculateDurationForText(text: string, targetWPM: number): number {
  const words = text.split(/\s+/).length;
  const chars = text.length;
  
  // Calculate based on both word count and character count
  const durationByWords = (words / targetWPM) * 60;
  const durationByChars = chars / CAPTION_STANDARDS.IDEAL_CPS;
  
  // Use average of both methods
  let duration = (durationByWords + durationByChars) / 2;
  
  // Apply constraints
  duration = Math.max(duration, CAPTION_STANDARDS.MIN_CAPTION_DURATION);
  duration = Math.min(duration, CAPTION_STANDARDS.MAX_CAPTION_DURATION);
  
  return duration;
}

/**
 * Align timestamp to frame boundary
 */
function alignToFrame(timestamp: number, frameRate: number): number {
  const frameDuration = 1 / frameRate;
  return Math.round(timestamp / frameDuration) * frameDuration;
}

/**
 * Calculate reading difficulty based on chunk characteristics
 */
function calculateReadingDifficulty(
  chunks: CaptionChunk[],
  targetWPM: number
): 'easy' | 'medium' | 'hard' {
  const avgWordsPerChunk = chunks.reduce((sum, c) => sum + c.word_count, 0) / chunks.length;
  const avgDuration = chunks.reduce((sum, c) => sum + c.duration, 0) / chunks.length;
  const actualWPM = (avgWordsPerChunk / avgDuration) * 60;
  
  if (actualWPM < targetWPM * 0.8) return 'easy';
  if (actualWPM > targetWPM * 1.2) return 'hard';
  return 'medium';
}

/**
 * Calculate quality score for caption chunks
 */
function calculateQualityScore(
  segments: ChunkedSegment[],
  _targetWPM: number
): number {
  let score = 100;
  
  segments.forEach(segment => {
    segment.caption_chunks.forEach((chunk, index) => {
      // Penalize for too short or too long duration
      if (chunk.duration < CAPTION_STANDARDS.MIN_CAPTION_DURATION) score -= 5;
      if (chunk.duration > CAPTION_STANDARDS.MAX_CAPTION_DURATION) score -= 5;
      
      // Penalize for too many characters
      if (chunk.char_count > CAPTION_STANDARDS.MAX_CHARS_PER_LINE * 2) score -= 3;
      
      // Reward for ideal chunk size (4-8 words is most readable)
      if (chunk.word_count >= 4 && chunk.word_count <= 8) {
        score += 2;
      } else if (chunk.word_count < 2 || chunk.word_count > 12) {
        score -= 2; // Penalize very short or very long chunks
      }
      
      // Check for meaningful chunks (not ending mid-thought)
      const text = chunk.text.trim();
      
      // Reward chunks that end with punctuation (complete thoughts)
      if (text.match(/[.!?,;:]$/)) {
        score += 1;
      }
      
      // Penalize chunks that end with common incomplete patterns
      if (text.match(/\b(the|a|an|to|of|in|and|or|but)$/i)) {
        score -= 3; // Ending with articles/conjunctions is bad
      }
      
      // Penalize orphaned single words at the end
      if (chunk.word_count === 1 && index === segment.caption_chunks.length - 1) {
        score -= 5;
      }
      
      // Penalize for single long words
      if (chunk.word_count === 1 && chunk.char_count > 15) score -= 2;
    });
  });
  
  return Math.max(0, Math.min(100, score));
}