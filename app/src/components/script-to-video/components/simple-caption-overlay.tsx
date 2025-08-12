'use client';

import { useEffect } from 'react';
import { useCaptionStore, useCurrentCaption } from '../store/caption-store';
import { useVideoEditorStore } from '../store/video-editor-store';

/**
 * Simple Caption Overlay Component
 * Shows professional 2-8 word chunks that change every 1-3 seconds
 * No complexity - just fetch once and display based on timeline
 */
export function SimpleCaptionOverlay({ videoId }: { videoId?: string }) {
  const { timeline, settings, segments } = useVideoEditorStore();
  const { loadCaptions, updateCurrentChunk, allChunks } = useCaptionStore();
  const currentCaption = useCurrentCaption();
  
  // Load captions once when component mounts (if videoId provided)
  useEffect(() => {
    if (videoId) {
      console.log('[SimpleCaptionOverlay] Loading captions for video:', videoId);
      loadCaptions(videoId);
    } else {
      console.log('[SimpleCaptionOverlay] No videoId provided, using fallback mode');
    }
  }, [videoId, loadCaptions]);
  
  // Update current chunk as video plays - FIXED: Direct timeline lookup
  useEffect(() => {
    if (timeline.current_time !== undefined) {
      if (allChunks.length > 0) {
        console.log('[SimpleCaptionOverlay] Updating chunk for ABSOLUTE time:', timeline.current_time, 'Total chunks:', allChunks.length);
        // FIXED: Direct timeline.current_time lookup (no segment calculation)
        updateCurrentChunk(timeline.current_time);
      } else {
        console.log('[SimpleCaptionOverlay] Timeline update (fallback mode):', timeline.current_time);
      }
    }
  }, [timeline.current_time, updateCurrentChunk, allChunks.length]);
  
  // FIXED: Improved fallback with absolute timing
  const getCurrentSegmentText = () => {
    if (!segments || segments.length === 0) return null;
    
    const currentSegment = segments.find(segment => 
      timeline.current_time >= segment.start_time && 
      timeline.current_time < segment.end_time
    );
    
    if (!currentSegment) return null;
    
    // FIXED: Create chunks with absolute timing (no segment-relative calculation)
    const text = currentSegment.text;
    const words = text.split(' ');
    
    // Use absolute time within segment for consistent display
    const timeIntoSegment = timeline.current_time - currentSegment.start_time;
    const segmentProgress = Math.min(1, Math.max(0, timeIntoSegment / currentSegment.duration));
    
    // Show progressive text reveal based on absolute time
    const wordsPerChunk = 6;
    const totalChunks = Math.ceil(words.length / wordsPerChunk);
    const currentChunkIndex = Math.min(Math.floor(segmentProgress * totalChunks), totalChunks - 1);
    
    const startWord = currentChunkIndex * wordsPerChunk;
    const endWord = Math.min(startWord + wordsPerChunk, words.length);
    const displayWords = words.slice(startWord, endWord).join(' ');
    
    console.log(`[Fallback] Time: ${timeline.current_time.toFixed(2)}s, Segment: ${currentSegment.start_time}-${currentSegment.end_time}, Progress: ${(segmentProgress*100).toFixed(1)}%, Text: "${displayWords}"`);
    
    return {
      text: displayWords,
      lines: [displayWords],
      confidence: 0.7 // Lower confidence for fallback
    };
  };
  
  // Use loaded caption chunks if available, otherwise fallback to segment text
  const captionToShow = currentCaption || getCurrentSegmentText();
  
  // Don't render if no caption
  if (!captionToShow) {
    return null;
  }
  
  // Simple styling - no complex animations
  const captionStyle = {
    position: 'absolute' as const,
    bottom: '10%',
    left: '50%',
    transform: 'translateX(-50%)',
    
    // Text styling
    color: settings.colors?.text_color || '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: '8px 16px',
    borderRadius: '4px',
    
    // Font
    fontFamily: settings.typography?.font_family || 'Arial, sans-serif',
    fontSize: '18px',
    fontWeight: 600,
    textAlign: 'center' as const,
    lineHeight: 1.4,
    
    // Ensure readability
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
    maxWidth: '80%',
    zIndex: 100
  };
  
  
  // Confidence indicator (optional - for debugging)
  const showConfidence = process.env.NODE_ENV === 'development';
  
  return (
    <div style={captionStyle}>
      {captionToShow.lines && captionToShow.lines.length > 1 ? (
        <>
          <div>{captionToShow.lines[0]}</div>
          {captionToShow.lines[1] && <div>{captionToShow.lines[1]}</div>}
        </>
      ) : (
        <div>{captionToShow.text}</div>
      )}
      
      {showConfidence && (
        <div style={{
          position: 'absolute',
          top: -20,
          right: 0,
          fontSize: '10px',
          color: captionToShow.confidence > 0.8 ? '#4ade80' : '#fbbf24',
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: '2px 4px',
          borderRadius: '2px'
        }}>
          {(captionToShow.confidence * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}

/**
 * Hook for video player to integrate captions
 */
export function useCaptions(videoId: string) {
  const { loadCaptions, updateCurrentChunk, reset } = useCaptionStore();
  const currentCaption = useCurrentCaption();
  
  useEffect(() => {
    // Load captions when video ID changes
    if (videoId) {
      loadCaptions(videoId);
    }
    
    // Cleanup on unmount
    return () => {
      reset();
    };
  }, [videoId, loadCaptions, reset]);
  
  return {
    currentCaption,
    updateTime: updateCurrentChunk
  };
}