import useStore from "../store/use-store";
import { useEffect } from "react";
import { filter, subject } from "@designcombo/events";
import {
	PLAYER_PAUSE,
	PLAYER_PLAY,
	PLAYER_PREFIX,
	PLAYER_SEEK,
	PLAYER_SEEK_BY,
	PLAYER_TOGGLE_PLAY,
} from "../constants/events";
import { LAYER_PREFIX, LAYER_SELECTION } from "@designcombo/state";
import { TIMELINE_SEEK, TIMELINE_PREFIX } from "@designcombo/timeline";
import { getSafeCurrentFrame } from "../utils/time";

const useTimelineEvents = () => {
	const { playerRef, fps, timeline, setState } = useStore();

	//handle player events
	useEffect(() => {
		const playerEvents = subject.pipe(
			filter(({ key }) => key.startsWith(PLAYER_PREFIX)),
		);
		const timelineEvents = subject.pipe(
			filter(({ key }) => key.startsWith(TIMELINE_PREFIX)),
		);

		const timelineEventsSubscription = timelineEvents.subscribe((obj) => {
			if (obj.key === TIMELINE_SEEK) {
				const time = obj.value?.payload?.time;
				if (playerRef?.current && typeof time === "number") {
					playerRef.current.seekTo((time / 1000) * fps);
				}
			}
		});
		// Remove duplicate player event handling - this is handled in use-player-events.ts
		const playerEventsSubscription = playerEvents.subscribe((obj) => {
			// Only handle timeline-specific player events if needed
			// Core player events (PLAY, PAUSE, SEEK) are handled elsewhere
		});

		return () => {
			playerEventsSubscription.unsubscribe();
			timelineEventsSubscription.unsubscribe();
		};
	}, [playerRef, fps]);

	// handle selection events
	useEffect(() => {
		const selectionEvents = subject.pipe(
			filter(({ key }) => key.startsWith(LAYER_PREFIX)),
		);

		const selectionSubscription = selectionEvents.subscribe((obj) => {
			if (obj.key === LAYER_SELECTION) {
				setState({
					activeIds: obj.value?.payload.activeIds,
				});
			}
		});
		return () => selectionSubscription.unsubscribe();
	}, [timeline]);
};

export default useTimelineEvents;
