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
  
  // Update current chunk as video plays
  useEffect(() => {
    if (timeline.current_time !== undefined) {
      if (allChunks.length > 0) {
        console.log('[SimpleCaptionOverlay] Updating chunk for time:', timeline.current_time, 'Total chunks:', allChunks.length);
        updateCurrentChunk(timeline.current_time);
      } else {
        // In fallback mode, just log the time update
        console.log('[SimpleCaptionOverlay] Timeline update (fallback mode):', timeline.current_time);
      }
    }
  }, [timeline.current_time, updateCurrentChunk, allChunks.length]);
  
  // Fallback: If no chunks loaded, create simple chunks from segment text
  const getCurrentSegmentText = () => {
    if (!segments || segments.length === 0) return null;
    
    const currentSegment = segments.find(segment => 
      timeline.current_time >= segment.start_time && 
      timeline.current_time < segment.end_time
    );
    
    if (!currentSegment) return null;
    
    // Create simple time-based chunks from segment text
    const text = currentSegment.text;
    const words = text.split(' ');
    const segmentProgress = (timeline.current_time - currentSegment.start_time) / currentSegment.duration;
    
    // Show different parts of text based on progress through segment
    const wordsPerChunk = 6; // Show 6 words at a time
    const totalChunks = Math.ceil(words.length / wordsPerChunk);
    const currentChunkIndex = Math.min(Math.floor(segmentProgress * totalChunks), totalChunks - 1);
    
    const startWord = currentChunkIndex * wordsPerChunk;
    const endWord = Math.min(startWord + wordsPerChunk, words.length);
    const displayWords = words.slice(startWord, endWord).join(' ');
    
    return {
      text: displayWords,
      lines: [displayWords],
      confidence: 1.0
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