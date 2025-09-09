import StateManager from "@designcombo/state";
import { ITrack } from "@designcombo/types";

/**
 * Remove items from tracks
 * @param tracks - Array of tracks
 * @param itemsToRemove - Array of item IDs to remove
 * @returns Updated tracks array
 */
function removeItemsFromTrack(tracks: ITrack[], itemsToRemove: string[]): ITrack[] {
  return tracks.map(track => ({
    ...track,
    trackItemIds: track.trackItemIds.filter(id => !itemsToRemove.includes(id))
  }));
}

/**
 * Delete selected items from the timeline
 * @param stateManager - The state manager instance
 * @param itemIds - Array of item IDs to delete
 */
export function deleteItems(stateManager: StateManager, itemIds: string[]) {
  if (!itemIds || itemIds.length === 0) {
    console.log("No items to delete");
    return;
  }

  console.log("🗑️ Deleting items:", itemIds);
  
  const currentState = stateManager.getState();
  const { tracks, trackItemsMap, trackItemIds, transitionsMap, transitionIds } = currentState;
  
  // Filter out the items to be deleted
  const newTrackItemIds = trackItemIds.filter(id => !itemIds.includes(id));
  const newTransitionIds = transitionIds.filter(id => !itemIds.includes(id));
  
  // Create new maps without the deleted items
  const newTrackItemsMap = { ...trackItemsMap };
  const newTransitionsMap = { ...transitionsMap };
  
  itemIds.forEach(id => {
    if (newTrackItemsMap[id]) {
      delete newTrackItemsMap[id];
    }
    if (newTransitionsMap[id]) {
      delete newTransitionsMap[id];
    }
  });
  
  // Update tracks to remove the deleted items
  const newTracks = removeItemsFromTrack(tracks, itemIds);
  
  // Update the state
  stateManager.updateState({
    tracks: newTracks,
    trackItemIds: newTrackItemIds,
    trackItemsMap: newTrackItemsMap,
    transitionIds: newTransitionIds,
    transitionsMap: newTransitionsMap,
    activeIds: [] // Clear selection after deletion
  });
  
  console.log("✅ Items deleted successfully");
}