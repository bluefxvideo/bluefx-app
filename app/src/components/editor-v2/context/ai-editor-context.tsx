'use client';

import { createContext, useContext, useRef, ReactNode } from 'react';
import { PlayerRef } from '@remotion/player';

export interface AIEditorContextValue {
  // Remotion player reference
  playerRef: React.RefObject<PlayerRef>;
  
  // Timeline canvas reference (will be set by timeline component)
  timelineRef: React.RefObject<HTMLCanvasElement>;
  
  // Scene container reference
  sceneRef: React.RefObject<HTMLDivElement>;
  
  // Helper functions
  seekToFrame: (frame: number) => void;
  togglePlayback: () => void;
  getCurrentFrame: () => number;
}

const AIEditorContext = createContext<AIEditorContextValue | null>(null);

export function AIEditorProvider({ children }: { children: ReactNode }) {
  const playerRef = useRef<PlayerRef>(null);
  const timelineRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  
  const seekToFrame = (frame: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(frame);
    }
  };
  
  const togglePlayback = () => {
    console.log('togglePlayback called');
    console.log('playerRef.current:', playerRef.current);
    
    if (playerRef.current) {
      const isPlaying = playerRef.current.isPlaying();
      console.log('Current playing state:', isPlaying);
      
      if (isPlaying) {
        console.log('Calling player.pause()');
        playerRef.current.pause();
      } else {
        console.log('Calling player.play()');
        playerRef.current.play();
      }
    } else {
      console.error('Player ref is null - player not mounted yet');
    }
  };
  
  const getCurrentFrame = () => {
    return playerRef.current?.getCurrentFrame() || 0;
  };
  
  const contextValue: AIEditorContextValue = {
    playerRef,
    timelineRef,
    sceneRef,
    seekToFrame,
    togglePlayback,
    getCurrentFrame
  };
  
  return (
    <AIEditorContext.Provider value={contextValue}>
      {children}
    </AIEditorContext.Provider>
  );
}

export function useAIEditorContext() {
  const context = useContext(AIEditorContext);
  if (!context) {
    throw new Error('useAIEditorContext must be used within an AIEditorProvider');
  }
  return context;
}