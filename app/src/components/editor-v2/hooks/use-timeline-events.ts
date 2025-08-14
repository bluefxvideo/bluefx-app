import useEditorStore from "../store/use-editor-store";
import { useEffect } from "react";
import { filter, subject } from "@designcombo/events";
import { TIMELINE_SEEK, TIMELINE_PREFIX } from "@designcombo/timeline";

const useTimelineEvents = () => {
	const { playerRef, fps, timeline, setState } = useEditorStore();

	//handle timeline and player events
	useEffect(() => {
		const timelineEvents = subject.pipe(
			filter(({ key }) => key.startsWith(TIMELINE_PREFIX)),
		);

		const timelineEventsSubscription = timelineEvents.subscribe((obj) => {
			if (obj.key === TIMELINE_SEEK) {
				const time = obj.value?.payload?.time;
				if (playerRef?.current && typeof time === "number") {
					console.log('Timeline seek to time:', time, 'frame:', (time / 1000) * fps);
					playerRef.current.seekTo((time / 1000) * fps);
				}
			}
		});

		return () => {
			timelineEventsSubscription.unsubscribe();
		};
	}, [playerRef, fps]);
};

export default useTimelineEvents;