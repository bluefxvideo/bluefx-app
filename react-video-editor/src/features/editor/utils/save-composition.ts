import type StateManager from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import type { IDesign } from "@designcombo/types";

/**
 * Save Composition Utility
 * Handles saving the editor state to the BlueFX database via API
 */

export interface SaveCompositionOptions {
  userId: string;
  videoId?: string;
  apiUrl: string;
  metadata?: Record<string, any>;
}

/**
 * Save the current editor composition to the database
 */
export async function saveComposition(
  stateManager: StateManager,
  options: SaveCompositionOptions
): Promise<{ success: boolean; error?: string; compositionId?: string }> {
  
  const { userId, videoId, apiUrl, metadata = {} } = options;
  
  try {
    console.log('💾 Saving composition to database...');
    
    // Get the complete editor state
    const editorState = stateManager.getState();
    
    // Create the composition data structure
    const compositionData: IDesign = {
      id: generateId(),
      ...editorState,
    };
    
    // Prepare the save payload
    const payload = {
      user_id: userId,
      video_id: videoId,
      composition_data: compositionData,
      metadata: {
        ...metadata,
        editor_version: '1.0.0',
        saved_at: new Date().toISOString(),
        track_count: editorState.tracks?.length || 0,
        item_count: editorState.trackItemIds?.length || 0,
        duration: editorState.duration,
        fps: editorState.fps,
        size: editorState.size,
      }
    };
    
    console.log('💾 Sending composition to API...', {
      userId,
      videoId,
      trackCount: payload.metadata.track_count,
      itemCount: payload.metadata.item_count
    });
    
    // Send to the API
    const response = await fetch(`${apiUrl}/api/script-video/save-composition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Save failed:', response.status, errorData);
      throw new Error(`Save failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Save failed');
    }
    
    console.log('✅ Composition saved successfully:', result.data);
    
    return {
      success: true,
      compositionId: result.data.id
    };
    
  } catch (error) {
    console.error('❌ Failed to save composition:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Load a saved composition from the database
 */
export async function loadSavedComposition(options: {
  userId: string;
  videoId?: string;
  compositionId?: string;
  apiUrl: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  
  const { userId, videoId, compositionId, apiUrl } = options;
  
  try {
    console.log('📥 Loading saved composition...');
    
    const params = new URLSearchParams({
      user_id: userId,
      ...(videoId && { video_id: videoId }),
      ...(compositionId && { composition_id: compositionId })
    });
    
    const response = await fetch(`${apiUrl}/api/script-video/save-composition?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Load failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Load failed');
    }
    
    if (!result.data) {
      console.log('📭 No saved composition found');
      return {
        success: true,
        data: null
      };
    }
    
    console.log('✅ Composition loaded successfully:', result.data.id);
    
    return {
      success: true,
      data: result.data.composition_data
    };
    
  } catch (error) {
    console.error('❌ Failed to load composition:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Auto-save functionality with debouncing
 */
export class AutoSaveManager {
  private saveTimer: NodeJS.Timeout | null = null;
  private lastSaveTime: Date | null = null;
  private readonly DEBOUNCE_DELAY = 5000; // 5 seconds
  
  constructor(
    private stateManager: StateManager,
    private options: SaveCompositionOptions
  ) {}
  
  /**
   * Trigger an auto-save (debounced)
   */
  triggerAutoSave() {
    // Clear existing timer
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    // Set new timer
    this.saveTimer = setTimeout(async () => {
      await this.performAutoSave();
    }, this.DEBOUNCE_DELAY);
  }
  
  /**
   * Perform the actual auto-save
   */
  private async performAutoSave() {
    console.log('⏱️ Auto-saving composition...');
    
    const result = await saveComposition(this.stateManager, {
      ...this.options,
      metadata: {
        ...this.options.metadata,
        auto_save: true,
        last_save_time: this.lastSaveTime?.toISOString()
      }
    });
    
    if (result.success) {
      this.lastSaveTime = new Date();
      console.log('✅ Auto-save complete');
    } else {
      console.error('❌ Auto-save failed:', result.error);
    }
  }
  
  /**
   * Force an immediate save
   */
  async saveNow() {
    // Cancel any pending auto-save
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    
    // Perform immediate save
    const result = await saveComposition(this.stateManager, this.options);
    
    if (result.success) {
      this.lastSaveTime = new Date();
    }
    
    return result;
  }
  
  /**
   * Clean up timers
   */
  destroy() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
}