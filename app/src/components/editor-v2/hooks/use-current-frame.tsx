import { CallbackListener, PlayerRef } from "@remotion/player";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Safely gets the current frame from a player reference
 * @param playerRef - The player reference
 * @returns The current frame as a finite number, or 0 if invalid
 */
const getSafeCurrentFrame = (playerRef: React.RefObject<PlayerRef> | null): number => {
	try {
		if (!playerRef?.current) {
			return 0;
		}

		const frame = playerRef.current.getCurrentFrame();

		// Check if frame is a valid finite number
		if (typeof frame !== "number" || !Number.isFinite(frame)) {
			console.warn("getCurrentFrame returned non-finite value:", frame);
			return 0;
		}

		// Ensure frame is non-negative
		return Math.max(0, frame);
	} catch (error) {
		console.error("Error getting current frame:", error);
		return 0;
	}
};

export const useCurrentPlayerFrame = (
	ref: React.RefObject<PlayerRef> | null,
) => {
	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const { current } = ref || {};
			if (!current) {
				return () => undefined;
			}
			const updater: CallbackListener<"frameupdate"> = () => {
				onStoreChange();
			};
			current.addEventListener("frameupdate", updater);
			return () => {
				current.removeEventListener("frameupdate", updater);
			};
		},
		[ref],
	);
	const data = useSyncExternalStore<number>(
		subscribe,
		() => getSafeCurrentFrame(ref),
		() => 0,
	);
	return data;
};