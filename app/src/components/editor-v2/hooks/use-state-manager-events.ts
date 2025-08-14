import { useEffect, useCallback, useRef } from "react";
import StateManager from "@designcombo/state";
import useEditorStore from "../store/use-editor-store";
import { IAudio, ITrackItem, IVideo } from "@designcombo/types";

// Global registry to prevent duplicate subscriptions
const subscriptionRegistry = new WeakMap<StateManager, Set<string>>();

export const useStateManagerEvents = (stateManager: StateManager) => {
	const { setState } = useEditorStore();
	const isSubscribedRef = useRef(false);

	// Handle track item updates
	const handleTrackItemUpdate = useCallback(() => {
		const currentState = stateManager.getState();
		const mergedTrackItemsDeatilsMap = currentState.trackItemsMap;
		
		setState({
			duration: currentState.duration,
			trackItemsMap: currentState.trackItemsMap,
		});
	}, [stateManager, setState]);

	const handleAddRemoveItems = useCallback(() => {
		const currentState = stateManager.getState();
		setState({
			trackItemsMap: currentState.trackItemsMap,
			trackItemIds: currentState.trackItemIds,
			tracks: currentState.tracks,
		});
	}, [stateManager, setState]);

	const handleUpdateItemDetails = useCallback(() => {
		const currentState = stateManager.getState();
		setState({
			trackItemsMap: currentState.trackItemsMap,
		});
	}, [stateManager, setState]);

	useEffect(() => {
		console.log("useStateManagerEvents initialized with StateManager:", stateManager);
		
		// Check if we already have subscriptions for this stateManager
		if (!subscriptionRegistry.has(stateManager)) {
			subscriptionRegistry.set(stateManager, new Set());
		}

		const registry = subscriptionRegistry.get(stateManager);
		if (!registry) return;
		const hookId = "useStateManagerEvents";

		// Prevent duplicate subscriptions
		if (registry.has(hookId)) {
			console.log("Already subscribed to StateManager events");
			return;
		}

		registry.add(hookId);
		isSubscribedRef.current = true;

		console.log("Setting up StateManager event subscriptions...");

		// Subscribe to state update details
		const resizeDesignSubscription = stateManager.subscribeToUpdateStateDetails(
			(newState) => {
				console.log('StateManager state details updated:', newState);
				setState(newState);
			},
		);

		// Subscribe to scale changes
		const scaleSubscription = stateManager.subscribeToScale((newState) => {
			console.log('StateManager scale updated:', newState);
			setState(newState);
		});

		// Subscribe to general state changes (this includes activeIds)
		const tracksSubscription = stateManager.subscribeToState((newState) => {
			console.log('StateManager state updated:', newState);
			setState(newState);
		});

		// Subscribe to duration changes
		const durationSubscription = stateManager.subscribeToDuration(
			(newState) => {
				console.log('StateManager duration updated:', newState);
				setState(newState);
			},
		);

		// Subscribe to track item updates
		const updateTrackItemsMap = stateManager.subscribeToUpdateTrackItem(
			handleTrackItemUpdate,
		);

		// Subscribe to add/remove items
		const itemsDetailsSubscription =
			stateManager.subscribeToAddOrRemoveItems(handleAddRemoveItems);

		// Subscribe to item details updates
		const updateItemDetailsSubscription =
			stateManager.subscribeToUpdateItemDetails(handleUpdateItemDetails);

		console.log("StateManager event subscriptions complete");

		// Cleanup function to unsubscribe from all events
		return () => {
			if (isSubscribedRef.current) {
				console.log("Cleaning up StateManager event subscriptions");
				scaleSubscription.unsubscribe();
				tracksSubscription.unsubscribe();
				durationSubscription.unsubscribe();
				itemsDetailsSubscription.unsubscribe();
				updateTrackItemsMap.unsubscribe();
				updateItemDetailsSubscription.unsubscribe();
				resizeDesignSubscription.unsubscribe();

				// Remove from registry
				registry.delete(hookId);
				isSubscribedRef.current = false;
			}
		};
	}, [
		stateManager,
		setState,
		handleTrackItemUpdate,
		handleAddRemoveItems,
		handleUpdateItemDetails,
	]);
};