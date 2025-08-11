import { create } from 'zustand';

/**
 * Simple Caption Store for Video Player
 * Fetches once, stores in memory, no complexity
 */

interface CaptionChunk {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
  lines?: [string, string?];  // For 2-line display
  confidence: number;
}

interface CaptionStore {
  // Data
  videoId: string | null;
  allChunks: CaptionChunk[];
  currentChunkIndex: number;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadCaptions: (videoId: string) => Promise<void>;
  updateCurrentChunk: (currentTime: number) => void;
  reset: () => void;
}

export const useCaptionStore = create<CaptionStore>((set, get) => ({
  // Initial state
  videoId: null,
  allChunks: [],
  currentChunkIndex: -1,
  isLoading: false,
  error: null,
  
  // Load captions once when video starts
  loadCaptions: async (videoId: string) => {
    // Skip if already loaded for this video
    if (get().videoId === videoId && get().allChunks.length > 0) {
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      // Simple fetch - no real-time needed
      const response = await fetch(`/api/script-video/${videoId}/captions`);
      if (!response.ok) throw new Error('Failed to load captions');
      
      const data = await response.json();
      
      // Flatten all chunks from all segments into single array
      const allChunks: CaptionChunk[] = [];
      
      if (data.segments) {
        data.segments.forEach((segment: any) => {
          if (segment.caption_chunks) {
            allChunks.push(...segment.caption_chunks);
          }
        });
      }
      
      // Sort by start time to ensure correct order
      allChunks.sort((a, b) => a.start_time - b.start_time);
      
      set({
        videoId,
        allChunks,
        currentChunkIndex: -1,
        isLoading: false,
        error: null
      });
      
      console.log(`✅ Loaded ${allChunks.length} caption chunks for video ${videoId}`);
      
    } catch (error) {
      console.error('Failed to load captions:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load captions'
      });
    }
  },
  
  // Update which chunk should be displayed based on current video time
  updateCurrentChunk: (currentTime: number) => {
    const { allChunks, currentChunkIndex } = get();
    
    if (allChunks.length === 0) return;
    
    // Find the chunk that should be displayed at current time
    const newIndex = allChunks.findIndex(chunk => 
      currentTime >= chunk.start_time && currentTime < chunk.end_time
    );
    
    // Only update if changed (avoid unnecessary re-renders)
    if (newIndex !== currentChunkIndex) {
      set({ currentChunkIndex: newIndex });
    }
  },
  
  // Reset store when leaving video player
  reset: () => {
    set({
      videoId: null,
      allChunks: [],
      currentChunkIndex: -1,
      isLoading: false,
      error: null
    });
  }
}));

// Helper hook to get current caption chunk
export function useCurrentCaption() {
  const { allChunks, currentChunkIndex } = useCaptionStore();
  
  if (currentChunkIndex < 0 || currentChunkIndex >= allChunks.length) {
    return null;
  }
  
  return allChunks[currentChunkIndex];
}