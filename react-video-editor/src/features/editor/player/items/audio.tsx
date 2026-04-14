import { IAudio } from "@designcombo/types";
import { BaseSequence, SequenceItemOptions } from "../base-sequence";
import { Audio as RemotionAudio } from "remotion";

export default function Audio({
	item,
	options,
}: {
	item: IAudio;
	options: SequenceItemOptions;
}) {
	const { fps } = options;
	const { details } = item;
	const playbackRate = item.playbackRate || 1;
	
	// Removed useEffect to prevent React Hooks order issues
	// Audio preloading is now handled globally in the AI asset loader
	
	// Validate trim values to prevent Remotion crash when trim.to < trim.from
	const trimFromFrame = Math.max(0, Math.round((item.trim?.from ?? 0) / 1000 * fps));
	const trimToFrame = Math.max(trimFromFrame + 1, Math.round((item.trim?.to ?? 0) / 1000 * fps));

	const children = (
		<RemotionAudio
			startFrom={trimFromFrame}
			endAt={trimToFrame}
			playbackRate={playbackRate}
			src={details.src}
			volume={(details.volume ?? 100) / 100}
		/>
	);
	return BaseSequence({ item, options, children });
}
