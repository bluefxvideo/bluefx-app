import StateManager, { ADD_AUDIO, ADD_IMAGE, ADD_VIDEO, ADD_TEXT, EDIT_OBJECT, DESIGN_LOAD } from '@designcombo/state';
import { dispatch } from '@designcombo/events';
import { ITrackItem } from '@designcombo/types';
import { useAIVideoEditorStore } from '../store/use-ai-video-editor-store';
import { AITrackItemAdapter } from './ai-track-item-adapter';

/**
 * Bridge between @designcombo/state StateManager and our AI Editor Zustand store
 */
export class AIStateManagerBridge {
  private stateManager: StateManager;
  private editorStore: any;

  constructor() {
    // Initialize with default video dimensions
    this.stateManager = new StateManager({
      size: {
        width: 1920,
        height: 1080,
      },
      fps: 30,
    });
    this.editorStore = useAIVideoEditorStore.getState();
    this.setupEventListeners();
  }

  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Initialize the state manager with current composition data
   */
  initialize() {
    const { composition } = this.editorStore;
    if (!composition) return;

    // Convert AI composition to @designcombo format
    const dcItems = AITrackItemAdapter.toDesignComboItems(composition);
    
    // Create a design payload in the format expected by @designcombo
    const designPayload = {
      fps: composition.composition.fps,
      size: {
        width: composition.composition.width,
        height: composition.composition.height,
      },
      trackItemsMap: {},
      trackItemIds: dcItems.map(item => item.id),
      tracks: [
        {
          id: 'main',
          name: 'Main Track',
          locked: false,
          hidden: false,
        }
      ],
    };

    // Create track items map
    dcItems.forEach(item => {
      designPayload.trackItemsMap[item.id] = item;
    });

    // Load the design using the event system
    dispatch(DESIGN_LOAD, { payload: designPayload });
  }

  /**
   * Setup event listeners for state synchronization
   */
  private setupEventListeners() {
    // Listen for timeline changes and sync back to AI store
    this.stateManager.subscribe((state) => {
      const { composition } = useAIVideoEditorStore.getState();
      if (!composition || !state.trackItemsMap) return;

      // Convert trackItemsMap back to array format
      const trackItems = Object.values(state.trackItemsMap);

      // Convert back to AI format and update store
      const updatedComposition = AITrackItemAdapter.updateComposition(
        composition,
        trackItems
      );

      useAIVideoEditorStore.getState().setComposition(updatedComposition);
    });

    // Subscribe to AI store changes and sync to state manager (optional - avoid circular updates)
    // This would be used when the AI store changes from outside the timeline
  }

  /**
   * Add item to timeline via state manager
   */
  addItem(type: 'text' | 'image' | 'video' | 'audio', data: any) {
    const { composition } = this.editorStore;
    if (!composition) return;

    const payload = {
      id: crypto.randomUUID(),
      type,
      display: {
        from: 0,
        to: 5000, // 5 seconds default
      },
      details: data,
      metadata: {
        resourceId: data.src || '',
        duration: 5000,
      },
    };

    switch (type) {
      case 'text':
        dispatch(ADD_TEXT, { payload });
        break;
      case 'image':
        dispatch(ADD_IMAGE, { payload });
        break;
      case 'video':
        dispatch(ADD_VIDEO, { payload });
        break;
      case 'audio':
        dispatch(ADD_AUDIO, { payload });
        break;
    }
  }

  /**
   * Edit item properties
   */
  editItem(itemId: string, updates: Partial<ITrackItem>) {
    dispatch(EDIT_OBJECT, {
      payload: {
        [itemId]: updates,
      },
    });
  }

  /**
   * Get current timeline items in @designcombo format
   */
  getTimelineItems(): ITrackItem[] {
    const state = this.stateManager.getState();
    return Object.values(state.trackItemsMap || {});
  }

  /**
   * Update timeline with new items (use events instead of direct calls)
   */
  updateTimelineItems(items: ITrackItem[]) {
    // Use event system to update items
    const trackItemsMap: Record<string, ITrackItem> = {};
    items.forEach(item => {
      trackItemsMap[item.id] = item;
    });

    this.stateManager.updateState({
      trackItemsMap,
      trackItemIds: items.map(item => item.id)
    });
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Add cleanup logic if needed
  }
}

// Singleton instance
let stateManagerBridge: AIStateManagerBridge | null = null;

export function getStateManagerBridge(): AIStateManagerBridge {
  if (!stateManagerBridge) {
    stateManagerBridge = new AIStateManagerBridge();
  }
  return stateManagerBridge;
}

export function initializeStateManager() {
  const bridge = getStateManagerBridge();
  bridge.initialize();
  return bridge;
}