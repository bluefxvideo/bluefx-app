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
    if (playerRef.current) {
      if (playerRef.current.isPlaying()) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
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