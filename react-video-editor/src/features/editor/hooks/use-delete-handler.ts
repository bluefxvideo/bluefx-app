import { useEffect } from "react";
import { filter, subject } from "@designcombo/events";
import { LAYER_DELETE, LAYER_PREFIX } from "@designcombo/state";
import StateManager from "@designcombo/state";
import useStore from "../store/use-store";
import { deleteItems } from "../utils/delete-items";

/**
 * Hook to handle delete events for timeline items
 * @param stateManager - The state manager instance from the editor
 */
export const useDeleteHandler = (stateManager: StateManager) => {
  const { activeIds } = useStore();

  useEffect(() => {
    // Subscribe to layer events
    const layerEvents = subject.pipe(
      filter(({ key }) => key === LAYER_DELETE)
    );

    const deleteSubscription = layerEvents.subscribe((obj) => {
      if (obj.key === LAYER_DELETE) {
        // Get the current active IDs
        const currentActiveIds = useStore.getState().activeIds;
        
        if (currentActiveIds.length > 0) {
          console.log("🗑️ LAYER_DELETE event received - deleting items:", currentActiveIds);
          deleteItems(stateManager, currentActiveIds);
        } else {
          console.log("⚠️ No items selected to delete");
        }
      }
    });

    return () => {
      deleteSubscription.unsubscribe();
    };
  }, [stateManager]);
};