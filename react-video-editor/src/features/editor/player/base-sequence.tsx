import { ISize, ITrackItem } from "@designcombo/types";
import { AbsoluteFill, Sequence } from "remotion";
import { calculateFrames } from "../utils/frames";
import { calculateContainerStyles } from "./styles";

export interface SequenceItemOptions {
	handleTextChange?: (id: string, text: string) => void;
	fps: number;
	editableTextId?: string | null;
	currentTime?: number;
	zIndex?: number;
	onTextBlur?: (id: string, text: string) => void;
	size?: ISize;
	frame?: number;
	isTransition?: boolean;
	/** Number of frames to extend this sequence beyond its natural end (for crossfade overlap) */
	extraDurationFrames?: number;
	/** Number of frames to fade in at the start (crossfade from previous image) */
	fadeInFrames?: number;
}

export const BaseSequence = ({
	item,
	options,
	children,
}: {
	item: ITrackItem;
	options: SequenceItemOptions;
	children: React.ReactNode;
}) => {
	const { details } = item as ITrackItem;
	const { fps, isTransition, extraDurationFrames } = options;
	const { from, durationInFrames } = calculateFrames(
		{
			from: item.display.from,
			to: item.display.to,
		},
		fps,
	);
	const crop = details.crop || {
		x: 0,
		y: 0,
		width: item.details.width,
		height: item.details.height,
	};

	// Extend duration for crossfade overlap (outgoing image stays visible longer)
	// Ensure minimum 1 frame to prevent Remotion crash
	const totalDuration = Math.max(1, Math.round((durationInFrames || 1) + (extraDurationFrames || 0)));

	return (
		<Sequence
			key={item.id}
			from={from}
			durationInFrames={totalDuration}
			style={{
				pointerEvents: "none",
			}}
		>
			<AbsoluteFill
				id={item.id}
				data-track-item="transition-element"
				className={`designcombo-scene-item id-${item.id} designcombo-scene-item-type-${item.type}`}
				style={calculateContainerStyles(details, crop, {
					pointerEvents: item.type === "audio" ? "none" : "auto",
				})}
			>
				{children}
			</AbsoluteFill>
		</Sequence>
	);
};
