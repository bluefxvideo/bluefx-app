'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Types for our AI-enhanced editor
export interface AITrackItem {
  id: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'ai-generated' | 'caption';
  start: number; // Start time in frames
  duration: number; // Duration in frames
  layer: number; // Z-index for layering
  
  // Standard properties
  details: {
    text?: string;
    src?: string; // URL for media
    volume?: number;
    opacity?: number;
    transform?: {
      x: number;
      y: number;
      scale: number;
      rotation: number;
    };
    // Caption-specific properties (following React Video Editor structure)
    fontSize?: number;
    width?: number;
    fontFamily?: string;
    fontUrl?: string;
    textAlign?: 'left' | 'center' | 'right';
    appearedColor?: string;
    activeColor?: string;
    activeFillColor?: string;
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    height?: number;
    top?: number;
    left?: number;
  };
  
  // AI-specific metadata
  ai_metadata?: {
    generation_settings: {
      voice_settings?: {
        voice_id: string;
        speed: string;
        emotion: string;
      };
      image_settings?: {
        prompt: string;
        enhanced_prompt: string;
        aspect_ratio: string;
        visual_style: string;
      };
      story_context?: {
        characters: any[];
        setting: string;
        mood: string;
      };
    };
    regeneration_count: number;
    last_regenerated: string;
    credits_used: number;
  };
  
  // Caption-specific metadata (following React Video Editor structure)
  caption_metadata?: {
    words: Array<{
      word: string;
      start: number; // Time in milliseconds
      end: number; // Time in milliseconds
      confidence: number; // 0-1 confidence score
    }>;
    sourceUrl?: string; // Associated audio source
    parentId?: string; // ID of parent audio track
  };
}

export interface AIComposition {
  // Remotion-native composition
  composition: {
    id: string;
    durationInFrames: number;
    fps: number;
    width: number;
    height: number;
  };
  
  // Sequences (timeline items)
  sequences: AITrackItem[];
  
  // Assets
  assets: {
    audioUrl?: string;
    imageUrls: string[];
    customAssets: string[];
  };
}

export interface AIVideoEditorState {
  // Project state
  project: {
    id: string | null;
    name: string;
    created_at: string;
    last_modified: string;
  };
  
  // Composition (Remotion-native)
  composition: AIComposition | null;
  
  // Timeline state
  timeline: {
    currentFrame: number;
    isPlaying: boolean;
    zoom: number;
    scrollLeft: number;
    selectedItemIds: string[];
    selectedCaptionSegment: {
      trackId: string;
      segmentIndex: number;
    } | null;
  };
  
  // AI operations state
  ai_operations: {
    isGenerating: boolean;
    isRegenerating: boolean;
    operation_type: string | null;
    selected_item_for_regeneration: string | null;
  };
  
  // UI state
  ui: {
    activePanel: 'assets' | 'text' | 'images' | 'audio' | 'effects';
    showTimeline: boolean;
    sidebarWidth: number;
  };
  
  // Editor initialization
  isInitialized: boolean;
}

export interface AIVideoEditorActions {
  // Initialization
  initializeEditor: (config: {
    width: number;
    height: number;
    fps: number;
    duration: number;
  }) => Promise<void>;
  
  // Project management
  createProject: (name: string) => void;
  loadProject: (projectId: string) => Promise<void>;
  saveProject: () => Promise<void>;
  
  // Composition management
  setComposition: (composition: AIComposition) => void;
  updateCompositionSettings: (settings: Partial<AIComposition['composition']>) => void;
  
  // Track item management
  addTrackItem: (item: Omit<AITrackItem, 'id'>) => string;
  updateTrackItem: (itemId: string, updates: Partial<AITrackItem>) => void;
  removeTrackItem: (itemId: string) => void;
  duplicateTrackItem: (itemId: string) => string;
  
  // Selection management
  selectItems: (itemIds: string[]) => void;
  clearSelection: () => void;
  selectCaptionSegment: (trackId: string, segmentIndex: number) => void;
  clearCaptionSegmentSelection: () => void;
  
  // Timeline controls
  setCurrentFrame: (frame: number) => void;
  play: () => void;
  pause: () => void;
  setZoom: (zoom: number) => void;
  setScrollLeft: (scrollLeft: number) => void;
  
  // AI operations
  regenerateItem: (itemId: string, settings?: any) => Promise<void>;
  generateNewItem: (type: AITrackItem['type'], prompt: string, position: number) => Promise<void>;
  
  // Batch operations
  duplicateSelectedItems: () => void;
  deleteSelectedItems: () => void;
  
  // Mock data operations (development only)
  loadMockCaptionData: () => Promise<void>;
  loadMockData: () => void;
  
  // UI controls
  setActivePanel: (panel: AIVideoEditorState['ui']['activePanel']) => void;
  toggleTimeline: () => void;
}

const initialState: AIVideoEditorState = {
  project: {
    id: null,
    name: 'Untitled Project',
    created_at: new Date().toISOString(),
    last_modified: new Date().toISOString()
  },
  
  composition: null,
  
  timeline: {
    currentFrame: 0,
    isPlaying: false,
    zoom: 1,
    scrollLeft: 0,
    selectedItemIds: [],
    selectedCaptionSegment: null
  },
  
  ai_operations: {
    isGenerating: false,
    isRegenerating: false,
    operation_type: null,
    selected_item_for_regeneration: null
  },
  
  ui: {
    activePanel: 'assets',
    showTimeline: true,
    sidebarWidth: 300
  },
  
  isInitialized: false
};

export const useAIVideoEditorStore = create<AIVideoEditorState & AIVideoEditorActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    // Initialization
    initializeEditor: async (config) => {
      const projectId = crypto.randomUUID();
      const compositionId = `video-${projectId}`;
      
      const composition: AIComposition = {
        composition: {
          id: compositionId,
          durationInFrames: Math.ceil((config.duration / 1000) * config.fps),
          fps: config.fps,
          width: config.width,
          height: config.height
        },
        sequences: [],
        assets: {
          imageUrls: [],
          customAssets: []
        }
      };
      
      set({
        project: {
          id: projectId,
          name: 'AI Video Project',
          created_at: new Date().toISOString(),
          last_modified: new Date().toISOString()
        },
        composition,
        isInitialized: true
      });
    },
    
    // Project management
    createProject: (name) => {
      set((state) => ({
        project: {
          ...state.project,
          id: crypto.randomUUID(),
          name,
          created_at: new Date().toISOString(),
          last_modified: new Date().toISOString()
        }
      }));
    },
    
    loadProject: async (projectId) => {
      // TODO: Implement project loading from database
      console.log('Loading project:', projectId);
    },
    
    saveProject: async () => {
      const state = get();
      // TODO: Implement project saving to database
      console.log('Saving project:', state.project.id);
      
      set((state) => ({
        project: {
          ...state.project,
          last_modified: new Date().toISOString()
        }
      }));
    },
    
    // Composition management
    setComposition: (composition) => {
      set({ composition });
    },
    
    updateCompositionSettings: (settings) => {
      set((state) => ({
        composition: state.composition ? {
          ...state.composition,
          composition: {
            ...state.composition.composition,
            ...settings
          }
        } : null
      }));
    },
    
    // Track item management
    addTrackItem: (item) => {
      const id = crypto.randomUUID();
      const newItem: AITrackItem = {
        ...item,
        id
      };
      
      set((state) => ({
        composition: state.composition ? {
          ...state.composition,
          sequences: [...state.composition.sequences, newItem]
        } : null
      }));
      
      return id;
    },
    
    updateTrackItem: (itemId, updates) => {
      set((state) => ({
        composition: state.composition ? {
          ...state.composition,
          sequences: state.composition.sequences.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
          )
        } : null
      }));
    },
    
    removeTrackItem: (itemId) => {
      set((state) => ({
        composition: state.composition ? {
          ...state.composition,
          sequences: state.composition.sequences.filter(item => item.id !== itemId)
        } : null,
        timeline: {
          ...state.timeline,
          selectedItemIds: state.timeline.selectedItemIds.filter(id => id !== itemId)
        }
      }));
    },
    
    duplicateTrackItem: (itemId) => {
      const state = get();
      const item = state.composition?.sequences.find(s => s.id === itemId);
      if (!item) return '';
      
      const newId = crypto.randomUUID();
      const duplicatedItem: AITrackItem = {
        ...item,
        id: newId,
        start: item.start + item.duration + 30 // Offset by duration + 1 second
      };
      
      set((state) => ({
        composition: state.composition ? {
          ...state.composition,
          sequences: [...state.composition.sequences, duplicatedItem]
        } : null
      }));
      
      return newId;
    },
    
    // Selection management
    selectItems: (itemIds) => {
      set((state) => ({
        timeline: {
          ...state.timeline,
          selectedItemIds: itemIds
        }
      }));
    },
    
    clearSelection: () => {
      set((state) => ({
        timeline: {
          ...state.timeline,
          selectedItemIds: [],
          selectedCaptionSegment: null
        }
      }));
    },
    
    selectCaptionSegment: (trackId, segmentIndex) => {
      set((state) => ({
        timeline: {
          ...state.timeline,
          selectedItemIds: [trackId], // Select the track too
          selectedCaptionSegment: { trackId, segmentIndex }
        }
      }));
    },
    
    clearCaptionSegmentSelection: () => {
      set((state) => ({
        timeline: {
          ...state.timeline,
          selectedCaptionSegment: null
        }
      }));
    },
    
    // Timeline controls
    setCurrentFrame: (frame) => {
      set((state) => ({
        timeline: {
          ...state.timeline,
          currentFrame: frame
        }
      }));
    },
    
    play: () => {
      set((state) => ({
        timeline: {
          ...state.timeline,
          isPlaying: true
        }
      }));
    },
    
    pause: () => {
      set((state) => ({
        timeline: {
          ...state.timeline,
          isPlaying: false
        }
      }));
    },
    
    setZoom: (zoom) => {
      set((state) => ({
        timeline: {
          ...state.timeline,
          zoom
        }
      }));
    },
    
    setScrollLeft: (scrollLeft) => {
      set((state) => ({
        timeline: {
          ...state.timeline,
          scrollLeft
        }
      }));
    },
    
    // AI operations
    regenerateItem: async (itemId, settings) => {
      set((state) => ({
        ai_operations: {
          ...state.ai_operations,
          isRegenerating: true,
          operation_type: 'regenerate',
          selected_item_for_regeneration: itemId
        }
      }));
      
      try {
        // TODO: Implement AI regeneration
        await new Promise(resolve => setTimeout(resolve, 2000)); // Mock delay
        
        // Update item with new generated content
        const state = get();
        const item = state.composition?.sequences.find(s => s.id === itemId);
        if (item) {
          const updates: Partial<AITrackItem> = {
            ai_metadata: {
              ...item.ai_metadata,
              regeneration_count: (item.ai_metadata?.regeneration_count || 0) + 1,
              last_regenerated: new Date().toISOString(),
              generation_settings: { ...item.ai_metadata?.generation_settings, ...settings }
            }
          };
          
          get().updateTrackItem(itemId, updates);
        }
        
      } catch (error) {
        console.error('AI regeneration failed:', error);
      } finally {
        set((state) => ({
          ai_operations: {
            ...state.ai_operations,
            isRegenerating: false,
            operation_type: null,
            selected_item_for_regeneration: null
          }
        }));
      }
    },
    
    generateNewItem: async (type, prompt, position) => {
      set((state) => ({
        ai_operations: {
          ...state.ai_operations,
          isGenerating: true,
          operation_type: 'generate'
        }
      }));
      
      try {
        // TODO: Implement AI generation
        await new Promise(resolve => setTimeout(resolve, 3000)); // Mock delay
        
        const newItem: Omit<AITrackItem, 'id'> = {
          type,
          start: position,
          duration: 150, // 5 seconds at 30fps
          layer: 1,
          details: {
            text: type === 'text' ? 'Generated text' : undefined,
            src: type !== 'text' ? 'https://example.com/generated-asset.jpg' : undefined
          },
          ai_metadata: {
            generation_settings: {},
            regeneration_count: 0,
            last_regenerated: new Date().toISOString(),
            credits_used: 5
          }
        };
        
        get().addTrackItem(newItem);
        
      } catch (error) {
        console.error('AI generation failed:', error);
      } finally {
        set((state) => ({
          ai_operations: {
            ...state.ai_operations,
            isGenerating: false,
            operation_type: null
          }
        }));
      }
    },
    
    // Batch operations for selected items
    duplicateSelectedItems: () => {
      const state = get();
      const selectedIds = state.timeline.selectedItemIds;
      
      selectedIds.forEach(itemId => {
        get().duplicateTrackItem(itemId);
      });
      
      // Clear selection after duplication
      get().clearSelection();
    },
    
    deleteSelectedItems: () => {
      const state = get();
      const selectedIds = state.timeline.selectedItemIds;
      
      selectedIds.forEach(itemId => {
        get().removeTrackItem(itemId);
      });
      
      // Clear selection after deletion
      get().clearSelection();
    },
    
    // Mock data operations (development only)
    loadMockCaptionData: async () => {
      try {
        // Clear existing composition first
        set((state) => ({
          composition: {
            ...state.composition,
            sequences: []
          } as any
        }));
        
        // Import mock caption data (external file)
        const response = await fetch('/mocks/caption-data.json');
        const mockData = await response.json();
        const { sampleCaptions } = mockData;
        
        // Create ONE unified caption track with all segments (professional approach)
        const totalDuration = Math.max(...sampleCaptions.map((c: any) => c.display.to));
        
        // Store all caption segments for dynamic rendering
        const captionSegments = sampleCaptions.map((caption: any) => ({
          start: caption.display.from,
          end: caption.display.to,
          text: caption.details.text,
          words: caption.metadata.words,
          style: {
            fontSize: caption.details.fontSize,
            activeColor: caption.details.activeColor,
            appearedColor: caption.details.appearedColor,
            color: caption.details.color
          }
        }));
        
        // Create ONE unified caption track
        const unifiedCaptionTrack: Omit<AITrackItem, 'id'> = {
          type: 'caption' as const,
          start: 0,
          duration: Math.floor(totalDuration / 1000 * 30),
          layer: 10,
          details: {
            text: "Captions", // Track name
            fontSize: 48,
            width: 800,
            fontFamily: 'Inter',
            textAlign: 'center',
            appearedColor: '#FFFFFF',
            activeColor: '#00FF88',
            activeFillColor: '#FF6B35',
            color: '#E0E0E0',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderColor: '#000000',
            borderWidth: 2,
            top: 1600,
            left: 140
          },
          caption_metadata: {
            segments: captionSegments, // All segments stored internally
            sourceUrl: null,
            parentId: null
          }
        };
        
        // Add unified caption track to composition
        get().addTrackItem(unifiedCaptionTrack);
        
        console.log('Mock caption data loaded successfully');
        
      } catch (error) {
        console.error('Failed to load mock caption data:', error);
      }
    },

    // Create basic mock data for timeline testing - similar to research screenshot
    loadMockData: () => {
      // Add multiple text items like in the research implementation
      const mockItems = [
        {
          type: 'text' as const,
          start: 0,
          duration: 150, // 5 seconds at 30fps
          layer: 1,
          details: {
            text: 'Heading and some body',
            fontSize: 48,
            fontFamily: 'Inter',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            textAlign: 'center' as const,
            width: 800,
            height: 100,
            top: 500,
            left: 560,
            opacity: 1
          }
        },
        {
          type: 'text' as const,
          start: 30,
          duration: 120, // 4 seconds overlapping
          layer: 2,
          details: {
            text: 'Heading and some body',
            fontSize: 48,
            fontFamily: 'Inter',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            textAlign: 'center' as const,
            width: 800,
            height: 100,
            top: 300,
            left: 560,
            opacity: 1
          }
        },
        {
          type: 'text' as const,
          start: 60,
          duration: 90, // 3 seconds overlapping  
          layer: 3,
          details: {
            text: 'Heading and some body',
            fontSize: 48,
            fontFamily: 'Inter',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            textAlign: 'center' as const,
            width: 800,
            height: 100,
            top: 100,
            left: 560,
            opacity: 1
          }
        },
        {
          type: 'image' as const,
          start: 0,
          duration: 180, // 6 seconds, bottom layer
          layer: 0,
          details: {
            src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600',
            width: 800,
            height: 600,
            top: 240,
            left: 560,
            opacity: 1
          }
        }
      ];

      // Add all mock items
      mockItems.forEach(item => {
        get().addTrackItem(item);
      });

      console.log('Mock track data loaded successfully');
    },
    
    // UI controls
    setActivePanel: (panel) => {
      set((state) => ({
        ui: {
          ...state.ui,
          activePanel: panel
        }
      }));
    },
    
    toggleTimeline: () => {
      set((state) => ({
        ui: {
          ...state.ui,
          showTimeline: !state.ui.showTimeline
        }
      }));
    }
  }))
);