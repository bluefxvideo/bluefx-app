'use client';

import { useEffect, useState } from 'react';
import { useVideoEditorStore } from '../store/video-editor-store';

interface Word {
  text: string;
  start_time: number;
  end_time: number;
  confidence: number;
}

interface LipSyncCaptionsProps {
  videoId?: string;
  words?: Word[]; // Word-level timing data from Whisper
}

/**
 * Word-level lip sync captions with highlighting
 * Each word lights up exactly when spoken for perfect sync
 */
export function LipSyncCaptions({ videoId: _videoId, words = [] }: LipSyncCaptionsProps) {
  const { timeline } = useVideoEditorStore();
  const [currentWords, setCurrentWords] = useState<Word[]>([]);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(-1);

  // Get current 6-8 word window for display
  useEffect(() => {
    if (!words.length) return;

    const currentTime = timeline.current_time;
    
    // Find currently active word
    const activeWordIndex = words.findIndex(word => 
      currentTime >= word.start_time && currentTime <= word.end_time
    );

    if (activeWordIndex >= 0) {
      // Show 3 words before and 3 words after current word
      const startIndex = Math.max(0, activeWordIndex - 3);
      const endIndex = Math.min(words.length, activeWordIndex + 4);
      
      const windowWords = words.slice(startIndex, endIndex);
      setCurrentWords(windowWords);
      setHighlightedWordIndex(activeWordIndex - startIndex);
    } else {
      // If no active word, find the closest upcoming words
      const upcomingWordIndex = words.findIndex(word => word.start_time > currentTime);
      if (upcomingWordIndex >= 0) {
        const startIndex = Math.max(0, upcomingWordIndex - 2);
        const endIndex = Math.min(words.length, upcomingWordIndex + 5);
        
        setCurrentWords(words.slice(startIndex, endIndex));
        setHighlightedWordIndex(-1); // No highlight yet
      }
    }
  }, [timeline.current_time, words]);

  // Don't render if no words to show
  if (!currentWords.length) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '10%',
      left: '50%',
      transform: 'translateX(-50%)',
      
      // Container styling
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: '12px 20px',
      borderRadius: '8px',
      maxWidth: '85%',
      textAlign: 'center',
      
      // Typography
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: 1.3,
      
      // Effects
      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)',
      zIndex: 100,
      
      // Smooth transitions
      transition: 'all 0.2s ease-out'
    }}>
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        justifyContent: 'center',
        gap: '6px'
      }}>
        {currentWords.map((word, index) => (
          <span
            key={`${word.start_time}-${index}`}
            style={{
              color: index === highlightedWordIndex 
                ? '#FFD700' // Gold highlight for active word
                : '#FFFFFF', // White for other words
              
              // Active word styling
              backgroundColor: index === highlightedWordIndex 
                ? 'rgba(255, 215, 0, 0.2)' 
                : 'transparent',
              
              // Smooth highlighting animation
              transition: 'all 0.15s ease-in-out',
              transform: index === highlightedWordIndex 
                ? 'scale(1.1)' 
                : 'scale(1)',
              
              // Visual emphasis
              textShadow: index === highlightedWordIndex
                ? '0 0 8px rgba(255, 215, 0, 0.6), 2px 2px 4px rgba(0, 0, 0, 0.9)'
                : '2px 2px 4px rgba(0, 0, 0, 0.9)',
              
              padding: '2px 4px',
              borderRadius: '3px',
              display: 'inline-block'
            }}
          >
            {word.text}
          </span>
        ))}
      </div>
      
      {/* Progress indicator */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          top: -25,
          right: 0,
          fontSize: '10px',
          color: '#4ade80',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: '2px 6px',
          borderRadius: '3px'
        }}>
          Word {highlightedWordIndex + 1}/{currentWords.length}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to extract word-level timing from Whisper data
 */
export function useWordTimings(videoId: string) {
  const [words, setWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!videoId) return;

    const loadWordTimings = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/script-video/${videoId}/word-timings`);
        if (response.ok) {
          const data = await response.json();
          
          // Convert Whisper word data to our format
          const wordTimings: Word[] = [];
          
          if (data.segments) {
            data.segments.forEach((segment: any) => {
              if (segment.words) {
                segment.words.forEach((word: any) => {
                  wordTimings.push({
                    text: word.word || word.text,
                    start_time: word.start,
                    end_time: word.end,
                    confidence: word.confidence || 0.8
                  });
                });
              }
            });
          }
          
          setWords(wordTimings);
          console.log(`✅ Loaded ${wordTimings.length} word timings for lip sync`);
        }
      } catch (error) {
        console.error('Failed to load word timings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWordTimings();
  }, [videoId]);

  return { words, isLoading };
}