import { IVideo } from "@designcombo/types";
import { BaseSequence, SequenceItemOptions } from "../base-sequence";
import { calculateMediaStyles } from "../styles";
import { OffthreadVideo } from "remotion";
import { calculateFrames } from "../../utils/frames";

export const Video = ({
	item,
	options,
}: {
	item: IVideo;
	options: SequenceItemOptions;
}) => {
	const { fps } = options;
	const { details, animations, metadata } = item;
	const playbackRate = item.playbackRate || 1;
	const crop = details?.crop || {
		x: 0,
		y: 0,
		width: details.width,
		height: details.height,
	};
	const { durationInFrames } = calculateFrames(item.display, fps);

	const children = (
		<VideoWithKenBurns
			item={item}
			details={details}
			crop={crop}
			metadata={metadata}
			durationInFrames={durationInFrames}
			fps={fps}
			playbackRate={playbackRate}
		/>
	);

	return BaseSequence({ item, options, children });
};

// Separate component to use hooks properly
import { useCurrentFrame } from "remotion";
import { calculateKenBurnsTransform, KenBurnsConfig } from "../../effects/ken-burns";

function VideoWithKenBurns({
	item,
	details,
	crop,
	metadata,
	durationInFrames,
	fps,
	playbackRate
}: {
	item: IVideo;
	details: any;
	crop: any;
	metadata: any;
	durationInFrames: number;
	fps: number;
	playbackRate: number;
}) {
	const frame = useCurrentFrame();
	
	// Get Ken Burns configuration from metadata
	const kenBurnsConfig: KenBurnsConfig = metadata?.kenBurns || {
		preset: 'none',
		intensity: 20,
		smoothness: 'ease-in-out'
	};
	
	// Calculate Ken Burns transform
	const kenBurnsTransform = calculateKenBurnsTransform(
		frame,
		durationInFrames,
		kenBurnsConfig
	);
	
	// Merge Ken Burns transform with existing styles
	const mediaStyles = {
		...calculateMediaStyles(details, crop),
		// Apply Ken Burns transform if active
		...(kenBurnsConfig.preset !== 'none' && {
			transform: kenBurnsTransform.transform,
			transformOrigin: 'center center'
		})
	};

	return (
		<div style={mediaStyles}>
			<OffthreadVideo
				startFrom={(item.trim?.from! / 1000) * fps}
				endAt={(item.trim?.to! / 1000) * fps || 1 / fps}
				playbackRate={playbackRate}
				src={details.src}
				volume={details.volume || 0 / 100}
			/>
		</div>
	);
}

export default Video;
