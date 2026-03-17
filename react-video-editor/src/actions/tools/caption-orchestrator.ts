'use server';

import { analyzeAudioWithWhisper, WhisperAnalysisResponse } from '../../services/whisper-analysis-service';

/**
 * Caption Orchestrator SDK
 * 
 * Generates frame-accurate captions using direct Whisper word timings
 * for professional lip-sync accuracy in video editing.
 */

export interface CaptionGenerationOptions {
  maxWordsPerChunk?: number;      // Default: 5 words (reduced for better readability)
  minChunkDuration?: number;      // Default: 0.833 seconds (5/6 second)
  maxChunkDuration?: number;      // Default: 3.5 seconds
  frameRate?: number;             // Default: 30fps
  maxCharsPerLine?: number;       // Default: 42 characters
  contentType?: 'educational' | 'standard' | 'fast';  // Default: 'standard'
  audioDuration?: number;         // Known audio duration in seconds for boundary checking
  segmentBoundaries?: number[];   // Image segment transition times in seconds
  alignWithSegments?: boolean;    // Prefer caption breaks at segment boundaries
  timelineOffsetMs?: number;      // Timeline offset in ms — applied to all caption timings after generation
}

export interface ProfessionalCaptionChunk {
  id: string;
  text: string;
  start_time: number;       // Frame-aligned absolute timing
  end_time: number;         // Frame-aligned absolute timing
  duration: number;
  word_count: number;
  char_count: number;
  lines: string[];          // Split into 1-2 lines for display
  confidence: number;       // Average word confidence
  word_boundaries: {        // Individual word timings for fine control
    word: string;
    start: number;
    end: number;
    confidence: number;
  }[];
}

export interface CaptionGenerationResponse {
  success: boolean;
  captions: ProfessionalCaptionChunk[];
  total_chunks: number;
  total_duration: number;
  avg_words_per_chunk: number;
  quality_metrics: {
    avg_confidence: number;
    timing_precision: number;  // Frame alignment accuracy
    readability_score: number; // Based on chunk length and line breaks
  };
  whisper_data?: WhisperAnalysisResponse; // Include for debugging/reuse
  error?: string;
}

/**
 * Main Caption Generation Function
 * Uses direct Whisper word timings for maximum accuracy.
 * When originalScript is provided (from AI voiceover), uses it for
 * punctuation, capitalization, and natural sentence boundaries.
 */
export async function generateCaptionsForAudio(
  audioUrl: string,
  existingWhisperData?: WhisperAnalysisResponse,
  options: CaptionGenerationOptions = {},
  originalScript?: string
): Promise<CaptionGenerationResponse> {
  const startTime = Date.now();
  console.log('🎬 Caption Orchestrator: Starting caption generation...');
  console.log('📍 Audio URL:', audioUrl);
  console.log('📊 Using existing Whisper data:', !!existingWhisperData);
  console.log('📝 Original script available:', !!originalScript);

  // Set defaults
  const opts = {
    maxWordsPerChunk: 5,       // Reduced from 6 to 5 for better readability
    minChunkDuration: 0.833,  // 5/6 second minimum
    maxChunkDuration: 3.5,     // Reduced from 4.0 to 3.5 seconds
    frameRate: 30,
    maxCharsPerLine: 42,
    contentType: 'standard' as const,
    ...options
  };

  try {
    // Step 1: Get or Generate Whisper Analysis
    let whisperData: WhisperAnalysisResponse;
    
    console.log('🔍 TIMING DEBUG:', {
      audioUrl,
      hasExistingWhisperData: !!existingWhisperData,
      existingDuration: existingWhisperData?.total_duration,
      providedAudioDuration: opts.audioDuration,
      source: 'caption-orchestrator'
    });
    
    if (existingWhisperData && opts.audioDuration) {
      // Validate existing data matches current audio duration
      const existingDuration = existingWhisperData.total_duration;
      const toleranceSeconds = 2; // Allow 2-second tolerance
      
      if (Math.abs(existingDuration - opts.audioDuration) <= toleranceSeconds) {
        console.log('✅ Using compatible existing Whisper analysis');
        whisperData = existingWhisperData;
      } else {
        console.log(`⚠️ Duration mismatch: existing=${existingDuration}s, current=${opts.audioDuration}s. Generating fresh analysis.`);
        whisperData = await analyzeAudioWithWhisper({
          audio_url: audioUrl,
          segments: []
        }, 30);
      }
    } else {
      // Always generate fresh analysis if no duration validation possible
      console.log('🔍 Generating fresh Whisper analysis (no existing data or duration)...');
      console.log('🔍 DEBUG: Calling analyzeAudioWithWhisper for:', audioUrl);
      whisperData = await analyzeAudioWithWhisper({
        audio_url: audioUrl,
        segments: [] // No pre-existing segments, let Whisper segment naturally
      }, 30); // Pass 30 fps
      
      if (!whisperData.success) {
        throw new Error(`Whisper analysis failed: ${whisperData.error}`);
      }
      console.log('✅ Whisper analysis completed');
    }

    // Step 2: Extract all word timings from segments or raw_word_timings
    let allWords: any[] = [];

    // First try: extract from segment_timings (populated when segments are provided)
    if (whisperData.segment_timings && whisperData.segment_timings.length > 0) {
      console.log('🔍 Extracting words from segment_timings:', whisperData.segment_timings.length, 'segments');
      whisperData.segment_timings.forEach((segment) => {
        if (segment.word_timings) {
          segment.word_timings.forEach(word => {
            allWords.push({
              ...word,
              start: word.start,
              end: word.end
            });
          });
        }
      });
    }

    // Fallback: use raw_word_timings (populated when segments is empty [])
    if (allWords.length === 0 && whisperData.raw_word_timings && whisperData.raw_word_timings.length > 0) {
      console.log('🔍 Using raw_word_timings fallback:', whisperData.raw_word_timings.length, 'words');
      whisperData.raw_word_timings.forEach(word => {
        allWords.push({
          word: word.word,
          start: word.start,
          end: word.end,
          confidence: word.confidence || 0.9
        });
      });
    }

    // Step 2b: Re-attach punctuation — prefer original script (perfect punctuation)
    // over Whisper's full_transcript (may have minor punctuation issues)
    const punctuationSource = originalScript || whisperData.full_transcript || '';
    if (punctuationSource && allWords.length > 0) {
      allWords = reattachPunctuation(allWords, punctuationSource);
      console.log(`📝 Re-attached punctuation from ${originalScript ? 'original script' : 'Whisper transcript'}`);
    }

    // Debug: Check if words extend beyond expected duration
    if (allWords.length > 0) {
      const maxWordEnd = Math.max(...allWords.map(w => w.end));
      console.log(`🔍 Word timings: ${allWords.length} words, max end time: ${maxWordEnd.toFixed(2)}s`);
      if (maxWordEnd > 35) {
        console.warn(`⚠️ WARNING: Word timings extend to ${maxWordEnd}s, which exceeds expected audio duration!`);
      }
    }

    if (allWords.length === 0) {
      throw new Error('No word timings available from Whisper analysis');
    }

    console.log(`📝 Processing ${allWords.length} words into professional captions...`);

    // Get audio duration - prefer the known duration from frontend, then Whisper data
    const audioDuration = opts.audioDuration ||
      whisperData.total_duration ||
      (allWords.length > 0 ? Math.max(...allWords.map(w => w.end)) : undefined);

    console.log(`🎵 Audio duration: ${audioDuration?.toFixed(2)}s (source: ${opts.audioDuration ? 'frontend' : 'whisper'})`);

    // Step 3: Generate Professional Caption Chunks
    const requiredOpts = { ...opts } as Required<CaptionGenerationOptions>;
    const captions = createProfessionalCaptionChunks(allWords, requiredOpts, audioDuration);

    // Step 4: Calculate Quality Metrics
    const qualityMetrics = calculateQualityMetrics(captions, whisperData, audioDuration);

    // Step 5: Apply timeline offset if provided (for multi-source merging)
    const offsetSec = (opts.timelineOffsetMs || 0) / 1000;
    if (offsetSec > 0) {
      console.log(`⏱️ Applying timeline offset: +${offsetSec.toFixed(3)}s (${opts.timelineOffsetMs}ms)`);
      captions.forEach(caption => {
        caption.start_time += offsetSec;
        caption.end_time += offsetSec;
        caption.word_boundaries.forEach(wb => {
          wb.start += offsetSec;
          wb.end += offsetSec;
        });
      });
    }

    const generationTime = Date.now() - startTime;
    console.log(`🎉 Caption generation completed in ${generationTime}ms`);
    console.log(`📊 Generated ${captions.length} caption chunks covering ${captions[captions.length - 1]?.end_time.toFixed(1)}s`);

    return {
      success: true,
      captions,
      total_chunks: captions.length,
      total_duration: audioDuration || (captions.length > 0 ? captions[captions.length - 1].end_time : 0),
      avg_words_per_chunk: captions.length > 0 
        ? captions.reduce((sum, c) => sum + c.word_count, 0) / captions.length 
        : 0,
      quality_metrics: qualityMetrics,
      whisper_data: whisperData
    };

  } catch (error) {
    console.error('❌ Caption generation failed:', error);
    return {
      success: false,
      captions: [],
      total_chunks: 0,
      total_duration: 0,
      avg_words_per_chunk: 0,
      quality_metrics: {
        avg_confidence: 0,
        timing_precision: 0,
        readability_score: 0
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Re-attach punctuation from the full Whisper transcript to individual words.
 * Whisper's word-level timestamps may strip punctuation that exists in the transcript.
 */
function reattachPunctuation(words: any[], fullTranscript: string): any[] {
  // Split transcript preserving punctuation attached to words
  const transcriptTokens = fullTranscript.match(/\S+/g) || [];
  if (transcriptTokens.length === 0) return words;

  // Helper: strip punctuation for comparison
  const stripPunct = (w: string) => w.toLowerCase().replace(/[^\w]/g, '');

  let tIdx = 0;
  return words.map(word => {
    const wordClean = stripPunct(word.word);
    if (!wordClean) return word;

    // Search forward in transcript tokens for a match (allow small gaps for misalignment)
    const searchWindow = Math.min(tIdx + 5, transcriptTokens.length);
    for (let j = tIdx; j < searchWindow; j++) {
      const tokenClean = stripPunct(transcriptTokens[j]);
      if (wordClean === tokenClean) {
        // Found match — use the transcript version which has punctuation + casing
        const result = { ...word, word: transcriptTokens[j] };
        tIdx = j + 1;
        return result;
      }
    }

    return word; // No match found, keep original
  });
}

/**
 * Create Professional Caption Chunks from Whisper Words
 * Groups words into readable chunks with natural sentence boundaries.
 * Ensures no timing overlap between consecutive chunks.
 */
function createProfessionalCaptionChunks(
  words: any[],
  options: Required<CaptionGenerationOptions>,
  maxAudioDuration?: number
): ProfessionalCaptionChunk[] {
  const chunks: ProfessionalCaptionChunk[] = [];
  let currentChunk: any[] = [];
  let chunkIndex = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentChunk.push(word);

    // Content analysis
    const isSentenceEnd = /[.!?]$/.test(word.word);
    const isClauseBreak = /[,;:\-—]$/.test(word.word);
    const hasLongPause = i < words.length - 1 && words[i + 1].start - word.end > 0.3;
    const chunkDuration = word.end - currentChunk[0].start;
    const isLastWord = i === words.length - 1;

    // Determine if we should end this chunk — prefer sentence boundaries
    let shouldEndChunk = false;

    if (isLastWord) {
      // Always end on the last word
      shouldEndChunk = true;
    } else if (isSentenceEnd && currentChunk.length >= 2) {
      // End of sentence — always break here (even with just 2 words)
      shouldEndChunk = true;
    } else if (currentChunk.length >= options.maxWordsPerChunk) {
      // Reached max word count — break here
      shouldEndChunk = true;
    } else if (hasLongPause && currentChunk.length >= 2) {
      // Long pause (>300ms gap) — natural break point
      shouldEndChunk = true;
    } else if (isClauseBreak && currentChunk.length >= 4) {
      // Clause break (comma, semicolon) with enough words
      shouldEndChunk = true;
    } else if (chunkDuration >= options.maxChunkDuration) {
      // Max duration exceeded — force break
      shouldEndChunk = true;
    }

    if (shouldEndChunk && currentChunk.length > 0) {
      const chunkStart = currentChunk[0].start;
      const chunkEnd = currentChunk[currentChunk.length - 1].end;

      // Determine end_time: use natural word end, do NOT extend past next word's start
      let finalEndTime = chunkEnd;

      // Cap to audio duration
      if (maxAudioDuration && finalEndTime > maxAudioDuration) {
        finalEndTime = maxAudioDuration;
      }

      const chunkText = currentChunk.map(w => w.word).join(' ').trim();
      const lines = splitIntoLines(chunkText, options.maxCharsPerLine);

      chunks.push({
        id: `caption-${chunkIndex}`,
        text: chunkText,
        start_time: chunkStart,
        end_time: finalEndTime,
        duration: finalEndTime - chunkStart,
        word_count: currentChunk.length,
        char_count: chunkText.length,
        lines: lines,
        confidence: currentChunk.reduce((sum, w) => sum + (w.confidence || 0.9), 0) / currentChunk.length,
        word_boundaries: currentChunk.map(w => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence || 0.9
        }))
      });

      currentChunk = [];
      chunkIndex++;
    }
  }

  // Post-process: ensure no timing gaps or overlaps between chunks
  for (let i = 0; i < chunks.length - 1; i++) {
    const current = chunks[i];
    const next = chunks[i + 1];

    // If current chunk ends after next chunk starts, cap it
    if (current.end_time > next.start_time) {
      current.end_time = next.start_time;
      current.duration = current.end_time - current.start_time;
    }

    // Extend current chunk's display to fill the gap until the next chunk
    // This prevents brief flashes of empty screen between captions
    const gap = next.start_time - current.end_time;
    if (gap > 0 && gap < 0.15) {
      // Small gap (<150ms) — extend current chunk to fill it
      current.end_time = next.start_time;
      current.duration = current.end_time - current.start_time;
    }
  }

  return chunks;
}

/**
 * Split text into lines following professional captioning standards
 */
function splitIntoLines(text: string, maxCharsPerLine: number): string[] {
  if (text.length <= maxCharsPerLine) {
    return [text];
  }

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Single word is too long, force it
        lines.push(word);
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  // Professional standard: max 2 lines
  return lines.slice(0, 2);
}

/**
 * Align timestamp to frame boundary for perfect video sync
 */
function alignToFrame(timestamp: number, frameRate: number): number {
  const frameDuration = 1 / frameRate;
  return Math.round(timestamp / frameDuration) * frameDuration;
}

/**
 * Calculate caption quality metrics
 */
function calculateQualityMetrics(
  captions: ProfessionalCaptionChunk[],
  whisperData: WhisperAnalysisResponse,
  audioDuration?: number
) {
  if (captions.length === 0) {
    return {
      avg_confidence: 0,
      timing_precision: 0,
      readability_score: 0
    };
  }

  // Average confidence across all words
  const allWordConfidences: number[] = [];
  captions.forEach(caption => {
    caption.word_boundaries.forEach(word => {
      allWordConfidences.push(word.confidence);
    });
  });
  const avg_confidence = allWordConfidences.reduce((a, b) => a + b, 0) / allWordConfidences.length;

  // Timing precision (how well aligned to frames)
  const frameDuration = 1 / 30; // 30fps
  let timingErrors = 0;
  captions.forEach(caption => {
    const startError = caption.start_time % frameDuration;
    const endError = caption.end_time % frameDuration;
    timingErrors += Math.min(startError, frameDuration - startError);
    timingErrors += Math.min(endError, frameDuration - endError);
  });
  // Enhanced timing precision: also check if captions exceed audio duration
  let audioBoundaryPenalty = 0;
  if (audioDuration) {
    const lastCaptionEnd = Math.max(...captions.map(c => c.end_time));
    if (lastCaptionEnd > audioDuration) {
      audioBoundaryPenalty = Math.min(50, (lastCaptionEnd - audioDuration) * 10); // Penalty for exceeding
      console.log(`⚠️ Caption timing exceeds audio duration by ${(lastCaptionEnd - audioDuration).toFixed(2)}s`);
    }
  }
  
  const timing_precision = Math.max(0, 100 - (timingErrors / captions.length * 2) * 1000 - audioBoundaryPenalty);

  // Readability score based on chunk characteristics
  let readabilityPoints = 100;
  captions.forEach(caption => {
    // Penalize very short or very long chunks
    if (caption.word_count < 2) readabilityPoints -= 5;
    if (caption.word_count > 8) readabilityPoints -= 3;
    
    // Penalize chunks that are too long character-wise
    if (caption.char_count > 84) readabilityPoints -= 5; // 2 lines * 42 chars
    
    // Reward good duration (1-4 seconds is ideal)
    if (caption.duration >= 1.0 && caption.duration <= 4.0) {
      readabilityPoints += 2;
    } else if (caption.duration < 0.833 || caption.duration > 6.0) {
      readabilityPoints -= 3;
    }
  });
  
  const readability_score = Math.max(0, Math.min(100, readabilityPoints));

  return {
    avg_confidence: Math.round(avg_confidence * 100) / 100,
    timing_precision: Math.round(timing_precision * 100) / 100,
    readability_score: Math.round(readability_score * 100) / 100
  };
}

/**
 * Utility: Extract audio URL from various video/editor sources
 */
export async function extractAudioUrl(source: {
  audioUrl?: string;
  trackItems?: any[];
  whisperData?: any;
}): Promise<string | null> {
  // Direct audio URL
  if (source.audioUrl) {
    return source.audioUrl;
  }

  // Extract from track items (editor format) — prefer audio tracks, fall back to video
  if (source.trackItems) {
    const audioTrack = source.trackItems.find(item =>
      item.type === 'audio' && item.details?.src
    ) || source.trackItems.find(item =>
      item.type === 'video' && item.details?.src
    );
    if (audioTrack) {
      return audioTrack.details.src;
    }
  }

  // Extract from existing Whisper data
  if (source.whisperData?.audio_url) {
    return source.whisperData.audio_url;
  }

  return null;
}